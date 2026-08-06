import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateVacancyRequestDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  legalEntityId?: string | null;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  positionId!: string;

  @IsUUID()
  requesterId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  requestedHeadcount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  employmentType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  budgetStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  criticality?: string | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetStartDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  justification?: string | null;
}

export class VacancyRequestActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  comment?: string;
}
