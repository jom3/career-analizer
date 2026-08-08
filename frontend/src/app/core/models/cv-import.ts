import type { Source } from './profile';

export type SourceLanguage = 'es' | 'en' | 'other';

export interface AtsCheckItem {
  key: string;
  label: string;
  ok: boolean;
  message: string;
}

// Misma forma que el backend (SPEC 06): los campos obligatorios pueden venir
// null porque la IA extrae solo lo que el CV declara, sin inventar.
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

export interface CvImportResult {
  documentId: string;
  draft: CvDraft;
  sourceLanguage: SourceLanguage;
  atsReport: AtsCheckItem[];
}

export interface CvDocument {
  id: string;
  originalName: string;
  mimeType: string;
  sourceLanguage: SourceLanguage;
  createdAt: string;
  draftJson: CvDraft;
}
