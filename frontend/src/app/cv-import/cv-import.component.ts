import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CvImportService } from '../core/cv-import.service';
import type { AtsCheckItem } from '../core/models/cv-import';
import {
  CEFR_LEVELS,
  SKILL_LEVELS,
  buildProfileForm,
  loadCvDraftForm,
  newCertificationForm,
  newEducationForm,
  newExperienceForm,
  newLanguageForm,
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
import { ProfileService } from '../core/profile.service';

@Component({
  selector: 'app-cv-import',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cv-import.component.html',
  styleUrl: './cv-import.component.scss',
})
export class CvImportComponent implements OnInit {
  private readonly cvImportService = inject(CvImportService);
  private readonly profileService = inject(ProfileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly cefrLevels = CEFR_LEVELS;
  readonly skillLevels = SKILL_LEVELS;

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

  removeAt(array: FormArray, index: number): void {
    array.removeAt(index);
  }

  onCurrentChange(
    group: ExperienceForm | EducationForm,
    event: Event,
  ): void {
    syncEndDate(group, (event.target as HTMLInputElement).checked);
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
      this.errorMessage.set(
        'Completá los campos obligatorios marcados antes de confirmar.',
      );
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
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        return 'El borrador ya no existe. Subí el CV nuevamente.';
      }
      if (error.status === 413) {
        return 'El archivo supera el límite de 10 MB.';
      }
      if (error.status === 422) {
        return 'No se pudo extraer texto del archivo. Puede ser un PDF escaneado sin capa de texto.';
      }
      const backendMessage = (error.error as { message?: string | string[] })
        ?.message;
      if (typeof backendMessage === 'string' && backendMessage.length > 0) {
        return backendMessage;
      }
      if (Array.isArray(backendMessage) && backendMessage.length > 0) {
        return backendMessage.join(', ');
      }
      if (error.status === 400) {
        return 'El archivo debe ser PDF o DOCX y pesar menos de 10 MB.';
      }
    }
    return 'No se pudo procesar el archivo. Intentalo de nuevo.';
  }
}
