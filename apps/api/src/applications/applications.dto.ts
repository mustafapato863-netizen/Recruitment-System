import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { ApplicationStage } from '@recruitflow/contracts';

export class CreateApplicationDto {
  @IsUUID()
  vacancyId!: string;

  @IsUUID()
  candidateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string | null;

  @IsOptional()
  @IsUUID()
  primaryRecruiterId?: string | null;

  @IsOptional()
  @IsUUID()
  taskOwnerId?: string | null;
}

export class UpdateApplicationStageDto {
  @IsEnum([
    'Applied',
    'Screening',
    'Interview',
    'Offer',
    'Pre-Hire',
    'Joined',
    'Rejected',
    'Withdrawn',
  ])
  stage!: ApplicationStage;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ApplicationQueryDto {
  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsString()
  stage?: ApplicationStage;

  @IsOptional()
  @IsUUID()
  primaryRecruiterId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
