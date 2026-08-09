import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { JobOfferDto } from '../../job-analysis/dto/job-offer.dto';

export type MatchLang = 'es' | 'en';

export type GapStatus = 'HAVE' | 'MISSING' | 'PARTIAL';
export type GapSource = 'REQUIRED' | 'PREFERRED' | 'OTHER';
export type RecommendationType = 'SKILL' | 'PROFILE';
export type DimensionKey = 'skills' | 'experience' | 'education' | 'languages';

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

@ValidatorConstraint({ name: 'exactlyOneMatchSource', async: false })
class ExactlyOneMatchSourceConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as JobMatchRequestDto;
    const hasOffer = dto.offer !== undefined;
    const hasOfferId = dto.jobOfferId !== undefined;
    return hasOffer !== hasOfferId;
  }

  defaultMessage(): string {
    return 'Se requiere exactamente uno de jobOfferId u offer.';
  }
}

@ValidatorConstraint({ name: 'saveOfferRequiresRawInput', async: false })
class SaveOfferRequiresRawInputConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as JobMatchRequestDto;
    if (!dto.saveOffer) {
      return true;
    }
    const rawInput = dto.offer?.rawInput?.trim();
    return typeof rawInput === 'string' && rawInput.length > 0;
  }

  defaultMessage(): string {
    return 'saveOffer: true requiere offer con rawInput no nulo.';
  }
}

export interface JobMatchDto {
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

export class JobMatchRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  jobOfferId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobOfferDto)
  offer?: JobOfferDto;

  @IsOptional()
  @IsBoolean()
  saveOffer?: boolean;

  @IsOptional()
  @IsIn(['es', 'en'] as const)
  lang?: MatchLang;

  @Validate(ExactlyOneMatchSourceConstraint)
  readonly _exactlyOneSource!: never;

  @Validate(SaveOfferRequiresRawInputConstraint)
  readonly _saveOfferRule!: never;
}
