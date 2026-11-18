import { describe, expect, it } from 'vitest';
import type { Profile } from './models/profile';
import {
  applyLangToForm,
  applyTranslatedProfile,
  extractLangValues,
} from './bilingual-form';
import { buildProfileForm, loadProfileForm, newCertificationForm } from './profile-form';

function profileWith(data: Record<string, unknown>): Profile {
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
  } as unknown as Profile;
}

describe('applyTranslatedProfile', () => {
  it('matches translated items by id even when an unsaved item is first', () => {
    const profile = profileWith({
      headlineEs: 'Desarrollador',
      headlineEn: 'Developer',
      certifications: [
        {
          id: 'cert-1',
          name: 'Angular: De cero a experto',
          nameEs: 'Angular: De cero a experto',
          nameEn: 'Angular: From Zero to Expert',
          issuer: 'Udemy',
          issuerEs: 'Udemy',
          issuerEn: 'Udemy',
          sortOrder: 0,
        },
        {
          id: 'cert-2',
          name: 'Node: De cero a experto',
          nameEs: 'Node: De cero a experto',
          nameEn: 'Node: From Zero to Expert',
          issuer: 'Udemy',
          issuerEs: 'Udemy',
          issuerEn: 'Udemy',
          sortOrder: 1,
        },
      ],
    });
    const form = buildProfileForm();
    loadProfileForm(form, profile);
    // El modal inserta los items nuevos al principio, sin id.
    form.controls.certifications.insert(
      0,
      newCertificationForm({ name: 'Curso nuevo' }),
    );

    const skipped = applyTranslatedProfile(form, profile, 'en');

    const names = form.controls.certifications.controls.map(
      (group) => group.controls.name.value,
    );
    expect(skipped).toBe(1);
    expect(names).toEqual([
      'Curso nuevo',
      'Angular: From Zero to Expert',
      'Node: From Zero to Expert',
    ]);
    expect(form.controls.headline.value).toBe('Developer');
  });

  it('replaces the lists so the sections render the new language', () => {
    const profile = profileWith({});
    const form = buildProfileForm();
    loadProfileForm(form, profile);
    const before = form.controls.certifications;

    applyTranslatedProfile(form, profile, 'en');

    expect(form.controls.certifications).not.toBe(before);
  });
});

describe('applyLangToForm', () => {
  it('replaces each list with a new instance so the cards re-render', () => {
    const form = buildProfileForm();
    const before = form.controls.certifications;

    applyLangToForm(form, extractLangValues(profileWith({}), 'en'));

    expect(form.controls.certifications).not.toBe(before);
  });
});
