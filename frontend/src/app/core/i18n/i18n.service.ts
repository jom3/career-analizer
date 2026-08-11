import { Injectable, signal } from '@angular/core';
import { es } from './es';
import { en } from './en';

export type UiLang = 'es' | 'en';

const STORAGE_KEY = 'career-analyzer-i18n';

interface Dictionaries {
  es: Record<string, string>;
  en: Record<string, string>;
}

const dictionaries: Dictionaries = { es, en };

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<UiLang>('es');

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') {
      this.lang.set(stored);
    } else {
      const browserLanguage = (navigator.language || '').toLowerCase();
      this.lang.set(browserLanguage.startsWith('en') ? 'en' : 'es');
    }
    document.documentElement.lang = this.lang();
  }

  is(lang: UiLang): boolean {
    return this.lang() === lang;
  }

  setLang(lang: UiLang): void {
    this.lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }

  t(key: string): string {
    return dictionaries[this.lang()][key] ?? key;
  }
}