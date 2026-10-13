import { describe, expect, it } from 'vitest';
import {
  RECORD_ACTUAL_JOINING,
  caseFingerprint,
  compliancePlan,
  decideJoining,
  resolveSnapshot,
  snapshotForNewCase,
  type JoiningFacts,
} from '../joining-policy';
import { licenseAssignmentWhere, finalApproverView } from '../hiring.service';
import { assignedInterviewView } from '../../interviews/interviews.service';

const day = '2026-11-01T00:00:00.000Z';

function facts(overrides: Partial<JoiningFacts> = {}): JoiningFacts {
  const snapshot = overrides.snapshot ?? { profile: 'legacy' as const, checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] as const };
  const checks = overrides.checks ?? snapshot.checks.map((type) => ({ type, verified: true, expiryDate: null, documentId: null }));
  return {
    organizationId: 'org',
    actor: { userId: 'recruiter', organizationId: 'org', permissions: [RECORD_ACTUAL_JOINING] },
    enforceActor: true,
    enforceRecord: true,
    actualJoiningDate: new Date(day),
    caseOwnerId: 'recruiter',
    primaryRecruiterId: null,
    vacancyPrimaryRecruiterId: null,
    acceptedOfferVersionId: 'offer-v1',
    hiringCaseStatus: 'Awaiting Joining',
    approvalFingerprint: null,
    approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: null }],
    joinedHeadcount: 0,
    approvedHeadcount: 1,
    ...overrides,
    snapshot: { profile: snapshot.profile, checks: [...snapshot.checks] },
    checks,
  };
}

function allowFingerprint(input: JoiningFacts): string {
  return caseFingerprint({ snapshot: input.snapshot, acceptedOfferVersionId: input.acceptedOfferVersionId, checks: input.checks });
}

