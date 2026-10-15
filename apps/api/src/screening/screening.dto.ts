import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { ScreeningOutcome } from '@recruitflow/contracts';

function blankToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateScreeningLogDto {
  @IsUUID()
  applicationId!: string;

  @IsEnum(['Passed', 'Failed', 'On Hold'])
  outcome!: ScreeningOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  noticePeriodDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  expectedSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  currentSalary?: number;

  @IsOptional()
  @IsEnum(['AED', 'EGP', 'EGY'], { message: 'Currency must be either AED or EGP' })
  salaryCurrency?: string;

  @IsOptional()
  @Transform(({ value }) => blankToNull(value))
  @IsString()
  @MaxLength(80)
  method?: string | null;

  @IsOptional()
  @Transform(({ value }) => blankToNull(value))
  @IsString()
  @MaxLength(500)
  evidenceSource?: string | null;

  @IsOptional()
  @Transform(({ value }) => blankToNull(value))
  @IsString()
  @MaxLength(200)
  nextStep?: string | null;
}
