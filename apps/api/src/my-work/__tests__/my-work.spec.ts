import { describe, expect, it } from 'vitest';
import { buildTargetChip } from '@recruitflow/contracts';
import { caseFingerprint, type JoiningCheckFact, type RequirementSnapshot } from '../../hiring/joining-policy';
import { buildMyWork, cairoDate, type MyWorkInput, type MyWorkJoiningDecisionFacts, type MyWorkJoiningInput } from '../my-work.buckets';

// Frozen clock: 19 Oct 2026, 09:00 Cairo (UTC+3) = 06:00Z.
const NOW = new Date('2026-10-19T06:00:00Z');
const empty: MyWorkInput = { jobs: [], requisitions: [], tasks: [], interviews: [], myMissingScorecards: [], othersMissingScorecards: [], offers: [] };

function decisionFacts(overrides: Partial<MyWorkJoiningDecisionFacts> & { staleFingerprint?: string } = {}): MyWorkJoiningDecisionFacts {
  const snapshot: RequirementSnapshot = overrides.snapshot ?? { profile: 'technical', checks: ['ID', 'CONTRACT'] };
  const checks: JoiningCheckFact[] = overrides.checks ?? snapshot.checks.map((type) => ({ type, verified: true, expiryDate: null, documentId: `${type}-doc` }));
  const acceptedOfferVersionId = overrides.acceptedOfferVersionId === undefined ? 'offer-v1' : overrides.acceptedOfferVersionId;
  const fingerprint = overrides.staleFingerprint ?? caseFingerprint({ snapshot, acceptedOfferVersionId, checks });
  return {
    organizationId: overrides.organizationId ?? 'org',
    snapshot,
    acceptedOfferVersionId,
    hiringCaseStatus: overrides.hiringCaseStatus === undefined ? 'Awaiting Joining' : overrides.hiringCaseStatus,
    approvalFingerprint: fingerprint,
    approvals: overrides.approvals ?? [{ status: 'Approved', invalidatedAt: null, roleCode: 'FINAL_HIRING_APPROVER', decisionFingerprint: fingerprint }],
    checks,
    joinedHeadcount: overrides.joinedHeadcount ?? 0,
    approvedHeadcount: overrides.approvedHeadcount ?? 2,
  };
}

describe('B4 target chip', () => {
  it('is "filled of target" from the requisition', () => {
    expect(buildTargetChip({ title: 'HRIS Developer', filled: 1, target: 3, dueDate: '2026-10-19' })).toEqual({ title: 'HRIS Developer', filled: 1, target: 3, label: '1 of 3', dueDate: '2026-10-19' });
    expect(buildTargetChip({ title: 'x', filled: 0, target: 0, dueDate: null }).label).toBe('0 of 0');
    expect(buildTargetChip({ title: 'x', filled: -2, target: 2.7, dueDate: null }).label).toBe('0 of 2');
    expect(buildTargetChip({ title: 'x', filled: 4, target: 3, dueDate: null }).label).toBe('4 of 3');
  });
});

