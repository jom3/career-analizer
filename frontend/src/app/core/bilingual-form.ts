import { FormArray } from '@angular/forms';
import type { Profile, ProfilePayload } from './models/profile';
import type { UiLang } from './i18n/i18n.service';
import {
  newMetricForm,
  type CertificationForm,
  type EducationForm,
  type ExperienceForm,
  type LanguageForm,
  type ProfileForm,
  type ProjectForm,
} from './profile-form';

// Valores de los campos bilingües de un idioma, alineados por índice con los
// arrays del form (el idioma inactivo se guarda aquí para no perder ediciones
// al cambiar de pestaña). Los campos no bilingües no se incluyen.
export interface LangExperienceValues {
  position: string;
  location: string;
  description: string;
  metrics: string[];
}

export interface LangEducationValues {
  degree: string;
  institution: string;
  field: string;
  description: string;
}

export interface LangCertificationValues {
  name: string;
  issuer: string;
}

export interface LangProjectValues {
  name: string;
  role: string;
  description: string;
  metrics: string[];
}

export interface LangLanguageValues {
  name: string;
}

export interface LangValues {
  headline: string;
  location: string;
  summary: string;
  experiences: LangExperienceValues[];
  education: LangEducationValues[];
  certifications: LangCertificationValues[];
  projects: LangProjectValues[];
  languages: LangLanguageValues[];
}

export function emptyLangValues(): LangValues {
  return {
    headline: '',
    location: '',
    summary: '',
    experiences: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
  };
}

const SUFFIX: Record<UiLang, 'Es' | 'En'> = { es: 'Es', en: 'En' };

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// Lee estrictamente la columna por idioma: si el idioma no tiene contenido
// propio, devuelve vacío (la pestaña del idioma sin traducir se ve vacía hasta
// que el usuario use "Traducir"), sin caer en la columna única sincronizada.
function readLocalized(
  record: unknown,
  field: string,
  lang: UiLang,
): string {
  const suffix = SUFFIX[lang];
  return asString((record as Record<string, unknown>)[`${field}${suffix}`]);
}

function readLocalizedArray(
  record: unknown,
  field: string,
  lang: UiLang,
): string[] {
  const suffix = SUFFIX[lang];
  const localized = (record as Record<string, unknown>)[`${field}${suffix}`];
  return Array.isArray(localized)
    ? localized.filter((item): item is string => typeof item === 'string')
    : [];
}

// True si el idioma tiene al menos un campo bilingüe con contenido.
export function hasContent(values: LangValues): boolean {
  const has = (value: string): boolean => value.trim().length > 0;
  const hasArray = (value: string[]): boolean => value.length > 0;
  if (has(values.headline) || has(values.location) || has(values.summary)) {
    return true;
  }
  if (
    values.experiences.some(
      (item) =>
        has(item.position) ||
        has(item.location) ||
        has(item.description) ||
        hasArray(item.metrics),
    )
  ) {
    return true;
  }
  if (
    values.education.some(
      (item) =>
        has(item.degree) ||
        has(item.institution) ||
        has(item.field) ||
        has(item.description),
    )
  ) {
    return true;
  }
  if (
    values.certifications.some((item) => has(item.name) || has(item.issuer))
  ) {
    return true;
  }
  if (
    values.projects.some(
      (item) =>
        has(item.name) ||
        has(item.role) ||
        has(item.description) ||
        hasArray(item.metrics),
    )
  ) {
    return true;
  }
  return values.languages.some((item) => has(item.name));
}

// Extrae del form plano los valores bilingües del idioma activo (para guardar
// ese idioma en el side-store al cambiar de pestaña).
export function extractLangFromForm(form: ProfileForm): LangValues {
  const v = form.getRawValue();
  return {
    headline: v.headline,
    location: v.location,
    summary: v.summary,
    experiences: v.experiences.map((item) => ({
      position: item.position,
      location: item.location,
      description: item.description,
      metrics: item.metrics,
    })),
    education: v.education.map((item) => ({
      degree: item.degree,
      institution: item.institution,
      field: item.field,
      description: item.description,
    })),
    certifications: v.certifications.map((item) => ({
      name: item.name,
      issuer: item.issuer,
    })),
    projects: v.projects.map((item) => ({
      name: item.name,
      role: item.role,
      description: item.description,
      metrics: item.metrics,
    })),
    languages: v.languages.map((item) => ({
      name: item.name,
    })),
  };
}

