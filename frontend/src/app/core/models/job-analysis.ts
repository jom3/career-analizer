export type JobLevel = 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
export type InputType = 'TEXT' | 'PDF' | 'IMAGE';
export type SourceLanguage = 'es' | 'en' | 'other';
export type OfferStatus = 'PENDING' | 'APPLIED' | 'OMITTED';

// Borrador relajado del análisis (SPEC 10): los campos pueden venir null cuando
// la fuente (texto, imagen o PDF) no aporta evidencia.
export interface JobOfferDraft {
  title: string | null;
  company: string | null;
  level: JobLevel | null;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number | null;
  experienceSummary: string | null;
  education: string[];
  languages: string[];
  keywords: string[];
}

export interface JobAnalysisResult {
  draft: JobOfferDraft;
  sourceLanguage: SourceLanguage;
  inputType: InputType;
  rawInput: string | null;
}

// Payload para POST/PUT /job-analysis: el título es obligatorio y los campos
// opcionales vacíos se envían como null.
export interface JobOfferPayload {
  title: string;
  company: string | null;
  level: JobLevel | null;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number | null;
  experienceSummary: string | null;
  education: string[];
  languages: string[];
  keywords: string[];
sourceLanguage: SourceLanguage | null;
  inputType: InputType;
  rawInput: string | null;
  status: OfferStatus;
}

export interface JobOffer extends JobOfferDraft {
  id: string;
  sourceLanguage: SourceLanguage | null;
  inputType: InputType;
  rawInput: string | null;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}
