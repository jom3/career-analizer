import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Source } from '../../generated/prisma/enums.js';

export class ExperienceDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 120)
  company!: string;

  @IsString()
  @Length(1, 120)
  position!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsBoolean()
  current!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  metrics?: string[];

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsInt()
  sortOrder!: number;
}

export class SkillDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 60)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsInt()
  sortOrder!: number;
}

export class EducationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 120)
  degree!: string;

  @IsString()
  @Length(1, 120)
  institution!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  field?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsBoolean()
  current!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsInt()
  sortOrder!: number;
}

export class CertificationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  issuer?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsInt()
  sortOrder!: number;
}

export class ProjectDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  techStack!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  metrics?: string[];

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsInt()
  sortOrder!: number;
}

export class LanguageDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 60)
  name!: string;

  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  level!: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsInt()
  sortOrder!: number;
}

export class ProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUrl()
  linkedin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences!: ExperienceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills!: SkillDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education!: EducationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications!: CertificationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  projects!: ProjectDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  languages!: LanguageDto[];
}
