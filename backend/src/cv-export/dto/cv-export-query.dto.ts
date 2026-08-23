import { IsIn, IsOptional } from 'class-validator';

export class CvExportQueryDto {
  @IsIn(['pdf', 'docx'])
  format!: 'pdf' | 'docx';

  // Sin default: si no viene, undefined, para que el controller use el header
  // Accept-Language (req.uiLang). Un default 'es' haría que el CV siempre
  // baje en español ignorando el idioma de la interfaz.
  @IsOptional()
  @IsIn(['es', 'en'])
  lang?: 'es' | 'en';
}
