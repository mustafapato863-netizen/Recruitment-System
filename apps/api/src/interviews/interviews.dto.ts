import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { InterviewStatus, InterviewType } from '@recruitflow/contracts';

export class CreateInterviewDto {
  @IsUUID()
  applicationId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsEnum(['Screening', 'Technical', 'Behavioral', 'Managerial', 'Executive'])
  interviewType!: InterviewType;

  @IsISO8601()
  scheduledStart!: string;

  @IsISO8601()
  scheduledEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationUrl?: string | null;

  @IsArray()
  @IsUUID('4', { each: true })
  attendeeUserIds!: string[];

  @IsOptional()
  @IsBoolean()
  allowConflict?: boolean;
}

export class UpdateInterviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsISO8601()
  scheduledStart?: string;

  @IsOptional()
  @IsISO8601()
  scheduledEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationUrl?: string | null;

  @IsOptional()
  @IsEnum(['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'])
  status?: InterviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rescheduleReason?: string;

  @IsOptional()
  @IsBoolean()
  allowConflict?: boolean;
}

export class SubmitScorecardDto {
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsEnum(['Strong Hire', 'Hire', 'Neutral', 'No Hire', 'Strong No Hire'])
  recommendation!: 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  strengths?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  concerns?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class InterviewQueryDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsString()
  status?: InterviewStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CheckAvailabilityDto {
  @IsArray()
  @IsUUID('4', { each: true })
  attendeeUserIds!: string[];

  @IsISO8601()
  scheduledStart!: string;

  @IsISO8601()
  scheduledEnd!: string;

  @IsOptional()
  @IsUUID()
  excludeInterviewId?: string;
}

export class GenerateSelfScheduleDto {
  @IsUUID()
  applicationId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsEnum(['Screening', 'Technical', 'Behavioral', 'Managerial', 'Executive'])
  interviewType!: InterviewType;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;

  @IsArray()
  @IsUUID('4', { each: true })
  attendeeUserIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(336)
  expiresInHours?: number;
}

export class PublicBookScheduleDto {
  @IsISO8601()
  selectedSlot!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  candidateNotes?: string;
}
