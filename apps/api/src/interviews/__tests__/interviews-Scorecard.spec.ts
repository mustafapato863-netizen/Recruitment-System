import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InterviewsService } from '../interviews.service';

describe('InterviewsService scheduling and scorecards', () => {
  const mockPrisma = {
    application: { findFirst: vi.fn() },
    interview: { findFirst: vi.fn(), updateMany: vi.fn() },
    interviewAttendee: { findUnique: vi.fn(), count: vi.fn() },
    interviewScorecard: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    interviewScorecardRating: { upsert: vi.fn(), findMany: vi.fn() },
  };
  let service: InterviewsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InterviewsService(mockPrisma as never, {} as never, {} as never);
  });

  const scheduleDto = {
    applicationId: 'app-1',
    interviewType: 'Technical' as const,
    scheduledStart: 'not-a-date',
    scheduledEnd: 'also-bad',
    attendeeUserIds: ['user-1'],
  };

  it('rejects a new interview when the job is on hold or closed', async () => {
    mockPrisma.application.findFirst.mockResolvedValue({
      id: 'app-1',
      organizationId: 'org-1',
      vacancy: { status: 'On Hold' },
    });
    await expect(service.createInterview('org-1', scheduleDto)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createInterview('org-1', scheduleDto)).rejects.toThrow(
      'This job is on hold and is not open for new interview scheduling.',
    );

    mockPrisma.application.findFirst.mockResolvedValue({
      id: 'app-1',
      organizationId: 'org-1',
      vacancy: { status: 'Closed' },
    });
    await expect(service.createInterview('org-1', scheduleDto)).rejects.toThrow(
      'This job is closed and is not open for new interview scheduling.',
    );
  });

  it('keeps scheduling open when the fixture omits vacancy status', async () => {
    mockPrisma.application.findFirst.mockResolvedValue({
      id: 'app-1',
      organizationId: 'org-1',
      candidate: { firstName: 'Ahmed', lastName: 'Embaby' },
      vacancy: { position: { title: 'HRIS Developer' } },
    });
    await expect(service.createInterview('org-1', scheduleDto)).rejects.toThrow(
      'Scheduled end time must be strictly after start time.',
    );
    await expect(service.createInterview('org-1', scheduleDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a scorecard on a no-show interview', async () => {
    mockPrisma.interview.findFirst.mockResolvedValue({ id: 'iv-1', status: 'No-show' });
    await expect(service.submitScorecard('org-1', 'iv-1', 'user-1', {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Evidence from the panel.',
    })).rejects.toThrow('Cancelled or no-show interviews cannot receive scorecards.');
    expect(mockPrisma.interviewScorecard.create).not.toHaveBeenCalled();
    expect(mockPrisma.interview.updateMany).not.toHaveBeenCalled();
  });

  it('rejects submitting a scorecard on a future interview while still allowing a draft', async () => {
    const futureStart = new Date(Date.now() + 86_400_000);
    mockPrisma.interview.findFirst.mockResolvedValue({ id: 'iv-future', status: 'Scheduled', scheduledStart: futureStart });
    mockPrisma.interviewAttendee.findUnique.mockResolvedValue({ interviewId: 'iv-future', userId: 'user-1' });
    await expect(service.submitScorecard('org-1', 'iv-future', 'user-1', {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Premature submission.',
      status: 'Submitted',
    })).rejects.toThrow('A scorecard cannot be submitted for a future interview before it starts.');
    expect(mockPrisma.interviewScorecard.create).not.toHaveBeenCalled();
  });

  it('does not mark the interview Completed when the scorecard is saved as Draft', async () => {
    mockPrisma.interview.findFirst.mockResolvedValue({ id: 'iv-1', status: 'Scheduled' });
    mockPrisma.interviewAttendee.findUnique.mockResolvedValue({ interviewId: 'iv-1', userId: 'user-1' });
    mockPrisma.interviewScorecard.findFirst.mockResolvedValue(null);
    mockPrisma.interviewScorecard.create.mockResolvedValue({
      id: 'sc-1',
      interviewId: 'iv-1',
      interviewerId: 'user-1',
      interviewer: { displayName: 'Karim Hassan' },
      overallRating: 4,
      recommendation: 'Hire',
      strengths: null,
      concerns: null,
      notes: 'Draft notes.',
      status: 'Draft',
      revision: 1,
      previousRevisionId: null,
      revisedById: null,
      revisionReason: null,
      submittedAt: null,
      createdAt: new Date('2026-10-06T09:00:00.000Z'),
    });
    mockPrisma.interviewAttendee.count.mockResolvedValue(1);
    mockPrisma.interviewScorecard.findMany.mockResolvedValue([{ interviewerId: 'user-1' }]);

    const saved = await service.submitScorecard('org-1', 'iv-1', 'user-1', {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Draft notes.',
      status: 'Draft',
    });

    expect(saved.status).toBe('Draft');
    expect(mockPrisma.interviewScorecard.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'Draft', submittedAt: null }),
    }));
    expect(mockPrisma.interview.updateMany).not.toHaveBeenCalled();
  });

  it('marks the interview Completed only after every assigned scorecard is submitted', async () => {
    mockPrisma.interview.findFirst.mockResolvedValue({ id: 'iv-1', status: 'Scheduled' });
    mockPrisma.interviewAttendee.findUnique.mockResolvedValue({ interviewId: 'iv-1', userId: 'user-1' });
    mockPrisma.interviewScorecard.findFirst.mockResolvedValue(null);
    mockPrisma.interviewScorecard.create.mockResolvedValue({
      id: 'sc-1',
      interviewId: 'iv-1',
      interviewerId: 'user-1',
      interviewer: { displayName: 'Karim Hassan' },
      overallRating: 4,
      recommendation: 'Hire',
      strengths: null,
      concerns: null,
      notes: 'Clear evidence.',
      status: 'Submitted',
      revision: 1,
      previousRevisionId: null,
      revisedById: null,
      revisionReason: null,
      submittedAt: new Date('2026-10-06T09:00:00.000Z'),
      createdAt: new Date('2026-10-06T09:00:00.000Z'),
    });
    mockPrisma.interviewAttendee.count.mockResolvedValue(1);
    mockPrisma.interviewScorecard.findMany.mockResolvedValue([{ interviewerId: 'user-1' }]);

    await service.submitScorecard('org-1', 'iv-1', 'user-1', {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Clear evidence.',
      status: 'Submitted',
    });

    expect(mockPrisma.interview.updateMany).toHaveBeenCalledWith({
      where: { id: 'iv-1', organizationId: 'org-1', status: { notIn: ['Cancelled', 'No-show'] } },
      data: { status: 'Completed', completedAt: expect.any(Date) },
    });
  });

  it('persists structured criteriaRatings linked to the scorecard and returns them', async () => {
    mockPrisma.interview.findFirst.mockResolvedValue({ id: 'iv-1', status: 'Scheduled' });
    mockPrisma.interviewAttendee.findUnique.mockResolvedValue({ interviewId: 'iv-1', userId: 'user-1' });
    mockPrisma.interviewScorecard.findFirst.mockResolvedValue(null);
    mockPrisma.interviewScorecard.create.mockResolvedValue({
      id: 'sc-1',
      interviewId: 'iv-1',
      interviewerId: 'user-1',
      interviewer: { displayName: 'Dr. Sarah' },
      overallRating: 5,
      recommendation: 'Strong Hire',
      strengths: 'Excellent clinical knowledge',
      concerns: null,
      notes: 'Outstanding candidate',
      status: 'Submitted',
      revision: 1,
      previousRevisionId: null,
      revisedById: null,
      revisionReason: null,
      submittedAt: new Date('2026-11-17T15:00:00.000Z'),
      createdAt: new Date('2026-11-17T15:00:00.000Z'),
    });
    mockPrisma.interviewAttendee.count.mockResolvedValue(1);
    mockPrisma.interviewScorecard.findMany.mockResolvedValue([{ interviewerId: 'user-1' }]);

    const criteriaRatings = [
      { criterionKey: 'crit-icu', criterionName: 'ICU Protocols', category: 'SKILL' as const, rating: 5, comment: 'Flawless' },
      { criterionKey: 'crit-comm', criterionName: 'Communication', category: 'COMPETENCY' as const, rating: 4, comment: 'Clear' },
    ];

    mockPrisma.interviewScorecardRating.findMany.mockResolvedValue(criteriaRatings);

    const result = await service.submitScorecard('org-1', 'iv-1', 'user-1', {
      overallRating: 5,
      recommendation: 'Strong Hire',
      notes: 'Outstanding candidate',
      status: 'Submitted',
      criteriaRatings,
    });

    expect(mockPrisma.interviewScorecardRating.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.interviewScorecardRating.upsert).toHaveBeenCalledWith({
      where: {
        scorecardId_criterionKey: {
          scorecardId: 'sc-1',
          criterionKey: 'crit-icu',
        },
      },
      update: {
        criterionName: 'ICU Protocols',
        category: 'SKILL',
        rating: 5,
        comment: 'Flawless',
      },
      create: {
        scorecardId: 'sc-1',
        criterionKey: 'crit-icu',
        criterionName: 'ICU Protocols',
        category: 'SKILL',
        rating: 5,
        comment: 'Flawless',
      },
    });

    expect(result.ratings).toEqual(criteriaRatings);
  });
});
