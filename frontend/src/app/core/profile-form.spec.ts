import { describe, expect, it } from 'vitest';
import type { Profile } from './models/profile';
import {
  MAX_METRICS,
  buildProfileForm,
  loadProfileForm,
  newCertificationForm,
  newExperienceForm,
  newSkillForm,
} from './profile-form';
import { buildBilingualPayload, emptyLangValues } from './bilingual-form';

function profileWith(data: Partial<Profile>): Profile {
  return {
    id: 'profile-1',
    headline: null,
    phone: null,
    location: null,
    website: null,
    linkedin: null,
    summary: null,
    experiences: [],
    skills: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
    ...data,
  };
}

describe('loadProfileForm', () => {
  it('replaces each list with a new instance so the view re-renders', () => {
    const form = buildProfileForm();
    const before = form.controls.education;

    loadProfileForm(form, profileWith({}));

    expect(form.controls.education).not.toBe(before);
    expect(form.controls.education.length).toBe(0);
  });

  it('keeps the ids returned after saving, enabling the document upload', () => {
    const form = buildProfileForm();

    loadProfileForm(
      form,
      profileWith({
        education: [
          {
            id: 'edu-1',
            degree: 'Licenciatura',
            institution: 'Universidad',
            current: false,
            sortOrder: 0,
          },
        ],
      }),
    );

    expect(form.controls.education.at(0).controls.id.value).toBe('edu-1');
  });
});

describe('validaciones del formulario', () => {
  it('rechaza un año fuera de 1900-2100', () => {
    const form = newCertificationForm({ name: 'Curso' });
    form.controls.year.setValue(1800);

    expect(form.controls.year.hasError('range')).toBe(true);

    form.controls.year.setValue(2014);
    expect(form.controls.year.valid).toBe(true);
  });

  it('acepta el año vacío', () => {
    const form = newCertificationForm({ name: 'Curso' });
    expect(form.controls.year.value).toBeNull();
    expect(form.controls.year.valid).toBe(true);

    const withNull = newCertificationForm({ name: 'Curso', year: null });
    expect(withNull.controls.year.value).toBeNull();
    expect(withNull.controls.year.valid).toBe(true);
  });

  it('rechaza nombres con solo espacios', () => {
    const form = newSkillForm({ name: 'Go' });
    form.controls.name.setValue('   ');

    expect(form.controls.name.hasError('required')).toBe(true);
  });

  it('rechaza URLs con espacios y acepta URLs sin protocolo', () => {
    const form = newCertificationForm({ name: 'Curso' });
    form.controls.url.setValue('https://a b.com');
    expect(form.controls.url.hasError('url')).toBe(true);

    form.controls.url.setValue('abc');
    expect(form.controls.url.hasError('url')).toBe(true);

    form.controls.url.setValue('linkedin.com/in/joams');
    expect(form.controls.url.valid).toBe(true);
  });

  it('limita las métricas a cinco al cargar', () => {
    const form = newExperienceForm({
      company: 'ACME',
      position: 'Dev',
      metrics: ['1', '2', '3', '4', '5', '6'],
    });

    expect(form.controls.metrics.length).toBe(MAX_METRICS);
  });

  it('descarta fechas parciales para no romper el guardado', () => {
    const form = newExperienceForm({
      company: 'ACME',
      position: 'Dev',
      startDate: '2019',
    });

    expect(form.controls.startDate.value).toBe('');
  });
});

describe('buildBilingualPayload', () => {
  it('sends the CV visibility flags of education and certifications', () => {
    const form = buildProfileForm();
    loadProfileForm(
      form,
      profileWith({
        education: [
          {
            id: 'edu-1',
            degree: 'Licenciatura',
            institution: 'Universidad',
            current: false,
            showInCompactCv: false,
            showInDocumentedCv: true,
            sortOrder: 0,
          },
        ],
        certifications: [
          {
            name: 'Curso corto',
            showInCompactCv: false,
            showInDocumentedCv: false,
            sortOrder: 0,
          },
        ],
      }),
    );

    const payload = buildBilingualPayload(form, 'es', emptyLangValues());

    expect(payload.education[0].showInCompactCv).toBe(false);
    expect(payload.education[0].showInDocumentedCv).toBe(true);
    expect(payload.certifications[0].showInCompactCv).toBe(false);
    expect(payload.certifications[0].showInDocumentedCv).toBe(false);
  });
});
