import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsString, IsOptional, IsIn, IsUUID, MaxLength } from 'class-validator';
import type { AdminChangeUserPasswordInput, CreateInvitationInput, CreateUserInput, UpdateUserInput } from '@recruitflow/contracts';

export class CreateUserDto implements CreateUserInput {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  jobTitle?: string | null;

  /**
   * No @MinLength here on purpose: password strength (min 10 chars, classes,
   * email local-part) is enforced by UsersService via evaluateStrongPassword
   * so every weak password fails with code WEAK_PASSWORD. A DTO @MinLength
   * would be rejected earlier by the global ValidationPipe as a generic
   * VALIDATION_ERROR instead.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  /** Role CODES (e.g. 'ADMINISTRATOR'). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  /** Role UUIDs; the backend accepts `roles` (codes) and/or `roleIds` (UUIDs). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}

export class AdminChangeUserPasswordDto implements AdminChangeUserPasswordInput {
  /** Strength enforced by UsersService (WEAK_PASSWORD); see CreateUserDto. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsBoolean()
  requireChangeOnNextLogin?: boolean;
}

export class UpdateUserDto implements UpdateUserInput {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  displayName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  jobTitle?: string | null;

  @IsString()
  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class CreateInvitationDto implements CreateInvitationInput {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
