import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { merge, Subscription } from 'rxjs';
import { apiErrorKey } from '../core/http-errors';
import type { Profile } from '../core/models/profile';
import {
  experienceDuplicateKey,
  findDuplicates,
  skillDuplicateKey,
} from '../core/duplicates';
import { overlappingExperiences } from '../core/overlap-warning';
import {
  buildProfileForm,
  loadProfileForm,
  type CertificationForm,
  type EducationForm,
  type ExperienceForm,
  type LanguageForm,
  type ProfileForm,
  type ProjectForm,
  type SkillForm,
} from '../core/profile-form';
import { I18nService, type UiLang } from '../core/i18n/i18n.service';
import { ProfileService } from '../core/profile.service';
import { CvExportService, CvExportFormat } from '../core/cv-export.service';
import {
  applyLangToForm,
  buildBilingualPayload,
  emptyLangValues,
  extractLangFromForm,
  extractLangValues,
  hasContent,
  type LangValues,
} from '../core/bilingual-form';
import { CertificationsSectionComponent } from '../shared/profile-form/certifications-section.component';
import { EducationSectionComponent } from '../shared/profile-form/education-section.component';
import { ExperienceSectionComponent } from '../shared/profile-form/experience-section.component';
import { LanguagesSectionComponent } from '../shared/profile-form/languages-section.component';
import { PersonalInfoSectionComponent } from '../shared/profile-form/personal-info-section.component';
import { ProjectsSectionComponent } from '../shared/profile-form/projects-section.component';
import { SkillsSectionComponent } from '../shared/profile-form/skills-section.component';
import { SummarySectionComponent } from '../shared/profile-form/summary-section.component';

