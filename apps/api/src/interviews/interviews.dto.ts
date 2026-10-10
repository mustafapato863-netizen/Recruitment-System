import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import type { InterviewStatus, InterviewType } from '@recruitflow/contracts';

export class CreateInterviewDto {
  @IsUUID()
  applicationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerJobTitle?: string | null;

  /** B5: no longer accepted. Kept only so the API can answer 400 INTERVIEWER_NOT_A_USER. */
  @IsOptional()
  interviewerName?: unknown;

  @IsOptional()
  @IsObject()
  attendeeJobTitles?: Record<string, string>;

  @IsString()
  @MaxLength(60)
  interviewType!: InterviewType;

  @IsISO8601()
  scheduledStart!: string;

  @IsISO8601()
  scheduledEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  /** B5: online room. https only, host on INTERVIEW_ROOM_HOSTS (validated in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationUrl?: string | null;

  /** B5: physical room when the interview is not online. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  roomName?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attendeeUserIds?: string[];

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

  /** B5: online room. https only, host on INTERVIEW_ROOM_HOSTS (validated in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationUrl?: string | null;

  /** B5: physical room when the interview is not online. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  roomName?: string | null;

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

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  notes!: string;

  /** B5: Draft saves without submitting; default Submitted. */
  @IsOptional()
  @IsEnum(['Draft', 'Submitted'])
  status?: 'Draft' | 'Submitted';
}

/** B5: revise a Submitted scorecard (new revision, reason required). */
export class ReviseScorecardDto {
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

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  notes!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class UpdateInterviewResponseDto {
  @IsEnum(['Confirmed', 'Reschedule Requested', 'Declined'])
  response!: 'Confirmed' | 'Reschedule Requested' | 'Declined';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class InterviewQueryDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

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

  @IsString()
  @MaxLength(60)
  interviewType!: InterviewType;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  attendeeUserIds!: string[];

  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Meeting link must be a valid HTTP or HTTPS URL.' })
  @MaxLength(500)
  locationUrl?: string;

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
