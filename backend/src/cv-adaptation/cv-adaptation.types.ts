import { offerSkillWhitelist } from '../job-match/profile-util';
import type { ProfileWithCollections } from '../profile/profile.service';
import {
  matchedProfileSkillNames,
  orderedSkills,
  rankByRelevance,
} from './cv-adaptation-rules';

// --- Contenido adaptado (se persiste en AdaptedCv.content) ---
// Forma compatible con CvData del exportador (SPEC 07): las fechas se guardan
// como ISO strings y cada item conserva originalId para auditar contra el
// snapshot. Los campos estructurales son verbatim del perfil; solo summary y
// experiences[].description pueden venir reformulados por la IA.

export interface AdaptedExperienceItem {
  originalId: string;
  company: string;
  position: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  description?: string;
  metrics: string[];
}

export interface AdaptedSkillItem {
  name: string;
}

export interface AdaptedEducationItem {
  originalId: string;
  degree: string;
  institution: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface AdaptedCertificationItem {
  originalId: string;
  name: string;
  issuer?: string;
  year?: number;
}

export interface AdaptedProjectItem {
  originalId: string;
  name: string;
  role?: string;
  description?: string;
  url?: string;
  techStack: string[];
  metrics: string[];
}

export interface AdaptedLanguageItem {
  originalId: string;
  name: string;
  level: string;
}

export interface AdaptedCvContent {
  headline?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  summary?: string;
  experiences: AdaptedExperienceItem[];
  projects: AdaptedProjectItem[];
  skills: AdaptedSkillItem[];
  education: AdaptedEducationItem[];
  certifications: AdaptedCertificationItem[];
  languages: AdaptedLanguageItem[];
}

// --- Snapshot local enriquecido ---
// Superset del ProfileSnapshot compartido de SPEC 11 (agrega originalId,
// fechas, location, current, etc.) que se persiste como profileSnapshot del
// AdaptedCv para auditar que el contenido sea verbatim del perfil real.

export interface AdaptedProfileSnapshot {
  headline: string | null;
  skills: Array<{ id: string; name: string; level: number }>;
  experiences: Array<{
    id: string;
    position: string;
    company: string;
    location: string | null;
    startDate: Date | null;
    endDate: Date | null;
    current: boolean;
    description: string | null;
    metrics: string[];
  }>;
  education: Array<{
    id: string;
    degree: string;
    institution: string;
    field: string | null;
    startDate: Date | null;
    endDate: Date | null;
    current: boolean;
    description: string | null;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string | null;
    year: number | null;
    url: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    role: string | null;
    description: string | null;
    url: string | null;
    techStack: string[];
    metrics: string[];
  }>;
  languages: Array<{ id: string; name: string; level: string }>;
}

export interface RewriteResult {
  experienceDescriptions: Array<{ originalId: string; text: string }>;
}

export function adaptedProfileSnapshot(
  profile: ProfileWithCollections,
): AdaptedProfileSnapshot {
  return {
    headline: profile.headline ?? null,
    skills: profile.skills.map((item) => ({
      id: item.id,
      name: item.name,
      level: item.level,
    })),
    experiences: profile.experiences.map((item) => ({
      id: item.id,
      position: item.position,
      company: item.company,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      current: item.current,
      description: item.description,
      metrics: item.metrics,
    })),
    education: profile.education.map((item) => ({
      id: item.id,
      degree: item.degree,
      institution: item.institution,
      field: item.field,
      startDate: item.startDate,
      endDate: item.endDate,
      current: item.current,
      description: item.description,
    })),
    certifications: profile.certifications.map((item) => ({
      id: item.id,
      name: item.name,
      issuer: item.issuer,
      year: item.year,
      url: item.url,
    })),
    projects: profile.projects.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      description: item.description,
      url: item.url,
      techStack: item.techStack,
      metrics: item.metrics,
    })),
    languages: profile.languages.map((item) => ({
      id: item.id,
      name: item.name,
      level: item.level,
    })),
  };
}

// Contenido base del CV adaptado: reglas deterministas del sistema (skills de la
// intersección primero, items rankeados por relevancia, resto verbatim). La IA
// solo reescribe summary y experiences[].description (applyRewrites).
export function buildBaseContent(
  profile: ProfileWithCollections,
  offer: {
    requiredSkills?: string[];
    preferredSkills?: string[];
    experienceSummary?: string | null;
  },
): {
  content: AdaptedCvContent;
  matchedSkillNames: string[];
} {
  const whitelist = offerSkillWhitelist(offer);
  const matchedSkillNames = matchedProfileSkillNames(profile.skills, whitelist);
  const skillNames = orderedSkills(profile.skills, matchedSkillNames);

  const experiences = profile.experiences
    .filter((item) => item.company && item.position)
    .map((item) => ({
      originalId: item.id,
      company: item.company,
      position: item.position,
      location: item.location ?? undefined,
      startDate: item.startDate?.toISOString(),
      endDate: item.endDate?.toISOString(),
      current: item.current,
      description: item.description ?? undefined,
      metrics: item.metrics,
    }));
  const rankedExperiences = rankByRelevance(
    experiences,
    matchedSkillNames,
    (item) =>
      `${item.position} ${item.company} ${item.description ?? ''} ${item.metrics.join(' ')}`,
  );

  const projects = profile.projects
    .filter((item) => item.name)
    .map((item) => ({
      originalId: item.id,
      name: item.name,
      role: item.role ?? undefined,
      description: item.description ?? undefined,
      url: item.url ?? undefined,
      techStack: item.techStack,
      metrics: item.metrics,
    }));
  const rankedProjects = rankByRelevance(
    projects,
    matchedSkillNames,
    (item) =>
      `${item.name} ${item.techStack.join(' ')} ${item.description ?? ''} ${item.metrics.join(' ')}`,
  );

  return {
    matchedSkillNames,
    content: {
      headline: profile.headline ?? undefined,
      phone: profile.phone ?? undefined,
      location: profile.location ?? undefined,
      website: profile.website ?? undefined,
      linkedin: profile.linkedin ?? undefined,
      summary: profile.summary ?? undefined,
      experiences: rankedExperiences,
      projects: rankedProjects,
      skills: skillNames.map((name) => ({ name })),
      education: profile.education
        .filter((item) => item.degree && item.institution)
        .map((item) => ({
          originalId: item.id,
          degree: item.degree,
          institution: item.institution,
          field: item.field ?? undefined,
          startDate: item.startDate?.toISOString(),
          endDate: item.endDate?.toISOString(),
          current: item.current,
          description: item.description ?? undefined,
        })),
      certifications: profile.certifications
        .filter((item) => item.name)
        .map((item) => ({
          originalId: item.id,
          name: item.name,
          issuer: item.issuer ?? undefined,
          year: item.year ?? undefined,
        })),
      languages: profile.languages
        .filter((item) => item.name)
        .map((item) => ({
          originalId: item.id,
          name: item.name,
          level: item.level,
        })),
    },
  };
}

// Aplica la reformulación de la IA solo donde hay un originalId conocido del
// snapshot. Un originalId desconocido se ignora: jamás se introduce texto huérfano.
export function applyRewrites(
  content: AdaptedCvContent,
  result: RewriteResult,
): AdaptedCvContent {
  const rewritten = new Map(
    result.experienceDescriptions.map((item) => [item.originalId, item.text]),
  );
  return {
    ...content,
    experiences: content.experiences.map((item) =>
      rewritten.has(item.originalId)
        ? { ...item, description: rewritten.get(item.originalId) }
        : item,
    ),
  };
}
