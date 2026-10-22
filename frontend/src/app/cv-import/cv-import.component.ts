import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { apiErrorKey } from '../core/http-errors';
import { CvImportService } from '../core/cv-import.service';
import type { AtsCheckItem } from '../core/models/cv-import';
import { I18nService } from '../core/i18n/i18n.service';
import {
  buildProfileForm,
  loadCvDraftForm,
  profileFormToPayload,
  type CertificationForm,
  type EducationForm,
  type ExperienceForm,
  type LanguageForm,
  type ProfileForm,
  type ProjectForm,
  type SkillForm,
} from '../core/profile-form';
import { ProfileService } from '../core/profile.service';
import { CertificationsSectionComponent } from '../shared/profile-form/certifications-section.component';
import { EducationSectionComponent } from '../shared/profile-form/education-section.component';
import { ExperienceSectionComponent } from '../shared/profile-form/experience-section.component';
import { LanguagesSectionComponent } from '../shared/profile-form/languages-section.component';
import { PersonalInfoSectionComponent } from '../shared/profile-form/personal-info-section.component';
import { ProjectsSectionComponent } from '../shared/profile-form/projects-section.component';
import { SkillsSectionComponent } from '../shared/profile-form/skills-section.component';
import { SummarySectionComponent } from '../shared/profile-form/summary-section.component';

@Component({
  selector: 'app-cv-import',
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
  templateUrl: './cv-import.component.html',
  styleUrl: './cv-import.component.scss',
})
export class CvImportComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly cvImportService = inject(CvImportService);
  private readonly profileService = inject(ProfileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly uploading = signal(false);
  readonly loadingDraft = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');
  readonly dragOver = signal(false);

  readonly documentId = signal<string | null>(null);
  readonly originalName = signal('');
  readonly atsReport = signal<AtsCheckItem[]>([]);

  readonly form: ProfileForm = buildProfileForm();

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
    const documentId = this.route.snapshot.queryParamMap.get('document');
    if (!documentId) {
      this.loadingDraft.set(false);
      return;
    }
    await this.recoverDraft(documentId);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.upload(file);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.upload(file);
    }
  }

  reset(): void {
    this.form.reset();
    this.documentId.set(null);
    this.originalName.set('');
    this.atsReport.set([]);
    this.errorMessage.set('');
    this.saved.set(false);
    void this.router.navigate(['/cv-import'], {
      queryParams: { document: null },
      queryParamsHandling: 'merge',
    });
  }

  async onConfirm(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.t('cvImport.confirmError'));
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    try {
      await this.profileService.putProfile(profileFormToPayload(this.form));
      this.saved.set(true);
      await this.router.navigate(['/profile']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async upload(file: File): Promise<void> {
    this.uploading.set(true);
    this.errorMessage.set('');
    try {
      const result = await this.cvImportService.upload(file);
      this.documentId.set(result.documentId);
      this.originalName.set(file.name);
      this.atsReport.set(result.atsReport);
      loadCvDraftForm(this.form, result.draft);
      await this.router.navigate([], {
        queryParams: { document: result.documentId },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.uploading.set(false);
    }
  }

  private async recoverDraft(documentId: string): Promise<void> {
    this.loadingDraft.set(true);
    try {
      const document = await this.cvImportService.getDocument(documentId);
      this.documentId.set(document.id);
      this.originalName.set(document.originalName);
      loadCvDraftForm(this.form, document.draftJson);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
      await this.router.navigate(['/cv-import'], {
        queryParams: { document: null },
        queryParamsHandling: 'merge',
      });
    } finally {
      this.loadingDraft.set(false);
    }
  }

  private messageFor(error: unknown): string {
    const mapped = apiErrorKey(error);
    if (mapped) return this.i18n.t(mapped);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        return this.i18n.t('cvImport.error404');
      }
      if (error.status === 422) {
        return this.i18n.t('cvImport.error422');
      }
      if (error.status === 413) {
        return this.i18n.t('cvImport.error413');
      }
      if (error.status === 400) {
        return this.i18n.t('cvImport.error400');
      }
    }
    return this.i18n.t('cvImport.errorGeneric');
  }
}