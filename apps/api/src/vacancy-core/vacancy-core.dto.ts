import {
  IsArray,
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
import { Type } from 'class-transformer';

export class CreateVacancyRequestDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  jobSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  responsibilities?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  qualifications?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  benefits?: string | null;
}

export class UpdateVacancyRequestDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  jobSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  responsibilities?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  qualifications?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  benefits?: string | null;
}

export class UpdateVacancyStatusDto {
  @IsEnum(['Open', 'On Hold', 'Cancelled'])
  status!: 'Open' | 'On Hold' | 'Cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateVacancyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  approvedHeadcount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minExperienceYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  jobSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  responsibilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  qualifications?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  benefits?: string;

  @IsOptional()
  @IsDateString()
  targetStartDate?: string;
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

  @IsOptional()
  @IsEnum(['PRIMARY', 'SUPPORT'])
  assignmentKind?: 'PRIMARY' | 'SUPPORT';
}

export class VacancyWorkQueueQueryDto {
  @IsOptional()
  @IsEnum(['Pending Activation', 'Open', 'On Hold', 'Partially Filled', 'Filled', 'Cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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
