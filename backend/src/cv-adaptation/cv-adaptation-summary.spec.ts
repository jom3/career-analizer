import { buildSummaryFacts } from './cv-adaptation-summary';
import type { AdaptedProfileSnapshot } from './cv-adaptation.types';

function makeProfile(overrides: Partial<AdaptedProfileSnapshot> = {}) {
  const base: AdaptedProfileSnapshot = {
    headline: 'Backend Developer',
    skills: [
      { id: 's1', name: 'TypeScript', level: 4 },
      { id: 's2', name: 'Angular', level: 4 },
      { id: 's3', name: 'Docker', level: 3 },
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
        metrics: ['Cut latency by 40%'],
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
  };
  return { ...base, ...overrides };
}

describe('buildSummaryFacts (fact sheet determinista)', () => {
  it('toma el rol del headline y la antigüedad de fechas reales', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile(),
      matchedSkills: ['TypeScript'],
      sourceLanguage: 'es',
    });

    expect(facts.role).toBe('Backend Developer');
    expect(facts.years).toBeGreaterThanOrEqual(1);
  });

  it('cae al cargo de la experiencia más reciente si no hay headline', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({ headline: null }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.role).toContain('Senior Engineer');
    expect(facts.role).toContain('Acme');
  });

  it('no afirma antigüedad cuando no hay fechas', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
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
      }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.years).toBeNull();
    expect(facts.role).toContain('Senior Engineer');
  });

  it('deriva modalidad freelance de la empresa actual', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        experiences: [
          {
            id: 'e1',
            position: 'Developer',
            company: 'Freelance',
            location: null,
            startDate: new Date('2020-01-01'),
            endDate: null,
            current: true,
            description: null,
            metrics: [],
          },
        ],
      }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.workType).toBe('freelance');
    expect(facts.currentCompany).toBe('Freelance');
  });

  it('deriva modalidad salarial de una empresa real no freelance', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile(),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.workType).toBe('salaried');
    expect(facts.currentCompany).toBe('Acme');
  });

  it('deja la modalidad en null cuando no hay experiencia actual', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({ experiences: [] }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.workType).toBeNull();
    expect(facts.currentCompany).toBeNull();
  });

  it('selecciona skills destacadas solo de nivel >= 4, matcheadas primero', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile(),
      matchedSkills: ['Docker', 'Angular', 'TypeScript'],
      sourceLanguage: 'es',
    });

    // Docker (nivel 3) queda fuera del resumen; las de nivel >= 4 entran.
    expect(facts.featuredSkills).toEqual(['Angular', 'TypeScript']);
    expect(facts.featuredSkills).not.toContain('Docker');
  });

  it('cae al top por nivel cuando no hay matcheadas de nivel alto', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile(),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.featuredSkills).toEqual(['TypeScript', 'Angular']);
    expect(facts.featuredSkills).not.toContain('Docker');
  });

  it('deja vacías las skills destacadas si no hay skills de nivel alto', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        skills: [
          { id: 's1', name: 'Docker', level: 3 },
          { id: 's2', name: 'Prisma', level: 2 },
        ],
      }),
      matchedSkills: ['Docker', 'Prisma'],
      sourceLanguage: 'es',
    });

    expect(facts.featuredSkills).toEqual([]);
  });

  it('incluye skills de nivel bajo usadas en el proyecto destacado', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        skills: [
          { id: 's1', name: 'TypeScript', level: 4 },
          { id: 's2', name: 'Angular', level: 4 },
          { id: 's3', name: 'Docker', level: 3 },
          { id: 's4', name: 'Prisma', level: 3 },
        ],
        projects: [
          {
            id: 'p1',
            name: 'Career Analyzer',
            role: null,
            description: 'A tool for job search assistance.',
            url: null,
            techStack: ['Angular', 'Prisma', 'Docker'],
            metrics: [],
          },
        ],
      }),
      matchedSkills: ['Angular', 'Docker', 'Prisma'],
      sourceLanguage: 'es',
    });

    // El stack real del proyecto destaca primero (Angular, Prisma, Docker);
    // Prisma y Docker son nivel bajo pero se usaron de verdad en el proyecto.
    expect(facts.featuredSkills).toEqual(['Angular', 'Prisma', 'Docker']);
  });

  it('rellena con skills avanzadas si el proyecto usa pocas', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        projects: [
          {
            id: 'p1',
            name: 'Career Analyzer',
            role: null,
            description: 'A tool for job search assistance.',
            url: null,
            techStack: ['Docker'],
            metrics: [],
          },
        ],
      }),
      matchedSkills: ['Angular', 'TypeScript', 'Docker'],
      sourceLanguage: 'es',
    });

    // Docker (proyecto) primero, luego las avanzadas Angular y TypeScript.
    expect(facts.featuredSkills).toEqual(['Docker', 'Angular', 'TypeScript']);
  });

  it('deduce la cualidad de adaptabilidad cuando hay stacks variados', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        skills: [
          { id: 's1', name: 'Angular', level: 4 },
          { id: 's2', name: 'Node', level: 4 },
          { id: 's3', name: 'Docker', level: 4 },
          { id: 's4', name: 'PostgreSQL', level: 4 },
        ],
      }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.quality?.kind).toBe('adaptable-stacks');
  });

  it('deduce la cualidad de código mantenible con evidencia en descripciones', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        skills: [{ id: 's1', name: 'TypeScript', level: 4 }],
        experiences: [
          {
            id: 'e1',
            position: 'Developer',
            company: 'Acme',
            location: null,
            startDate: new Date('2020-01-01'),
            endDate: null,
            current: true,
            description:
              'Refactoring and testing to keep the codebase maintainable.',
            metrics: [],
          },
        ],
      }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.quality?.kind).toBe('maintainable-code');
  });

  it('deduce la cualidad de desempeño con métricas de resultado', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        skills: [{ id: 's1', name: 'TypeScript', level: 4 }],
      }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.quality?.kind).toBe('performance');
    expect(facts.quality?.evidence).toBe('Cut latency by 40%');
  });

  it('omite la cualidad si no hay evidencia', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        headline: null,
        skills: [],
        experiences: [],
        projects: [],
      }),
      matchedSkills: [],
      sourceLanguage: 'es',
    });

    expect(facts.quality).toBeNull();
  });

  it('elige el proyecto más relevante a la oferta (techStack/descripción)', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        projects: [
          {
            id: 'p1',
            name: 'Legacy App',
            role: null,
            description: null,
            url: null,
            techStack: ['Java'],
            metrics: [],
          },
          {
            id: 'p2',
            name: 'Career Analyzer',
            role: null,
            description: 'A tool that matches candidates to job offers.',
            url: null,
            techStack: ['Angular', 'NestJS'],
            metrics: ['Matches 500 CVs per week'],
          },
        ],
      }),
      matchedSkills: ['Angular'],
      sourceLanguage: 'es',
    });

    expect(facts.featuredProject?.name).toBe('Career Analyzer');
    expect(facts.featuredProject?.description).toContain('matches candidates');
    expect(facts.featuredProject?.metrics).toEqual([
      'Matches 500 CVs per week',
    ]);
  });

  it('omite el proyecto destacado si ninguno cita skills de la oferta', () => {
    const facts = buildSummaryFacts({
      profile: makeProfile({
        projects: [
          {
            id: 'p1',
            name: 'Legacy App',
            role: null,
            description: null,
            url: null,
            techStack: ['Java'],
            metrics: [],
          },
        ],
      }),
      matchedSkills: ['Angular'],
      sourceLanguage: 'es',
    });

    expect(facts.featuredProject).toBeNull();
  });

  it('resuelve el idioma es/en', () => {
    const es = buildSummaryFacts({
      profile: makeProfile(),
      matchedSkills: [],
      sourceLanguage: 'es',
    });
    const en = buildSummaryFacts({
      profile: makeProfile(),
      matchedSkills: [],
      sourceLanguage: 'en',
    });

    expect(es.lang).toBe('es');
    expect(en.lang).toBe('en');
  });
});
