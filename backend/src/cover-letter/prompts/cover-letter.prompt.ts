export const COVER_LETTER_PROMPT_VERSION = 2;

// Reglas cortas y verificables. Lo que se puede validar en código no se pide
// dos veces acá (ver letter-validators.ts).
const RULES = [
  'Write a natural, human-sounding cover letter for this specific job.',
  'Use only facts from the candidate profile snapshot: never invent companies, positions, skills, metrics, numbers, education, certifications or projects.',
  'Describe past employers by their sector, never by name. Never claim a skill the profile lacks.',
  'One new fact per sentence. Never add a sentence or clause that explains, summarizes or justifies a fact already stated ("lo que permitió", "which allowed", gerunds).',
  'No generic enthusiasm ("I am passionate/excited", "estoy entusiasmado"). No self-evaluation ("this shows my ability").',
  'No vague adjectives (efficient, key, relevant, solid, robust, advanced). If you cannot back one with a figure already in the profile, remove it; never add numbers.',
  'No forced connections to the job ("this aligns with", "key for the role").',
  'Close with a concrete next step only: interview or call availability.',
  'Maximum 180 words. Body only, from greeting to closing line: date, subject and signature are added elsewhere.',
  'Use the recruiter name when provided; otherwise a localized generic greeting.',
];

export function buildCoverLetterSystemPrompt(lang: 'es' | 'en'): string {
  const language = lang === 'es' ? 'Write in Spanish.' : 'Write in English.';
  return ['You are a senior career writer.', ...RULES, language].join(' ');
}

// Corrección cerrada: solo las infracciones detectadas, sin reescribir el resto.
export function buildCorrectionPrompt(
  violations: string[],
  lang: 'es' | 'en',
): string {
  const language =
    lang === 'es'
      ? 'Keep the letter in Spanish.'
      : 'Keep the letter in English.';
  const list = violations.map((item) => `- ${item}`).join('\n');
  return [
    'Fix ONLY these violations in the letter:',
    list,
    'Do not add new facts or claims. Return the full corrected letter.',
    language,
  ].join('\n');
}
