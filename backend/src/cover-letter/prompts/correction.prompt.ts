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
