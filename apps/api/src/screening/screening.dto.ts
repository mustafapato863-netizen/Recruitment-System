import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
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
}
