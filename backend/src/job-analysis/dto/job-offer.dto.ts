import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InputType, JobLevel } from '../../generated/prisma/enums.js';

export class JobOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(50)
  responsibilities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(50)
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(50)
  preferredSkills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  experienceSummary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(30)
  education?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @ArrayMaxSize(20)
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @ArrayMaxSize(50)
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  sourceLanguage?: string;

  @IsOptional()
  @IsEnum(InputType)
  inputType?: InputType;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  rawInput?: string;
}
