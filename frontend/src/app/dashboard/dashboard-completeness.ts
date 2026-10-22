import type { Profile } from '../core/models/profile';

export interface ProfileLike {
  headline: string | null;
  summary: string | null;
  experiences: unknown[];
  education: unknown[];
  skills: unknown[];
  projects: unknown[];
  certifications: unknown[];
  languages: unknown[];
}

export const COMPLETENESS_SECTIONS = [
  'dashboard.sectionIntro',
  'dashboard.sectionExperience',
  'dashboard.sectionEducation',
  'dashboard.sectionSkills',
  'dashboard.sectionProjects',
  'dashboard.sectionLanguages',
] as const;

// Secciones vacías del perfil. Un perfil sin datos cuenta como todo pendiente.
export function missingProfileSections(
  profile: ProfileLike | Profile | null,
): string[] {
  if (!profile) {
    return [...COMPLETENESS_SECTIONS];
  }
  const complete: Record<string, boolean> = {
    'dashboard.sectionIntro': Boolean(
      profile.headline?.trim() || profile.summary?.trim(),
    ),
    'dashboard.sectionExperience': profile.experiences.length > 0,
    'dashboard.sectionEducation': profile.education.length > 0,
    'dashboard.sectionSkills': profile.skills.length > 0,
    'dashboard.sectionProjects':
      profile.projects.length > 0 || profile.certifications.length > 0,
    'dashboard.sectionLanguages': profile.languages.length > 0,
  };
  return COMPLETENESS_SECTIONS.filter((key) => !complete[key]);
}

export function completenessPercent(missing: string[]): number {
  const total = COMPLETENESS_SECTIONS.length;
  return Math.round(((total - missing.length) / total) * 100);
}
