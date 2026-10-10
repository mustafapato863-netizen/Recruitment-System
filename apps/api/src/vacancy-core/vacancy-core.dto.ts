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
  MinLength,
  IsIn,
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
  @IsInt()
  @Min(1)
  @Max(2147483647)
  budgetMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  budgetMax?: number | null;

  @IsOptional()
  @IsString()
  @IsIn(['AED', 'EGP'])
  budgetCurrency?: 'AED' | 'EGP' | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  criticality?: string | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetFillDate?: string | null;

  @IsOptional()
  @IsIn(['After Approval', 'Deferred'])
  recruitmentTiming?: 'After Approval' | 'Deferred' | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  plannedOpenDate?: string | null;

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

  // B3 (v2 §4/§7): due date (alias of targetFillDate), grade, assigned employee.
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  gradeId?: string | null;

  /** M1: master-data department (category 'departments'). */
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string | null;
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
  @IsInt()
  @Min(1)
  @Max(2147483647)
  budgetMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  budgetMax?: number | null;

  @IsOptional()
  @IsString()
  @IsIn(['AED', 'EGP'])
  budgetCurrency?: 'AED' | 'EGP' | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  criticality?: string | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetFillDate?: string | null;

  @IsOptional()
  @IsIn(['After Approval', 'Deferred'])
  recruitmentTiming?: 'After Approval' | 'Deferred' | null;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  plannedOpenDate?: string | null;

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

  // B3 (v2 §4/§7): due date (alias of targetFillDate), grade, assigned employee.
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  gradeId?: string | null;

  /** M1: master-data department (category 'departments'). */
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string | null;
}

export class UpdateVacancyStatusDto {
  // B3: Open (= reopen), On Hold (= hold), Closed (= close). Reason required.
  // Partially Filled / Filled are set by seats; Cancelled is requisition-only.
  @IsEnum(['Open', 'On Hold', 'Closed'])
  status!: 'Open' | 'On Hold' | 'Closed';

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

/** B3: hold / reopen / close a job. */
export class JobStatusReasonDto {
  /** Hold/close: a value from 'hold-reasons' / 'close-reasons' (or "Other" + note). Reopen: free text. */
  @IsString()
  @MinLength(3, { message: 'A reason is required.' })
  @MaxLength(1000)
  reason!: string;

  /** Free text; required when reason is "Other". */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** Hold only: optional future date (YYYY-MM-DD). Stored on the job and in history; no auto-reopen. */
  @IsOptional()
  @IsString()
  holdUntil?: string;
}

/** B3: cancel a requisition. Reason required once approved (enforced in the service). */
export class CancelVacancyRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/** B3: activate an approved requisition. */
export class ActivateVacancyRequestDto {
  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string;
}

/** M1: Manager adjusts the target of an activated requisition. */
export class UpdateRequisitionTargetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class VacancyWorkQueueQueryDto {
  /** B3: only jobs the caller owns (active PRIMARY assignee). */
  @IsOptional()
  @IsIn(['true', 'false', true, false])
  mine?: string | boolean;

  @IsOptional()
  @IsEnum(['Open', 'On Hold', 'Partially Filled', 'Filled', 'Closed'])
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
