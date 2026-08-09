import { IsIn, IsOptional } from 'class-validator';

export class CvExportQueryDto {
  @IsIn(['pdf', 'docx'])
  format!: 'pdf' | 'docx';

  @IsOptional()
  @IsIn(['es', 'en'])
  lang: 'es' | 'en' = 'es';
}
