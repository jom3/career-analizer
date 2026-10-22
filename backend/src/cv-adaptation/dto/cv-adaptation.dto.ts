import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { OfferContext } from '../../common/offer-context';

export interface AdaptedCvDto {
  id: string;
  jobOfferId: string | null;
  offer: OfferContext;
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

  // Idioma del documento; si falta se usa el de la interfaz (Accept-Language).
  @IsOptional()
  @IsIn(['es', 'en'])
  lang?: 'es' | 'en';
}

export class AdaptedCvExportQueryDto {
  @IsIn(['pdf', 'docx'])
  format!: 'pdf' | 'docx';

  @IsOptional()
  @IsIn(['es', 'en'])
  lang?: 'es' | 'en';
}
