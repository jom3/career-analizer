import { createHash } from 'node:crypto';
import type { ProfileWithCollections } from '../profile/profile.service';

export interface ProfileSkillItem {
  name: string;
  level: number;
}

export interface ProfileExperienceItem {
  position: string;
  company: string;
  description: string | null;
  metrics: string[];
}

export interface ProfileEducationItem {
  degree: string;
  field: string | null;
  institution: string;
}

export interface ProfileCertificationItem {
  name: string;
}

export interface ProfileProjectItem {
  name: string;
  techStack: string[];
  description: string | null;
}

export interface ProfileLanguageItem {
  name: string;
  level: string;
}

// Vista agregada del perfil usada como entrada del matching. Solo refleja datos
// reales del Candidate Profile; es la base auditable contra la que la IA genera.
export interface ProfileSnapshot {
  skills: ProfileSkillItem[];
  experiences: ProfileExperienceItem[];
  education: ProfileEducationItem[];
  certifications: ProfileCertificationItem[];
  projects: ProfileProjectItem[];
  languages: ProfileLanguageItem[];
}

export function profileSnapshot(
  profile: ProfileWithCollections,
): ProfileSnapshot {
  return {
    skills: profile.skills.map((item) => ({
      name: item.name,
      level: item.level,
    })),
    experiences: profile.experiences.map((item) => ({
      position: item.position,
      company: item.company,
      description: item.description,
      metrics: item.metrics,
    })),
    education: profile.education.map((item) => ({
      degree: item.degree,
      field: item.field,
      institution: item.institution,
    })),
    certifications: profile.certifications.map((item) => ({ name: item.name })),
    projects: profile.projects.map((item) => ({
      name: item.name,
      techStack: item.techStack,
      description: item.description,
    })),
    languages: profile.languages.map((item) => ({
      name: item.name,
      level: item.level,
    })),
  };
}

function normalizeLength(n: number): string {
  return n.toString().padStart(3, '0');
}

function iterableToFingerprint(parts: string[]): string {
  const serialized = parts
    .map((part) => normalizeLength(part.length) + part)
    .join('');
  return createHash('sha256').update(serialized).digest('hex');
}

// Huella determinista del snapshot: cualquier cambio en los campos que afectan
// al matching cambia el hash y marca el match como stale.
export function profileFingerprint(snapshot: ProfileSnapshot): string {
  const parts: string[] = [];
  for (const skill of snapshot.skills) {
    parts.push(`skill:${skill.name}|${skill.level}`);
  }
  for (const experience of snapshot.experiences) {
    parts.push(
      `exp:${experience.position}|${experience.company}|${experience.description ?? ''}|${experience.metrics.join(',')}`,
    );
  }
  for (const education of snapshot.education) {
    parts.push(
      `edu:${education.degree}|${education.field ?? ''}|${education.institution}`,
    );
  }
  for (const certification of snapshot.certifications) {
    parts.push(`cert:${certification.name}`);
  }
  for (const project of snapshot.projects) {
    parts.push(
      `proj:${project.name}|${project.techStack.join(',')}|${project.description ?? ''}`,
    );
  }
  for (const language of snapshot.languages) {
    parts.push(`lang:${language.name}|${language.level}`);
  }
  return iterableToFingerprint(parts);
}

function skillToken(text: string): string {
  return text.trim().toLowerCase();
}

// Conjunto de skills que la oferta declara (requeridos, preferidos y los citados
// en el resumen de experiencia). El matching solo puede listar gaps entre estos:
// nunca se inventa un gap fuera de la oferta.
export function offerSkillWhitelist(offer: {
  requiredSkills?: string[];
  preferredSkills?: string[];
  experienceSummary?: string | null;
}): Set<string> {
  const whitelist = new Set<string>(
    [...(offer.requiredSkills ?? []), ...(offer.preferredSkills ?? [])].map(
      skillToken,
    ),
  );
  if (offer.experienceSummary) {
    for (const token of offer.experienceSummary
      .toLowerCase()
      .split(/[\s,;]+/)) {
      const cleaned = token.replace(/[^a-z0-9+#.-]/g, '');
      if (cleaned.length >= 2) {
        whitelist.add(cleaned);
      }
    }
  }
  return whitelist;
}

export function isWhitelistedSkill(
  name: string,
  whitelist: Set<string>,
): boolean {
  return whitelist.has(skillToken(name));
}
