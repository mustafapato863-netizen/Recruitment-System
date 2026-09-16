import { IsString, IsInt, IsOptional, IsBoolean, Min, IsIn } from 'class-validator';

export class UpsertRecruiterTargetDto {
  @IsString()
  recruiterId!: string;

  @IsIn(['daily', 'monthly'])
  period!: 'daily' | 'monthly';

  @IsOptional()
  @IsString()
  month?: string; // "2026-09" format, required for monthly

  @IsInt()
  @Min(0)
  calls!: number;

  @IsInt()
  @Min(0)
  screenings!: number;

  @IsInt()
  @Min(0)
  interviews!: number;

  @IsInt()
  @Min(0)
  offers!: number;

  @IsInt()
  @Min(0)
  hires!: number;

  @IsInt()
  @Min(0)
  cvSourced!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRecruiterTargetDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  calls?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  screenings?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  interviews?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  hires?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cvSourced?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
