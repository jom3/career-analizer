import { Source } from '../generated/prisma/enums.js';

export type { Source };

export type SourceLanguage = 'es' | 'en' | 'other';

export interface AtsCheckItem {
  key: string;
  label: string;
  ok: boolean;
  message: string;
}

export interface CvDraftExperience {
  company: string | null;
  position: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  description: string | null;
  source: Source;
  sortOrder: number;
}

export interface CvDraftSkill {
  name: string;
  level: number | null;
  source: Source;
  sortOrder: number;
}

export interface CvDraftEducation {
  degree: string | null;
  institution: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  description: string | null;
  source: Source;
  sortOrder: number;
}

export interface CvDraftCertification {
  name: string | null;
  issuer: string | null;
  year: number | null;
  url: string | null;
  source: Source;
  sortOrder: number;
}

export interface CvDraftProject {
  name: string | null;
  role: string | null;
  description: string | null;
  url: string | null;
  techStack: string[];
  source: Source;
  sortOrder: number;
}

export interface CvDraftLanguage {
  name: string;
  level: string | null;
  source: Source;
  sortOrder: number;
}

// Borrador relajado del agregado de ProfileDto (SPEC 05): los campos
// obligatorios pueden venir null cuando el CV no aporta evidencia.
export interface CvDraft {
  headline: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  summary: string | null;
  experiences: CvDraftExperience[];
  skills: CvDraftSkill[];
  education: CvDraftEducation[];
  certifications: CvDraftCertification[];
  projects: CvDraftProject[];
  languages: CvDraftLanguage[];
}
