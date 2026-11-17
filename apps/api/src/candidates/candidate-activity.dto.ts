import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { CandidateActivityKind } from '@recruitflow/contracts';

const ACTIVITY_KINDS = ['Call', 'Note', 'Email', 'Meeting', 'Document Verification', 'Offer Follow-up'];
const FOLLOW_UP_KINDS = [...ACTIVITY_KINDS, 'FollowUp'];

export class CreateCandidateActivityDto {
  @IsIn(ACTIVITY_KINDS)
  kind!: CandidateActivityKind;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  summary!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dueAt?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  followUpDueAt?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  followUpSummary?: string;

  @IsOptional()
  @IsIn(FOLLOW_UP_KINDS)
  followUpKind?: CandidateActivityKind;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class CandidateActivityQueryDto {
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

export class RescheduleCandidateActivityDto {
  @IsDateString({ strict: true })
  dueAt!: string;
}
