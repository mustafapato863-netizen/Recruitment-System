import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreatePipelineTemplateDto {
  @IsString()
  name!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class DuplicatePipelineTemplateDto {
  @IsString()
  name!: string;
}

export class CreatePipelineStageDto {
  @IsString()
  name!: string;

  @IsString()
  stageType!: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsNumber()
  @IsOptional()
  slaDays?: number;

  @IsString()
  @IsOptional()
  defaultOwner?: string;

  @IsString()
  @IsOptional()
  entryGate?: string;

  @IsString()
  @IsOptional()
  exitGate?: string;
}

export class UpdatePipelineStageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  stageType?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsNumber()
  @IsOptional()
  slaDays?: number;

  @IsString()
  @IsOptional()
  defaultOwner?: string;

  @IsString()
  @IsOptional()
  entryGate?: string;

  @IsString()
  @IsOptional()
  exitGate?: string;
}

export class ReorderStagesDto {
  @IsString({ each: true })
  stageIds!: string[];
}
