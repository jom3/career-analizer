import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { OfferContext } from '../../common/offer-context';

export interface CoverLetterDto {
  id: string;
  jobOfferId: string | null;
  offer: OfferContext;
  recruiterName: string | null;
  note: string | null;
  sourceLanguage: string | null;
  content: string;
  editedByUser: boolean;
  promptVersion: number;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterDraftDto {
  content: string;
  sourceLanguage: string | null;
  wordCount: number;
  warnings: { code: string; detail?: string }[];
}

export interface CoverLetterDraftRequest {
  jobOfferId: string;
  recruiterName?: string | null;
  note?: string | null;
}

export class CreateCoverLetterDraftDto {
  @IsString()
  @IsNotEmpty()
  jobOfferId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recruiterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  // Idioma del documento; si falta se usa el de la interfaz (Accept-Language).
  @IsOptional()
  @IsIn(['es', 'en'])
  lang?: 'es' | 'en';
}

export class CreateCoverLetterDto extends CreateCoverLetterDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content!: string;
}

export class UpdateCoverLetterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content!: string;
}

export class CoverLetterExportQueryDto {
  @IsIn(['pdf', 'docx'])
  format!: 'pdf' | 'docx';

  @IsOptional()
  @IsIn(['es', 'en'])
  lang?: 'es' | 'en';
}
