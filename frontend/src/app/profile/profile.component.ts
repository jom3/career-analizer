import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import type { Profile } from '../core/models/profile';
import {
  experienceDuplicateKey,
  findDuplicates,
  skillDuplicateKey,
} from '../core/duplicates';
import { overlappingExperiences } from '../core/overlap-warning';
import {
  CEFR_LEVELS,
  SKILL_LEVELS,
  buildProfileForm,
  loadProfileForm,
  newCertificationForm,
  newEducationForm,
  newExperienceForm,
  newLanguageForm,
  newMetricForm,
  newProjectForm,
  newSkillForm,
  profileFormToPayload,
  syncEndDate,
  type CertificationForm,
  type EducationForm,
  type ExperienceForm,
  type LanguageForm,
  type ProfileForm,
  type ProjectForm,
  type SkillForm,
} from '../core/profile-form';
import { I18nService } from '../core/i18n/i18n.service';
import { ProfileService } from '../core/profile.service';
import { CvExportService, CvExportFormat } from '../core/cv-export.service';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly profileService = inject(ProfileService);
  private readonly cvExportService = inject(CvExportService);

  readonly cefrLevels = CEFR_LEVELS;
  readonly skillLevels = SKILL_LEVELS;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly downloading = signal<'pdf' | 'docx' | null>(null);
  readonly errorMessage = signal('');
  readonly loadError = signal('');
  readonly duplicateKeys = signal<{
    skills: Set<string>;
    experiences: Set<string>;
  }>({ skills: new Set(), experiences: new Set() });
  readonly overlapIndices = signal<Set<number>>(new Set());

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

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.profileService.getProfile();
      loadProfileForm(this.form, profile);
    } catch {
      this.loadError.set(this.i18n.t('profile.loadError'));
    } finally {
      this.loading.set(false);
    }
    this.refreshDuplicates();
    this.duplicateSubscription = combineLatest([
      this.experiences.valueChanges,
      this.skills.valueChanges,
    ]).subscribe(() => this.refreshDuplicates());
    this.experiences.valueChanges.subscribe(() => this.refreshOverlaps());
  }

  ngOnDestroy(): void {
    this.duplicateSubscription?.unsubscribe();
  }

  isSkillDuplicate(index: number): boolean {
    const group = this.skills.controls[index];
    const key = skillDuplicateKey({ name: group.controls.name.value });
    return this.duplicateKeys().skills.has(key);
  }

  isExperienceDuplicate(index: number): boolean {
    const group = this.experiences.controls[index];
    const key = experienceDuplicateKey({
      company: group.controls.company.value,
      position: group.controls.position.value,
      startDate: group.controls.startDate.value,
      endDate: group.controls.endDate.value,
    });
    return this.duplicateKeys().experiences.has(key);
  }

  isExperienceOverlapping(index: number): boolean {
    return this.overlapIndices().has(index);
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
    this.duplicateKeys.set({
      skills: new Set(result.skills.map((group) => group.key)),
      experiences: new Set(result.experiences.map((group) => group.key)),
    });
  }

  addExperience(): void {
    this.experiences.push(newExperienceForm());
  }
  addSkill(): void {
    this.skills.push(newSkillForm());
  }
  addEducation(): void {
    this.education.push(newEducationForm());
  }
  addCertification(): void {
    this.certifications.push(newCertificationForm());
  }
  addProject(): void {
    this.projects.push(newProjectForm());
  }
  addLanguage(): void {
    this.languages.push(newLanguageForm());
  }

  addMetric(group: ExperienceForm | ProjectForm): void {
    group.controls.metrics.push(newMetricForm());
  }

  removeMetric(group: ExperienceForm | ProjectForm, index: number): void {
    group.controls.metrics.removeAt(index);
  }

  removeAt(array: FormArray, index: number): void {
    array.removeAt(index);
  }

  onCurrentChange(
    group: ExperienceForm | EducationForm,
    event: Event,
  ): void {
    syncEndDate(group, (event.target as HTMLInputElement).checked);
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
      const profile = await this.profileService.putProfile(
        profileFormToPayload(this.form),
      );
      loadProfileForm(this.form, profile);
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
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return this.i18n.t('profile.saveError400');
    }
    return this.i18n.t('profile.saveError');
  }
}