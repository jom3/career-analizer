import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import type {
  Language,
  Profile,
  ProfilePayload,
  Source,
} from './models/profile';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;

// Tipos de entrada relajados (nullable) para aceptar tanto items de /profile
// como borradores de CV importado (SPEC 06), cuyos campos pueden venir null.
export interface ExperienceInput {
  id?: string | null;
  company?: string | null;
  position?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
  description?: string | null;
  source?: Source;
}

export interface SkillInput {
  id?: string | null;
  name?: string | null;
  level?: number | null;
  source?: Source;
}

export interface EducationInput {
  id?: string | null;
  degree?: string | null;
  institution?: string | null;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
  description?: string | null;
  source?: Source;
}

export interface CertificationInput {
  id?: string | null;
  name?: string | null;
  issuer?: string | null;
  year?: number | null;
  url?: string | null;
  source?: Source;
}

export interface ProjectInput {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  description?: string | null;
  url?: string | null;
  techStack?: string[];
  source?: Source;
}

export interface LanguageInput {
  id?: string | null;
  name?: string | null;
  level?: string | null;
  source?: Source;
}

// Estructura del borrador de CV importado (misma forma que Profile sin id).
export interface CvDraftInput {
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  linkedin?: string | null;
  summary?: string | null;
  experiences?: ExperienceInput[];
  skills?: SkillInput[];
  education?: EducationInput[];
  certifications?: CertificationInput[];
  projects?: ProjectInput[];
  languages?: LanguageInput[];
}

export type ExperienceForm = FormGroup<{
  id: FormControl<string | null>;
  company: FormControl<string>;
  position: FormControl<string>;
  location: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  current: FormControl<boolean>;
  description: FormControl<string>;
  source: FormControl<Source>;
}>;

export type SkillForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  level: FormControl<number>;
  source: FormControl<Source>;
}>;

export type EducationForm = FormGroup<{
  id: FormControl<string | null>;
  degree: FormControl<string>;
  institution: FormControl<string>;
  field: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  current: FormControl<boolean>;
  description: FormControl<string>;
  source: FormControl<Source>;
}>;

export type CertificationForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  issuer: FormControl<string>;
  year: FormControl<number | null>;
  url: FormControl<string>;
  source: FormControl<Source>;
}>;

export type ProjectForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  role: FormControl<string>;
  description: FormControl<string>;
  url: FormControl<string>;
  techStack: FormControl<string>;
  source: FormControl<Source>;
}>;

export type LanguageForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  level: FormControl<string>;
  source: FormControl<Source>;
}>;

export type ProfileForm = FormGroup<{
  headline: FormControl<string>;
  phone: FormControl<string>;
  location: FormControl<string>;
  website: FormControl<string>;
  linkedin: FormControl<string>;
  summary: FormControl<string>;
  experiences: FormArray<ExperienceForm>;
  skills: FormArray<SkillForm>;
  education: FormArray<EducationForm>;
  certifications: FormArray<CertificationForm>;
  projects: FormArray<ProjectForm>;
  languages: FormArray<LanguageForm>;
}>;

// FormGroup con un campo `endDate`: ExperienceForm y EducationForm comparten
// el comportamiento de deshabilitar la fecha de fin cuando `current` es true.
export interface CurrentDateGroup {
  controls: {
    endDate: FormControl<string>;
  };
}

export function syncEndDate(group: CurrentDateGroup, checked: boolean): void {
  if (checked) {
    group.controls.endDate.disable();
  } else {
    group.controls.endDate.enable();
  }
}

