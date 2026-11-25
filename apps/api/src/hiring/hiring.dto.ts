import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import type { ComplianceStatus } from '@recruitflow/contracts';

export class CreateHiringCaseDto {
  @IsString()
  offerId!: string;
}

export class UpdateComplianceDto {
  @IsEnum(['Pending', 'Submitted', 'Verified', 'Rejected', 'Not Required'])
  status!: ComplianceStatus;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class FinalApprovalDto {
  @IsEnum(['Approve', 'Reject'])
  decision!: 'Approve' | 'Reject';

  @IsString()
  comment!: string;
}

export class JoiningUpdateDto {
  @IsEnum(['Joined', 'Postponed', 'No-show'])
  status!: 'Joined' | 'Postponed' | 'No-show';

  @IsOptional()
  @IsDateString()
  actualJoiningDate?: string;

  /** Meeting notes 2026-11-25 (item 4): edit the expected joining date on the case. */
  @IsOptional()
  @IsDateString()
  plannedJoiningDate?: string | null;
}

/** Meeting notes 2026-11-25 (item 4): edit only the expected joining date (no status change). */
export class UpdatePlannedJoiningDateDto {
  @IsOptional()
  @IsDateString()
  plannedJoiningDate?: string | null;
}
