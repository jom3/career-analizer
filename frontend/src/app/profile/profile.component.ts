import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type {
  Certification,
  Education,
  Experience,
  Language,
  Profile,
  ProfilePayload,
  Project,
  Skill,
} from '../core/models/profile';
import { ProfileService } from '../core/profile.service';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;

type ExperienceForm = FormGroup<{
  id: FormControl<string | null>;
  company: FormControl<string>;
  position: FormControl<string>;
  location: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  current: FormControl<boolean>;
  description: FormControl<string>;
}>;

type SkillForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  level: FormControl<number>;
}>;

type EducationForm = FormGroup<{
  id: FormControl<string | null>;
  degree: FormControl<string>;
  institution: FormControl<string>;
  field: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  current: FormControl<boolean>;
  description: FormControl<string>;
}>;

type CertificationForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  issuer: FormControl<string>;
  year: FormControl<number | null>;
  url: FormControl<string>;
}>;

type ProjectForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  role: FormControl<string>;
  description: FormControl<string>;
  url: FormControl<string>;
  techStack: FormControl<string>;
}>;

type LanguageForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  level: FormControl<string>;
}>;

function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  readonly cefrLevels = CEFR_LEVELS;
  readonly skillLevels = SKILL_LEVELS;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');
  readonly loadError = signal('');

  readonly form = new FormGroup({
    headline: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(30)],
    }),
    location: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    website: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(2048)],
    }),
    linkedin: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(2048)],
    }),
    summary: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    experiences: new FormArray<ExperienceForm>([]),
    skills: new FormArray<SkillForm>([]),
    education: new FormArray<EducationForm>([]),
    certifications: new FormArray<CertificationForm>([]),
    projects: new FormArray<ProjectForm>([]),
    languages: new FormArray<LanguageForm>([]),
  });

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
      this.loadForm(profile);
    } catch {
      this.loadError.set('No se pudo cargar tu perfil.');
    } finally {
      this.loading.set(false);
    }
  }

  addExperience(): void {
    this.experiences.push(this.newExperienceForm());
  }
  addSkill(): void {
    this.skills.push(this.newSkillForm());
  }
  addEducation(): void {
    this.education.push(this.newEducationForm());
  }
  addCertification(): void {
    this.certifications.push(this.newCertificationForm());
  }
  addProject(): void {
    this.projects.push(this.newProjectForm());
  }
  addLanguage(): void {
    this.languages.push(this.newLanguageForm());
  }

  removeAt(array: FormArray, index: number): void {
    array.removeAt(index);
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
      const profile = await this.profileService.putProfile(this.toPayload());
      this.loadForm(profile);
      this.saved.set(true);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  private loadForm(profile: Profile): void {
    this.form.patchValue({
      headline: profile.headline ?? '',
      phone: profile.phone ?? '',
      location: profile.location ?? '',
      website: profile.website ?? '',
      linkedin: profile.linkedin ?? '',
      summary: profile.summary ?? '',
    });
    this.experiences.clear();
    for (const item of profile.experiences) {
      this.experiences.push(this.newExperienceForm(item));
    }
    this.skills.clear();
    for (const item of profile.skills) {
      this.skills.push(this.newSkillForm(item));
    }
    this.education.clear();
    for (const item of profile.education) {
      this.education.push(this.newEducationForm(item));
    }
    this.certifications.clear();
    for (const item of profile.certifications) {
      this.certifications.push(this.newCertificationForm(item));
    }
    this.projects.clear();
    for (const item of profile.projects) {
      this.projects.push(this.newProjectForm(item));
    }
    this.languages.clear();
    for (const item of profile.languages) {
      this.languages.push(this.newLanguageForm(item));
    }
  }

  private toPayload(): ProfilePayload {
    const v = this.form.getRawValue();
    return {
      headline: v.headline.trim() || null,
      phone: v.phone.trim() || null,
      location: v.location.trim() || null,
      website: v.website.trim() || null,
      linkedin: v.linkedin.trim() || null,
      summary: v.summary.trim() || null,
      experiences: v.experiences.map((item, index) => ({
        id: item.id ?? undefined,
        company: item.company.trim(),
        position: item.position.trim(),
        location: item.location.trim() || null,
        startDate: item.startDate || null,
        endDate: item.current ? null : item.endDate || null,
        current: item.current,
        description: item.description.trim() || null,
        sortOrder: index,
      })),
      skills: v.skills.map((item, index) => ({
        id: item.id ?? undefined,
        name: item.name.trim(),
        level: item.level,
        sortOrder: index,
      })),
      education: v.education.map((item, index) => ({
        id: item.id ?? undefined,
        degree: item.degree.trim(),
        institution: item.institution.trim(),
        field: item.field.trim() || null,
        startDate: item.startDate || null,
        endDate: item.current ? null : item.endDate || null,
        current: item.current,
        description: item.description.trim() || null,
        sortOrder: index,
      })),
      certifications: v.certifications.map((item, index) => ({
        id: item.id ?? undefined,
        name: item.name.trim(),
        issuer: item.issuer.trim() || null,
        year: item.year || null,
        url: item.url.trim() || null,
        sortOrder: index,
      })),
      projects: v.projects.map((item, index) => ({
        id: item.id ?? undefined,
        name: item.name.trim(),
        role: item.role.trim() || null,
        description: item.description.trim() || null,
        url: item.url.trim() || null,
        techStack: item.techStack
          .split(',')
          .map((tech) => tech.trim())
          .filter((tech) => tech.length > 0),
        sortOrder: index,
      })),
      languages: v.languages.map((item, index) => ({
        id: item.id ?? undefined,
        name: item.name.trim(),
        level: item.level as Language['level'],
        sortOrder: index,
      })),
    };
  }

  private newExperienceForm(item?: Experience): ExperienceForm {
    return new FormGroup({
      id: new FormControl<string | null>(item?.id ?? null),
      company: new FormControl<string>(item?.company ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      position: new FormControl<string>(item?.position ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      location: new FormControl<string>(item?.location ?? '', {
        nonNullable: true,
      }),
      startDate: new FormControl<string>(toDateInput(item?.startDate), {
        nonNullable: true,
      }),
      endDate: new FormControl<string>(toDateInput(item?.endDate), {
        nonNullable: true,
      }),
      current: new FormControl<boolean>(item?.current ?? false, {
        nonNullable: true,
      }),
      description: new FormControl<string>(item?.description ?? '', {
        nonNullable: true,
      }),
    });
  }

  private newSkillForm(item?: Skill): SkillForm {
    return new FormGroup({
      id: new FormControl<string | null>(item?.id ?? null),
      name: new FormControl<string>(item?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      level: new FormControl<number>(item?.level ?? 3, { nonNullable: true }),
    });
  }

  private newEducationForm(item?: Education): EducationForm {
    return new FormGroup({
      id: new FormControl<string | null>(item?.id ?? null),
      degree: new FormControl<string>(item?.degree ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      institution: new FormControl<string>(item?.institution ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      field: new FormControl<string>(item?.field ?? '', { nonNullable: true }),
      startDate: new FormControl<string>(toDateInput(item?.startDate), {
        nonNullable: true,
      }),
      endDate: new FormControl<string>(toDateInput(item?.endDate), {
        nonNullable: true,
      }),
      current: new FormControl<boolean>(item?.current ?? false, {
        nonNullable: true,
      }),
      description: new FormControl<string>(item?.description ?? '', {
        nonNullable: true,
      }),
    });
  }

  private newCertificationForm(item?: Certification): CertificationForm {
    return new FormGroup({
      id: new FormControl<string | null>(item?.id ?? null),
      name: new FormControl<string>(item?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      issuer: new FormControl<string>(item?.issuer ?? '', { nonNullable: true }),
      year: new FormControl<number | null>(item?.year ?? null),
      url: new FormControl<string>(item?.url ?? '', { nonNullable: true }),
    });
  }

  private newProjectForm(item?: Project): ProjectForm {
    return new FormGroup({
      id: new FormControl<string | null>(item?.id ?? null),
      name: new FormControl<string>(item?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      role: new FormControl<string>(item?.role ?? '', { nonNullable: true }),
      description: new FormControl<string>(item?.description ?? '', {
        nonNullable: true,
      }),
      url: new FormControl<string>(item?.url ?? '', { nonNullable: true }),
      techStack: new FormControl<string>((item?.techStack ?? []).join(', '), {
        nonNullable: true,
      }),
    });
  }

  private newLanguageForm(item?: Language): LanguageForm {
    return new FormGroup({
      id: new FormControl<string | null>(item?.id ?? null),
      name: new FormControl<string>(item?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      level: new FormControl<string>(item?.level ?? 'B1', { nonNullable: true }),
    });
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Hay campos inválidos. Revisá los formularios.';
    }
    return 'No se pudo guardar el perfil. Intentalo de nuevo.';
  }
}
