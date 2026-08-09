import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface AdaptedCvDto {
  id: string;
  jobOfferId: string | null;
  jobMatchId: string | null;
  sourceLanguage: string | null;
  content: unknown;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export class CreateCvAdaptationDto {
  @IsString()
  @IsNotEmpty()
  jobOfferId!: string;

  @IsOptional()
  @IsString()
  jobMatchId?: string;
}

export class AdaptedCvExportQueryDto {
  @IsIn(['pdf', 'docx'])
  format!: 'pdf' | 'docx';

  @IsOptional()
  @IsIn(['es', 'en'])
  lang?: 'es' | 'en';
}
