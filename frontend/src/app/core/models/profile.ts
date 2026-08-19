export type Source = 'USER' | 'CV_IMPORT' | 'AI';

// Objeto por idioma de un campo bilingüe del perfil (SPEC 17).
export interface LocalizedValue {
  es?: string | null;
  en?: string | null;
}

export interface LocalizedArray {
  es?: string[] | null;
  en?: string[] | null;
}

export interface Experience {
  id?: string;
  company: string;
  position: string;
  positionI18n?: LocalizedValue;
  location?: string | null;
  locationI18n?: LocalizedValue;
  startDate?: string | null;
  endDate?: string | null;
  current: boolean;
  description?: string | null;
  descriptionI18n?: LocalizedValue;
  metrics: string[];
  metricsI18n?: LocalizedArray;
  source?: Source;
  sortOrder: number;
}

export interface Skill {
  id?: string;
  name: string;
  level: number;
  source?: Source;
  sortOrder: number;
}

export interface Education {
  id?: string;
  degree: string;
  degreeI18n?: LocalizedValue;
  institution: string;
  institutionI18n?: LocalizedValue;
  field?: string | null;
  fieldI18n?: LocalizedValue;
  startDate?: string | null;
  endDate?: string | null;
  current: boolean;
  description?: string | null;
  descriptionI18n?: LocalizedValue;
  source?: Source;
  sortOrder: number;
}

export interface Certification {
  id?: string;
  name: string;
  nameI18n?: LocalizedValue;
  issuer?: string | null;
  issuerI18n?: LocalizedValue;
  year?: number | null;
  url?: string | null;
  source?: Source;
  sortOrder: number;
}

export interface Project {
  id?: string;
  name: string;
  nameI18n?: LocalizedValue;
  role?: string | null;
  roleI18n?: LocalizedValue;
  description?: string | null;
  descriptionI18n?: LocalizedValue;
  url?: string | null;
  techStack: string[];
  metrics: string[];
  metricsI18n?: LocalizedArray;
  source?: Source;
  sortOrder: number;
}

export interface Language {
  id?: string;
  name: string;
  nameI18n?: LocalizedValue;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  source?: Source;
  sortOrder: number;
}

export interface Profile {
  id: string;
  headline: string | null;
  headlineI18n?: LocalizedValue;
  phone: string | null;
  location: string | null;
  locationI18n?: LocalizedValue;
  website: string | null;
  linkedin: string | null;
  summary: string | null;
  summaryI18n?: LocalizedValue;
  source?: Source;
  experiences: Experience[];
  skills: Skill[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  languages: Language[];
}

export type ProfilePayload = Omit<Profile, 'id'>;