describe('B4 My Work buckets (frozen clock, Africa/Cairo)', () => {
  it('uses the Cairo calendar day, not UTC', () => {
    expect(cairoDate(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19');
    expect(buildMyWork(empty, new Date('2026-10-18T22:30:00Z')).today).toBe('2026-10-19');
  });

  it('v2 worked example: Mariam, HRIS Developer 1 of 3 due 19 Oct', () => {
    const work = buildMyWork({
      ...empty,
      jobs: [{ id: 'j1', code: 'VAC-1', title: 'HRIS Developer', status: 'Open', joined: 1, target: 3, dueDate: '2026-10-19' }],
      myMissingScorecards: [{ interviewId: 'i1', title: 'Interview: Ahmed Embaby', end: new Date('2026-10-18T10:00:00Z') }],
      offers: [{ id: 'o1', code: 'OFF-1', status: 'Pending Approval', applicationId: 'a3', updatedAt: NOW }],
    }, NOW);
    expect(work.targets).toEqual([expect.objectContaining({ title: 'HRIS Developer', label: '1 of 3', dueDate: '2026-10-19', vacancyId: 'j1' })]);
    expect(work.dueToday.map((i) => i.id)).toEqual(['j1']);
    expect(work.overdue).toEqual([expect.objectContaining({ id: 'i1', type: 'scorecard', nextAction: { code: 'submit-scorecard', label: 'Submit scorecard' } })]);
    expect(work.waitingOnOthers).toEqual([expect.objectContaining({ id: 'o1', waitingOn: 'approver' })]);
    expect(work.counts).toEqual({ overdue: 1, today: 1, waitingOnOthers: 1 });
    expect(work.empty).toBe(false);
  });

  it('places tasks, jobs and requisitions by due day', () => {
    const work = buildMyWork({
      ...empty,
      tasks: [
        { id: 't-over', title: 'old', dueAt: new Date('2026-10-18T20:59:00Z'), entityType: null, entityId: null }, // 18 Oct 23:59 Cairo
        { id: 't-today', title: 'now', dueAt: new Date('2026-10-18T21:00:00Z'), entityType: null, entityId: null }, // 19 Oct 00:00 Cairo
        { id: 't-later', title: 'later', dueAt: new Date('2026-10-20T08:00:00Z'), entityType: null, entityId: null },
      ],
      jobs: [
        { id: 'j-over', code: 'V2', title: 'A', status: 'Partially Filled', joined: 1, target: 2, dueDate: '2026-10-10' },
        { id: 'j-held', code: 'V3', title: 'B', status: 'On Hold', joined: 0, target: 1, dueDate: '2026-10-10' },
        { id: 'j-filled', code: 'V4', title: 'C', status: 'Filled', joined: 1, target: 1, dueDate: '2026-10-10' },
        { id: 'j-closed', code: 'V5', title: 'D', status: 'Closed', joined: 0, target: 1, dueDate: '2026-10-10' },
      ],
      requisitions: [
        { id: 'r-draft-nodate', code: 'R1', title: 'R', status: 'Draft', dueDate: null },
        { id: 'r-approved-over', code: 'R2', title: 'R', status: 'Approved', dueDate: '2026-10-01' },
        { id: 'r-pending', code: 'R3', title: 'R', status: 'Pending Approval', dueDate: '2026-10-01' },
        { id: 'r-cancelled', code: 'R4', title: 'R', status: 'Cancelled', dueDate: '2026-10-01' },
      ],
    }, NOW);
    expect(work.overdue.map((i) => i.id).sort()).toEqual(['j-over', 'r-approved-over', 't-over']);
    expect(work.overdue.find((i) => i.id === 'r-approved-over')!.nextAction.code).toBe('activate-requisition');
    expect(work.dueToday.map((i) => i.id).sort()).toEqual(['r-draft-nodate', 't-today']);
    expect(work.waitingOnOthers.map((i) => [i.id, i.waitingOn])).toEqual([['r-pending', 'approver']]);
    expect(work.targets.map((t) => t.vacancyId)).toEqual(['j-over']);
  });

  it('interviews today, missing scorecards from others, offers sent', () => {
    const work = buildMyWork({
      ...empty,
      interviews: [
        { id: 'iv-today', title: 'Today', start: new Date('2026-10-19T11:00:00Z'), end: new Date('2026-10-19T12:00:00Z'), applicationId: 'a1' },
        { id: 'iv-tomorrow', title: 'Tomorrow', start: new Date('2026-10-20T11:00:00Z'), end: new Date('2026-10-20T12:00:00Z'), applicationId: 'a1' },
      ],
      myMissingScorecards: [{ interviewId: 'iv-future', title: 'not ended', end: new Date('2026-10-19T12:00:00Z') }],
      othersMissingScorecards: [
        { interviewId: 'iv-done', title: 'Ended', end: new Date('2026-10-18T12:00:00Z'), missing: 2 },
        { interviewId: 'iv-complete', title: 'All in', end: new Date('2026-10-18T12:00:00Z'), missing: 0 },
      ],
      offers: [{ id: 'o-sent', code: 'O', status: 'Sent', applicationId: 'a', updatedAt: NOW }, { id: 'o-acc', code: 'O2', status: 'Accepted', applicationId: 'a', updatedAt: NOW }],
    }, NOW);
    expect(work.dueToday.map((i) => i.id)).toEqual(['iv-today']);
    expect(work.overdue).toEqual([]);
    expect(work.waitingOnOthers.map((i) => [i.id, i.waitingOn])).toEqual([['iv-done', 'interviewer'], ['o-sent', 'candidate']]);
  });

  it('keeps a held job off targets and keeps an awaiting-joining case on today', () => {
    const work = buildMyWork({
      ...empty,
      jobs: [{ id: 'j-held', code: 'V3', title: 'Held role', status: 'On Hold', joined: 1, target: 2, dueDate: '2026-10-10' }],
      joining: [{
        id: 'hc1', applicationId: 'a-join', title: 'Sample Candidate — awaiting joining (Held role)',
        app: { applicationId: 'a-join', candidate: { id: 'c1', name: 'Sample Candidate' }, stage: 'Offer' },
      }],
    }, NOW);
    expect(work.targets).toEqual([]);
    expect(work.overdue.map((i) => i.id)).not.toContain('j-held');
    expect(work.dueToday).toEqual([expect.objectContaining({
      id: 'a-join', type: 'task', reason: 'Awaiting joining',
      entity: { type: 'application', id: 'a-join' },
      nextAction: { code: 'record-joining', label: 'Record joining' },
    })]);
  });

  it('empty state', () => {
    const work = buildMyWork(empty, NOW);
    expect(work).toMatchObject({ empty: true, emptyMessage: 'No open work assigned to you.', counts: { overdue: 0, today: 0, waitingOnOthers: 0 }, upcomingInterviews: [], joiningSoon: [] });
  });

  it('upcoming interviews stay caller-scoped across today and tomorrow', () => {
    const people = [{ id: 'u-k', name: 'Karim Hassan' }];
    const input: MyWorkInput = {
      ...empty,
      interviews: [
        { id: 'old', title: 'Old', start: new Date('2026-10-18T08:00:00Z'), end: new Date('2026-10-18T09:00:00Z'), applicationId: 'a-old', ownsFile: true, iAmInterviewer: true, jobTitle: 'HRIS Developer', app: { applicationId: 'a-old', candidate: { id: 'c-old', name: 'Ahmed Embaby' }, stage: 'Interview' }, interviewers: people },
        { id: 'today', title: 'Today', start: new Date('2026-10-19T07:00:00Z'), end: new Date('2026-10-19T08:00:00Z'), applicationId: 'a-today', ownsFile: true, jobTitle: 'HRIS Developer', roomName: 'Room SG-4', roomUrl: null, app: { applicationId: 'a-today', candidate: { id: 'c-n', name: 'Nourhan Sami' }, stage: 'Interview' }, interviewers: people },
        { id: 'tmr', title: 'Tomorrow', start: new Date('2026-10-20T07:00:00Z'), end: new Date('2026-10-20T08:00:00Z'), applicationId: 'a-tmr', ownsFile: true, jobHeld: true, jobTitle: 'Held role', app: { applicationId: 'a-tmr', candidate: { id: 'c-h', name: 'Held Candidate' }, stage: 'Interview' } },
        { id: 'assigned', title: 'Assigned', start: new Date('2026-10-21T06:00:00Z'), end: new Date('2026-10-21T07:00:00Z'), applicationId: 'a-secret', ownsFile: false, iAmInterviewer: true, jobTitle: 'BI Data Analyst', app: { applicationId: 'a-secret', candidate: { id: 'c-r', name: 'Rana Adel' }, stage: 'Interview' } },
        { id: 'stranger', title: 'No relationship', start: new Date('2026-10-19T09:00:00Z'), end: new Date('2026-10-19T10:00:00Z'), applicationId: 'a-x', ownsFile: false, iAmInterviewer: false },
      ],
      myMissingScorecards: [{ interviewId: 'old', title: 'Old', end: new Date('2026-10-18T09:00:00Z') }],
    };
    const today = buildMyWork(input, NOW, 'today');
    const tomorrow = buildMyWork(input, NOW, 'tomorrow');
    expect(today.upcomingInterviews?.map((row) => row.id)).toEqual(['old', 'today', 'tmr', 'assigned']);
    expect(tomorrow.upcomingInterviews?.map((row) => row.id)).toEqual(['old', 'today', 'tmr', 'assigned']);
    expect(today.dueToday.map((row) => row.id)).toEqual(['today']);
    expect(tomorrow.dueToday.map((row) => row.id)).toEqual(['tmr']);
    const fileRow = today.upcomingInterviews?.find((row) => row.id === 'today');
    expect(fileRow).toMatchObject({ access: 'file', applicationId: 'a-today', status: 'scheduled', action: { key: 'open-interview', label: 'Manage interview' }, room: { name: 'Room SG-4', url: null }, held: false });
    expect(today.upcomingInterviews?.find((row) => row.id === 'tmr')).toMatchObject({ access: 'file', held: true, applicationId: 'a-tmr' });
    expect(today.upcomingInterviews?.find((row) => row.id === 'old')).toMatchObject({ status: 'scorecard_overdue', action: { key: 'submit-scorecard', label: 'Submit scorecard' } });
    const assigned = today.upcomingInterviews?.find((row) => row.id === 'assigned');
    expect(assigned).toMatchObject({ access: 'evaluation', status: 'assigned', action: { label: 'Open evaluation' } });
    expect(assigned && 'applicationId' in assigned).toBe(false);
    expect(JSON.stringify(assigned)).not.toContain('a-secret');
  });

  it('joining soon is not a hire and does not change filled seats', () => {
    const work = buildMyWork({
      ...empty,
      jobs: [{ id: 'j1', code: 'VAC-1', title: 'HRIS Developer', status: 'Open', joined: 1, target: 3, dueDate: '2026-10-19' }],
      joining: [{ id: 'hc-held', applicationId: 'a-held', title: 'Held Candidate — awaiting joining (Held role)' }],
      joiningSoon: [
        { id: 'hc-approval', applicationId: 'a1', candidateName: 'Lina Hassan', jobTitle: 'HRIS Developer', intendedDate: new Date('2026-11-01T09:00:00Z'), checksComplete: 2, checksRequired: 2, licenceRequired: false, licenceVerified: false, approvalPending: true, postponed: false, held: false, decisionFacts: null },
        { id: 'hc-licence', applicationId: 'a2', candidateName: 'Mona Said', jobTitle: 'Staff Nurse', intendedDate: new Date('2026-11-04T09:00:00Z'), checksComplete: 2, checksRequired: 3, licenceRequired: true, licenceVerified: false, approvalPending: false, postponed: false, held: true, decisionFacts: null },
        { id: 'hc-ready', applicationId: 'a3', candidateName: 'Nour Adel', jobTitle: 'HRIS Developer', intendedDate: new Date('2026-11-02T09:00:00Z'), checksComplete: 2, checksRequired: 2, licenceRequired: false, licenceVerified: false, approvalPending: false, postponed: false, held: false, decisionFacts: decisionFacts() },
        { id: 'hc-later', applicationId: 'a4', candidateName: 'Omar Late', jobTitle: 'Analyst', intendedDate: null, checksComplete: 0, checksRequired: 2, licenceRequired: false, licenceVerified: false, approvalPending: false, postponed: true, held: false, decisionFacts: decisionFacts() },
      ],
    }, NOW);
    expect(work.targets[0]).toMatchObject({ filled: 1, target: 3, label: '1 of 3' });
    expect(work.counts).toEqual({ overdue: 0, today: 2, waitingOnOthers: 0 });
    expect(work.dueToday.map((row) => row.id).sort()).toEqual(['a-held', 'j1']);
    expect(work.joiningSoon?.map((row) => [row.id, row.readiness, row.joined])).toEqual([
      ['hc-approval', 'approval_pending', false],
      ['hc-ready', 'ready', false],
      ['hc-licence', 'licence_pending', false],
      ['hc-later', 'postponed', false],
    ]);
    expect(work.joiningSoon?.find((row) => row.id === 'hc-licence')).toMatchObject({ detail: 'Licence review assigned', checksComplete: 2, checksRequired: 3, held: true });
    expect(work.joiningSoon?.find((row) => row.id === 'hc-approval')?.detail).toBe('Final approval pending');
    expect(work.joiningSoon?.find((row) => row.id === 'hc-ready')).toMatchObject({ readiness: 'ready', detail: 'Ready to record joining', joined: false });
    expect(work.joiningSoon?.every((row) => row.joined === false)).toBe(true);
    const withoutJoinedFlag = JSON.stringify(work.joiningSoon?.map(({ joined, ...row }) => row));
    expect(withoutJoinedFlag).not.toMatch(/Joined|salary|document/i);
  });

  it('ready joining passes decideJoining; expiry, capacity, a stale approval, and missing facts do not', () => {
    const clinical: RequirementSnapshot = { profile: 'clinical', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] };
    const expiredChecks: JoiningCheckFact[] = [
      { type: 'ID', verified: true, documentId: 'id-1' },
      { type: 'CONTRACT', verified: true, documentId: 'contract-1' },
      { type: 'SCFHS_LICENCE', verified: true, expiryDate: '2026-10-20T00:00:00.000Z', documentId: 'licence-1' },
    ];
    const row = (id: string, name: string, extra: Partial<MyWorkJoiningInput>): MyWorkJoiningInput => ({
      id, applicationId: id, candidateName: name, jobTitle: 'Staff Nurse', intendedDate: new Date('2026-11-02T09:00:00Z'),
      checksComplete: 3, checksRequired: 3, licenceRequired: true, licenceVerified: true, approvalPending: false, postponed: false, held: false,
      decisionFacts: decisionFacts({ snapshot: clinical, checks: expiredChecks }),
      ...extra,
    });
    const work = buildMyWork({
      ...empty,
      jobs: [{ id: 'j1', code: 'VAC-1', title: 'Staff Nurse', status: 'Open', joined: 1, target: 1, dueDate: '2026-10-19' }],
      joiningSoon: [
        row('hc-expired', 'Expired Licence', {}),
        row('hc-full', 'Full Ward', { decisionFacts: decisionFacts({ joinedHeadcount: 2, approvedHeadcount: 2 }), licenceRequired: false, checksComplete: 2, checksRequired: 2 }),
        row('hc-stale', 'Stale Approval', { decisionFacts: decisionFacts({ staleFingerprint: 'old-fingerprint' }), licenceRequired: false, checksComplete: 2, checksRequired: 2 }),
        row('hc-ready', 'Ready Nurse', { decisionFacts: decisionFacts(), licenceRequired: false, checksComplete: 2, checksRequired: 2, jobTitle: 'HRIS Developer' }),
        row('hc-review', 'Missing Facts', { decisionFacts: null, licenceRequired: false, checksComplete: 2, checksRequired: 2 }),
        row('hc-before-clock', 'Before Clock', { intendedDate: null, decisionFacts: decisionFacts({ snapshot: clinical, checks: expiredChecks.map((check) => check.type === 'SCFHS_LICENCE' ? { ...check, expiryDate: '2026-10-18T00:00:00.000Z' } : check) }) }),
        row('hc-on-clock', 'On Clock', { intendedDate: null, decisionFacts: decisionFacts({ snapshot: clinical, checks: expiredChecks.map((check) => check.type === 'SCFHS_LICENCE' ? { ...check, expiryDate: `${NOW.toISOString().slice(0, 10)}T00:00:00.000Z` } : check) }) }),
        row('hc-postponed', 'Postponed Start', { postponed: true, decisionFacts: decisionFacts() }),
        row('hc-pending-licence', 'Pending Licence', { licenceVerified: false, checksComplete: 2, decisionFacts: decisionFacts({ snapshot: clinical, checks: expiredChecks }) }),
      ],
    }, NOW);
    const by = (id: string) => work.joiningSoon?.find((item) => item.id === id);
    expect(by('hc-expired')).toMatchObject({ readiness: 'blocked', detail: 'The required SCFHS licence expires before the actual joining date.', checksComplete: 3, checksRequired: 3, joined: false });
    expect(by('hc-full')).toMatchObject({ readiness: 'blocked', detail: 'Approved capacity is already filled.', joined: false });
    expect(by('hc-stale')).toMatchObject({ readiness: 'blocked', detail: 'The final hiring approval does not match the current offer and checks. Review the case again.', joined: false });
    expect(by('hc-ready')).toMatchObject({ readiness: 'ready', detail: 'Ready to record joining', joined: false });
    expect(by('hc-review')).toMatchObject({ readiness: 'review', detail: 'Review readiness', joined: false });
    expect(by('hc-before-clock')).toMatchObject({ readiness: 'blocked', detail: 'The required SCFHS licence expires before the actual joining date.', intendedDate: null, joined: false });
    expect(by('hc-on-clock')).toMatchObject({ readiness: 'ready', detail: 'Ready to record joining', intendedDate: null, joined: false });
    expect(by('hc-postponed')).toMatchObject({ readiness: 'postponed', detail: 'Start postponed' });
    expect(by('hc-pending-licence')).toMatchObject({ readiness: 'licence_pending', detail: 'Licence review assigned', checksComplete: 2, checksRequired: 3 });
    expect(work.targets[0]).toMatchObject({ filled: 1, target: 1, label: '1 of 1' });
    expect(work.joiningSoon?.every((item) => item.joined === false)).toBe(true);
    expect(JSON.stringify(work.joiningSoon)).not.toMatch(/salary|monthlyPackage|annualFixed|documentId/i);
  });

  it('upcoming uses end and status inside the next 30 days and keeps overdue evaluations', () => {
    const file = (id: string, start: string, end: string, extra: Partial<MyWorkInput['interviews'][number]> = {}) => ({
      id, title: id, start: new Date(start), end: new Date(end), applicationId: `app-${id}`, ownsFile: true, jobTitle: 'HRIS Developer', status: 'Scheduled',
      app: { applicationId: `app-${id}`, candidate: { id: 'c', name: id }, stage: 'Interview' },
      ...extra,
    });
    const work = buildMyWork({
      ...empty,
      interviews: [
        file('done-today', '2026-10-19T02:00:00Z', '2026-10-19T03:00:00Z', { status: 'Completed' }),
        file('ended-open', '2026-10-19T02:00:00Z', '2026-10-19T03:00:00Z'),
        file('noshow', '2026-10-19T08:00:00Z', '2026-10-19T09:00:00Z', { status: 'No-show' }),
        file('noshow-card', '2026-10-18T08:00:00Z', '2026-10-18T09:00:00Z', { status: 'No-show' }),
        file('overdue-today', '2026-10-19T01:00:00Z', '2026-10-19T02:00:00Z', { status: 'Completed' }),
        file('later', '2026-10-19T08:00:00Z', '2026-10-19T09:00:00Z'),
        file('day30', '2026-11-18T08:00:00Z', '2026-11-18T09:00:00Z'),
        file('day31', '2026-11-19T08:00:00Z', '2026-11-19T09:00:00Z'),
        file('assigned-only', '2026-10-25T08:00:00Z', '2026-10-25T09:00:00Z', { ownsFile: false, iAmInterviewer: true, applicationId: 'secret-file' }),
      ],
      myMissingScorecards: [
        { interviewId: 'overdue-today', title: 'overdue-today', end: new Date('2026-10-19T02:00:00Z') },
        { interviewId: 'noshow-card', title: 'noshow-card', end: new Date('2026-10-18T09:00:00Z') },
      ],
    }, NOW);
    expect(work.upcomingInterviews?.map((row) => row.id)).toEqual(['overdue-today', 'later', 'assigned-only', 'day30']);
    expect(work.upcomingInterviews?.find((row) => row.id === 'overdue-today')).toMatchObject({ status: 'scorecard_overdue' });
    expect(work.upcomingInterviews?.find((row) => row.id === 'later')).toMatchObject({ status: 'scheduled' });
    expect(work.upcomingInterviews?.find((row) => row.id === 'day30')).toMatchObject({ status: 'scheduled' });
    expect(work.upcomingInterviews?.some((row) => row.id === 'done-today' || row.id === 'ended-open' || row.id === 'noshow' || row.id === 'noshow-card' || row.id === 'day31')).toBe(false);
    const assigned = work.upcomingInterviews?.find((row) => row.id === 'assigned-only');
    expect(assigned && 'applicationId' in assigned).toBe(false);
    expect(JSON.stringify(assigned)).not.toContain('secret-file');
    const todayIds = work.dueToday.map((row) => row.id);
    expect(todayIds).toEqual(expect.arrayContaining(['done-today', 'ended-open', 'later', 'noshow', 'overdue-today']));
    expect(todayIds).not.toContain('day30');
    expect(todayIds).not.toContain('day31');
    expect(todayIds).not.toContain('assigned-only');
    expect(todayIds).not.toContain('noshow-card');
    const tomorrow = buildMyWork({ ...empty, interviews: [file('tmr', '2026-10-20T07:00:00Z', '2026-10-20T08:00:00Z')] }, NOW, 'tomorrow');
    expect(tomorrow.dueToday.map((row) => row.id)).toEqual(['tmr']);
    expect(tomorrow.upcomingInterviews?.map((row) => row.id)).toEqual(['tmr']);
  });
});
