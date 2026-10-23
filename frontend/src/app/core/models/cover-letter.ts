import type { OfferContext } from './offer-context';

export type CvExportFormat = 'pdf' | 'docx';

export interface CoverLetter {
  id: string;
  jobOfferId: string | null;
  offer: OfferContext;
  recruiterName: string | null;
  note: string | null;
  sourceLanguage: string | null;
  content: string;
  editedByUser: boolean;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CoverLetterWarningCode =
  | 'WORD_LIMIT'
  | 'BANNED_PHRASE'
  | 'EMPLOYER_NAME'
  | 'TARGET_COMPANY_REPEATED'
  | 'GENERIC_CLOSING'
  | 'EMPTY_ADJECTIVE'
  | 'UNSUPPORTED_NUMBER'
  | 'GERUND'
  | 'MISSING_SKILL'
  | 'UNSUPPORTED_YEARS'
  | 'UNSUPPORTED_SECTOR'
  | 'RECRUITER_NAME_MISSING';

export interface CoverLetterWarning {
  code: CoverLetterWarningCode;
  detail?: string;
}

export interface CoverLetterDraft {
  content: string;
  sourceLanguage: string | null;
  wordCount: number;
  warnings: CoverLetterWarning[];
}

export interface CoverLetterDraftRequest {
  jobOfferId: string;
  recruiterName?: string;
  note?: string;
  lang?: 'es' | 'en';
}

export interface CreateCoverLetterRequest extends CoverLetterDraftRequest {
  content: string;
}