import { extractFirstUrl } from './extract-url';

describe('extractFirstUrl', () => {
  it('devuelve la primera URL http(s) del texto', () => {
    expect(
      extractFirstUrl('Postulate en https://jobs.example.com/offers/42 hoy'),
    ).toBe('https://jobs.example.com/offers/42');
  });

  it('quita la puntuación final pegada a la URL', () => {
    expect(extractFirstUrl('Link: https://example.com/job.')).toBe(
      'https://example.com/job',
    );
  });

  it('devuelve null si el texto no contiene URL', () => {
    expect(extractFirstUrl('Buscamos un desarrollador senior')).toBeNull();
  });

  it('devuelve null si la URL supera el largo máximo', () => {
    const longUrl = `https://example.com/${'a'.repeat(2048)}`;
    expect(extractFirstUrl(longUrl)).toBeNull();
  });
});
