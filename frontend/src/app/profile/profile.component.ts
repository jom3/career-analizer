import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Profile } from '../core/models/profile';
import {
  CEFR_LEVELS,
  SKILL_LEVELS,
  buildProfileForm,
  loadProfileForm,
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
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);

  readonly cefrLevels = CEFR_LEVELS;
  readonly skillLevels = SKILL_LEVELS;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');
  readonly loadError = signal('');

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
    try {
      const profile = await this.profileService.getProfile();
      loadProfileForm(this.form, profile);
    } catch {
      this.loadError.set('No se pudo cargar tu perfil.');
    } finally {
      this.loading.set(false);
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

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set('Completá los campos obligatorios de las secciones.');
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

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Hay campos inválidos. Revisá los formularios.';
    }
    return 'No se pudo guardar el perfil. Intentalo de nuevo.';
  }
}
