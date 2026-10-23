import type { ProfileSnapshot } from '../job-match/profile-util';

// Una carta necesita evidencia del candidato: al menos una skill y una
// experiencia descrita o un proyecto. Con menos, la IA solo puede inventar.
export function hasEnoughEvidence(profile: ProfileSnapshot): boolean {
  const hasDescribedExperience = profile.experiences.some((experience) =>
    Boolean(experience.description?.trim()),
  );
  const hasProject = profile.projects.length > 0;
  return profile.skills.length > 0 && (hasDescribedExperience || hasProject);
}