function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function buildProfileForm(): ProfileForm {
  return new FormGroup({
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
}

export function newExperienceForm(item?: ExperienceInput): ExperienceForm {
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
    endDate: new FormControl<string>(
      {
        value: toDateInput(item?.endDate),
        disabled: item?.current === true,
      },
      { nonNullable: true },
    ),
    current: new FormControl<boolean>(item?.current ?? false, {
      nonNullable: true,
    }),
    description: new FormControl<string>(item?.description ?? '', {
      nonNullable: true,
    }),
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

export function newSkillForm(item?: SkillInput): SkillForm {
  return new FormGroup({
    id: new FormControl<string | null>(item?.id ?? null),
    name: new FormControl<string>(item?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    level: new FormControl<number>(item?.level ?? 3, { nonNullable: true }),
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

export function newEducationForm(item?: EducationInput): EducationForm {
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
    endDate: new FormControl<string>(
      {
        value: toDateInput(item?.endDate),
        disabled: item?.current === true,
      },
      { nonNullable: true },
    ),
    current: new FormControl<boolean>(item?.current ?? false, {
      nonNullable: true,
    }),
    description: new FormControl<string>(item?.description ?? '', {
      nonNullable: true,
    }),
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

export function newCertificationForm(
  item?: CertificationInput,
): CertificationForm {
  return new FormGroup({
    id: new FormControl<string | null>(item?.id ?? null),
    name: new FormControl<string>(item?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    issuer: new FormControl<string>(item?.issuer ?? '', { nonNullable: true }),
    year: new FormControl<number | null>(item?.year ?? null),
    url: new FormControl<string>(item?.url ?? '', { nonNullable: true }),
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

export function newProjectForm(item?: ProjectInput): ProjectForm {
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
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

export function newLanguageForm(item?: LanguageInput): LanguageForm {
  return new FormGroup({
    id: new FormControl<string | null>(item?.id ?? null),
    name: new FormControl<string>(item?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    level: new FormControl<string>(item?.level ?? 'B1', { nonNullable: true }),
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

function clearAndPush<T extends AbstractControl, I>(
  array: FormArray<T>,
  factory: (item?: I) => T,
  items: I[],
): void {
  array.clear();
  for (const item of items) {
    array.push(factory(item));
  }
}

export function loadProfileForm(form: ProfileForm, profile: Profile): void {
  form.patchValue({
    headline: profile.headline ?? '',
    phone: profile.phone ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
    linkedin: profile.linkedin ?? '',
    summary: profile.summary ?? '',
  });
  clearAndPush(form.controls.experiences, newExperienceForm, profile.experiences);
  clearAndPush(form.controls.skills, newSkillForm, profile.skills);
  clearAndPush(form.controls.education, newEducationForm, profile.education);
  clearAndPush(
    form.controls.certifications,
    newCertificationForm,
    profile.certifications,
  );
  clearAndPush(form.controls.projects, newProjectForm, profile.projects);
  clearAndPush(form.controls.languages, newLanguageForm, profile.languages);
}

export function loadCvDraftForm(form: ProfileForm, draft: CvDraftInput): void {
  form.patchValue({
    headline: draft.headline ?? '',
    phone: draft.phone ?? '',
    location: draft.location ?? '',
    website: draft.website ?? '',
    linkedin: draft.linkedin ?? '',
    summary: draft.summary ?? '',
  });
  clearAndPush(
    form.controls.experiences,
    newExperienceForm,
    draft.experiences ?? [],
  );
  clearAndPush(form.controls.skills, newSkillForm, draft.skills ?? []);
  clearAndPush(form.controls.education, newEducationForm, draft.education ?? []);
  clearAndPush(
    form.controls.certifications,
    newCertificationForm,
    draft.certifications ?? [],
  );
  clearAndPush(form.controls.projects, newProjectForm, draft.projects ?? []);
  clearAndPush(form.controls.languages, newLanguageForm, draft.languages ?? []);
}

export function profileFormToPayload(form: ProfileForm): ProfilePayload {
  const v = form.getRawValue();
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
      source: item.source,
      sortOrder: index,
    })),
    skills: v.skills.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      level: item.level,
      source: item.source,
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
      source: item.source,
      sortOrder: index,
    })),
    certifications: v.certifications.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      issuer: item.issuer.trim() || null,
      year: item.year || null,
      url: item.url.trim() || null,
      source: item.source,
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
      source: item.source,
      sortOrder: index,
    })),
    languages: v.languages.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      level: item.level as Language['level'],
      source: item.source,
      sortOrder: index,
    })),
  };
}
