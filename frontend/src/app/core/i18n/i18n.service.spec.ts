import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from './i18n.service';

const STORAGE_KEY = 'career-analyzer-i18n';

function setBrowserLanguage(language: string): void {
  Object.defineProperty(navigator, 'language', {
    value: language,
    configurable: true,
  });
}

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sin preferencia guardada y navegador no es en, arranca en español', () => {
    setBrowserLanguage('es-AR');
    const service = new I18nService();
    expect(service.lang()).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('sin preferencia guardada y navegador en inglés, arranca en inglés', () => {
    setBrowserLanguage('en-US');
    const service = new I18nService();
    expect(service.lang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('sin preferencia guardada y navegador desconocido, arranca en español', () => {
    setBrowserLanguage('fr-FR');
    const service = new I18nService();
    expect(service.lang()).toBe('es');
  });

  it('respeta la preferencia guardada en localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    const service = new I18nService();
    expect(service.lang()).toBe('en');
    expect(service.t('nav.profile')).toBe('Profile');
  });

  it('setLang persiste en localStorage y actualiza el documento', () => {
    setBrowserLanguage('es-AR');
    const service = new I18nService();
    service.setLang('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(service.is('en')).toBe(true);
    service.setLang('es');
    expect(service.t('nav.profile')).toBe('Perfil');
  });

  it('t devuelve la clave cuando no está traducida', () => {
    setBrowserLanguage('es-AR');
    const service = new I18nService();
    expect(service.t('no.existe')).toBe('no.existe');
  });
});