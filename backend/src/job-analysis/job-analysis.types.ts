import { JobLevel } from '../generated/prisma/enums.js';

export type SourceLanguage = 'es' | 'en' | 'other';

// Borrador relajado del análisis de una oferta: los campos pueden venir null
// cuando la fuente (texto, imagen o PDF) no aporta evidencia.
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
