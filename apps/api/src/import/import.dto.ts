import { ArrayMaxSize, ArrayMinSize, IsString, IsOptional, IsArray, ValidateNested, IsEnum, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { ImportRowDecision, ImportRowDecisionInput } from '@recruitflow/contracts';

export class ImportRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string | null;

  @IsOptional()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}

export class UploadImportDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

export class SaveDecisionDto implements ImportRowDecisionInput {
  @IsEnum(['Update', 'NewApplication', 'Skip', 'KeepBoth'])
  decision!: ImportRowDecision;
}
