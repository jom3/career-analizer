export const CV_CHECK_KEYS = [
  'intro',
  'contact',
  'experience',
  'experienceMetrics',
  'education',
  'skills',
  'projects',
  'languages',
  'noDuplicates',
] as const;

export type CvCheckKey = (typeof CV_CHECK_KEYS)[number];

export const CV_SECTIONS = [
  'intro',
  'contact',
  'experience',
  'education',
  'skills',
  'projects',
  'languages',
] as const;

export type CvSection = (typeof CV_SECTIONS)[number];

// Pesos que suman 100. La nota es la suma de los chequeos cumplidos.
export const CV_CHECK_WEIGHTS: Record<CvCheckKey, number> = {
  intro: 15,
  contact: 10,
  experience: 20,
  experienceMetrics: 15,
  education: 10,
  skills: 10,
  projects: 10,
  languages: 5,
  noDuplicates: 5,
};

export interface CvCheck {
  key: CvCheckKey;
  ok: boolean;
  detail?: string;
}

export interface CvSuggestion {
  section: CvSection;
  action: string;
}

export interface CvAnalysis {
  score: number;
  checks: CvCheck[];
  strengths: string[];
  suggestions: CvSuggestion[];
  lang: 'es' | 'en';
  aiAvailable: boolean;
}
