import { validateLetter } from './letter-validators';
import { findSpanishGerunds } from './spanish-gerunds';

describe('findSpanishGerunds', () => {
  it('detecta gerundios con y sin tilde y con pronombre enclítico', () => {
    expect(
      findSpanishGerunds(
        'Desarrollé APIs utilizando NestJS, logrando una mejora.',
      ),
    ).toEqual(['utilizando', 'logrando']);
    expect(
      findSpanishGerunds('Ayudándole al equipo y construyendo tableros'),
    ).toEqual(['Ayudándole', 'construyendo']);
  });

  it('no marca palabras que terminan igual pero no son gerundios', () => {
    expect(
      findSpanishGerunds(
        'Cuando entiendo el negocio, Fernando mando el reporte.',
      ),
    ).toEqual([]);
  });

  it('no marca texto sin gerundios', () => {
    expect(findSpanishGerunds('Diseñé una API con NestJS.')).toEqual([]);
  });
});

describe('validateLetter con gerundios', () => {
  const base = { employers: [], targetCompany: null };

  it('agrega la advertencia GERUND en cartas en español', () => {
    const warnings = validateLetter(
      'Construí la API con NestJS, utilizando PostgreSQL.',
      { ...base, lang: 'es' },
    );

    expect(warnings).toEqual([{ code: 'GERUND', detail: 'utilizando' }]);
  });

  it('no aplica la regla a cartas en inglés', () => {
    const warnings = validateLetter('I built the API using NestJS.', {
      ...base,
      lang: 'en',
    });

    expect(warnings.some((warning) => warning.code === 'GERUND')).toBe(false);
  });
});
