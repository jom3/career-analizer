import type { AdaptedProfileSnapshot } from './cv-adaptation.types';
import { HIGH_SKILL_MIN } from './skill-level';

// Hechos reales del perfil que la IA redacta como resumen (SPEC 20):
// el sistema elige QUÉ puede decirse a partir de datos verdaderos y la IA solo
// lo escribe en prosa natural. Jamás se inventa: sin rol inventado, sin años sin
// fechas, sin skills de nivel bajo, sin missing skills, sin cualidades sin evidencia.

export interface SummaryProjectFact {
  name: string;
  description: string | null;
  techStack: string[];
  metrics: string[];
}

export type SummaryQualityFact =
  | { kind: 'adaptable-stacks'; evidence: string[] }
  | { kind: 'maintainable-code'; evidence: string }
  | { kind: 'performance'; evidence: string };

export interface SummaryFacts {
  role: string | null;
  years: number | null;
  workType: 'freelance' | 'salaried' | null;
  currentCompany: string | null;
  featuredProject: SummaryProjectFact | null;
  featuredSkills: string[];
  quality: SummaryQualityFact | null;
  lang: 'es' | 'en';
}

export interface DeterministicSummaryInput {
  profile: AdaptedProfileSnapshot;
  matchedSkills: string[];
  sourceLanguage: string | null;
}

// Selección determinista de los hechos que la IA puede afirmar en el resumen.
// Reglas de verdad (todas derivan de datos reales del perfil):
// - Rol: headline del perfil o el cargo/empresa de la experiencia más reciente.
// - Antigüedad: solo si hay fechas reales que la calculen (>= 1 año).
// - Modalidad: freelance si la empresa actual lo sugiere; salarial si hay empresa
//   real; null si no hay experiencia actual.
// - Proyecto destacado: el más relevante a la oferta (techStack/descripción que
//   citan skills matcheadas); su propósito es la descripción real.
// - Skills destacadas: solo nivel >= 4 (avanzado/experto), matcheadas primero,
//   máx 3. Las de nivel bajo se omiten del resumen (van en la sección de skills).
// - Cualidad transferible: solo si hay evidencia real (stacks variados, mención
//   de mantenibilidad/escalabilidad, o métricas de resultado).
export function buildSummaryFacts(
  input: DeterministicSummaryInput,
): SummaryFacts {
  const { profile, matchedSkills, sourceLanguage } = input;
  const lang = languageOf(sourceLanguage);
  const recent = mostRecentExperience(profile);
  const project = featuredProject(profile, matchedSkills);

  return {
    role: roleFromProfile(profile),
    years: yearsOfExperience(profile),
    workType: workTypeOf(recent),
    currentCompany: recent?.company?.trim() || null,
    featuredProject: project,
    featuredSkills: featuredSkills(profile, matchedSkills, project),
    quality: transferableQuality(profile),
    lang,
  };
}

