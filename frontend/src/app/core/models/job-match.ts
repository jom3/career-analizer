import type { JobOfferPayload } from './job-analysis';

export type MatchLang = 'es' | 'en';
export type GapStatus = 'HAVE' | 'MISSING' | 'PARTIAL';
export type GapSource = 'REQUIRED' | 'PREFERRED' | 'OTHER';
export type RecommendationType = 'SKILL' | 'PROFILE';
export type DimensionKey = 'skills' | 'experience' | 'education' | 'languages';

// Análisis de encaje persistido (SPEC 11): resultado del matching entre el
// perfil del candidato y una oferta, con snapshot de la oferta y huella del
// perfil en el servidor para detectar resultados viejos (stale).
export interface JobMatchDimension {
  key: DimensionKey;
  score: number | null;
  justification: string;
}

export interface JobMatchGap {
  name: string;
  status: GapStatus;
  source: GapSource;
  note?: string;
}

export interface JobMatchRecommendation {
  type: RecommendationType;
  target: string;
  suggestion: string;
}

export interface JobMatch {
  id: string;
  jobOfferId: string | null;
  lang: MatchLang;
  overallScore: number;
  overallJustification: string;
  dimensions: JobMatchDimension[];
  gaps: JobMatchGap[];
  recommendations: JobMatchRecommendation[];
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

// Crea un match desde una oferta guardada.
export interface CreateMatchFromOfferRequest {
  jobOfferId: string;
  lang?: MatchLang;
}

// Crea un match desde un draft estructurado; saveOffer persiste la oferta.
export interface CreateMatchFromDraftRequest {
  offer: JobOfferPayload;
  saveOffer?: boolean;
  lang?: MatchLang;
}

export type CreateMatchRequest =
  | CreateMatchFromOfferRequest
  | CreateMatchFromDraftRequest;