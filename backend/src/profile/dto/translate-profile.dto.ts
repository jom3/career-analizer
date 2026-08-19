import { IsIn, IsOptional } from 'class-validator';

export class TranslateProfileDto {
  @IsIn(['es', 'en'])
  lang!: 'es' | 'en';

  // Idioma de origen (pestaña activa). Si se provee, se usa como fuente en
  // lugar de la heurística de cobertura (SPEC 17: "primario definido en el
  // request").
  @IsOptional()
  @IsIn(['es', 'en'])
  from?: 'es' | 'en';
}
