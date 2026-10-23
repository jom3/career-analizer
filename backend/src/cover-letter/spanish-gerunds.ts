const GERUND_SUFFIX =
  /(ando|iendo|yendo)(me|te|se|nos|os|le|les|lo|la|los|las)?$/;

// Palabras terminadas en -ando/-iendo que no son gerundios: conjunciones,
// nombres propios y verbos conjugados en primera persona (entiendo, atiendo).
const NON_GERUNDS = new Set([
  'cuando',
  'mando',
  'comando',
  'demando',
  'fernando',
  'armando',
  'hernando',
  'rolando',
  'orlando',
  'entiendo',
  'atiendo',
  'defiendo',
  'extiendo',
]);

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function findSpanishGerunds(text: string): string[] {
  const words = text.match(/\p{L}+/gu) ?? [];
  return words.filter((word) => {
    const normalized = normalizeWord(word);
    return !NON_GERUNDS.has(normalized) && GERUND_SUFFIX.test(normalized);
  });
}
