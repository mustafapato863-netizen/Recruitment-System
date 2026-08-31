import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsUUID,
  IsEnum,
} from 'class-validator';

export class CreateVacancyRequestDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  legalEntityId?: string | null;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  positionId!: string;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsInt()
  @Min(1)
  @Max(10000)
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
  @MaxLength(5000)
  justification?: string | null;
}

export class UpdateVacancyRequestDto {
  @IsOptional()
  @IsUUID()
  legalEntityId?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  requestedHeadcount?: number;

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
  @MaxLength(5000)
  justification?: string | null;
}

export class UpdateVacancyStatusDto {
  @IsEnum(['Open', 'On Hold', 'Cancelled'])
  status!: 'Open' | 'On Hold' | 'Cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class VacancyRequestActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class AssignTeamMemberDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MaxLength(60)
  roleCode!: string;
}
