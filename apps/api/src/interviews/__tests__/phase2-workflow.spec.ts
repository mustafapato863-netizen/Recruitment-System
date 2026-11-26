import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import { MessageAttemptsService } from '../../applications/message-attempts.service';
import { assertStageGate } from '../../applications/application-gates';
import { ScreeningService } from '../../screening/screening.service';
import { decideJoining } from '../../hiring/joining-policy';
import { InterviewsService } from '../interviews.service';

const ORG_ID = 'org-1';
const RECRUITER: AuthUser = {
  userId: 'rec-1',
  organizationId: ORG_ID,
  email: 'rec@example.com',
  displayName: 'Mariam Recruiter',
  roleCodes: ['RECRUITER'],
};

describe('Phase 2 — Tickets 08, 11, 12, 13, 04 backend guarantees', () => {
  it('Ticket 08: returns server-resolved wa.me link for assigned recruiter without creating any sent attempt, and denies unauthorized user', async () => {
    const auditCreate = vi.fn();
    const prisma = {
      application: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: 'app-1',
            candidate: { phone: '+966 50 123 4567', phoneNormalized: '+966501234567' },
          })
          .mockResolvedValueOnce({
            stage: 'Screening',
            candidate: { firstName: 'Nora', lastName: 'Adel', phone: '+966 50 123 4567', phoneNormalized: '+966501234567' },
            vacancy: { position: { title: 'ICU Nurse' } },
            organization: { name: 'Saudi German Health' },
            primaryRecruiter: { displayName: 'Mariam Recruiter' },
            interviews: [],
          })
          .mockResolvedValueOnce(null),
      },
      whatsAppTemplate: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tpl-1',
          bodyTemplate: 'Hello {{candidateName}}, update for {{positionTitle}}.',
        }),
      },
      auditLog: { create: auditCreate },
    };
    const access = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG_ID }) };
    const service = new MessageAttemptsService(prisma as unknown as PrismaService, access as unknown as AccessControlService);

    const link = await service.buildWhatsAppLink(RECRUITER, 'app-1', { templateId: 'tpl-1' });
    expect(link.url).toContain('https://wa.me/966501234567?text=');
    expect(link.message).toBe('Hello Nora Adel, update for ICU Nurse.');
    expect(auditCreate).not.toHaveBeenCalled();

    await expect(service.buildWhatsAppLink(RECRUITER, 'app-unassigned')).rejects.toMatchObject({
      status: 403,
      response: { code: 'WHATSAPP_NOT_AUTHORIZED' },
    });
  });

  it('Ticket 08: returns 400 PHONE_MISSING when candidate has no valid international phone number', async () => {
    const prisma = {
      application: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'app-2',
          candidate: { phone: null, phoneNormalized: null },
        }),
      },
    };
    const access = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG_ID }) };
    const service = new MessageAttemptsService(prisma as unknown as PrismaService, access as unknown as AccessControlService);

    await expect(service.buildWhatsAppLink(RECRUITER, 'app-2')).rejects.toMatchObject({
      status: 400,
      response: { code: 'PHONE_MISSING' },
    });
  });

  it('Ticket 11: blocks Screening -> Interview when expectedSalary is missing, and computes inclusive salary fit', async () => {
    const txMissing = {
      screeningLog: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ notes: 'Strong clinical communication', expectedSalary: null })
          .mockResolvedValueOnce(null),
      },
    };
    await expect(
      assertStageGate(txMissing as never, { id: 'app-1', stage: 'Screening' }, 'Interview'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'EXPECTED_SALARY_REQUIRED' },
    });

    const txWithSalary = {
      screeningLog: {
        findFirst: vi.fn().mockResolvedValue({ notes: 'Strong fit', expectedSalary: 15000 }),
      },
    };
    await expect(
      assertStageGate(txWithSalary as never, { id: 'app-1', stage: 'Screening' }, 'Interview'),
    ).resolves.toBeUndefined();

    // Salary fit boundary: expected === budgetMin is within range
    const prisma = {
      application: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'app-1',
          stage: 'Screening',
          version: 2,
          candidate: { firstName: 'Omar', lastName: 'Saleh' },
          vacancy: {
            position: { title: 'ICU Nurse' },
            vacancyRequest: { budgetMin: 12000, budgetMax: 18000, budgetCurrency: 'SAR', budgetPeriod: 'Monthly' },
          },
          screeningLogs: [{ expectedSalary: 12000, salaryCurrency: 'SAR', salaryPeriod: 'Monthly' }],
        }),
      },
    };
    const accessControl = {
      assertApplicationAccess: vi.fn().mockResolvedValue(undefined),
      getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG_ID }),
    };
    const screeningService = new ScreeningService(prisma as unknown as PrismaService, accessControl as unknown as AccessControlService);
    const ctx = await screeningService.getScreeningContext(ORG_ID, 'app-1', RECRUITER);
    expect(ctx.salaryFit).toBe('within');
    expect(ctx.vacancySalaryRange).toEqual({ min: 12000, max: 18000, currency: 'SAR', period: 'Monthly' });
  });

  it('Ticket 13: blocks Interview -> Offer until EVERY assigned panelist submits a scorecard (Draft never counts)', async () => {
    const txPending = {
      interview: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'iv-1',
            title: 'Technical Panel',
            attendees: [
              { userId: 'u-1', user: { displayName: 'Dr. Ahmed' } },
              { userId: 'u-2', user: { displayName: 'Nurse Mona' } },
            ],
            scorecards: [{ interviewerId: 'u-1' }],
          },
        ]),
      },
    };
    await expect(
      assertStageGate(txPending as never, { id: 'app-1', stage: 'Interview' }, 'Offer'),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'GATE_SCORECARD_NOT_SUBMITTED',
        missing: ['Nurse Mona (Technical Panel)'],
      },
    });

    const txAllDone = {
      interview: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'iv-1',
            title: 'Technical Panel',
            attendees: [
              { userId: 'u-1', user: { displayName: 'Dr. Ahmed' } },
              { userId: 'u-2', user: { displayName: 'Nurse Mona' } },
            ],
            scorecards: [{ interviewerId: 'u-1' }, { interviewerId: 'u-2' }],
          },
        ]),
      },
    };
    await expect(
      assertStageGate(txAllDone as never, { id: 'app-1', stage: 'Interview' }, 'Offer'),
    ).resolves.toBeUndefined();
  });

  it('Ticket 13: saves SGH evaluation criteria with Not observed (null rating) without converting to 0', async () => {
    const ratingUpsert = vi.fn().mockResolvedValue({});
    const prisma = {
      interview: {
        findFirst: vi.fn().mockResolvedValue({ id: 'iv-1', status: 'Scheduled', scheduledStart: new Date(Date.now() - 3600_000) }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      interviewAttendee: {
        findUnique: vi.fn().mockResolvedValue({ interviewId: 'iv-1', userId: 'u-1' }),
        count: vi.fn().mockResolvedValue(1),
      },
      interviewScorecard: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'sc-1',
          interviewId: 'iv-1',
          interviewerId: 'u-1',
          interviewer: { displayName: 'Dr. Ahmed' },
          overallRating: 4,
          recommendation: 'Hire',
          strengths: 'Strong clinical reasoning',
          concerns: null,
          notes: 'Recommended for hire',
          status: 'Submitted',
          revision: 1,
          previousRevisionId: null,
          revisedById: null,
          revisionReason: null,
          submittedAt: new Date(),
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([{ interviewerId: 'u-1' }]),
      },
      interviewScorecardRating: {
        upsert: ratingUpsert,
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new InterviewsService(prisma as never, {} as never, {} as never);
    await service.submitScorecard(ORG_ID, 'iv-1', 'u-1', {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Recommended for hire',
      evaluationTemplate: 'SGH_COMBINED',
      decisionSummary: 'Strong clinical fit',
      criteriaRatings: [
        { criterionKey: 'hr_communication', criterionName: 'Communication', category: 'HR_BEHAVIORAL', rating: 5, notObserved: false },
        { criterionKey: 'tech_icu_vent', criterionName: 'Ventilator Ops', category: 'TECHNICAL', rating: null, notObserved: true },
      ],
    });

    expect(ratingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ criterionKey: 'tech_icu_vent', rating: null, notObserved: true }),
      }),
    );
  });

  it('Ticket 04: blocks joining when a Pre-Hire assessment interview has missing panel scorecards', () => {
    const decision = decideJoining({
      organizationId: ORG_ID,
      enforceActor: false,
      enforceRecord: false,
      actualJoiningDate: null,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      snapshot: { profile: 'technical', checks: ['ID', 'CONTRACT'] },
      acceptedOfferVersionId: 'ov-1',
      hiringCaseStatus: 'Awaiting Joining',
      approvalFingerprint: 'profile:technical|offer:ov-1|ID:1::,CONTRACT:1::',
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', decisionFingerprint: 'profile:technical|offer:ov-1|ID:1::,CONTRACT:1::' }],
      checks: [{ type: 'ID', verified: true }, { type: 'CONTRACT', verified: true }],
      joinedHeadcount: 0,
      approvedHeadcount: 2,
      assessmentInterviews: [
        { title: 'Pre-Hire Clinical Assessment', status: 'Completed', attendeeCount: 2, submittedScorecardCount: 1 },
      ],
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe('GATE_ASSESSMENT_INCOMPLETE');
    }
  });
});
