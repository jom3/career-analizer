export type CvExportFormat = 'pdf' | 'docx';

export interface CoverLetter {
  id: string;
  jobOfferId: string | null;
  recruiterName: string | null;
  note: string | null;
  sourceLanguage: string | null;
  content: string;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterDraft {
  content: string;
  sourceLanguage: string | null;
}

export interface CoverLetterDraftRequest {
  jobOfferId: string;
  recruiterName?: string;
  note?: string;
}

export interface CreateCoverLetterRequest extends CoverLetterDraftRequest {
  content: string;
}