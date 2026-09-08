import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { CandidateActivityKind } from '@recruitflow/contracts';

export class CreateCandidateActivityDto {
  @IsIn(['Call', 'Note', 'Email', 'Meeting', 'Document Verification', 'Offer Follow-up'])
  kind!: CandidateActivityKind;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  summary!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dueAt?: string;
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
