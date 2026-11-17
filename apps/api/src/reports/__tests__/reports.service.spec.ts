import { describe, expect, it, vi } from 'vitest';
import { ReportsService, normalizeReportSource } from '../reports.service';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';

describe('ReportsService — 4-tab overview calculations', () => {
  it('normalizes source aliases into controlled channels', () => {
    expect(normalizeReportSource('linkedin.com')).toBe('LinkedIn');
    expect(normalizeReportSource('LinkedIn Jobs')).toBe('LinkedIn');
    expect(normalizeReportSource('SGH Career Portal')).toBe('Career Site');
    expect(normalizeReportSource('Employee Ref')).toBe('Referral');
    expect(normalizeReportSource('External Headhunter')).toBe('Agency');
    expect(normalizeReportSource('Suggested from bank')).toBe('Direct / Bank');
    expect(normalizeReportSource('')).toBe('Unknown');
    expect(normalizeReportSource(null)).toBe('Unknown');
  });

  it('computes reachedFunnel (including rejected cohort items), timeToHire, sourcePerformance, and followUps', async () => {
    const appliedAt1 = new Date('2026-10-02T09:00:00.000Z');
    const appliedAt2 = new Date('2026-10-04T09:00:00.000Z');
    const cohortApps = [
      {
        id: 'app-1',
        candidateId: 'cand-1',
        vacancyId: 'vac-1',
        source: 'linkedin.com',
        stage: 'Rejected',
        appliedAt: appliedAt1,
        createdAt: appliedAt1,
        updatedAt: new Date('2026-10-15T09:00:00.000Z'),
        followUpDate: null,
        candidate: { id: 'cand-1', firstName: 'Omar', lastName: 'Hassan' },
        vacancy: { id: 'vac-1', vacancyCode: 'VAC-1', position: { title: 'ICU Nurse' } },
        primaryRecruiter: { id: 'u-rec', displayName: 'Sarah Ahmed' },
        statusHistory: [
          { fromStage: 'Applied', toStage: 'Screening', createdAt: new Date('2026-10-04T09:00:00.000Z') },
          { fromStage: 'Screening', toStage: 'Interview', createdAt: new Date('2026-10-08T09:00:00.000Z') },
          { fromStage: 'Interview', toStage: 'Rejected', createdAt: new Date('2026-10-15T09:00:00.000Z') },
        ],
        interviews: [],
        offers: [],
        hiringCase: null,
      },
      {
        id: 'app-2',
        candidateId: 'cand-2',
        vacancyId: 'vac-1',
        source: 'Employee Ref',
        stage: 'Interview',
        appliedAt: appliedAt2,
        createdAt: appliedAt2,
        updatedAt: new Date('2026-10-10T09:00:00.000Z'),
        followUpDate: new Date('2026-10-12T09:00:00.000Z'),
        candidate: { id: 'cand-2', firstName: 'Mariam', lastName: 'Essam' },
        vacancy: { id: 'vac-1', vacancyCode: 'VAC-1', position: { title: 'ICU Nurse' } },
        primaryRecruiter: { id: 'u-rec', displayName: 'Sarah Ahmed' },
        statusHistory: [
          { fromStage: 'Applied', toStage: 'Screening', createdAt: new Date('2026-10-05T09:00:00.000Z') },
          { fromStage: 'Screening', toStage: 'Interview', createdAt: new Date('2026-10-09T09:00:00.000Z') },
        ],
        notes: [],
        screeningLogs: [],
        interviews: [
          {
            id: 'iv-1',
            status: 'Completed',
            scheduledStart: new Date('2026-10-11T09:00:00.000Z'),
            attendees: [{ userId: 'u-iv', user: { displayName: 'Dr. Nour Ali' } }],
            scorecards: [],
          },
        ],
        offers: [],
        hiringCase: null,
      },
    ];

    const prisma = {
      application: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(cohortApps)
          .mockResolvedValueOnce([cohortApps[1]]),
      },
      offer: { findMany: vi.fn().mockResolvedValue([]) },
      interview: { findMany: vi.fn().mockResolvedValue([]) },
      hiringCase: { findMany: vi.fn().mockResolvedValue([]) },
      vacancy: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'vac-1',
            vacancyCode: 'VAC-1',
            approvedHeadcount: 2,
            positionId: 'pos-1',
            position: { title: 'ICU Nurse' },
            applications: [],
          },
        ]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      branch: { findMany: vi.fn().mockResolvedValue([]) },
      position: { findMany: vi.fn().mockResolvedValue([]) },
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'task-1',
            title: 'Call candidate in bank',
            dueAt: new Date('2026-10-10T09:00:00.000Z'),
            relatedEntityType: 'candidate',
            relatedEntityId: 'cand-bank',
            assignedTo: { displayName: 'Sarah Ahmed' },
          },
        ]),
      },
    } as unknown as PrismaService;

    const accessControl = {
      getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: 'org-1' }),
    } as unknown as AccessControlService;

    const service = new ReportsService(prisma, accessControl);
    const overview = await service.getOverview(
      'org-1',
      { month: '2026-10', vacancyId: 'vac-1' },
      { userId: 'u-rec', organizationId: 'org-1', tokenVersion: 0, roleCodes: ['RECRUITER'] },
    );

    // 1. Reached funnel keeps rejected application in cohort denominator and counts its reached Interview stage
    expect(overview.reachedFunnel?.cohortTotal).toBe(2);
    expect(overview.reachedFunnel?.reachedInterview).toBe(2);
    expect(overview.reachedFunnel?.tooFewToJudge).toBe(true);
    expect(overview.reachedFunnel?.outcomes.find((o) => o.outcome === 'REJECTED')?.count).toBe(1);

    // 2. Time to hire returns null medianDays when completedHiresCount === 0 (never 0 days)
    expect(overview.timeToHire?.completedHiresCount).toBe(0);
    expect(overview.timeToHire?.medianDays).toBeNull();
    expect(overview.timeToHire?.waitingFiles).toHaveLength(1);
    expect(overview.timeToHire?.waitingFiles[0]?.blockerKind).toBe('INTERVIEW_FEEDBACK');
    expect(overview.timeToHire?.waitingFiles[0]?.canRemindInterviewer).toBe(true);
    expect(overview.timeToHire?.waitingFiles[0]?.canSubmitOwnScorecard).toBe(false);

    // 3. Source performance normalizes aliases and marks < 5 as tooFewToJudge
    expect(overview.sourcePerformance?.sources.map((s) => s.source)).toEqual(['LinkedIn', 'Referral']);
    expect(overview.sourcePerformance?.sources.every((s) => s.tooFewToJudge)).toBe(true);

    // 4. Follow-ups distinguishes APPLICATION_FOLLOW_UP, PERSON_FOLLOW_UP, and PENDING_SCORECARD
    expect(overview.followUps?.scopeLabel).toBe('My follow-ups');
    expect(overview.followUps?.items.map((i) => i.kind).sort()).toEqual([
      'APPLICATION_FOLLOW_UP',
      'PENDING_SCORECARD',
      'PERSON_FOLLOW_UP',
    ]);

    // 5. Top jobs by applications and summaryCards
    expect(overview.topJobs).toEqual([
      {
        vacancyId: 'vac-1',
        jobTitle: 'ICU Nurse',
        vacancyCode: 'VAC-1',
        applicationsCount: 2,
        joinedCount: 0,
      },
    ]);
    expect(overview.summaryCards?.newCandidates.count).toBe(2);
    expect(overview.summaryCards?.newCandidates.changePct).toBeNull();
  });

  it('computes summaryCards growth percentages only when previous period has non-zero baseline', async () => {
    const prisma = {
      application: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'app-1',
            candidateId: 'cand-1',
            vacancyId: 'vac-1',
            source: 'LinkedIn',
            stage: 'Applied',
            appliedAt: new Date('2026-10-10T09:00:00.000Z'),
            createdAt: new Date('2026-10-10T09:00:00.000Z'),
            updatedAt: new Date('2026-10-10T09:00:00.000Z'),
            candidate: { id: 'cand-1', firstName: 'Nabil', lastName: 'Ahmed' },
            vacancy: { id: 'vac-1', vacancyCode: 'VAC-1', position: { title: 'Registered Nurse' } },
            primaryRecruiter: { id: 'u-rec', displayName: 'Sarah Ahmed' },
            statusHistory: [],
            interviews: [],
            offers: [],
            hiringCase: null,
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
      offer: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      interview: {
        findMany: vi.fn().mockResolvedValue([
          { status: 'Scheduled', scheduledStart: new Date('2026-10-12T10:00:00.000Z') },
          { status: 'Scheduled', scheduledStart: new Date('2026-10-14T10:00:00.000Z') },
          { status: 'Scheduled', scheduledStart: new Date('2026-10-15T10:00:00.000Z') },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
      hiringCase: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      vacancy: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      branch: { findMany: vi.fn().mockResolvedValue([]) },
      position: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const service = new ReportsService(prisma);
    const overview = await service.getOverview('org-1', { month: '2026-10' });

    // 1 application vs 2 previous -> -50%
    expect(overview.summaryCards?.newCandidates).toEqual({
      count: 1,
      previousCount: 2,
      changePct: -50,
    });
    // 3 interviews vs 2 previous -> +50%
    expect(overview.summaryCards?.interviewsScheduled).toEqual({
      count: 3,
      previousCount: 2,
      changePct: 50,
    });
    // 0 offers vs 0 previous -> changePct is null (no valid baseline)
    expect(overview.summaryCards?.offersSent).toEqual({
      count: 0,
      previousCount: 0,
      changePct: null,
    });
  });
});
