import { IsArray, IsEmail, IsNotEmpty, IsString, IsOptional, IsIn, IsUUID, MinLength, MaxLength } from 'class-validator';
import type { CreateInvitationInput, CreateUserInput, UpdateUserInput } from '@recruitflow/contracts';

export class CreateUserDto implements CreateUserInput {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class UpdateUserDto implements UpdateUserInput {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  displayName?: string;

  @IsString()
  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: string;
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
