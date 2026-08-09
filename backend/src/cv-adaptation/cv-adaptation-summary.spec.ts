import { buildDeterministicSummary } from './cv-adaptation-summary';
import type { AdaptedProfileSnapshot } from './cv-adaptation.types';

describe('buildDeterministicSummary', () => {
  const profile: AdaptedProfileSnapshot = {
    headline: 'Backend Developer',
    skills: [
      { id: 's1', name: 'TypeScript', level: 4 },
      { id: 's2', name: 'Angular', level: 4 },
    ],
    experiences: [
      {
        id: 'e1',
        position: 'Senior Engineer',
        company: 'Acme',
        location: null,
        startDate: new Date('2020-01-01'),
        endDate: null,
        current: true,
        description: null,
        metrics: [],
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
  };

  it('construye resumen con rol, skills matcheadas y línea de compromiso honesta', () => {
    const result = buildDeterministicSummary({
      profile,
      matchedSkills: ['TypeScript', 'Angular'],
      missingSkills: ['NestJS'],
      sourceLanguage: 'es',
    });

    expect(result).toBeTruthy();
    expect(result).toContain('Backend Developer');
    expect(result).toContain('TypeScript');
    expect(result).toContain('Angular');
    expect(result).toContain('Compromiso con el aprendizaje de NestJS');
  });

  it('incluye antigüedad solo cuando hay fechas reales', () => {
    const result = buildDeterministicSummary({
      profile,
      matchedSkills: [],
      missingSkills: [],
      sourceLanguage: 'es',
    });

    expect(result).toContain('años de experiencia');
  });

  it('no afirma antigüedad cuando no hay fechas', () => {
    const result = buildDeterministicSummary({
      profile: {
        ...profile,
        headline: null,
        experiences: [
          {
            id: 'e1',
            position: 'Senior Engineer',
            company: 'Acme',
            location: null,
            startDate: null,
            endDate: null,
            current: true,
            description: null,
            metrics: [],
          },
        ],
      },
      matchedSkills: [],
      missingSkills: [],
      sourceLanguage: 'es',
    });

    expect(result).not.toContain('años de experiencia');
    expect(result).toContain('Senior Engineer');
  });

  it('usa el headline y skills reales, sin tecnologías inventadas', () => {
    const result = buildDeterministicSummary({
      profile,
      matchedSkills: ['TypeScript'],
      missingSkills: [],
      sourceLanguage: 'en',
    });

    expect(result).toContain('Backend Developer');
    expect(result).toContain('Experience with TypeScript');
    expect(result).not.toContain('Python');
    expect(result).not.toContain('Django');
    expect(result).not.toContain('FastAPI');
    expect(result).not.toContain('PostgreSQL');
  });

  it('devuelve null cuando no hay datos en el perfil', () => {
    const result = buildDeterministicSummary({
      profile: { ...profile, headline: null, experiences: [], skills: [] },
      matchedSkills: [],
      missingSkills: [],
      sourceLanguage: 'es',
    });

    expect(result).toBeNull();
  });

  it('no menciona skills faltantes como poseídas, solo como compromiso', () => {
    const result = buildDeterministicSummary({
      profile,
      matchedSkills: ['TypeScript'],
      missingSkills: ['Docker'],
      sourceLanguage: 'es',
    });

    const sentences = result ?? '';
    expect(sentences).not.toContain('Experiencia en Docker');
    expect(sentences).toContain('Compromiso con el aprendizaje de Docker');
  });
});
