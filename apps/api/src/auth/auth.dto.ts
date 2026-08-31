import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type {
  AcceptInvitationInput,
  ChangePasswordInput,
  CompleteEmailVerificationInput,
  CompletePasswordResetInput,
  RequestEmailVerificationInput,
  RequestPasswordResetInput,
  UpdateSelfProfileInput,
  UpdateUserPreferencesInput,
} from '@recruitflow/contracts';

export class LoginDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MinLength(1, { message: 'Email cannot be empty' })
  declare email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(1, { message: 'Password cannot be empty' })
  declare password: string;
}

export class UpdateSelfProfileDto implements UpdateSelfProfileInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare displayName: string;
}

export class UpdateUserPreferencesDto implements UpdateUserPreferencesInput {
  @IsOptional()
  @IsIn(['light', 'dark'])
  declare theme?: 'light' | 'dark';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  declare timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  declare dateFormat?: string;

  @IsOptional()
  @IsIn(['12h', '24h'])
  declare timeFormat?: '12h' | '24h';

  @IsOptional()
  @IsBoolean()
  declare reducedMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  declare inAppNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  declare emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  declare interviewReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  declare approvalReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  declare taskReminders?: boolean;
}

export class ChangePasswordDto implements ChangePasswordInput {
  @IsString()
  @IsNotEmpty()
  declare currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  declare newPassword: string;
}

export class RequestPasswordResetDto implements RequestPasswordResetInput {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  declare email: string;
}

export class CompletePasswordResetDto implements CompletePasswordResetInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  declare newPassword: string;
}

export class RequestEmailVerificationDto implements RequestEmailVerificationInput {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  declare email: string;
}

export class CompleteEmailVerificationDto implements CompleteEmailVerificationInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare token: string;
}

export class AcceptInvitationDto implements AcceptInvitationInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  declare password: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  declare displayName?: string;
}
