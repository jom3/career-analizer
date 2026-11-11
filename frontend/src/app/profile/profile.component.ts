import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { Subscription } from 'rxjs';
import { apiCodeKey, apiErrorKey } from '../core/http-errors';
import type { Profile } from '../core/models/profile';
import { experienceDuplicateKey, findDuplicates, skillDuplicateKey } from '../core/duplicates';
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
import {
  describeBackendError,
  describeFormError,
  findFirstInvalidPath,
} from '../core/profile-errors';
import {
  CvDownloadError,
  CvExportService,
  type CvDocumentPath,
  type CvExportFormat,
} from '../core/cv-export.service';
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
import { PhotoSectionComponent } from '../shared/profile-form/photo-section.component';
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
    PhotoSectionComponent,
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
  readonly downloading = signal<string | null>(null);
  readonly hasPhoto = signal(false);
  readonly errorMessage = signal('');
  readonly loadError = signal('');
  readonly duplicateSkillIndices = signal<ReadonlySet<number>>(new Set());
  readonly duplicateExperienceIndices = signal<ReadonlySet<number>>(new Set());
  readonly overlapIndices = signal<ReadonlySet<number>>(new Set());
  readonly activeLang = signal<UiLang>(this.i18n.lang());
  readonly translating = signal(false);
  readonly unsaved = signal(false);

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
    return this.otherLang === 'en' ? 'profile.translateToEn' : 'profile.translateToEs';
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
    // Se escucha el formulario completo: al cargar el perfil las listas se
    // reemplazan por instancias nuevas y las suscripciones por lista quedarían
    // apuntando a las viejas.
    this.duplicateSubscription = this.form.valueChanges.subscribe(() => {
      this.refreshDuplicates();
      this.refreshOverlaps();
      this.unsaved.set(true);
      this.saved.set(false);
    });
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
    this.hasPhoto.set(Boolean(profile.photoMimeType));
    loadProfileForm(this.form, profile);
    applyLangToForm(this.form, extractLangValues(profile, active));
    this.unsaved.set(false);
  }

  onSelectLang(lang: UiLang): void {
    if (lang === this.activeLang()) {
      return;
    }
    const wasUnsaved = this.unsaved();
    const currentFormValues = extractLangFromForm(this.form);
    const incomingValues = this.sideStore;
    this.sideStore = currentFormValues;
    this.activeLang.set(lang);
    applyLangToForm(this.form, incomingValues);
    // Cambiar de pestaña no modifica el perfil: se conserva el estado previo.
    this.unsaved.set(wasUnsaved);
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
    const experienceKeys = new Set(result.experiences.map((group) => group.key));

    this.duplicateSkillIndices.set(this.indexSet(skills, skillKeys, skillDuplicateKey));
    this.duplicateExperienceIndices.set(
      this.indexSet(experiences, experienceKeys, experienceDuplicateKey),
    );
  }

  private indexSet<T>(items: T[], keys: Set<string>, toKey: (item: T) => string): Set<number> {
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
      const path = findFirstInvalidPath(this.form);
      this.errorMessage.set(
        describeFormError(this.form, this.i18n) ??
          this.i18n.t('profile.saveErrorInvalid'),
      );
      if (path) {
        this.scrollToError(path);
      }
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    try {
      const payload = buildBilingualPayload(this.form, this.activeLang(), this.sideStore);
      const profile = await this.profileService.putProfile(payload);
      this.applyProfile(profile);
      this.saved.set(true);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  async onDownload(
    format: CvExportFormat,
    documentPath: CvDocumentPath = 'cv-export',
  ): Promise<void> {
    this.downloading.set(downloadKey(documentPath, format));
    this.errorMessage.set('');
    try {
      await this.cvExportService.download(format, documentPath);
    } catch (error) {
      const key = error instanceof CvDownloadError ? apiCodeKey(error.code) : null;
      this.errorMessage.set(this.i18n.t(key ?? 'profile.downloadError'));
    } finally {
      this.downloading.set(null);
    }
  }

  isDownloading(documentPath: CvDocumentPath, format: CvExportFormat): boolean {
    return this.downloading() === downloadKey(documentPath, format);
  }

  private messageFor(error: unknown): string {
    const mapped = apiErrorKey(error);
    if (mapped) return this.i18n.t(mapped);
    const described = describeBackendError(error, this.i18n);
    if (described) return described;
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return this.i18n.t('profile.saveError400');
    }
    return this.i18n.t('profile.saveError');
  }

  private scrollToError(path: string[]): void {
    const [section, index] = path;
    const prefix = SECTION_PREFIXES[section];
    const itemId =
      prefix && index !== undefined && /^\d+$/.test(index)
        ? `${prefix}-item-${index}`
        : null;
    setTimeout(() => {
      const target =
        (itemId ? document.getElementById(itemId) : null) ??
        document.querySelector<HTMLElement>(`[formcontrolname="${section}"]`) ??
        document.querySelector<HTMLElement>('.profile-form');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }
}

// Prefijo de los ids de tarjeta de cada sección (ver section-utils).
const SECTION_PREFIXES: Record<string, string> = {
  experiences: 'experience',
  skills: 'skill',
  education: 'education',
  certifications: 'certification',
  projects: 'project',
  languages: 'language',
};

function downloadKey(documentPath: CvDocumentPath, format: CvExportFormat): string {
  return `${documentPath}/${format}`;
}
