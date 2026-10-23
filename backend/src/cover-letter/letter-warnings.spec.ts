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

  it('marca una skill de la oferta que el perfil no tiene, aunque se niegue', () => {
    const warnings = validateLetter(
      'Construí APIs con NestJS. No tengo experiencia con Kubernetes.',
      {
        ...base,
        lang: 'es',
        missingSkills: ['Kubernetes', 'Terraform'],
      },
    );

    expect(warnings).toEqual([{ code: 'MISSING_SKILL', detail: 'Kubernetes' }]);
  });

  it('marca años de experiencia que el perfil no indica, aunque la oferta los tenga', () => {
    const warnings = validateLetter(
      'Tengo más de 4 años de experiencia en APIs.',
      {
        ...base,
        lang: 'es',
        profileText: '{"experiences":[{"position":"Backend Engineer"}]}',
      },
    );

    expect(warnings).toEqual([{ code: 'UNSUPPORTED_YEARS', detail: '4 años' }]);
  });

  it('acepta años de experiencia que el perfil sí indica', () => {
    const warnings = validateLetter('Tengo 4 años de experiencia en APIs.', {
      ...base,
      lang: 'es',
      profileText: '{"summary":"4 años de experiencia en backend"}',
    });

    expect(
      warnings.some((warning) => warning.code === 'UNSUPPORTED_YEARS'),
    ).toBe(false);
  });

  it('un nivel de skill numérico no respalda años de experiencia', () => {
    const warnings = validateLetter('Tengo 4 años de experiencia en APIs.', {
      ...base,
      lang: 'es',
      profileText: '{"skills":[{"name":"NestJS","level":4}]}',
    });

    expect(warnings.map((warning) => warning.code)).toEqual([
      'UNSUPPORTED_YEARS',
    ]);
  });

  it('marca el sector de un empleador que el perfil no indica', () => {
    const warnings = validateLetter(
      'Desarrollé APIs en una empresa del sector tecnológico.',
      { ...base, lang: 'es', profileText: '{"skills":["NestJS"]}' },
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      'UNSUPPORTED_SECTOR',
    ]);
  });

  it('no aplica la regla a cartas en inglés', () => {
    const warnings = validateLetter('I built the API using NestJS.', {
      ...base,
      lang: 'en',
    });

    expect(warnings.some((warning) => warning.code === 'GERUND')).toBe(false);
  });
});
