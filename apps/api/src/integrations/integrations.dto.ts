import { IsString, IsObject, IsOptional } from 'class-validator';

export class UpdateIntegrationDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  configJson?: Record<string, unknown>;
}
