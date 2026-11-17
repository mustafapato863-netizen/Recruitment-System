import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from '../applications.service';
import { ApplicationFileService } from '../application-file.service';
import { GATE_CODES, assertStageGate } from '../application-gates';
import { InterviewsService, assignedInterviewView } from '../../interviews/interviews.service';
import { OffersService } from '../../offers/offers.service';
import { HiringService, finalApproverView } from '../../hiring/hiring.service';
import { RECORD_ACTUAL_JOINING, caseFingerprint, decideJoining } from '../../hiring/joining-policy';
import { buildMyWork } from '../../my-work/my-work.buckets';
import { MyWorkService } from '../../my-work/my-work.service';
import { ResultsService } from '../../results/results.service';
import { TasksService } from '../../tasks/tasks.service';

const ORG = 'org-synth-1';
const OTHER_ORG = 'org-synth-2';
const NOW = new Date('2026-10-30T09:00:00.000Z');

describe('Recruiter workflow integration (Tickets 01–08)', () => {
  it('Ticket 01: My Work surfaces actionable approved/draft/sent-back/expired offers, >200 tasks ordered by due date, and 15-day-old missing scorecards', async () => {
    const overdueTasks = Array.from({ length: 205 }, (_, idx) => ({
      id: `task-${idx + 1}`,
      title: `Follow up candidate #${idx + 1}`,
      dueAt: new Date(NOW.getTime() - (205 - idx) * 86_400_000),
      entityType: 'Candidate',
      entityId: `cand-${idx + 1}`,
    }));

    const oldInterviewEnd = new Date(NOW.getTime() - 15 * 86_400_000);
    const oldInterviewStart = new Date(oldInterviewEnd.getTime() - 3_600_000);

    const buckets = buildMyWork(
      {
        jobs: [],
        requisitions: [],
        tasks: overdueTasks,
        interviews: [
          {
            id: 'iv-15d-old',
            title: 'Technical Panel',
            status: 'Completed',
            start: oldInterviewStart,
            end: oldInterviewEnd,
            applicationId: 'app-iv-old',
            ownsFile: true,
            iAmInterviewer: true,
            jobTitle: 'Senior Software Engineer',
            app: {
              applicationId: 'app-iv-old',
              stage: 'Interview',
              candidate: { id: 'c-iv', name: 'Omar Hassan' },
            },
          },
        ],
        myMissingScorecards: [
          {
            interviewId: 'iv-15d-old',
            title: 'Technical Panel',
            end: oldInterviewEnd,
            app: {
              applicationId: 'app-iv-old',
              stage: 'Interview',
              candidate: { id: 'c-iv', name: 'Omar Hassan' },
            },
          },
        ],
        othersMissingScorecards: [],
        offers: [
          {
            id: 'of-approved',
            code: 'OF-APP',
            status: 'Approved',
            applicationId: 'app-1',
            updatedAt: NOW,
          },
          {
            id: 'of-draft',
            code: 'OF-DR',
            status: 'Draft',
            applicationId: 'app-2',
            updatedAt: NOW,
          },
          {
            id: 'of-sentback',
            code: 'OF-SB',
            status: 'Draft',
            sentBack: true,
            applicationId: 'app-3',
            updatedAt: NOW,
          },
          {
            id: 'of-expired',
            code: 'OF-EXP',
            status: 'Expired',
            applicationId: 'app-4',
            updatedAt: NOW,
          },
        ],
      },
      NOW,
    );

    const taskItems = buckets.overdue.filter((i) => i.type === 'task');
    expect(taskItems).toHaveLength(205);
    const scorecardItem = buckets.overdue.find((i) => i.id === 'iv-15d-old');
    expect(scorecardItem?.nextAction).toEqual({ code: 'submit-scorecard', label: 'Submit scorecard' });

    expect(buckets.dueToday.find((i) => i.id === 'of-approved')?.nextAction).toEqual({ code: 'send-offer', label: 'Send offer' });
    expect(buckets.dueToday.find((i) => i.id === 'of-draft')?.nextAction).toEqual({ code: 'open-offer', label: 'Submit for approval' });
    expect(buckets.dueToday.find((i) => i.id === 'of-sentback')?.nextAction).toEqual({ code: 'open-offer', label: 'Revise and resubmit' });
    expect(buckets.dueToday.find((i) => i.id === 'of-expired')?.nextAction).toEqual({ code: 'open-offer', label: 'New offer version' });

    // Verify MyWorkService query retains completed interviews older than 14 days and orders tasks by dueAt asc
    const interviewFindMany = vi.fn().mockResolvedValue([]);
    const taskFindMany = vi.fn().mockResolvedValue([]);
    const prismaMock = {
      vacancy: { findMany: vi.fn().mockResolvedValue([]) },
      vacancyRequest: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: taskFindMany },
      interview: { findMany: interviewFindMany },
      offer: { findMany: vi.fn().mockResolvedValue([]) },
      hiringCase: { findMany: vi.fn().mockResolvedValue([]) },
      serviceHeartbeat: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const svc = new MyWorkService(prismaMock as never);
    await svc.getMyWork({ userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] }, NOW);
    expect(taskFindMany.mock.calls[0]?.[0]?.orderBy).toEqual([{ dueAt: 'asc' }, { id: 'asc' }]);
    expect(interviewFindMany.mock.calls[0]?.[0]?.orderBy).toEqual({ scheduledStart: 'asc' });
  });

  it('Ticket 03: Idempotent job assignment prevents duplicate applications; concurrent task close blocks stale updates', async () => {
    const existingApp = {
      id: 'app-existing-1',
      organizationId: ORG,
      applicationCode: 'APP-2026-001',
      vacancyId: 'vac-1',
      candidateId: 'cand-1',
      stage: 'Applied',
    };
    const appPrisma = {
      vacancy: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'vac-1',
          organizationId: ORG,
          vacancyCode: 'VAC-2026-001',
          status: 'Open',
          primaryRecruiterId: 'rec-1',
          assignments: [{ id: 'asgn-1' }],
        }),
      },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ id: 'cand-1', organizationId: ORG, firstName: 'Nabil', lastName: 'Ahmed' }),
      },
      application: {
        findUnique: vi.fn().mockResolvedValue(existingApp),
        create: vi.fn(),
      },
    };
    const appService = new ApplicationsService(
      appPrisma as never,
      { enqueueWithTx: vi.fn() } as never,
      {} as never,
      {
        getVacancyVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        assertCanAccessVacancy: vi.fn().mockResolvedValue(undefined),
      } as never,
    );
    await expect(
      appService.createApplication(
        ORG,
        { vacancyId: 'vac-1', candidateId: 'cand-1' } as never,
        { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'APPLICATION_EXISTS' }),
    });
    expect(appPrisma.application.create).not.toHaveBeenCalled();

    // Concurrent task completion/reassignment guard via updateMany
    const taskRow = {
      id: 'task-1',
      organizationId: ORG,
      assigneeUserId: 'rec-1',
      status: 'Open',
      dueAt: NOW,
      title: 'Call candidate',
      type: 'FollowUp',
      priority: 'Normal',
    };
    const taskPrisma = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      task: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(taskRow)
          .mockResolvedValueOnce({ ...taskRow, assigneeUserId: 'rec-2' })
          .mockResolvedValueOnce(taskRow)
          .mockResolvedValueOnce({ ...taskRow, status: 'Completed' }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const tasksService = new TasksService(taskPrisma as never);
    await expect(
      tasksService.updateStatus(ORG, 'rec-1', 'task-1', 'Completed'),
    ).rejects.toThrow('Access denied: task belongs to another user');
    await expect(
      tasksService.reschedule(ORG, 'rec-1', 'task-1', '2027-11-05T10:00:00.000Z'),
    ).rejects.toThrow('Cannot reschedule a closed task.');
  });

  it('Ticket 04: Interview scheduling blocks held/closed jobs, enforces submitted scorecard gate, and narrows interviewer view', async () => {
    const ivPrisma = {
      application: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'app-held',
          organizationId: ORG,
          stage: 'Screening',
          vacancy: { id: 'vac-held', status: 'On Hold' },
        }),
      },
    };
    const ivService = new InterviewsService(ivPrisma as never, { create: vi.fn() } as never, {} as never);
    await expect(
      ivService.createInterview(ORG, {
        applicationId: 'app-held',
        interviewType: 'Technical',
        scheduledStart: '2026-11-02T09:00:00.000Z',
        scheduledEnd: '2026-11-02T10:00:00.000Z',
        attendeeUserIds: ['iv-1'],
        locationUrl: 'https://meet.google.com/abc-defg-hij',
      } as never),
    ).rejects.toThrow(ConflictException);

    // Gate check: Draft scorecard blocks Offer stage; Submitted scorecard unlocks Offer stage
    const gatePrismaDraft = {
      interviewScorecard: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect(
      assertStageGate(gatePrismaDraft as never, { id: 'app-1', stage: 'Interview' }, 'Offer'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: GATE_CODES.scorecard }),
    });

    const gatePrismaSubmitted = {
      interviewScorecard: { count: vi.fn().mockResolvedValue(1) },
    };
    await expect(
      assertStageGate(gatePrismaSubmitted as never, { id: 'app-1', stage: 'Interview' }, 'Offer'),
    ).resolves.toBeUndefined();

    // Narrow interviewer view strips other interviewers' scorecards and applicationCode
    const narrow = assignedInterviewView(
      {
        id: 'iv-1',
        organizationId: ORG,
        interviewCode: 'INT-1',
        applicationId: 'app-1',
        applicationCode: 'APP-1',
        title: 'Technical Panel',
        interviewType: 'Technical',
        scheduledStart: NOW.toISOString(),
        scheduledEnd: NOW.toISOString(),
        timezone: 'Africa/Cairo',
        status: 'Completed',
        attendees: [
          { id: 'att-1', interviewId: 'iv-1', userId: 'iv-1', userName: 'Dr. Iv One', response: 'Accepted' },
          { id: 'att-2', interviewId: 'iv-1', userId: 'iv-2', userName: 'Dr. Iv Two', response: 'Accepted' },
        ],
        scorecards: [
          { id: 'sc-1', interviewId: 'iv-1', interviewerId: 'iv-1', interviewerName: 'Dr. Iv One', overallRating: 4, recommendation: 'Hire', strengths: 'Good', concerns: '', notes: 'My scorecard', revision: 1, status: 'Submitted' },
          { id: 'sc-2', interviewId: 'iv-1', interviewerId: 'iv-2', interviewerName: 'Dr. Iv Two', overallRating: 2, recommendation: 'No Hire', strengths: '', concerns: 'Private', notes: 'Other private note', revision: 1, status: 'Submitted' },
        ],
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      } as never,
      'iv-1',
    );
    expect(narrow.applicationCode).toBeUndefined();
    expect(narrow.scorecards).toHaveLength(1);
    expect(narrow.scorecards[0]?.interviewerId).toBe('iv-1');
  });

  it('Ticket 05: Offer currentVersionId authority, stale approval rejection, and persisted decline reason note', async () => {
    const noteCreate = vi.fn().mockResolvedValue({ id: 'note-decline-1' });
    const offerRow = {
      id: 'offer-1',
      organizationId: ORG,
      applicationId: 'app-1',
      offerCode: 'OF-2026-001',
      status: 'Sent',
      currentVersionId: 'ver-2',
      application: {
        id: 'app-1',
        primaryRecruiterId: 'rec-1',
        candidate: { firstName: 'Kareem', lastName: 'Fathy' },
        vacancy: { primaryRecruiterId: 'rec-1', position: { title: 'Medical Coder' } },
      },
      versions: [
        { id: 'ver-3', versionNumber: 3, status: 'Draft', approvalStatus: 'Draft', approvals: [] },
        { id: 'ver-2', versionNumber: 2, status: 'Sent', approvalStatus: 'Approved', approvals: [] },
      ],
    };
    const prismaMock = {
      offer: {
        findFirst: vi.fn().mockResolvedValue(offerRow),
        update: vi.fn().mockResolvedValue({ ...offerRow, status: 'Declined' }),
      },
      offerVersion: {
        update: vi.fn().mockResolvedValue({ id: 'ver-2', status: 'Declined' }),
      },
      offerApproval: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'appr-stale-v1',
          offerVersionId: 'ver-1',
          status: 'Pending',
          offerVersion: {
            id: 'ver-1',
            versionNumber: 1,
            offer: { id: 'offer-1', organizationId: ORG, currentVersionId: 'ver-2', status: 'Pending Approval' },
          },
        }),
      },
      application: {
        findUnique: vi.fn().mockResolvedValue({ id: 'app-1', stage: 'Offer' }),
        update: vi.fn().mockResolvedValue({ id: 'app-1', stage: 'Rejected' }),
      },
      applicationStatusHistory: {
        create: vi.fn().mockResolvedValue({ id: 'hist-1' }),
      },
      applicationNote: { create: noteCreate },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };
    const offersService = new OffersService(
      prismaMock as never,
      { create: vi.fn().mockResolvedValue(undefined) } as never,
      {
        getOfferVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        getApplicationReadVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        canViewCompensationForVacancy: vi.fn().mockReturnValue(true),
      } as never,
    );

    // Stale v1 approval decision is rejected with OFFER_NOT_CURRENT_VERSION
    await expect(
      offersService.submitDecision(
        { userId: 'mgr-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['HR_MANAGER'] } as never,
        'appr-stale-v1',
        { decision: 'Approve', comment: 'Approving old version' } as never,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OFFER_NOT_CURRENT_VERSION' }),
    });

    // Declining currentVersionId (ver-2) updates ver-2 and records the decline reason in applicationNote
    const res = await offersService.updateOfferStatus(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'offer-1',
      { status: 'Declined', reason: 'Accepted competing hospital offer' },
    );
    expect(res).toEqual({ success: true, status: 'Declined' });
    expect(prismaMock.offerVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-2' },
      data: { status: 'Declined' },
    });
    expect(noteCreate).toHaveBeenCalledWith({
      data: {
        organizationId: ORG,
        applicationId: 'app-1',
        authorId: 'rec-1',
        content: 'Candidate declined offer v2: Accepted competing hospital offer',
      },
    });
  });

  it('Ticket 06: Technical and clinical hires enforce check snapshots, final approval separation, explicit joining date, and single headcount increment', async () => {
    const explicitJoiningDate = new Date('2026-10-29T00:00:00.000Z');

    // 1. Technical hire: ID + CONTRACT verified -> Final approval -> Recruiter records actual joining date
    const techSnapshot = { profile: 'technical' as const, checks: ['ID', 'CONTRACT'] as const };
    const techChecks = [
      { type: 'ID' as const, verified: true, expiryDate: null, documentId: 'doc-id' },
      { type: 'CONTRACT' as const, verified: true, expiryDate: null, documentId: 'doc-contract' },
    ];
    const techFp = caseFingerprint({
      snapshot: techSnapshot,
      acceptedOfferVersionId: 'offer-tech-v1',
      checks: techChecks,
    });

    // Without final approval -> blocked with FINAL_APPROVAL_REQUIRED
    const beforeApproval = decideJoining({
      organizationId: ORG,
      actor: { userId: 'rec-1', organizationId: ORG, permissions: [RECORD_ACTUAL_JOINING] },
      enforceActor: true,
      enforceRecord: true,
      actualJoiningDate: explicitJoiningDate,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      acceptedOfferVersionId: 'offer-tech-v1',
      hiringCaseStatus: 'Pending Final Approval',
      approvalFingerprint: null,
      approvals: [],
      joinedHeadcount: 0,
      approvedHeadcount: 1,
      snapshot: { profile: 'technical', checks: ['ID', 'CONTRACT'] },
      checks: techChecks,
    });
    expect(beforeApproval).toMatchObject({ ok: false, code: 'FINAL_APPROVAL_REQUIRED' });

    // Final approver cannot record actual joining (separation of duties)
    const approverAttempt = decideJoining({
      organizationId: ORG,
      actor: { userId: 'approver-1', organizationId: ORG, permissions: ['FINAL_HIRING_APPROVAL'] },
      enforceActor: true,
      enforceRecord: true,
      actualJoiningDate: explicitJoiningDate,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      acceptedOfferVersionId: 'offer-tech-v1',
      hiringCaseStatus: 'Awaiting Joining',
      approvalFingerprint: techFp,
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: techFp }],
      joinedHeadcount: 0,
      approvedHeadcount: 1,
      snapshot: { profile: 'technical', checks: ['ID', 'CONTRACT'] },
      checks: techChecks,
    });
    expect(approverAttempt).toMatchObject({ ok: false, code: 'JOINING_PERMISSION_REQUIRED', httpStatus: 403 });

    // Cross-tenant attempt -> 404 WRONG_ORGANIZATION
    const wrongTenantAttempt = decideJoining({
      organizationId: ORG,
      actor: { userId: 'rec-1', organizationId: OTHER_ORG, permissions: [RECORD_ACTUAL_JOINING] },
      enforceActor: true,
      enforceRecord: true,
      actualJoiningDate: explicitJoiningDate,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      acceptedOfferVersionId: 'offer-tech-v1',
      hiringCaseStatus: 'Awaiting Joining',
      approvalFingerprint: techFp,
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: techFp }],
      joinedHeadcount: 0,
      approvedHeadcount: 1,
      snapshot: { profile: 'technical', checks: ['ID', 'CONTRACT'] },
      checks: techChecks,
    });
    expect(wrongTenantAttempt).toMatchObject({ ok: false, code: 'WRONG_ORGANIZATION', httpStatus: 404 });

    // Responsible recruiter with explicit joining date succeeds
    const techJoinDecision = decideJoining({
      organizationId: ORG,
      actor: { userId: 'rec-1', organizationId: ORG, permissions: [RECORD_ACTUAL_JOINING] },
      enforceActor: true,
      enforceRecord: true,
      actualJoiningDate: explicitJoiningDate,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      acceptedOfferVersionId: 'offer-tech-v1',
      hiringCaseStatus: 'Awaiting Joining',
      approvalFingerprint: techFp,
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: techFp }],
      joinedHeadcount: 0,
      approvedHeadcount: 1,
      snapshot: { profile: 'technical', checks: ['ID', 'CONTRACT'] },
      checks: techChecks,
    });
    expect(techJoinDecision).toMatchObject({ ok: true });

    // 2. Clinical hire: requires valid non-expired SCFHS_LICENCE on the explicit joining date
    const clinicalSnapshot = { profile: 'clinical' as const, checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] as const };
    const expiredClinicalChecks = [
      { type: 'ID' as const, verified: true, expiryDate: null, documentId: 'doc-id' },
      { type: 'CONTRACT' as const, verified: true, expiryDate: null, documentId: 'doc-contract' },
      { type: 'SCFHS_LICENCE' as const, verified: true, expiryDate: '2026-10-01T00:00:00.000Z', documentId: 'doc-lic' },
    ];
    const expiredClinicalAttempt = decideJoining({
      organizationId: ORG,
      actor: { userId: 'rec-1', organizationId: ORG, permissions: [RECORD_ACTUAL_JOINING] },
      enforceActor: true,
      enforceRecord: true,
      actualJoiningDate: explicitJoiningDate,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      acceptedOfferVersionId: 'offer-clin-v1',
      hiringCaseStatus: 'Awaiting Joining',
      approvalFingerprint: null,
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: null }],
      joinedHeadcount: 0,
      approvedHeadcount: 1,
      snapshot: { profile: 'clinical', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] },
      checks: expiredClinicalChecks,
    });
    expect(expiredClinicalAttempt).toMatchObject({ ok: false, code: 'LICENCE_EXPIRED' });

    const validClinicalChecks = [
      { type: 'ID' as const, verified: true, expiryDate: null, documentId: 'doc-id' },
      { type: 'CONTRACT' as const, verified: true, expiryDate: null, documentId: 'doc-contract' },
      { type: 'SCFHS_LICENCE' as const, verified: true, expiryDate: '2027-10-01T00:00:00.000Z', documentId: 'doc-lic' },
    ];
    const clinFp = caseFingerprint({
      snapshot: clinicalSnapshot,
      acceptedOfferVersionId: 'offer-clin-v1',
      checks: validClinicalChecks,
    });
    const validClinicalJoin = decideJoining({
      organizationId: ORG,
      actor: { userId: 'rec-1', organizationId: ORG, permissions: [RECORD_ACTUAL_JOINING] },
      enforceActor: true,
      enforceRecord: true,
      actualJoiningDate: explicitJoiningDate,
      caseOwnerId: 'rec-1',
      primaryRecruiterId: 'rec-1',
      vacancyPrimaryRecruiterId: 'rec-1',
      acceptedOfferVersionId: 'offer-clin-v1',
      hiringCaseStatus: 'Awaiting Joining',
      approvalFingerprint: clinFp,
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: clinFp }],
      joinedHeadcount: 0,
      approvedHeadcount: 1,
      snapshot: { profile: 'clinical', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] },
      checks: validClinicalChecks,
    });
    expect(validClinicalJoin).toMatchObject({ ok: true });

    // Confirm HiringService.confirmJoining is idempotent when already Joined (returns alreadyJoined: true without incrementing headcount)
    const vacancyUpdateMany = vi.fn();
    const hiringPrisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rec-1',
          organizationId: ORG,
          status: 'Active',
          userRoles: [{ role: { code: 'RECRUITER', permissions: [{ permission: { code: RECORD_ACTUAL_JOINING } }] } }],
        }),
      },
      hiringCase: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'case-joined-1',
          organizationId: ORG,
          status: 'Joined',
          joinedAt: explicitJoiningDate,
          ownerUserId: 'rec-1',
          applicationId: 'app-joined-1',
          application: {
            id: 'app-joined-1',
            stage: 'Joined',
            primaryRecruiterId: 'rec-1',
            vacancyId: 'vac-1',
            vacancy: { id: 'vac-1', primaryRecruiterId: 'rec-1', joinedHeadcount: 1, approvedHeadcount: 2 },
            joiningChecks: validClinicalChecks,
          },
          offer: { currentVersionId: 'offer-clin-v1', versions: [{ id: 'offer-clin-v1', status: 'Accepted' }] },
          approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: clinFp }],
        }),
      },
      vacancy: { updateMany: vacancyUpdateMany },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(hiringPrisma)),
    };
    const hiringSvc = new HiringService(hiringPrisma as never, { log: vi.fn().mockResolvedValue(undefined) } as never);
    const repeatJoin = await hiringSvc.confirmJoining(
      ORG,
      'case-joined-1',
      { joinedAt: explicitJoiningDate.toISOString() },
      { userId: 'rec-1', organizationId: ORG, permissions: [RECORD_ACTUAL_JOINING], tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
    );
    expect(repeatJoin).toMatchObject({ alreadyJoined: true, success: true });
    expect(vacancyUpdateMany).not.toHaveBeenCalled();

    // Final approver view redacts compensation
    const approverSlice = finalApproverView({
      id: 'case-joined-1',
      status: 'Pending Final Approval',
      application: {
        candidate: { firstName: 'Nabil', lastName: 'Ahmed', currentSalary: 18000, expectedSalary: 22000 } as never,
        vacancy: { position: { title: 'Registered Nurse' }, branch: { name: 'SGH Dubai' } },
      },
      approvals: [],
    });
    expect(JSON.stringify(approverSlice)).not.toContain('18000');
    expect(JSON.stringify(approverSlice)).not.toContain('22000');
  });

  it('R01/R04/R05/R06: Canonical ApplicationFollowUp task lifecycle, document request status matching, WhatsApp prepareOnly, and atomic Withdrawn reason', async () => {
    // 1. R01: ApplicationFileService.setFollowUp creates canonical ApplicationFollowUp task and clears/dismisses it when followUpDate is cleared
    const taskCreate = vi.fn().mockResolvedValue({ id: 'task-fu-1' });
    const taskUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const appUpdate = vi.fn().mockResolvedValue({ id: 'app-1', followUpDate: new Date('2026-11-01T00:00:00.000Z') });
    const filePrisma = {
      application: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'app-1',
          candidateId: 'cand-1',
          vacancyId: 'vac-1',
          organizationId: ORG,
          primaryRecruiterId: 'rec-1',
          taskOwnerId: 'rec-1',
          followUpDate: null,
          candidate: { firstName: 'Kareem', lastName: 'Fathy' },
          vacancy: { primaryRecruiterId: 'rec-1', vacancyCode: 'VAC-1', position: { title: 'Medical Coder' } },
        }),
        update: appUpdate,
      },
      vacancyAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      task: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: taskCreate,
        update: vi.fn(),
        updateMany: taskUpdateMany,
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'aud-req-1', createdAt: NOW }),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'aud-req-id',
              reason: 'ID',
              createdAt: new Date('2026-10-28T08:00:00.000Z'),
            },
            {
              id: 'aud-req-contract',
              reason: 'CONTRACT',
              createdAt: new Date('2026-10-28T09:00:00.000Z'),
            },
            {
              id: 'aud-req-lic',
              reason: 'SCFHS_LICENCE',
              createdAt: new Date('2026-10-28T10:00:00.000Z'),
            },
          ]),
      },
      candidateDocument: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'doc-id-1',
            documentType: 'National ID',
            fileName: 'id.pdf',
            fileSize: 1024,
            scanStatus: 'Clean',
            storageKey: 'local/id.pdf',
            storageProvider: 'local',
            createdAt: new Date('2026-10-29T08:00:00.000Z'),
            uploadedBy: { id: 'rec-1', displayName: 'Mariam Farag' },
          },
          {
            id: 'doc-contract-1',
            documentType: 'Signed Contract',
            fileName: 'contract.pdf',
            fileSize: 2048,
            scanStatus: 'Clean',
            storageKey: 'local/contract.pdf',
            storageProvider: 'local',
            createdAt: new Date('2026-10-29T09:00:00.000Z'),
            uploadedBy: { id: 'rec-1', displayName: 'Mariam Farag' },
          },
        ]),
      },
      joiningCheck: {
        findMany: vi.fn().mockResolvedValue([
          { type: 'ID', verified: true, documentId: 'doc-id-1' },
        ]),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(filePrisma)),
    };

    const fileSvc = new ApplicationFileService(
      filePrisma as never,
      { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }) } as never,
      { log: vi.fn().mockResolvedValue(undefined) } as never,
      { create: vi.fn().mockResolvedValue(undefined) } as never,
    );
    const setRes = await fileSvc.setFollowUp(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'app-1',
      '2026-11-01',
    );
    expect(setRes).toEqual({ id: 'app-1', followUpDate: '2026-11-01' });
    expect(taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG,
        title: 'Follow up: Kareem Fathy · Medical Coder',
        type: 'ApplicationFollowUp',
        status: 'Open',
        assigneeUserId: 'rec-1',
        entityType: 'Application',
        entityId: 'app-1',
      }),
    });

    appUpdate.mockResolvedValueOnce({ id: 'app-1', followUpDate: null });
    await fileSvc.setFollowUp(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'app-1',
      null,
    );
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG,
        entityType: 'Application',
        entityId: 'app-1',
        type: 'ApplicationFollowUp',
        status: { in: ['Open', 'In Progress'] },
      },
      data: expect.objectContaining({ status: 'Dismissed' }),
    });

    // 2. R04: documentHistory matches DOCUMENT_REQUEST -> Verified (ID), Received (CONTRACT), Requested (SCFHS_LICENCE)
    const docHist = await fileSvc.documentHistory(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'app-1',
    );
    expect(docHist.requests.map((r) => [r.documentType, r.status, r.matchedDocumentId])).toEqual([
      ['ID', 'Verified', 'doc-id-1'],
      ['CONTRACT', 'Received', 'doc-contract-1'],
      ['SCFHS_LICENCE', 'Requested', null],
    ]);

    // 3. R01: ResultsService.results keeps an application follow-up overdue if only a generic note exists while its canonical ApplicationFollowUp task is still Open
    const resultsPrisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 'rec-1', displayName: 'Mariam Farag' }]),
      },
      vacancy: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      application: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'app-overdue-1',
            stage: 'Screening',
            followUpDate: new Date('2026-10-20T00:00:00.000Z'),
            notes: [{ createdAt: new Date('2026-10-25T10:00:00.000Z') }],
            statusHistory: [],
          },
        ]),
      },
      task: {
        findMany: vi.fn().mockResolvedValue([
          { entityId: 'app-overdue-1', status: 'Open', dueAt: new Date('2026-10-20T00:00:00.000Z'), completedAt: null, updatedAt: new Date('2026-10-20T08:00:00.000Z'), createdAt: new Date('2026-10-20T08:00:00.000Z') },
        ]),
      },
      screeningLog: { findMany: vi.fn().mockResolvedValue([]) },
      offerVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const resultsSvc = new ResultsService(
      resultsPrisma as never,
      {
        getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        getVacancyVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
      } as never,
    );
    const resTiles = await resultsSvc.results(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'me',
      { month: '2026-10' },
      NOW,
    );
    expect(resTiles.tiles.overdueFollowUps.value).toBe(1);

    // 4. R05 & R06: OffersService WhatsApp prepareOnly does not mark Sent; Withdrawn records atomic reason note
    const offerNoteCreate = vi.fn().mockResolvedValue({ id: 'note-withdrawn-1' });
    const offerUpdate = vi.fn().mockResolvedValue({ id: 'offer-w1', status: 'Withdrawn' });
    const offerVersionUpdate = vi.fn().mockResolvedValue({ id: 'ver-w1', status: 'Withdrawn' });
    const offerPrisma = {
      offer: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'offer-w1',
          organizationId: ORG,
          applicationId: 'app-w1',
          offerCode: 'OF-W1',
          status: 'Approved',
          currentVersionId: 'ver-w1',
          application: {
            id: 'app-w1',
            primaryRecruiterId: 'rec-1',
            candidate: { firstName: 'Kareem', lastName: 'Fathy', phone: '+201001234567', email: 'kareem@x.test' },
            vacancy: { primaryRecruiterId: 'rec-1', position: { title: 'Medical Coder' } },
          },
          versions: [
            { id: 'ver-w1', versionNumber: 1, status: 'Approved', approvalStatus: 'Approved', approvals: [] },
          ],
        }),
        update: offerUpdate,
      },
      offerVersion: {
        findUnique: vi.fn().mockResolvedValue({ id: 'ver-w1', versionNumber: 1, status: 'Approved', approvalStatus: 'Approved' }),
        update: offerVersionUpdate,
        updateMany: vi.fn(),
      },
      emailTemplate: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      whatsAppTemplate: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tpl-1',
          organizationId: ORG,
          status: 'Active',
          bodyTemplate: 'Hello {{candidateName}}, your offer for {{positionTitle}} is ready.',
        }),
      },
      application: {
        findUnique: vi.fn().mockResolvedValue({ id: 'app-w1', stage: 'Offer' }),
        update: vi.fn().mockResolvedValue({ id: 'app-w1', stage: 'Rejected' }),
      },
      applicationStatusHistory: { create: vi.fn().mockResolvedValue({ id: 'h-w1' }) },
      applicationNote: { create: offerNoteCreate },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(offerPrisma)),
    };
    const offersSvc = new OffersService(
      offerPrisma as never,
      { create: vi.fn().mockResolvedValue(undefined) } as never,
      {
        getOfferVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        getApplicationReadVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
        canViewCompensationForVacancy: vi.fn().mockReturnValue(true),
      } as never,
    );

    const prepared = await offersSvc.sendOffer(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'offer-w1',
      { channel: 'whatsapp', templateId: 'tpl-1', prepareOnly: true },
    );
    expect(prepared).toMatchObject({
      id: 'offer-w1',
      status: 'Approved',
      prepared: true,
      channel: 'whatsapp',
      templateId: 'tpl-1',
    });
    expect(offerUpdate).not.toHaveBeenCalled();
    expect(offerVersionUpdate).not.toHaveBeenCalled();

    offerPrisma.offer.findFirst.mockResolvedValueOnce({
      id: 'offer-w1',
      organizationId: ORG,
      applicationId: 'app-w1',
      offerCode: 'OF-W1',
      status: 'Sent',
      currentVersionId: 'ver-w1',
      application: {
        id: 'app-w1',
        primaryRecruiterId: 'rec-1',
        candidate: { firstName: 'Kareem', lastName: 'Fathy' },
        vacancy: { primaryRecruiterId: 'rec-1', position: { title: 'Medical Coder' } },
      },
      versions: [
        { id: 'ver-w1', versionNumber: 1, status: 'Sent', approvalStatus: 'Approved', approvals: [] },
      ],
    });
    const withdrawnRes = await offersSvc.updateOfferStatus(
      { userId: 'rec-1', organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] } as never,
      'offer-w1',
      { status: 'Withdrawn', reason: 'Relocated abroad' },
    );
    expect(withdrawnRes).toEqual({ success: true, status: 'Withdrawn' });
    expect(offerNoteCreate).toHaveBeenCalledWith({
      data: {
        organizationId: ORG,
        applicationId: 'app-w1',
        authorId: 'rec-1',
        content: 'Candidate withdrew: Relocated abroad',
      },
    });
  });
});
