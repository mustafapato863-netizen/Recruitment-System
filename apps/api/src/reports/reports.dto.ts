import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** @deprecated B8: ignored (no prior-period comparison). Still accepted so old clients do not get 400. */
  @IsOptional()
  @IsDateString()
  comparisonFrom?: string;

  /** @deprecated B8: ignored. */
  @IsOptional()
  @IsDateString()
  comparisonTo?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsUUID()
  recruiterId?: string;
}
