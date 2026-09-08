import { IsNotEmpty, IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import type {
  CreatePermissionInput,
  CreateRoleInput,
  UpdatePermissionInput,
  UpdateRoleInput,
} from '@recruitflow/contracts';

export class CreateRoleDto implements CreateRoleInput {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  /** Accepted for backwards compatibility; the API always assigns the code. */
  code?: string;

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

export class CreatePermissionDto implements CreatePermissionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class UpdatePermissionDto implements UpdatePermissionInput {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
