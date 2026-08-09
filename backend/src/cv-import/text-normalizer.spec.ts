import { normalizeText } from './text-normalizer';

describe('normalizeText', () => {
  it('convierte ligaduras U+FB00–U+FB06 a su forma simple', () => {
    expect(normalizeText('ﬁle')).toBe('file');
    expect(normalizeText('eﬃcient')).toBe('efficient');
    expect(normalizeText('oﬀice')).toBe('office');
    expect(normalizeText('ﬂow')).toBe('flow');
    expect(normalizeText('aﬀord')).toBe('afford');
    expect(normalizeText('liﬅ')).toBe('list');
  });

  it('convierte comillas tipográficas a rectas', () => {
    expect(normalizeText('“hola”')).toBe('"hola"');
    expect(normalizeText('‘hola’')).toBe("'hola'");
  });

  it('convierte guiones en/em a guion simple', () => {
    expect(normalizeText('a – b')).toBe('a - b');
    expect(normalizeText('a — b')).toBe('a - b');
  });

  it('convierte espacios no separables a espacio', () => {
    expect(normalizeText('a\u00A0b')).toBe('a b');
  });

  it('colapsa espacios múltiples', () => {
    expect(normalizeText('a    b\t c')).toBe('a b c');
  });

  it('mantiene los saltos de línea', () => {
    expect(normalizeText('a  b\nc')).toBe('a b\nc');
  });

  it('combina varias normalizaciones en un solo pasaje', () => {
    expect(normalizeText('“ﬁle — draft”')).toBe('"file - draft"');
  });

  it('deja texto ya limpio sin cambios', () => {
    expect(normalizeText('Senior Developer, Madrid')).toBe(
      'Senior Developer, Madrid',
    );
  });
});