// Extrae los valores bilingües de un idioma desde un Profile (columnas *_es/_en).
export function extractLangValues(profile: Profile, lang: UiLang): LangValues {
  const exp = (record: unknown, field: string) =>
    readLocalized(record, field, lang);
  const expArray = (record: unknown, field: string) =>
    readLocalizedArray(record, field, lang);
  return {
    headline: exp(profile, 'headline'),
    location: exp(profile, 'location'),
    summary: exp(profile, 'summary'),
    experiences: profile.experiences.map((item) => ({
      position: exp(item, 'position'),
      location: exp(item, 'location'),
      description: exp(item, 'description'),
      metrics: expArray(item, 'metrics'),
    })),
    education: profile.education.map((item) => ({
      degree: exp(item, 'degree'),
      institution: exp(item, 'institution'),
      field: exp(item, 'field'),
      description: exp(item, 'description'),
    })),
    certifications: profile.certifications.map((item) => ({
      name: exp(item, 'name'),
      issuer: exp(item, 'issuer'),
    })),
    projects: profile.projects.map((item) => ({
      name: exp(item, 'name'),
      role: exp(item, 'role'),
      description: exp(item, 'description'),
      metrics: expArray(item, 'metrics'),
    })),
    languages: profile.languages.map((item) => ({
      name: exp(item, 'name'),
    })),
  };
}

function setMetrics(
  array: FormArray,
  values: string[],
): void {
  array.clear();
  for (const value of values) {
    array.push(newMetricForm(value));
  }
}

