import {
  IsArray,
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
