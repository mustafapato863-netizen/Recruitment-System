import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsDateString()
  comparisonFrom?: string;

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
