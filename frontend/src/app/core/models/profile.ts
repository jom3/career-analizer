export type Source = 'USER' | 'CV_IMPORT' | 'AI';

export interface Experience {
  id?: string;
  company: string;
  position: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current: boolean;
  description?: string | null;
  metrics: string[];
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
  institution: string;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current: boolean;
  description?: string | null;
  source?: Source;
  sortOrder: number;
}

export interface Certification {
  id?: string;
  name: string;
  issuer?: string | null;
  year?: number | null;
  url?: string | null;
  source?: Source;
  sortOrder: number;
}

export interface Project {
  id?: string;
  name: string;
  role?: string | null;
  description?: string | null;
  url?: string | null;
  techStack: string[];
  metrics: string[];
  source?: Source;
  sortOrder: number;
}

export interface Language {
  id?: string;
  name: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  source?: Source;
  sortOrder: number;
}

export interface Profile {
  id: string;
  headline: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  summary: string | null;
  source?: Source;
  experiences: Experience[];
  skills: Skill[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  languages: Language[];
}

export type ProfilePayload = Omit<Profile, 'id'>;
