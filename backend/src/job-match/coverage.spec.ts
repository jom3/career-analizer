import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeCoverage,
  normalizeSkill,
  reconcileGaps,
  weightedScore,
} from './coverage';
import type { ProfileSnapshot } from './profile-util';

interface ProfileFixture {
  id: string;
  snapshot: ProfileSnapshot;
}

interface OfferFixture {
  id: string;
  requiredSkills: string[];
}

interface CaseFixture {
  id: string;
  profile: string;
  offer: string;
  expect: { requiredMatched: string[]; coverage: number };
}

const fixturesDir = join(__dirname, '..', '..', 'test', 'fixtures', 'evals');

const profiles: ProfileFixture[] = JSON.parse(
  readFileSync(join(fixturesDir, 'profiles.json'), 'utf8'),
) as ProfileFixture[];
const offers: OfferFixture[] = JSON.parse(
  readFileSync(join(fixturesDir, 'offers.json'), 'utf8'),
) as OfferFixture[];
const cases: CaseFixture[] = JSON.parse(
  readFileSync(join(fixturesDir, 'cases.json'), 'utf8'),
) as CaseFixture[];

function profileOf(id: string): ProfileSnapshot {
  const profile = profiles.find((item) => item.id === id);
  if (!profile) {
    throw new Error(`Perfil de prueba inexistente: ${id}`);
  }
  return profile.snapshot;
}

function offerOf(id: string): OfferFixture {
  const offer = offers.find((item) => item.id === id);
  if (!offer) {
    throw new Error(`Oferta de prueba inexistente: ${id}`);
  }
  return offer;
}

describe('computeCoverage', () => {
  it('cubre los 10 casos de evaluación con la cobertura exacta', () => {
    for (const testCase of cases) {
      const result = computeCoverage(
        offerOf(testCase.offer).requiredSkills,
        profileOf(testCase.profile),
      );

      expect(result.matched).toEqual(testCase.expect.requiredMatched);
      expect(result.percent).toBe(testCase.expect.coverage);
    }
  });

  it('matchea alias entre oferta y perfil', () => {
    const result = computeCoverage(['Node', 'PostgreSQL'], profileOf('P1'));

    expect(result.matched).toEqual(['Node', 'PostgreSQL']);
    expect(result.percent).toBe(100);
  });

  it('cuenta la evidencia declarada en el techStack de proyectos', () => {
    const result = computeCoverage(['scikit-learn'], profileOf('P3'));

    expect(result.matched).toEqual(['scikit-learn']);
    expect(result.percent).toBe(100);
  });

  it('no cuenta menciones en texto libre', () => {
    const profile: ProfileSnapshot = {
      skills: [],
      experiences: [
        {
          position: 'Dev',
          company: 'Acme',
          description: 'Trabajé con Kubernetes en producción.',
          metrics: [],
        },
      ],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    };

    const result = computeCoverage(['Kubernetes'], profile);

    expect(result.matched).toEqual([]);
    expect(result.percent).toBe(0);
  });

  it('sin requisitos declarados la cobertura es null', () => {
    const result = computeCoverage([], profileOf('P1'));

    expect(result).toEqual({ matched: [], total: 0, percent: null });
  });

  it('cuenta una sola vez los requisitos repetidos', () => {
    const result = computeCoverage(
      ['PostgreSQL', 'postgres', 'Node'],
      profileOf('P1'),
    );

    expect(result.total).toBe(2);
    expect(result.percent).toBe(100);
  });
});

describe('normalizeSkill', () => {
  it('normaliza alias y mayúsculas', () => {
    expect(normalizeSkill('  NodeJS ')).toBe('node.js');
    expect(normalizeSkill('POSTGRES')).toBe('postgresql');
    expect(normalizeSkill('k8s')).toBe('kubernetes');
    expect(normalizeSkill('Angular')).toBe('angular');
  });
});

describe('weightedScore', () => {
  it('pondera 50/50 cobertura y score de IA', () => {
    const coverage = { matched: [], total: 3, percent: 67 };

    expect(weightedScore(coverage, 70)).toBe(69);
  });

  it('usa el score de IA cuando no hay requisitos', () => {
    const coverage = { matched: [], total: 0, percent: null };

    expect(weightedScore(coverage, 73)).toBe(73);
  });
});

describe('reconcileGaps', () => {
  it('corrige a HAVE un MISSING que tiene evidencia determinista', () => {
    const gaps = [
      {
        name: 'Node.js',
        status: 'MISSING' as const,
        source: 'REQUIRED' as const,
      },
    ];

    const result = reconcileGaps(gaps, ['Node.js'], 'es');

    expect(result[0].status).toBe('HAVE');
  });

  it('degrada a PARTIAL un HAVE sin evidencia determinista', () => {
    const gaps = [
      { name: 'Docker', status: 'HAVE' as const, source: 'REQUIRED' as const },
    ];

    const result = reconcileGaps(gaps, [], 'es');

    expect(result[0].status).toBe('PARTIAL');
    expect(result[0].note).toBe('evidencia parcial');
  });

  it('no toca los gaps que ya coinciden', () => {
    const gaps = [
      { name: 'Docker', status: 'HAVE' as const, source: 'REQUIRED' as const },
      { name: 'Go', status: 'MISSING' as const, source: 'REQUIRED' as const },
    ];

    expect(reconcileGaps(gaps, ['Docker'], 'es')).toEqual(gaps);
  });
});
