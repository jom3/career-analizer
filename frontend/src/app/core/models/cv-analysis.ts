export type CvCheckKey =
  | 'intro'
  | 'contact'
  | 'experience'
  | 'experienceMetrics'
  | 'education'
  | 'skills'
  | 'projects'
  | 'languages'
  | 'noDuplicates';

export type CvSection =
  | 'intro'
  | 'contact'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'languages';

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
