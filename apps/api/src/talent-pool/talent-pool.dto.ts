import { IsString, IsOptional, IsArray, IsUUID, IsDateString, MaxLength } from 'class-validator';
import type { CreateTalentPoolInput, AddToPoolInput } from '@recruitflow/contracts';

export class CreateTalentPoolDto implements CreateTalentPoolInput {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class AddToPoolDto implements AddToPoolInput {
  @IsUUID()
  candidateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string | null;

  @IsOptional()
  @IsDateString()
  consentExpiry?: string | null;
}
