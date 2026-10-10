/**
 * Dev-only fixtures in the #9 shape. The `mariam` case reproduces #9's own
 * frozen-clock spec (my-work.spec.ts "v2 worked example": NOW 19 Oct 2026 09:00 Cairo),
 * plus a today-interview and a sent offer so every bucket kind shows. No pay fields.
 */
import type { MyWorkResponse } from './myWork';

export function myWorkFixture(opts: { variant?: 'mariam' | 'empty' | 'targets-only' | 'multi-target' } = {}): MyWorkResponse {
  const variant = opts.variant ?? 'mariam';
  const hris = { title: 'HRIS Developer', filled: 1, target: 3, label: '1 of 3', dueDate: '2026-10-19', vacancyId: 'j1', vacancyCode: 'VAC-1' };
  const base = { timezone: 'Africa/Cairo', today: '2026-10-19', generatedAt: '2026-10-19T06:00:00.000Z' };
  if (variant === 'empty') {
    return { ...base, counts: { overdue: 0, today: 0, waitingOnOthers: 0 }, overdue: [], dueToday: [], waitingOnOthers: [], targets: [], empty: true, emptyMessage: 'No open work assigned to you.' };
  }
  if (variant === 'targets-only') {
    return { ...base, counts: { overdue: 0, today: 0, waitingOnOthers: 0 }, overdue: [], dueToday: [], waitingOnOthers: [], targets: [hris], empty: false, emptyMessage: null };
  }
  const targets = variant === 'multi-target'
    ? [hris, { title: 'Data Analyst', filled: 0, target: 2, label: '0 of 2', dueDate: null, vacancyId: 'j2', vacancyCode: 'VAC-2' }]
    : [hris];
  return {
    ...base,
    counts: { overdue: 1, today: 2, waitingOnOthers: 2 },
    overdue: [{
      id: 'i1', type: 'scorecard', title: 'Interview: Ahmed Embaby', dueAt: '2026-10-18T10:00:00.000Z',
      reason: 'Your scorecard is missing', nextAction: { code: 'submit-scorecard', label: 'Submit scorecard' }, entity: { type: 'Interview', id: 'i1' },
    }],
    dueToday: [
      { id: 'j1', type: 'job', title: 'HRIS Developer (VAC-1)', dueAt: '2026-10-19', reason: '1 of 3 seats filled',
        nextAction: { code: 'review-applicants', label: 'Review applicants' }, entity: { type: 'Vacancy', id: 'j1' } },
      { id: 'iv2', type: 'interview', title: 'Screening: Nourhan Sami', dueAt: '2026-10-19T08:30:00.000Z', reason: 'Interview today',
        nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'Application', id: 'a2' } },
    ],
    waitingOnOthers: [
      { id: 'o1', type: 'offer', title: 'Offer OFF-1', dueAt: null, reason: 'Offer waiting for approval',
        nextAction: { code: 'open-offer', label: 'Open offer' }, entity: { type: 'Application', id: 'a3' }, waitingOn: 'approver' },
      { id: 'iv-done', type: 'scorecard', title: 'Interview: Omar Said', dueAt: '2026-10-18T12:00:00.000Z', reason: '2 scorecard(s) missing',
        nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'Interview', id: 'iv-done' }, waitingOn: 'interviewer' },
    ],
    targets, empty: false, emptyMessage: null,
  };
}
