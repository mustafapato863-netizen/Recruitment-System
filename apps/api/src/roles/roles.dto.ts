import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import type { CreateRoleInput, UpdateRoleInput } from '@recruitflow/contracts';

export class CreateRoleDto implements CreateRoleInput {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateRoleDto implements UpdateRoleInput {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: string;
}