// Aplica los valores de un idioma al form plano, tocando solo los campos
// bilingües (deja intactos los no bilingües: fechas, urls, niveles, etc.).
export function applyLangToForm(form: ProfileForm, values: LangValues): void {
  form.controls.headline.setValue(values.headline);
  form.controls.location.setValue(values.location);
  form.controls.summary.setValue(values.summary);

  form.controls.experiences.controls.forEach((item, index) => {
    const value = values.experiences[index];
    if (!value) return;
    item.controls.position.setValue(value.position);
    item.controls.location.setValue(value.location);
    item.controls.description.setValue(value.description);
    setMetrics(item.controls.metrics, value.metrics);
  });

  form.controls.education.controls.forEach((item, index) => {
    const value = values.education[index];
    if (!value) return;
    item.controls.degree.setValue(value.degree);
    item.controls.institution.setValue(value.institution);
    item.controls.field.setValue(value.field);
    item.controls.description.setValue(value.description);
  });

  form.controls.certifications.controls.forEach((item, index) => {
    const value = values.certifications[index];
    if (!value) return;
    item.controls.name.setValue(value.name);
    item.controls.issuer.setValue(value.issuer);
  });

  form.controls.projects.controls.forEach((item, index) => {
    const value = values.projects[index];
    if (!value) return;
    item.controls.name.setValue(value.name);
    item.controls.role.setValue(value.role);
    item.controls.description.setValue(value.description);
    setMetrics(item.controls.metrics, value.metrics);
  });

  form.controls.languages.controls.forEach((item, index) => {
    const value = values.languages[index];
    if (!value) return;
    item.controls.name.setValue(value.name);
  });
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function i18nObject(
  activeLang: UiLang,
  activeValue: string,
  otherValue: string,
): { es?: string | null; en?: string | null } {
  return {
    [activeLang]: clean(activeValue),
    [activeLang === 'es' ? 'en' : 'es']: clean(otherValue),
  };
}

function i18nArray(
  activeLang: UiLang,
  activeValue: string[],
  otherValue: string[],
): { es?: string[] | null; en?: string[] | null } {
  return {
    [activeLang]: activeValue,
    [activeLang === 'es' ? 'en' : 'es']: otherValue,
  };
}

// Construye el payload con los objetos *I18n: el idioma activo sale del form y
// el inactivo del side-store. Las columnas planas se sincronizan al idioma
// activo (el backend deriva el valor único desde el objeto *I18n).
export function buildBilingualPayload(
  form: ProfileForm,
  activeLang: UiLang,
  values: LangValues,
): ProfilePayload {
  const v = form.getRawValue();
  const other = activeLang === 'es' ? 'en' : 'es';

  return {
    headline: clean(v.headline),
    headlineI18n: i18nObject(activeLang, v.headline, values.headline),
    phone: clean(v.phone),
    location: clean(v.location),
    locationI18n: i18nObject(activeLang, v.location, values.location),
    website: clean(v.website),
    linkedin: clean(v.linkedin),
    summary: clean(v.summary),
    summaryI18n: i18nObject(activeLang, v.summary, values.summary),
    experiences: v.experiences.map((item, index) => ({
      id: item.id ?? undefined,
      company: item.company.trim(),
      position: item.position.trim(),
      positionI18n: i18nObject(
        activeLang,
        item.position,
        values.experiences[index]?.position ?? '',
      ),
      location: item.location.trim() || null,
      locationI18n: i18nObject(
        activeLang,
        item.location,
        values.experiences[index]?.location ?? '',
      ),
      startDate: item.startDate || null,
      endDate: item.current ? null : item.endDate || null,
      current: item.current,
      description: item.description.trim() || null,
      descriptionI18n: i18nObject(
        activeLang,
        item.description,
        values.experiences[index]?.description ?? '',
      ),
      metrics: item.metrics.map((m) => m.trim()).filter((m) => m.length > 0),
      metricsI18n: i18nArray(
        activeLang,
        item.metrics.map((m) => m.trim()).filter((m) => m.length > 0),
        values.experiences[index]?.metrics ?? [],
      ),
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
      degreeI18n: i18nObject(
        activeLang,
        item.degree,
        values.education[index]?.degree ?? '',
      ),
      institution: item.institution.trim(),
      institutionI18n: i18nObject(
        activeLang,
        item.institution,
        values.education[index]?.institution ?? '',
      ),
      field: item.field.trim() || null,
      fieldI18n: i18nObject(
        activeLang,
        item.field,
        values.education[index]?.field ?? '',
      ),
      startDate: item.startDate || null,
      endDate: item.current ? null : item.endDate || null,
      current: item.current,
      description: item.description.trim() || null,
      descriptionI18n: i18nObject(
        activeLang,
        item.description,
        values.education[index]?.description ?? '',
      ),
      source: item.source,
      sortOrder: index,
    })),
    certifications: v.certifications.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      nameI18n: i18nObject(
        activeLang,
        item.name,
        values.certifications[index]?.name ?? '',
      ),
      issuer: item.issuer.trim() || null,
      issuerI18n: i18nObject(
        activeLang,
        item.issuer,
        values.certifications[index]?.issuer ?? '',
      ),
      year: item.year || null,
      url: item.url.trim() || null,
      source: item.source,
      sortOrder: index,
    })),
    projects: v.projects.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      nameI18n: i18nObject(
        activeLang,
        item.name,
        values.projects[index]?.name ?? '',
      ),
      role: item.role.trim() || null,
      roleI18n: i18nObject(
        activeLang,
        item.role,
        values.projects[index]?.role ?? '',
      ),
      description: item.description.trim() || null,
      descriptionI18n: i18nObject(
        activeLang,
        item.description,
        values.projects[index]?.description ?? '',
      ),
      url: item.url.trim() || null,
      techStack: item.techStack
        .split(',')
        .map((tech) => tech.trim())
        .filter((tech) => tech.length > 0),
      metrics: item.metrics.map((m) => m.trim()).filter((m) => m.length > 0),
      metricsI18n: i18nArray(
        activeLang,
        item.metrics.map((m) => m.trim()).filter((m) => m.length > 0),
        values.projects[index]?.metrics ?? [],
      ),
      source: item.source,
      sortOrder: index,
    })),
    languages: v.languages.map((item, index) => ({
      id: item.id ?? undefined,
      name: item.name.trim(),
      nameI18n: i18nObject(
        activeLang,
        item.name,
        values.languages[index]?.name ?? '',
      ),
      level: item.level as Profile['languages'][number]['level'],
      source: item.source,
      sortOrder: index,
    })),
  };
}
