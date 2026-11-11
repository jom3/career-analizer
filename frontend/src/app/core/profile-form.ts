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
import {
  commaSeparatedMaxLength,
  optionalIntegerRange,
  optionalUrl,
  trimmedRequired,
} from './validators';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;
export const MAX_METRICS = 5;

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
  metrics?: string[];
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
  showInCompactCv?: boolean;
  showInDocumentedCv?: boolean;
  documentName?: string | null;
  source?: Source;
}

export interface CertificationInput {
  id?: string | null;
  name?: string | null;
  issuer?: string | null;
  year?: number | null;
  url?: string | null;
  showInCompactCv?: boolean;
  showInDocumentedCv?: boolean;
  documentName?: string | null;
  source?: Source;
}

export interface ProjectInput {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  description?: string | null;
  url?: string | null;
  techStack?: string[];
  metrics?: string[];
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
  metrics: FormArray<FormControl<string>>;
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
  showInCompactCv: FormControl<boolean>;
  showInDocumentedCv: FormControl<boolean>;
  documentName: FormControl<string>;
  source: FormControl<Source>;
}>;

export type CertificationForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  issuer: FormControl<string>;
  year: FormControl<number | null>;
  url: FormControl<string>;
  showInCompactCv: FormControl<boolean>;
  showInDocumentedCv: FormControl<boolean>;
  documentName: FormControl<string>;
  source: FormControl<Source>;
}>;

export type ProjectForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  role: FormControl<string>;
  description: FormControl<string>;
  url: FormControl<string>;
  techStack: FormControl<string>;
  metrics: FormArray<FormControl<string>>;
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

export function newMetricForm(value = ''): FormControl<string> {
  return new FormControl<string>(value, { nonNullable: true });
}

// Solo fechas ISO completas: una fecha parcial haría fallar el guardado.
function toDateInput(value?: string | null): string {
  if (!value) {
    return '';
  }
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function toYear(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
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
      validators: [Validators.maxLength(2048), optionalUrl],
    }),
    linkedin: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(2048), optionalUrl],
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
      validators: [trimmedRequired, Validators.maxLength(120)],
    }),
    position: new FormControl<string>(item?.position ?? '', {
      nonNullable: true,
      validators: [trimmedRequired, Validators.maxLength(120)],
    }),
    location: new FormControl<string>(item?.location ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
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
      validators: [Validators.maxLength(2000)],
    }),
    metrics: new FormArray<FormControl<string>>(
      (item?.metrics ?? [])
        .slice(0, MAX_METRICS)
        .map((metric) => newMetricForm(metric)),
    ),
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
      validators: [trimmedRequired, Validators.maxLength(60)],
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
      validators: [trimmedRequired, Validators.maxLength(120)],
    }),
    institution: new FormControl<string>(item?.institution ?? '', {
      nonNullable: true,
      validators: [trimmedRequired, Validators.maxLength(120)],
    }),
    field: new FormControl<string>(item?.field ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
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
      validators: [Validators.maxLength(2000)],
    }),
    showInCompactCv: new FormControl<boolean>(item?.showInCompactCv ?? true, {
      nonNullable: true,
    }),
    showInDocumentedCv: new FormControl<boolean>(
      item?.showInDocumentedCv ?? true,
      { nonNullable: true },
    ),
    documentName: new FormControl<string>(item?.documentName ?? '', {
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
      validators: [trimmedRequired, Validators.maxLength(120)],
    }),
    issuer: new FormControl<string>(item?.issuer ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    year: new FormControl<number | null>(toYear(item?.year), {
      validators: [optionalIntegerRange(1900, 2100)],
    }),
    url: new FormControl<string>(item?.url ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(2048), optionalUrl],
    }),
    showInCompactCv: new FormControl<boolean>(item?.showInCompactCv ?? true, {
      nonNullable: true,
    }),
    showInDocumentedCv: new FormControl<boolean>(
      item?.showInDocumentedCv ?? true,
      { nonNullable: true },
    ),
    documentName: new FormControl<string>(item?.documentName ?? '', {
      nonNullable: true,
    }),
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
      validators: [trimmedRequired, Validators.maxLength(120)],
    }),
    role: new FormControl<string>(item?.role ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    description: new FormControl<string>(item?.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    url: new FormControl<string>(item?.url ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(2048), optionalUrl],
    }),
    techStack: new FormControl<string>((item?.techStack ?? []).join(', '), {
      nonNullable: true,
      validators: [commaSeparatedMaxLength(60)],
    }),
    metrics: new FormArray<FormControl<string>>(
      (item?.metrics ?? [])
        .slice(0, MAX_METRICS)
        .map((metric) => newMetricForm(metric)),
    ),
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
      validators: [trimmedRequired, Validators.maxLength(60)],
    }),
    level: new FormControl<string>(item?.level ?? 'B1', { nonNullable: true }),
    source: new FormControl<Source>(item?.source ?? 'USER', {
      nonNullable: true,
    }),
  });
}

// Cada lista se reemplaza por una instancia nueva: el input de las secciones
// cambia de referencia y la vista se vuelve a renderizar (necesario para
// habilitar el adjunto de un ítem recién guardado con id).

export function loadProfileForm(form: ProfileForm, profile: Profile): void {
  form.patchValue({
    headline: profile.headline ?? '',
    phone: profile.phone ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
    linkedin: profile.linkedin ?? '',
    summary: profile.summary ?? '',
  });
  form.setControl(
    'experiences',
    new FormArray<ExperienceForm>(profile.experiences.map(newExperienceForm)),
  );
  form.setControl(
    'skills',
    new FormArray<SkillForm>(profile.skills.map(newSkillForm)),
  );
  form.setControl(
    'education',
    new FormArray<EducationForm>(profile.education.map(newEducationForm)),
  );
  form.setControl(
    'certifications',
    new FormArray<CertificationForm>(
      profile.certifications.map(newCertificationForm),
    ),
  );
  form.setControl(
    'projects',
    new FormArray<ProjectForm>(profile.projects.map(newProjectForm)),
  );
  form.setControl(
    'languages',
    new FormArray<LanguageForm>(profile.languages.map(newLanguageForm)),
  );
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
  form.setControl(
    'experiences',
    new FormArray<ExperienceForm>(
      (draft.experiences ?? []).map(newExperienceForm),
    ),
  );
  form.setControl(
    'skills',
    new FormArray<SkillForm>((draft.skills ?? []).map(newSkillForm)),
  );
  form.setControl(
    'education',
    new FormArray<EducationForm>((draft.education ?? []).map(newEducationForm)),
  );
  form.setControl(
    'certifications',
    new FormArray<CertificationForm>(
      (draft.certifications ?? []).map(newCertificationForm),
    ),
  );
  form.setControl(
    'projects',
    new FormArray<ProjectForm>((draft.projects ?? []).map(newProjectForm)),
  );
  form.setControl(
    'languages',
    new FormArray<LanguageForm>((draft.languages ?? []).map(newLanguageForm)),
  );
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
      metrics: item.metrics.map((m) => m.trim()).filter((m) => m.length > 0),
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
      showInCompactCv: item.showInCompactCv,
      showInDocumentedCv: item.showInDocumentedCv,
      source: item.source,
      sortOrder: index,
    })),
    certifications: v.certifications.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      issuer: item.issuer.trim() || null,
      year: item.year || null,
      url: item.url.trim() || null,
      showInCompactCv: item.showInCompactCv,
      showInDocumentedCv: item.showInDocumentedCv,
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
      metrics: item.metrics.map((m) => m.trim()).filter((m) => m.length > 0),
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