function languageOf(sourceLanguage: string | null): 'es' | 'en' {
  const lower = sourceLanguage?.toLowerCase() ?? '';
  if (lower.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

// Rol real: headline del perfil, o el cargo más reciente con empresa del perfil.
function roleFromProfile(profile: AdaptedProfileSnapshot): string | null {
  if (profile.headline && profile.headline.trim().length > 0) {
    return profile.headline.trim();
  }
  const recent = mostRecentExperience(profile);
  if (!recent) {
    return null;
  }
  const company = recent.company?.trim();
  if (!company) {
    return recent.position.trim();
  }
  return `${recent.position.trim()} at ${company}`;
}

// Antigüedad computada: se unifican los rangos con fechas reales y se suma el
// tiempo cubierto. Solo devuelve años enteros cuando el resultado es >= 1.
function yearsOfExperience(profile: AdaptedProfileSnapshot): number | null {
  const spans = profile.experiences
    .map((item) => {
      if (!item.startDate) return null;
      const start = item.startDate.getTime();
      const end = item.current ? Date.now() : (item.endDate?.getTime() ?? null);
      if (end === null || end <= start) return null;
      return { start, end };
    })
    .filter((span): span is { start: number; end: number } => span !== null)
    .sort((a, b) => a.start - b.start);

  if (spans.length === 0) return null;

  let coveredMs = 0;
  let rangeStart = spans[0].start;
  let rangeEnd = spans[0].end;
  for (let i = 1; i < spans.length; i++) {
    const span = spans[i];
    if (span.start <= rangeEnd) {
      rangeEnd = Math.max(rangeEnd, span.end);
    } else {
      coveredMs += rangeEnd - rangeStart;
      rangeStart = span.start;
      rangeEnd = span.end;
    }
  }
  coveredMs += rangeEnd - rangeStart;

  const years = Math.floor(coveredMs / (365.25 * 24 * 3600 * 1000));
  return years >= 1 ? years : null;
}

function mostRecentExperience(
  profile: AdaptedProfileSnapshot,
): AdaptedProfileSnapshot['experiences'][number] | null {
  return (
    [...profile.experiences].sort(
      (a, b) => relevanceOf(b) - relevanceOf(a),
    )[0] ?? null
  );
}

// Modalidad laboral derivada de la empresa actual (real, no inventada):
// nombres que sugieren freelance/independiente → 'freelance'; empresa real
// no freelance → 'salaried'; sin experiencia actual → null.
function workTypeOf(
  recent: AdaptedProfileSnapshot['experiences'][number] | null,
): 'freelance' | 'salaried' | null {
  if (!recent) {
    return null;
  }
  const company = recent.company?.trim().toLowerCase() ?? '';
  const freelanceHint = [
    'freelance',
    'freelancer',
    'independiente',
    'independiente',
    'autónomo',
    'autonoma',
    'self-employed',
    'independent',
  ];
  if (freelanceHint.some((token) => company.includes(token))) {
    return 'freelance';
  }
  return company.length > 0 ? 'salaried' : null;
}

// Proyecto más relevante a la oferta: el que cita más skills matcheadas en su
// techStack, nombre o descripción. Su propósito para el resumen es la descripción
// real (nunca se inventa una frase de propósito sin dato).
function featuredProject(
  profile: AdaptedProfileSnapshot,
  matchedSkills: string[],
): SummaryProjectFact | null {
  const projects = profile.projects.filter((item) => item.name?.trim());
  if (projects.length === 0) {
    return null;
  }
  const scored = projects
    .map((item) => ({ item, score: relevanceScore(item, matchedSkills) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score === 0) {
    return null;
  }
  return {
    name: best.item.name.trim(),
    description: best.item.description?.trim() || null,
    techStack: best.item.techStack,
    metrics: best.item.metrics,
  };
}

function relevanceScore(
  project: AdaptedProfileSnapshot['projects'][number],
  matchedSkills: string[],
): number {
  const haystack = [
    project.name,
    project.description ?? '',
    ...project.techStack,
    ...project.metrics,
  ]
    .join(' ')
    .toLowerCase();
  return matchedSkills.filter((skill) => haystack.includes(skill.toLowerCase()))
    .length;
}

// Skills destacadas del resumen: las usadas en el proyecto destacado (stack
// real, evidencia de uso) primero, luego las de nivel >= 4 (avanzado/experto),
// matcheadas con prioridad, máx 3. Skills de nivel bajo NO usadas en el proyecto
// quedan fuera del resumen (viven en la sección de skills, regla SPEC 20).
function featuredSkills(
  profile: AdaptedProfileSnapshot,
  matchedSkills: string[],
  project: SummaryProjectFact | null,
): string[] {
  const levelByName = new Map(
    profile.skills
      .filter((item) => item.name.trim().length > 0)
      .map((item) => [normalizeSkillName(item.name), item] as const),
  );

  // 1) skills usadas realmente en el proyecto destacado (techStack).
  const projectUsed = (project?.techStack ?? [])
    .filter((name) => levelByName.has(normalizeSkillName(name)))
    .map((name) => name.trim());

  // 2) avanzadas (nivel >= 4): las matcheadas primero (orden del match), luego
  // el resto por nivel descendente.
  const highLevelByName = new Map(
    profile.skills
      .filter((item) => item.level >= HIGH_SKILL_MIN && item.name.trim())
      .map((item) => [normalizeSkillName(item.name), item] as const),
  );
  const matchedHigh = matchedSkills
    .map((name) => normalizeSkillName(name))
    .filter((normalized) => highLevelByName.has(normalized));
  const advanced = matchedHigh
    .map((normalized) => highLevelByName.get(normalized)?.name.trim() ?? '')
    .filter((name) => name.length > 0)
    .concat(
      [...highLevelByName.values()]
        .filter((item) => !matchedHigh.includes(normalizeSkillName(item.name)))
        .sort((a, b) => b.level - a.level)
        .map((item) => item.name.trim()),
    );

  const ordered = [...projectUsed, ...advanced].filter(
    (name) => name.length > 0,
  );
  return [...new Set(ordered)].slice(0, 3);
}

// Cualidad transferible SOLO si hay evidencia real:
// - stacks variados (>= 3 categorías tecnológicas) → adaptabilidad a stacks.
// - descripciones que mencionan mantenibilidad/escalabilidad/testing → código
//   mantenible.
// - métricas de resultado → desempeño/resolución de problemas.
// Sin evidencia se omite la cualidad (mejor callar que inventar).
function transferableQuality(
  profile: AdaptedProfileSnapshot,
): SummaryQualityFact | null {
  const stacks = distinctSkillCategories(profile.skills.map((s) => s.name));
  if (stacks.length >= 3) {
    return { kind: 'adaptable-stacks', evidence: stacks };
  }

  const prose = [
    ...profile.experiences.map((item) => item.description ?? ''),
    ...profile.projects.map((item) => item.description ?? ''),
  ]
    .join(' ')
    .toLowerCase();
  const maintainableHints = [
    'mantenible',
    'mantenibilidad',
    'maintainable',
    'maintainability',
    'escalable',
    'scalable',
    'refactor',
    'testing',
    'test coverage',
    'clean code',
  ];
  if (maintainableHints.some((token) => prose.includes(token))) {
    return { kind: 'maintainable-code', evidence: prose.trim() };
  }

  const metrics = [...profile.experiences, ...profile.projects]
    .flatMap((item) => item.metrics)
    .filter((metric) => metric.trim().length > 0);
  if (metrics.length > 0) {
    return { kind: 'performance', evidence: metrics[0].trim() };
  }

  return null;
}

// Categorías tecnológicas reales de las skills del perfil (heurística por token).
// Se usan como evidencia de adaptabilidad: cuantas más categorías distintas,
// más creíble decir que el candidato se adapta a distintos stacks.
const SKILL_CATEGORIES: ReadonlyArray<{ category: string; tokens: string[] }> =
  [
    {
      category: 'frontend',
      tokens: [
        'react',
        'angular',
        'vue',
        'svelte',
        'css',
        'html',
        'tailwind',
        'sass',
        'typescript',
      ],
    },
    {
      category: 'backend',
      tokens: [
        'node',
        'nest',
        'express',
        'fastify',
        'python',
        'django',
        'flask',
        'java',
        'spring',
        'go',
        'golang',
        'dotnet',
        'php',
        'laravel',
      ],
    },
    {
      category: 'database',
      tokens: [
        'postgres',
        'postgresql',
        'mysql',
        'mongo',
        'mongodb',
        'prisma',
        'redis',
        'sql',
        'dynamo',
        'supabase',
      ],
    },
    {
      category: 'devops',
      tokens: [
        'docker',
        'kubernetes',
        'k8s',
        'aws',
        'gcp',
        'azure',
        'terraform',
        'ci',
        'ci/cd',
        'github actions',
        'cloud',
      ],
    },
    {
      category: 'testing',
      tokens: ['jest', 'vitest', 'playwright', 'cypress', 'testing'],
    },
  ];

function distinctSkillCategories(names: string[]): string[] {
  const categories = new Set<string>();
  for (const name of names) {
    const lower = name.trim().toLowerCase();
    for (const group of SKILL_CATEGORIES) {
      if (group.tokens.some((token) => lower.includes(token))) {
        categories.add(group.category);
      }
    }
  }
  return [...categories];
}

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function relevanceOf(item: {
  startDate: Date | null;
  endDate: Date | null;
  current: boolean;
}): number {
  const end = item.current ? Date.now() : (item.endDate?.getTime() ?? 0);
  return end;
}
