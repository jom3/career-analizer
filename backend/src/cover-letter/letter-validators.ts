export type CoverLetterWarningCode =
  | 'WORD_LIMIT'
  | 'BANNED_PHRASE'
  | 'EMPLOYER_NAME'
  | 'TARGET_COMPANY_REPEATED'
  | 'GENERIC_CLOSING'
  | 'EMPTY_ADJECTIVE';

export interface CoverLetterWarning {
  code: CoverLetterWarningCode;
  detail?: string;
}

export interface LetterValidationInput {
  lang: 'es' | 'en';
  employers: string[];
  targetCompany: string | null;
}

export const MAX_WORDS = 180;

const BANNED_PHRASES = [
  'esto se alinea con los requerimientos del puesto',
  'se alinea con los requerimientos',
  'lo que permitió',
  'lo que permitio',
  'lo que facilitó',
  'lo que facilito',
  'tecnologías relevantes',
  'tecnologias relevantes',
  'tecnologías clave',
  'tecnologias clave',
  'quedo atento a su respuesta',
  'espero con interés',
  'espero con interes',
];

const EMPTY_ADJECTIVES = [
  'clave',
  'claves',
  'relevante',
  'relevantes',
  'eficaz',
  'eficaces',
  'eficiente',
  'eficientes',
  'fundamental',
  'fundamentales',
  'avanzado',
  'avanzada',
  'avanzados',
  'avanzadas',
  'óptimo',
  'óptima',
  'óptimos',
  'óptimas',
  'optimo',
  'optima',
  'sólido',
  'sólida',
  'solidos',
  'sólidos',
  'robusto',
  'robusta',
  'innovador',
  'innovadora',
];

const CLOSING_KEYWORDS = [
  'equipo',
  'aportar',
  'contribuir',
  'crecimiento',
  'objetivos',
  'éxito',
  'exito',
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function strip(text: string, phrases: string[]): string {
  return phrases.reduce(
    (result, phrase) => result.split(phrase).join(' '),
    text,
  );
}

function lastSentence(content: string): string {
  const sentences = content
    .split(/[.!?]+\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return sentences.at(-1) ?? '';
}

// Un adjetivo vacío se tolera solo si la misma oración tiene un número: la
// evidencia tiene que estar en la afirmación, no en la oración de al lado.
function sentenceAt(text: string, index: number): string {
  const start = Math.max(
    text.lastIndexOf('.', index),
    text.lastIndexOf('!', index),
    text.lastIndexOf('?', index),
    text.lastIndexOf('\n', index),
  );
  const end = text.slice(index).search(/[.!?\n]/);
  return text.slice(start + 1, end === -1 ? undefined : index + end);
}

function hasNearbyNumber(text: string, index: number): boolean {
  return /\d/.test(sentenceAt(text, index));
}

function findBannedPhrases(content: string): string[] {
  const lower = normalize(content);
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

function findEmptyAdjectives(content: string, banned: string[]): string[] {
  const cleaned = strip(normalize(content), banned);
  const found: string[] = [];
  for (const adjective of EMPTY_ADJECTIVES) {
    const pattern = new RegExp(`\\b${adjective}\\b`, 'g');
    let match = pattern.exec(cleaned);
    while (match !== null) {
      if (!hasNearbyNumber(cleaned, match.index)) {
        found.push(adjective);
        break;
      }
      match = pattern.exec(cleaned);
    }
  }
  return found;
}

export function validateLetter(
  content: string,
  input: LetterValidationInput,
): CoverLetterWarning[] {
  const warnings: CoverLetterWarning[] = [];
  const lower = normalize(content);

  const words = countWords(content);
  if (words > MAX_WORDS) {
    warnings.push({ code: 'WORD_LIMIT', detail: String(words) });
  }

  const banned = findBannedPhrases(content);
  if (banned.length > 0) {
    warnings.push({ code: 'BANNED_PHRASE', detail: banned.join(', ') });
  }

  const employer = input.employers.find(
    (name) => name.trim().length > 0 && lower.includes(normalize(name)),
  );
  if (employer) {
    warnings.push({ code: 'EMPLOYER_NAME', detail: employer });
  }

  const target = input.targetCompany?.trim();
  if (target) {
    const occurrences = lower.split(normalize(target)).length - 1;
    if (occurrences > 1) {
      warnings.push({
        code: 'TARGET_COMPANY_REPEATED',
        detail: String(occurrences),
      });
    }
  }

  const closing = normalize(lastSentence(content));
  if (CLOSING_KEYWORDS.some((keyword) => closing.includes(keyword))) {
    warnings.push({ code: 'GENERIC_CLOSING', detail: lastSentence(content) });
  }

  const adjectives = findEmptyAdjectives(content, banned);
  if (adjectives.length > 0) {
    warnings.push({ code: 'EMPTY_ADJECTIVE', detail: adjectives.join(', ') });
  }

  return warnings;
}
