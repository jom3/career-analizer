// Utilidades compartidas para el perfil bilingüe es/en.
// La columna única (legacy) se sincroniza con el idioma primario (es si existe,
// si no en), de modo que los consumidores que aún la usan siguen funcionando
// hasta SPEC 18.

export type LanguageCode = 'es' | 'en';

export interface LocalizedValue {
  es?: string | null;
  en?: string | null;
}

export interface LocalizedArray {
  es?: string[] | null;
  en?: string[] | null;
}

// Heurística simple: si el texto contiene caracteres propios del español
// (letras acentuadas, ñ, ¿, ¡) → es; si no → en. Fallback: es.
export function detectLanguage(text: string): LanguageCode {
  const hasSpanishChars = /[áéíóúüñ¿¡ÁÉÍÓÚÜÑ]/.test(text);
  return hasSpanishChars ? 'es' : 'en';
}

function pickPrimary(es: string | null, en: string | null): string | null {
  return es ?? en;
}

function valueOrNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

// Resuelve los valores por idioma y el valor de la columna única para un
// campo de texto. Si viene el objeto por idioma, es la fuente autoritativa;
// si no, se detecta el idioma del campo plano. La columna única (flat) puede
// ser null; el caller la escribe en la columna legacy (coercionando a '' solo
// cuando la columna es requerida).
export function resolveBilingualString(
  flat: string | null | undefined,
  localized: LocalizedValue | undefined,
): { es: string | null; en: string | null; flat: string | null } {
  if (localized) {
    const es = valueOrNull(localized.es ?? '');
    const en = valueOrNull(localized.en ?? '');
    return { es, en, flat: pickPrimary(es, en) };
  }
  const value = flat ?? null;
  const lang = detectLanguage(value ?? '');
  return {
    es: lang === 'es' ? value : null,
    en: lang === 'en' ? value : null,
    flat: value,
  };
}

// Igual que resolveBilingualString pero para listas de strings (metrics).
// No se fuerza paridad entre idiomas.
export function resolveBilingualStringArray(
  flat: string[] | null | undefined,
  localized: LocalizedArray | undefined,
): { es: string[]; en: string[]; flat: string[] } {
  if (localized) {
    const es = localized.es ?? [];
    const en = localized.en ?? [];
    return { es, en, flat: es.length > 0 ? es : en };
  }
  const value = flat ?? [];
  const lang = detectLanguage(value.join(' '));
  return {
    es: lang === 'es' ? value : [],
    en: lang === 'en' ? value : [],
    flat: value,
  };
}
