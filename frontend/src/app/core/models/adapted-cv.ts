export type CvExportFormat = 'pdf' | 'docx';

// Versión de CV adaptada a una oferta (SPEC 12): contenido derivado del
// Candidate Profile (fields estructurales verbatim) con prosa reformulada por
// IA en el idioma de la oferta.
export interface AdaptedExperience {
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

export interface AdaptedProject {
  originalId: string;
  name: string;
  role?: string;
  description?: string;
  url?: string;
  techStack: string[];
  metrics: string[];
}

export interface AdaptedEducation {
  originalId: string;
  degree: string;
  institution: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface AdaptedCertification {
  originalId: string;
  name: string;
  issuer?: string;
  year?: number;
}

export interface AdaptedLanguage {
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
  experiences: AdaptedExperience[];
  projects: AdaptedProject[];
  skills: AdaptedSkillItem[];
  education: AdaptedEducation[];
  certifications: AdaptedCertification[];
  languages: AdaptedLanguage[];
}

export interface AdaptedCv {
  id: string;
  jobOfferId: string | null;
  jobMatchId: string | null;
  sourceLanguage: string | null;
  content: AdaptedCvContent;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdaptationRequest {
  jobOfferId: string;
  jobMatchId?: string;
}