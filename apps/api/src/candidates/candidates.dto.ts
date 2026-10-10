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

/** API description for the anonymize reason (no Swagger in this repo; surfaced in docs and validation errors). */
export const ANONYMIZE_REASON_DESCRIPTION =
  'Why this candidate is being anonymized (e.g. legal erasure ticket number). 10-1000 characters. Do not include personal data in the reason.';

/**
 * B2: legal-erasure request for POST /candidates/:id/anonymize.
 * The reason is stored verbatim in the immutable audit log.
 */
export class AnonymizeCandidateDto {
  /** Do not include personal data in the reason. 10-1000 characters, stored in the audit log. */
  @IsString({ message: ANONYMIZE_REASON_DESCRIPTION })
  @MinLength(10, { message: `A reason of at least 10 characters is required. ${ANONYMIZE_REASON_DESCRIPTION}` })
  @MaxLength(1000, { message: `The reason must be at most 1000 characters. ${ANONYMIZE_REASON_DESCRIPTION}` })
  reason!: string;
}
