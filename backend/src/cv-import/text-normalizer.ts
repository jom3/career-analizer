// Mapa explícito de caracteres tipográficos a sus formas simples.
const LIGATURES: Record<string, string> = {
  '\uFB00': 'ff', // LATIN SMALL LIGATURE FF
  '\uFB01': 'fi', // LATIN SMALL LIGATURE FI
  '\uFB02': 'fl', // LATIN SMALL LIGATURE FL
  '\uFB03': 'ffi', // LATIN SMALL LIGATURE FFI
  '\uFB04': 'ffl', // LATIN SMALL LIGATURE FFL
  '\uFB05': 'st', // LATIN SMALL LIGATURE LONG S T
  '\uFB06': 'st', // LATIN SMALL LIGATURE ST
};

const TYPOGRAPHIC_QUOTES: Record<string, string> = {
  '\u2018': "'", // LEFT SINGLE QUOTATION MARK
  '\u2019': "'", // RIGHT SINGLE QUOTATION MARK
  '\u201A': "'", // SINGLE LOW-9 QUOTATION MARK
  '\u201B': "'", // SINGLE HIGH-REVERSED-9 QUOTATION MARK
  '\u201C': '"', // LEFT DOUBLE QUOTATION MARK
  '\u201D': '"', // RIGHT DOUBLE QUOTATION MARK
  '\u201E': '"', // DOUBLE LOW-9 QUOTATION MARK
  '\u201F': '"', // DOUBLE HIGH-REVERSED-9 QUOTATION MARK
};

const DASHES: Record<string, string> = {
  '\u2013': '-', // EN DASH
  '\u2014': '-', // EM DASH
  '\u2015': '-', // HORIZONTAL BAR
};

const NON_BREAKING_SPACES: Record<string, string> = {
  '\u00A0': ' ', // NO-BREAK SPACE
  '\u2007': ' ', // FIGURE SPACE
  '\u202F': ' ', // NARROW NO-BREAK SPACE
};

const CHAR_MAP: Record<string, string> = {
  ...LIGATURES,
  ...TYPOGRAPHIC_QUOTES,
  ...DASHES,
  ...NON_BREAKING_SPACES,
};

const CHAR_MAP_REGEX = new RegExp(
  Object.keys(CHAR_MAP)
    .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);

const MULTIPLE_SPACES_REGEX = /[ \t]+/g;

// Normaliza ligaduras, comillas tipográficas, guiones en/em, espacios no
// separables y colapsa espacios múltiples. Mantiene los saltos de línea.
export function normalizeText(text: string): string {
  const deTypographed = text.replace(CHAR_MAP_REGEX, (char) => CHAR_MAP[char]);
  return deTypographed.replace(MULTIPLE_SPACES_REGEX, ' ');
}
