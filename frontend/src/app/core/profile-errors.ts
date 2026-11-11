import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormGroup } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import type { I18nService } from './i18n/i18n.service';

const SECTION_KEYS: Record<string, string> = {
  experiences: 'profile.experience',
  skills: 'profile.skill',
  education: 'profile.education',
  certifications: 'profile.certification',
  projects: 'profile.project',
  languages: 'profile.language',
};

const FIELD_KEYS: Record<string, string> = {
  headline: 'profile.headline',
  phone: 'profile.phone',
  location: 'profile.location',
  website: 'profile.website',
  linkedin: 'profile.linkedin',
  summary: 'profile.summary',
  company: 'profile.company',
  position: 'profile.position',
  startDate: 'profile.from',
  endDate: 'profile.to',
  current: 'profile.currentJob',
  description: 'profile.description',
  degree: 'profile.degree',
  institution: 'profile.institution',
  field: 'profile.field',
  issuer: 'profile.issuer',
  year: 'profile.year',
  url: 'profile.url',
  role: 'profile.role',
  techStack: 'profile.techStack',
  level: 'profile.level',
  metrics: 'profile.metrics',
  showInCompactCv: 'profile.showInCompactCv',
  showInDocumentedCv: 'profile.showInDocumentedCv',
};

// El campo `name` se etiqueta distinto según la sección.
const NAME_KEYS: Record<string, string> = {
  certifications: 'profile.certName',
  projects: 'profile.projectName',
  skills: 'profile.name',
  languages: 'profile.name',
};

// Traduce el primer mensaje de un 400 del backend a algo legible con la
// sección, el ítem y el campo afectados.
export function describeBackendError(
  error: unknown,
  i18n: I18nService,
): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return null;
  }
  const body = error.error as { message?: unknown } | null;
  const raw = body?.message;
  const messages = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const message = messages.find((item): item is string => typeof item === 'string');
  if (!message) {
    return null;
  }
  const parsed = /^(?:([a-zA-Z]+)\.(\d+)\.)?([a-zA-Z]+)\s+(.+)$/.exec(message);
  if (!parsed) {
    return null;
  }
  const [, section, index, field, rule] = parsed;
  return describeField(
    section ?? null,
    index ? Number(index) : null,
    field,
    describeRule(rule, i18n),
    i18n,
  );
}

// Encuentra el primer control inválido del formulario y lo describe.
export function describeFormError(
  form: FormGroup,
  i18n: I18nService,
  section: string | null = null,
): string | null {
  const path = findFirstInvalidPath(form);
  if (!path) {
    return null;
  }
  const control = controlAt(form, path);
  const rule = describeControlErrors(control?.errors ?? null, control?.value, i18n);
  if (section) {
    return describeField(section, null, path[path.length - 1], rule, i18n);
  }
  const [head, index, ...rest] = path;
  if (index !== undefined && /^\d+$/.test(index) && SECTION_KEYS[head]) {
    return describeField(head, Number(index), rest[0] ?? '', rule, i18n);
  }
  return describeField(null, null, path[path.length - 1], rule, i18n);
}

function describeField(
  section: string | null,
  index: number | null,
  field: string,
  rule: string,
  i18n: I18nService,
): string {
  const label = fieldLabel(section, field, i18n);
  if (section && index !== null) {
    return `${i18n.t(SECTION_KEYS[section])} ${index + 1} · ${label}: ${rule}`;
  }
  if (section) {
    return `${i18n.t(SECTION_KEYS[section])} · ${label}: ${rule}`;
  }
  return `${label}: ${rule}`;
}

function fieldLabel(
  section: string | null,
  field: string,
  i18n: I18nService,
): string {
  if (field === 'name' && section && NAME_KEYS[section]) {
    return i18n.t(NAME_KEYS[section]);
  }
  const key = FIELD_KEYS[field];
  return key ? i18n.t(key) : field;
}

function describeRule(rule: string, i18n: I18nService): string {
  const amount = /(-?\d+)/.exec(rule)?.[1];
  if (rule.includes('integer')) {
    return i18n.t('validation.integer');
  }
  if (rule.includes('URL')) {
    return i18n.t('validation.url');
  }
  if (rule.includes('ISO 8601')) {
    return i18n.t('validation.date');
  }
  if (rule.includes('should not be empty')) {
    return i18n.t('validation.required');
  }
  if (rule.startsWith('must not be greater than')) {
    return withValue(i18n.t('validation.max'), amount);
  }
  if (rule.startsWith('must not be less than')) {
    return withValue(i18n.t('validation.min'), amount);
  }
  if (rule.startsWith('must be shorter than or equal to')) {
    return withValue(i18n.t('validation.maxLength'), amount);
  }
  if (rule.startsWith('must contain no more than')) {
    return withValue(i18n.t('validation.maxItems'), amount);
  }
  return i18n.t('validation.generic');
}

function describeControlErrors(
  errors: ValidationErrors | null,
  value: unknown,
  i18n: I18nService,
): string {
  if (!errors) {
    return i18n.t('validation.generic');
  }
  if (errors['required']) {
    return i18n.t('validation.required');
  }
  if (errors['integer']) {
    return i18n.t('validation.integer');
  }
  if (errors['url']) {
    return i18n.t('validation.url');
  }
  if (errors['range']) {
    const { min, max } = errors['range'] as { min: number; max: number };
    const below = Number(value) < min;
    return withValue(
      i18n.t(below ? 'validation.min' : 'validation.max'),
      String(below ? min : max),
    );
  }
  if (errors['maxlength']) {
    return withValue(
      i18n.t('validation.maxLength'),
      String(errors['maxlength'].requiredLength),
    );
  }
  if (errors['maxLength']) {
    return withValue(
      i18n.t('validation.maxLength'),
      String(errors['maxLength'].requiredLength),
    );
  }
  return i18n.t('validation.generic');
}

function withValue(template: string, value?: string): string {
  return template.replace('{value}', value ?? '');
}

export function findFirstInvalidPath(
  control: AbstractControl,
  path: string[] = [],
): string[] | null {
  if (!control.invalid) {
    return null;
  }
  if (control instanceof FormGroup) {
    for (const [key, child] of Object.entries(control.controls)) {
      const found = findFirstInvalidPath(child, [...path, key]);
      if (found) {
        return found;
      }
    }
  }
  if (control instanceof FormArray) {
    for (let index = 0; index < control.length; index += 1) {
      const found = findFirstInvalidPath(control.at(index), [
        ...path,
        String(index),
      ]);
      if (found) {
        return found;
      }
    }
  }
  return path.length > 0 ? path : null;
}

function controlAt(
  control: AbstractControl,
  path: string[],
): AbstractControl | null {
  let current: AbstractControl | null = control;
  for (const key of path) {
    if (current instanceof FormGroup) {
      current = current.controls[key] ?? null;
    } else if (current instanceof FormArray) {
      current = current.at(Number(key)) ?? null;
    } else {
      return null;
    }
    if (!current) {
      return null;
    }
  }
  return current;
}
