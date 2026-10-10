import { describe, expect, it } from 'vitest';
import { buildTargetChip } from '@recruitflow/contracts';
import { buildMyWork, cairoDate, type MyWorkInput } from '../my-work.buckets';

// Frozen clock: 19 Oct 2026, 09:00 Cairo (UTC+3) = 06:00Z.
const NOW = new Date('2026-10-19T06:00:00Z');
const empty: MyWorkInput = { jobs: [], requisitions: [], tasks: [], interviews: [], myMissingScorecards: [], othersMissingScorecards: [], offers: [] };

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

  it('empty state', () => {
    const work = buildMyWork(empty, NOW);
    expect(work).toMatchObject({ empty: true, emptyMessage: 'No open work assigned to you.', counts: { overdue: 0, today: 0, waitingOnOthers: 0 } });
  });
});
