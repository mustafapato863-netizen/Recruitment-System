import { IsEmail, IsNotEmpty, IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';
import type { CreateUserInput, UpdateUserInput } from '@recruitflow/contracts';

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
