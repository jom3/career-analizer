import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export interface CoverLetterDto {
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

export interface CoverLetterDraftDto {
  content: string;
  sourceLanguage: string | null;
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
}

export class CreateCoverLetterDto extends CreateCoverLetterDraftDto {
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
