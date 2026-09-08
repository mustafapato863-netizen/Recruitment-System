import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { ScreeningOutcome } from '@recruitflow/contracts';

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
  @IsString()
  @MaxLength(10)
  salaryCurrency?: string;
}