describe('joining policy', () => {
  it('reports missing checks before final approval, including when no hiring case exists', () => {
    const decision = decideJoining(facts({
      checks: [],
      hiringCaseStatus: null,
      approvals: [],
      enforceActor: false,
    }));
    expect(decision).toMatchObject({ ok: false, code: 'GATE_JOINING_CHECKS_INCOMPLETE', missing: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] });
  });

  it('requires final hiring approval after the checks, and ignores offer approval', () => {
    const decision = decideJoining(facts({ approvals: [], enforceActor: false, enforceRecord: false }));
    expect(decision).toMatchObject({ ok: false, code: 'FINAL_APPROVAL_REQUIRED', httpStatus: 409 });
  });

  it('does not treat FINAL_HIRING_APPROVAL as permission to record joining, or another recruiter as the owner', () => {
    expect(decideJoining(facts({ actor: { userId: 'approver', organizationId: 'org', permissions: ['FINAL_HIRING_APPROVAL'] } })).code).toBe('JOINING_PERMISSION_REQUIRED');
    const owned = facts();
    owned.approvalFingerprint = allowFingerprint(owned);
    owned.approvals[0]!.decisionFingerprint = owned.approvalFingerprint;
    expect(decideJoining({ ...owned, actor: { userId: 'other', organizationId: 'org', permissions: [RECORD_ACTUAL_JOINING] } })).toMatchObject({ code: 'JOINING_NOT_OWNER', httpStatus: 403 });
    expect(decideJoining({ ...owned, actor: { userId: 'recruiter', organizationId: 'other-org', permissions: [RECORD_ACTUAL_JOINING] } })).toMatchObject({ code: 'WRONG_ORGANIZATION', httpStatus: 404 });
  });

  it('keeps a technical profile to ID and contract, and blocks a clinical hire on a missing or expired licence', () => {
    const technical = decideJoining(facts({
      snapshot: { profile: 'technical', checks: ['ID', 'CONTRACT'] },
      checks: [{ type: 'ID', verified: true }, { type: 'CONTRACT', verified: true }],
      enforceActor: false,
      enforceRecord: false,
      approvals: [],
    }));
    expect(technical).toMatchObject({ code: 'FINAL_APPROVAL_REQUIRED' });
    expect(decideJoining(facts({
      snapshot: { profile: 'clinical', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] },
      checks: [{ type: 'ID', verified: true }, { type: 'CONTRACT', verified: true }, { type: 'SCFHS_LICENCE', verified: true, expiryDate: null }],
      enforceActor: false,
    }))).toMatchObject({ code: 'LICENCE_EXPIRY_REQUIRED' });
    expect(decideJoining(facts({
      snapshot: { profile: 'clinical', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] },
      checks: [{ type: 'ID', verified: true }, { type: 'CONTRACT', verified: true }, { type: 'SCFHS_LICENCE', verified: true, expiryDate: '2026-10-01T00:00:00.000Z' }],
      enforceActor: false,
    }))).toMatchObject({ code: 'LICENCE_EXPIRED' });
  });

  it('keeps a historical snapshot when the job profile changes, and rejects a stale approval', () => {
    expect(resolveSnapshot({ profile: 'legacy', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] }, { requirementProfile: 'technical' }).profile).toBe('legacy');
    expect(snapshotForNewCase(null).profile).toBe('legacy');
    expect(snapshotForNewCase({ joiningProfile: 'technical' }).checks).toEqual(['ID', 'CONTRACT']);
    expect(compliancePlan(snapshotForNewCase(null)).map((item) => item.name)).toEqual(['Identity Document', 'Background Check', 'SCFHS licence']);
    const ready = facts({ enforceActor: false, enforceRecord: false });
    ready.approvalFingerprint = 'old';
    ready.approvals[0]!.decisionFingerprint = 'old';
    expect(decideJoining(ready)).toMatchObject({ code: 'APPROVAL_STALE' });
    const current = allowFingerprint(ready);
    ready.approvalFingerprint = current;
    ready.approvals[0]!.decisionFingerprint = current;
    expect(decideJoining(ready).ok).toBe(true);
    expect(decideJoining({ ...ready, joinedHeadcount: 1 })).toMatchObject({ code: 'CAPACITY_FULL' });
    expect(decideJoining({ ...ready, enforceRecord: true, actualJoiningDate: null })).toMatchObject({ code: 'JOINING_DATE_REQUIRED', httpStatus: 400 });
  });

  it('limits licence and final-approval responses, and an interviewer view, to the assigned slice', () => {
    expect(licenseAssignmentWhere('user-1', 'org-1')).toMatchObject({ organizationId: 'org-1' });
    const journey = finalApproverView({
      id: 'case',
      status: 'Pending Final Approval',
      application: {
        candidate: { firstName: 'Sample', lastName: 'Candidate', currentSalary: 1000, expectedSalary: 2000 } as never,
        vacancy: { position: { title: 'Sample role' }, branch: { name: 'Sample site' } },
      },
      approvals: [{ id: 'a', roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending', comment: null, decidedAt: null, invalidatedAt: null }],
    });
    expect(Object.keys(journey).sort()).toEqual(['approvals', 'branchName', 'candidateName', 'id', 'positionTitle', 'status']);
    expect(JSON.stringify(journey)).not.toMatch(/currentSalary|expectedSalary/);
    const narrow = assignedInterviewView({
      id: 'iv', organizationId: 'org', interviewCode: 'INT', applicationId: 'app', applicationCode: 'APP-1',
      title: 'Panel', interviewType: 'HR', scheduledStart: day, scheduledEnd: day, timezone: 'Asia/Riyadh',
      status: 'Scheduled', attendees: [
        { id: '1', interviewId: 'iv', userId: 'me', userName: 'Me', response: 'Confirmed' },
        { id: '2', interviewId: 'iv', userId: 'other', userName: 'Other', response: 'Confirmed' },
      ],
      scorecards: [
        { id: 's1', interviewId: 'iv', interviewerId: 'me', interviewerName: 'Me', overallRating: 4, recommendation: 'Hire', strengths: '', concerns: '', notes: 'mine', revision: 1, status: 'Submitted' },
        { id: 's2', interviewId: 'iv', interviewerId: 'other', interviewerName: 'Other', overallRating: 2, recommendation: 'No Hire', strengths: '', concerns: '', notes: 'secret', revision: 1, status: 'Submitted' },
      ],
      createdAt: day, updatedAt: day,
    } as never, 'me');
    expect(narrow.applicationCode).toBeUndefined();
    expect(narrow.attendees.map((row) => row.userId)).toEqual(['me']);
    expect(narrow.scorecards.map((row) => row.notes)).toEqual(['mine']);
  });
});
