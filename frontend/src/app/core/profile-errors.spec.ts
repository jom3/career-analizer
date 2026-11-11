import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { I18nService } from './i18n/i18n.service';
import {
  describeBackendError,
  describeFormError,
  findFirstInvalidPath,
} from './profile-errors';
import { buildProfileForm, newCertificationForm, newSkillForm } from './profile-form';

const i18n = new I18nService();

function withValue(key: string, value: string): string {
  return i18n.t(key).replace('{value}', value);
}

describe('describeFormError', () => {
  it('nombra la sección, el ítem y el campo inválido', () => {
    const form = buildProfileForm();
    form.controls.certifications.push(
      newCertificationForm({ name: 'Curso' }),
    );
    form.controls.certifications.at(0).controls.year.setValue(1800);

    expect(describeFormError(form, i18n)).toBe(
      `${i18n.t('profile.certification')} 1 · ${i18n.t('profile.year')}: ${withValue('validation.min', '1900')}`,
    );
  });

  it('describe un campo de nivel superior', () => {
    const form = buildProfileForm();
    form.controls.website.setValue('a b');

    expect(describeFormError(form, i18n)).toBe(
      `${i18n.t('profile.website')}: ${i18n.t('validation.url')}`,
    );
  });

  it('devuelve null con el formulario válido', () => {
    expect(describeFormError(buildProfileForm(), i18n)).toBeNull();
  });

  it('usa la sección indicada para un borrador suelto', () => {
    const draft = newCertificationForm({ name: 'Curso' });
    draft.controls.year.setValue(1800);

    expect(describeFormError(draft, i18n, 'certifications')).toBe(
      `${i18n.t('profile.certification')} · ${i18n.t('profile.year')}: ${withValue('validation.min', '1900')}`,
    );
  });
});

describe('findFirstInvalidPath', () => {
  it('llega hasta el control inválido dentro de una lista', () => {
    const form = buildProfileForm();
    form.controls.skills.push(newSkillForm());
    form.controls.skills.at(0).controls.name.setValue('');

    expect(findFirstInvalidPath(form)).toEqual(['skills', '0', 'name']);
  });
});

describe('describeBackendError', () => {
  it('traduce el primer mensaje de validación del backend', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        message: ['certifications.2.year must not be greater than 2100'],
      },
    });

    expect(describeBackendError(error, i18n)).toBe(
      `${i18n.t('profile.certification')} 3 · ${i18n.t('profile.year')}: ${withValue('validation.max', '2100')}`,
    );
  });

  it('traduce el error de URL', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: ['certifications.0.url must be a URL address'] },
    });

    expect(describeBackendError(error, i18n)).toBe(
      `${i18n.t('profile.certification')} 1 · ${i18n.t('profile.url')}: ${i18n.t('validation.url')}`,
    );
  });

  it('ignora errores que no son 400', () => {
    const error = new HttpErrorResponse({ status: 500 });
    expect(describeBackendError(error, i18n)).toBeNull();
  });
});
