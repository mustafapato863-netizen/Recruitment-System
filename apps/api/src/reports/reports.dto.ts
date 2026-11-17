import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class ReportOverviewQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM.' })
  month?: string;

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

  @IsOptional()
  @IsUUID()
  vacancyId?: string;
}