@Component({
  selector: 'app-profile',
  imports: [
    ReactiveFormsModule,
    PersonalInfoSectionComponent,
    SummarySectionComponent,
    ExperienceSectionComponent,
    SkillsSectionComponent,
    EducationSectionComponent,
    CertificationsSectionComponent,
    ProjectsSectionComponent,
    LanguagesSectionComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly profileService = inject(ProfileService);
  private readonly cvExportService = inject(CvExportService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly downloading = signal<'pdf' | 'docx' | null>(null);
  readonly errorMessage = signal('');
  readonly loadError = signal('');
  readonly duplicateSkillIndices = signal<ReadonlySet<number>>(new Set());
  readonly duplicateExperienceIndices = signal<ReadonlySet<number>>(new Set());
  readonly overlapIndices = signal<ReadonlySet<number>>(new Set());
  readonly activeLang = signal<UiLang>(this.i18n.lang());
  readonly translating = signal(false);

  private sideStore: LangValues = emptyLangValues();

  readonly form: ProfileForm = buildProfileForm();

  private duplicateSubscription?: Subscription;

  get experiences(): FormArray<ExperienceForm> {
    return this.form.controls.experiences;
  }
  get skills(): FormArray<SkillForm> {
    return this.form.controls.skills;
  }
  get education(): FormArray<EducationForm> {
    return this.form.controls.education;
  }
  get certifications(): FormArray<CertificationForm> {
    return this.form.controls.certifications;
  }
  get projects(): FormArray<ProjectForm> {
    return this.form.controls.projects;
  }
  get languages(): FormArray<LanguageForm> {
    return this.form.controls.languages;
  }

  get otherLang(): UiLang {
    return this.activeLang() === 'es' ? 'en' : 'es';
  }

  isActiveLang(lang: UiLang): boolean {
    return this.activeLang() === lang;
  }

  translateButtonKey(): string {
    return this.otherLang === 'en'
      ? 'profile.translateToEn'
      : 'profile.translateToEs';
  }

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.profileService.getProfile();
      this.applyProfile(profile);
    } catch {
      this.loadError.set(this.i18n.t('profile.loadError'));
    } finally {
      this.loading.set(false);
    }
    this.refreshDuplicates();
    // merge, no combineLatest: cada colección debe recalcular por su cuenta.
    this.duplicateSubscription = merge(
      this.experiences.valueChanges,
      this.skills.valueChanges,
    ).subscribe(() => this.refreshDuplicates());
    this.experiences.valueChanges.subscribe(() => this.refreshOverlaps());
  }

  // Aplica un perfil cargado/guardado al editor: determina la pestaña activa
  // (idioma de la UI si tiene contenido, si no el idioma de origen), llena el
  // side-store con el idioma inactivo y muestra el idioma activo en el form.
  private applyProfile(profile: Profile): void {
    const ui = this.i18n.lang();
    const uiValues = extractLangValues(profile, ui);
    const esValues = extractLangValues(profile, 'es');
    const enValues = extractLangValues(profile, 'en');
    const active = hasContent(uiValues)
      ? ui
      : hasContent(esValues)
        ? 'es'
        : hasContent(enValues)
          ? 'en'
          : ui;
    this.activeLang.set(active);
    this.sideStore = extractLangValues(profile, active === 'es' ? 'en' : 'es');
    loadProfileForm(this.form, profile);
    applyLangToForm(this.form, extractLangValues(profile, active));
  }

  onSelectLang(lang: UiLang): void {
    if (lang === this.activeLang()) {
      return;
    }
    const currentFormValues = extractLangFromForm(this.form);
    const incomingValues = this.sideStore;
    this.sideStore = currentFormValues;
    this.activeLang.set(lang);
    applyLangToForm(this.form, incomingValues);
  }

  async onTranslate(): Promise<void> {
    const target = this.otherLang;
    const source = this.activeLang();
    this.translating.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    try {
      const profile = await this.profileService.translateProfile(target, source);
      const sourceValues = extractLangFromForm(this.form);
      this.sideStore = sourceValues;
      this.activeLang.set(target);
      applyLangToForm(this.form, extractLangValues(profile, target));
    } catch {
      this.errorMessage.set(this.i18n.t('profile.translateError'));
    } finally {
      this.translating.set(false);
    }
  }

  ngOnDestroy(): void {
    this.duplicateSubscription?.unsubscribe();
  }

  private refreshOverlaps(): void {
    const experiences = this.experiences.controls.map((group) => ({
      startDate: group.controls.startDate.value,
      endDate: group.controls.endDate.value,
      current: group.controls.current.value,
    }));
    const pairs = overlappingExperiences(experiences);
    const involved = new Set<number>();
    for (const [first, second] of pairs) {
      involved.add(first);
      involved.add(second);
    }
    this.overlapIndices.set(involved);
  }

  private refreshDuplicates(): void {
    const skills = this.skills.controls.map((group) => ({
      name: group.controls.name.value,
    }));
    const experiences = this.experiences.controls.map((group) => ({
      company: group.controls.company.value,
      position: group.controls.position.value,
      startDate: group.controls.startDate.value,
      endDate: group.controls.endDate.value,
    }));
    const result = findDuplicates({ skills, experiences });
    const skillKeys = new Set(result.skills.map((group) => group.key));
    const experienceKeys = new Set(
      result.experiences.map((group) => group.key),
    );

    this.duplicateSkillIndices.set(
      this.indexSet(skills, skillKeys, skillDuplicateKey),
    );
    this.duplicateExperienceIndices.set(
      this.indexSet(experiences, experienceKeys, experienceDuplicateKey),
    );
  }

  private indexSet<T>(
    items: T[],
    keys: Set<string>,
    toKey: (item: T) => string,
  ): Set<number> {
    const indices = new Set<number>();
    items.forEach((item, index) => {
      if (keys.has(toKey(item))) {
        indices.add(index);
      }
    });
    return indices;
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.t('profile.saveErrorInvalid'));
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    try {
      const payload = buildBilingualPayload(
        this.form,
        this.activeLang(),
        this.sideStore,
      );
      const profile = await this.profileService.putProfile(payload);
      this.applyProfile(profile);
      this.saved.set(true);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  async onDownload(format: CvExportFormat): Promise<void> {
    this.downloading.set(format);
    this.errorMessage.set('');
    try {
      await this.cvExportService.download(format);
    } catch {
      this.errorMessage.set(this.i18n.t('profile.downloadError'));
    } finally {
      this.downloading.set(null);
    }
  }

  private messageFor(error: unknown): string {
    const mapped = apiErrorKey(error);
    if (mapped) return this.i18n.t(mapped);
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return this.i18n.t('profile.saveError400');
    }
    return this.i18n.t('profile.saveError');
  }
}
