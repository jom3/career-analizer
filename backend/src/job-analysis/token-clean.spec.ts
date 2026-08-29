import { cleanStringArray } from './token-clean';

describe('cleanStringArray', () => {
  it('recorta y colapsa espacios', () => {
    expect(cleanStringArray(['  TypeScript  ', 'Node.js'])).toEqual([
      'TypeScript',
      'Node.js',
    ]);
  });

  it('quita puntuación final y adjetivos de nivel', () => {
    expect(
      cleanStringArray(['React avanzado.', 'Node.js.', 'PostgreSQL,']),
    ).toEqual(['React', 'Node.js', 'PostgreSQL']);
    expect(cleanStringArray(['Node.js senior'])).toEqual(['Node.js']);
  });

  it('descarta frases completas y marcadores de oración', () => {
    expect(
      cleanStringArray([
        'TypeScript',
        'Más de 3 años desarrollando aplicaciones Full Stack.',
        'Experiencia sólida con TypeScript.',
        'Español fluido.',
        'Experiencia Fintech',
        'GitHub Actions',
      ]),
    ).toEqual(['TypeScript', 'GitHub Actions']);
  });

  it('ignora valores que no son strings', () => {
    expect(cleanStringArray(['Git', 42, null, ''])).toEqual(['Git']);
  });
});
