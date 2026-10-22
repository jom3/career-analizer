import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverLetterWarningCode } from './letter-validators';
import { validateLetter } from './letter-validators';

interface ValidationCase {
  id: string;
  lang: 'es' | 'en';
  text: string;
  employers: string[];
  targetCompany: string | null;
  expect: { violations: CoverLetterWarningCode[] };
}

const cases: ValidationCase[] = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      'test',
      'fixtures',
      'evals',
      'letter-validation.json',
    ),
    'utf8',
  ),
) as ValidationCase[];

describe('validateLetter', () => {
  it('cubre los 10 casos de evaluación', () => {
    for (const testCase of cases) {
      const warnings = validateLetter(testCase.text, {
        lang: testCase.lang,
        employers: testCase.employers,
        targetCompany: testCase.targetCompany,
      });

      expect(warnings.map((warning) => warning.code)).toEqual(
        testCase.expect.violations,
      );
    }
  });

  it('acepta una carta limpia', () => {
    const warnings = validateLetter(
      'Diseñé una plataforma para un centro de salud. Estoy disponible para una entrevista esta semana.',
      { lang: 'es', employers: ['Acme'], targetCompany: null },
    );

    expect(warnings).toEqual([]);
  });

  it('marca el límite de palabras con el conteo', () => {
    const content = Array.from({ length: 200 }, () => 'palabra').join(' ');

    const warnings = validateLetter(content, {
      lang: 'es',
      employers: [],
      targetCompany: null,
    });

    expect(warnings).toEqual([{ code: 'WORD_LIMIT', detail: '200' }]);
  });

  it('marca un adjetivo vacío aunque el número esté en otra oración', () => {
    const warnings = validateLetter(
      'Reduje la latencia un 30%. Tengo un nivel avanzado en Node.js. Estoy disponible para una entrevista.',
      { lang: 'es', employers: [], targetCompany: null },
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      'EMPTY_ADJECTIVE',
    ]);
  });

  it('no marca como vacío un adjetivo con evidencia numérica cerca', () => {
    const warnings = validateLetter(
      'Reduje la latencia en consultas eficientes de 320 ms a 180 ms. Estoy disponible para una entrevista.',
      { lang: 'es', employers: [], targetCompany: null },
    );

    expect(warnings).toEqual([]);
  });

  it('detecta un cierre genérico por aportar al equipo', () => {
    const warnings = validateLetter(
      'Construí APIs con NestJS. Espero poder aportar al crecimiento del equipo.',
      { lang: 'es', employers: [], targetCompany: null },
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      'GENERIC_CLOSING',
    ]);
  });
});
