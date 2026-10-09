import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentCompany?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string | null;

  @IsOptional()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsInt()
  experienceYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;

  @IsOptional()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  availability?: string | null;

  @IsOptional()
  metadata?: Record<string, unknown> | null;
}

export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentCompany?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string | null;

  @IsOptional()
  @IsEnum(['Active', 'Blacklisted', 'Archived'])
  status?: 'Active' | 'Blacklisted' | 'Archived';

  @IsOptional()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsInt()
  experienceYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;

  @IsOptional()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  availability?: string | null;

  @IsOptional()
  metadata?: Record<string, unknown> | null;
}

export class CandidateQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** B2: legal-erasure request. The reason is stored in the audit log, so keep PII out of it. */
export class AnonymizeCandidateDto {
  @IsString()
  @MinLength(10, { message: 'A reason of at least 10 characters is required.' })
  @MaxLength(1000)
  reason!: string;
}
