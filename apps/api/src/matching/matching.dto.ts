import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EVIDENCE_SOURCE_TYPES, type EvidenceSourceType } from './skill-evidence';

export class AddSkillEvidenceDto {
  @IsUUID()
  skillId!: string;

  @IsOptional()
  @IsIn([...EVIDENCE_SOURCE_TYPES])
  sourceType?: EvidenceSourceType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  snippet?: string;
}

export class DuplicateCheckDto {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
