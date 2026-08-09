import type { AdaptedProfileSnapshot } from './cv-adaptation.types';

export interface DeterministicSummaryInput {
  profile: AdaptedProfileSnapshot;
  matchedSkills: string[];
  missingSkills: string[];
  sourceLanguage: string | null;
}

// Resumen determinista e inmutable (SPEC 12): se construye SOLO con datos reales
// del perfil y skills que la oferta declara. La IA jamás redacta el resumen.
//
// Reglas de verdad:
// - Rol: headline del perfil o el cargo/empresa real de la experiencia más
//   reciente. Nunca un cargo inventado.
// - Antigüedad: solo si hay fechas reales que la calculen (nunca se afirma
//   "más de N años" sin datos).
// - Habilidades: solo skills reales del perfil (las que pide la oferta primero).
// - Línea de compromiso: solo menciona tecnologías de la oferta que el perfil
//   no tiene; se expresa como compromiso de aprendizaje, no como posesión.
export function buildDeterministicSummary(
  input: DeterministicSummaryInput,
): string | null {
  const { profile, matchedSkills, missingSkills, sourceLanguage } = input;
  const lang = languageOf(sourceLanguage);

  const role = roleFromProfile(profile, lang);
  const years = yearsOfExperience(profile);
  const skills = languageJoinedList(
    matchedSkills.length > 0 ? matchedSkills : topProfileSkills(profile),
    lang,
  );
  const commitments = languageJoinedList(missingSkills, lang);

  const sentences: string[] = [];
  if (role && years !== null) {
    sentences.push(
      lang === 'es'
        ? `${role}, con más de ${years} años de experiencia.`
        : `${role}, with over ${years} years of experience.`,
    );
  } else if (role) {
    sentences.push(role + '.');
  } else if (years !== null) {
    sentences.push(
      lang === 'es'
        ? `Más de ${years} años de experiencia profesional.`
        : `Over ${years} years of professional experience.`,
    );
  }

  if (skills.length > 0) {
    sentences.push(
      lang === 'es'
        ? `Experiencia en ${skills}.`
        : `Experience with ${skills}.`,
    );
  }

  if (commitments.length > 0) {
    sentences.push(
      lang === 'es'
        ? `Compromiso con el aprendizaje de ${commitments} para aportar al rol.`
        : `Committed to learning ${commitments} to contribute to the role.`,
    );
  }

  return sentences.length > 0 ? sentences.join(' ') : null;
}

function languageOf(sourceLanguage: string | null): 'es' | 'en' {
  const lower = sourceLanguage?.toLowerCase() ?? '';
  if (lower.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

// Rol real: headline del perfil, o el cargo más reciente con empresa del perfil.
function roleFromProfile(
  profile: AdaptedProfileSnapshot,
  lang: 'es' | 'en',
): string | null {
  if (profile.headline && profile.headline.trim().length > 0) {
    return profile.headline.trim();
  }
  const recent = [...profile.experiences]
    .filter((item) => item.position?.trim())
    .sort((a, b) => relevanceOf(b) - relevanceOf(a))[0];
  if (!recent) {
    return null;
  }
  const company = recent.company?.trim();
  if (!company) {
    return recent.position.trim();
  }
  const connector = lang === 'es' ? 'en' : 'at';
  return `${recent.position.trim()} ${connector} ${company}`;
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

function topProfileSkills(profile: AdaptedProfileSnapshot): string[] {
  return profile.skills
    .filter((item) => item.name.trim().length > 0)
    .slice()
    .sort((a, b) => b.level - a.level)
    .slice(0, 5)
    .map((item) => item.name.trim());
}

function languageJoinedList(items: string[], lang: 'es' | 'en'): string {
  const clean = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) {
    return lang === 'es'
      ? `${clean[0]} y ${clean[1]}`
      : `${clean[0]} and ${clean[1]}`;
  }
  const conjunction = lang === 'es' ? 'y' : 'and';
  return `${clean.slice(0, -1).join(', ')} ${conjunction} ${clean[clean.length - 1]}`;
}

function relevanceOf(item: {
  startDate: Date | null;
  endDate: Date | null;
  current: boolean;
}): number {
  const end = item.current ? Date.now() : (item.endDate?.getTime() ?? 0);
  return end;
}
