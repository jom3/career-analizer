// Limpieza de tokens extraídos de una oferta (skills, keywords, etc.).
// Compartido entre el parser de ofertas (SPEC 10) y la adaptación del CV
// (SPEC 12): garantiza que las frases completas que la IA a veces devuelve como
// "skills" (p. ej. "Más de 3 años desarrollando aplicaciones Full Stack.") no
// lleguen a los consumidores (whitelist, missing skills, commit line).

// Marcas de oración: tokens-frase que no son skills puntuales.
export const SENTENCE_MARKERS = [
  'experiencia',
  'experience',
  'años',
  'years',
  'disponibilidad',
  'requisito',
  'requirement',
  'habilidades',
  'responsabilidad',
  'responsibilit',
  'working',
  'learning',
  'fluido',
  'fluent',
];

// Adjetivos de nivel que la IA a veces pega al final de un skill ("React
// avanzado", "Node.js senior"). Se eliminan para dejar el token de tecnología.
const TRAILING_QUALIFIERS = [
  'avanzado',
  'avanzada',
  'senior',
  'junior',
  'experto',
  'experta',
];

// Recorta, quita puntuación final y adjetivos de nivel, colapsa espacios y
// descarta frases completas (más de 8 palabras o con marcadores de oración).
// Verbatims legítimos como "GitHub Actions" o "CI/CD" se conservan.
export function cleanStringArray(value: unknown): string[] {
  return toStringArray(value)
    .map((item) => stripTrailingQualifier(trimToken(item)))
    .filter((item) => item.length > 0)
    .filter((item) => {
      const lower = item.toLowerCase();
      const wordCount = item.split(' ').length;
      return wordCount <= 8 && !SENTENCE_MARKERS.some((m) => lower.includes(m));
    });
}

function trimToken(item: string): string {
  return item
    .trim()
    .replace(/[.;,]+$/, '')
    .replace(/\s+/g, ' ');
}

function stripTrailingQualifier(token: string): string {
  const words = token.split(' ');
  if (words.length <= 1) {
    return token;
  }
  const last = words[words.length - 1].toLowerCase();
  return TRAILING_QUALIFIERS.includes(last)
    ? words.slice(0, -1).join(' ')
    : token;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}
