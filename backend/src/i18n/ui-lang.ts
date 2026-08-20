export type UiLang = 'es' | 'en';

// Normaliza el header Accept-Language a un idioma de interfaz soportado.
// Cualquier valor no reconocido (o ausencia de header) cae a 'es'.
export function resolveUiLang(header?: string): UiLang {
  const raw = header?.split(',')[0]?.trim().toLowerCase() ?? '';
  if (raw.startsWith('en')) return 'en';
  return 'es';
}

// Devuelve el valor del idioma objetivo y, si está vacío, el del otro idioma.
export function selectLang(
  es?: string | null,
  en?: string | null,
  target: UiLang = 'es',
): string | null {
  const preferred = target === 'en' ? en : es;
  if (preferred) return preferred;
  const fallback = target === 'en' ? es : en;
  return fallback ? fallback : null;
}

// Igual que selectLang pero para listas no vacías (p. ej. metrics).
export function selectLangList(
  es?: string[] | null,
  en?: string[] | null,
  target: UiLang = 'es',
): string[] | null {
  const preferred = target === 'en' ? en : es;
  if (preferred && preferred.length > 0) return preferred;
  const fallback = target === 'en' ? es : en;
  return fallback && fallback.length > 0 ? fallback : null;
}
