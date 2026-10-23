import { mentionsToken } from '../common/token-mention';
import { findSpanishGerunds } from './spanish-gerunds';

export type CoverLetterWarningCode =
  | 'WORD_LIMIT'
  | 'BANNED_PHRASE'
  | 'EMPLOYER_NAME'
  | 'TARGET_COMPANY_REPEATED'
  | 'GENERIC_CLOSING'
  | 'EMPTY_ADJECTIVE'
  | 'UNSUPPORTED_NUMBER'
  | 'GERUND'
  | 'MISSING_SKILL'
  | 'UNSUPPORTED_YEARS'
  | 'UNSUPPORTED_SECTOR'
  | 'RECRUITER_NAME_MISSING';

export interface CoverLetterWarning {
  code: CoverLetterWarningCode;
  detail?: string;
}

export interface LetterValidationInput {
  lang: 'es' | 'en';
  employers: string[];
  targetCompany: string | null;
  // Cifras que existen en el perfil o en la oferta. Si se omite, no se valida.
  supportedNumbers?: string[];
  // Skills de la oferta que el perfil no tiene: ni afirmarlas ni negarlas.
  missingSkills?: string[];
  // Texto del perfil: única fuente para años de experiencia y sector.
  profileText?: string;
  recruiterName?: string | null;
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
  'espero su respuesta',
  'lo que me permite',
  'lo que permite',
  'estoy entusiasmado',
  'estoy entusiasmada',
  'estoy emocionado',
  'estoy emocionada',
  'i am excited',
  'i am passionate',
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

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?\s?%?/g;

function normalizeNumber(raw: string): string {
  return raw.replace(/\s+/g, '').replace(',', '.').replace('%', '');
}

function isYear(value: string): boolean {
  if (!/^\d{4}$/.test(value)) {
    return false;
  }
  const year = Number(value);
  return year >= 1900 && year <= 2100;
}

// Toda cifra de la carta debe existir en el perfil o en la oferta. Los años
// quedan afuera: son contexto, no una métrica inventada.
function findUnsupportedNumbers(
  content: string,
  supported: string[],
): string[] {
  const allowed = new Set(supported.map(normalizeNumber));
  const found: string[] = [];
  for (const match of content.matchAll(NUMBER_PATTERN)) {
    const value = normalizeNumber(match[0]);
    if (value.length === 0 || isYear(value) || allowed.has(value)) {
      continue;
    }
    if (!found.includes(value)) {
      found.push(value);
    }
  }
  return found;
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

const YEARS_CLAIM = /(\d+)\+?\s*(?:años|year|years)\b/giu;
const EXPERIENCE_WORD = /experiencia|experience|trayectoria/i;
const SECTOR_WORD = /\b(?:sector|industria|industry)\b/i;

// El perfil respalda años solo si el número aparece junto a una unidad de tiempo:
// un nivel de skill "4" no es evidencia de experiencia.
function profileStatesYears(profileText: string, years: string): boolean {
  return new RegExp(`(?<!\\d)${years}\\s*(?:años|year|years)\\b`, 'iu').test(
    profileText,
  );
}

// Afirmaciones sobre el candidato que el perfil no respalda: años de experiencia
// y sector del empleador. Una oferta no es evidencia del candidato.
function findUnsupportedClaims(
  sentence: string,
  profileText: string,
): CoverLetterWarning[] {
  const warnings: CoverLetterWarning[] = [];
  if (EXPERIENCE_WORD.test(sentence)) {
    for (const match of sentence.matchAll(YEARS_CLAIM)) {
      if (!profileStatesYears(profileText, match[1])) {
        warnings.push({ code: 'UNSUPPORTED_YEARS', detail: match[0] });
      }
    }
  }
  if (SECTOR_WORD.test(sentence) && !SECTOR_WORD.test(profileText)) {
    warnings.push({ code: 'UNSUPPORTED_SECTOR', detail: sentence.trim() });
  }
  return warnings;
}

export function isUnsupportedClaimSentence(
  sentence: string,
  profileText: string,
): boolean {
  return findUnsupportedClaims(sentence, profileText).length > 0;
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

  if (input.supportedNumbers) {
    const unsupported = findUnsupportedNumbers(content, input.supportedNumbers);
    if (unsupported.length > 0) {
      warnings.push({
        code: 'UNSUPPORTED_NUMBER',
        detail: unsupported.join(', '),
      });
    }
  }

  if (input.missingSkills) {
    const mentioned = input.missingSkills.filter((skill) =>
      mentionsToken(content, skill),
    );
    if (mentioned.length > 0) {
      warnings.push({ code: 'MISSING_SKILL', detail: mentioned.join(', ') });
    }
  }

  const recruiter = input.recruiterName?.trim();
  if (recruiter && !lower.includes(normalize(recruiter))) {
    warnings.push({ code: 'RECRUITER_NAME_MISSING', detail: recruiter });
  }

  if (input.profileText !== undefined) {
    const sentences = content.split(/(?<=[.!?])\s+|\n+/);
    for (const sentence of sentences) {
      warnings.push(...findUnsupportedClaims(sentence, input.profileText));
    }
  }

  if (input.lang === 'es') {
    const gerunds = [...new Set(findSpanishGerunds(content))];
    if (gerunds.length > 0) {
      warnings.push({ code: 'GERUND', detail: gerunds.join(', ') });
    }
  }

  return warnings;
}
