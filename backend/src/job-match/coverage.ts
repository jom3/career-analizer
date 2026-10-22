import type { JobMatchGap } from './dto/job-match.dto';
import type { ProfileSnapshot } from './profile-util';

export const SCORING_VERSION = 2;

export interface CoverageResult {
  matched: string[];
  total: number;
  percent: number | null;
}

// Alias acotados: solo variantes inequívocas del mismo skill.
const ALIASES: Record<string, string> = {
  node: 'node.js',
  nodejs: 'node.js',
  'node.js': 'node.js',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
};

export function normalizeSkill(name: string): string {
  const key = name.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const skill of skills) {
    const key = normalizeSkill(skill);
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(skill.trim());
    }
  }
  return result;
}

// Evidencia explícita del perfil: skills declaradas y techStack de proyectos.
// El texto libre no cuenta para la cobertura.
export function profileEvidence(snapshot: ProfileSnapshot): Set<string> {
  const evidence = new Set<string>();
  for (const skill of snapshot.skills) {
    evidence.add(normalizeSkill(skill.name));
  }
  for (const project of snapshot.projects) {
    for (const tech of project.techStack) {
      evidence.add(normalizeSkill(tech));
    }
  }
  return evidence;
}

export function computeCoverage(
  requiredSkills: string[],
  snapshot: ProfileSnapshot,
): CoverageResult {
  const required = uniqueSkills(requiredSkills ?? []);
  if (required.length === 0) {
    return { matched: [], total: 0, percent: null };
  }
  const evidence = profileEvidence(snapshot);
  const matched = required.filter((skill) =>
    evidence.has(normalizeSkill(skill)),
  );
  return {
    matched,
    total: required.length,
    percent: Math.round((matched.length / required.length) * 100),
  };
}

// 50/50 entre cobertura determinista y evaluación de la IA. Sin requisitos
// declarados, el score es el de la IA.
export function weightedScore(
  coverage: CoverageResult,
  aiScore: number,
): number {
  if (coverage.percent === null) {
    return aiScore;
  }
  return Math.round(0.5 * coverage.percent + 0.5 * aiScore);
}

// La cobertura manda sobre la IA en la dirección "tiene la skill". Al revés,
// sin evidencia determinista un HAVE se degrada a PARTIAL.
export function reconcileGaps(
  gaps: JobMatchGap[],
  matched: string[],
  lang: 'es' | 'en',
): JobMatchGap[] {
  const evidence = new Set(matched.map(normalizeSkill));
  const partialNote = lang === 'es' ? 'evidencia parcial' : 'partial evidence';

  return gaps.map((gap) => {
    const hasEvidence = evidence.has(normalizeSkill(gap.name));
    if (hasEvidence && gap.status !== 'HAVE') {
      return { ...gap, status: 'HAVE' };
    }
    if (!hasEvidence && gap.status === 'HAVE') {
      return { ...gap, status: 'PARTIAL', note: gap.note ?? partialNote };
    }
    return gap;
  });
}
