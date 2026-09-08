import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateInterviewDto,
  GenerateSelfScheduleDto,
  SubmitScorecardDto,
  UpdateInterviewDto,
  UpdateInterviewResponseDto,
} from '../interviews.dto';

describe('interview workflow DTOs', () => {
  it('requires written interviewer notes for a scorecard', async () => {
    const missing = await validate(plainToInstance(SubmitScorecardDto, {
      overallRating: 4,
      recommendation: 'Hire',
    }));
    expect(missing.some((error) => error.property === 'notes')).toBe(true);

    const valid = await validate(plainToInstance(SubmitScorecardDto, {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Clear evidence of role competency and strong communication.',
    }));
    expect(valid).toHaveLength(0);
  });

  it('accepts only supported interviewer responses', async () => {
    const valid = await validate(plainToInstance(UpdateInterviewResponseDto, {
      response: 'Reschedule Requested',
      note: 'Available tomorrow afternoon.',
    }));
    expect(valid).toHaveLength(0);

    const invalid = await validate(plainToInstance(UpdateInterviewResponseDto, {
      response: 'Maybe',
    }));
    expect(invalid.some((error) => error.property === 'response')).toBe(true);
  });

  it('validates meeting links as HTTP or HTTPS URLs', async () => {
    const valid = await validate(plainToInstance(CreateInterviewDto, {
      applicationId: '00000000-0000-4000-8000-000000000001',
      interviewType: 'Technical',
      scheduledStart: '2026-09-10T10:00:00.000Z',
      scheduledEnd: '2026-09-10T10:45:00.000Z',
      attendeeUserIds: ['00000000-0000-4000-8000-000000000002'],
      locationUrl: 'https://meet.example.com/interview',
    }));
    expect(valid).toHaveLength(0);

    const invalid = await validate(plainToInstance(UpdateInterviewDto, {
      locationUrl: 'meet.example.com/interview',
    }));
    expect(invalid.some((error) => error.property === 'locationUrl')).toBe(true);

    const selfScheduleWithoutInterviewer = await validate(plainToInstance(GenerateSelfScheduleDto, {
      applicationId: '00000000-0000-4000-8000-000000000001',
      title: 'Technical interview',
      interviewType: 'Technical',
      attendeeUserIds: [],
    }));
    expect(selfScheduleWithoutInterviewer.some((error) => error.property === 'attendeeUserIds')).toBe(true);
  });
});
