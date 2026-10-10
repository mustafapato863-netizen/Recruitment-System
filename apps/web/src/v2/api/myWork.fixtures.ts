/**
 * Dev-only fixtures in the #9 @829983a shape (NOW 19 Oct 2026 09:00 Cairo, Mariam).
 * Mirrors #9's buckets: actions[], interview room/interviewers, candidate+stage, target dept/site/owner. No pay fields.
 */
import type { MyWorkDay, MyWorkResponse, MyWorkTarget } from './myWork';

export type FixtureVariant = 'mariam' | 'empty' | 'targets-only' | 'multi-target' | 'stale-worker';

export function myWorkFixture(opts: { variant?: FixtureVariant; day?: MyWorkDay } = {}): MyWorkResponse {
  const variant = opts.variant ?? 'mariam';
  const day = opts.day ?? 'today';
  const hris: MyWorkTarget = { title: 'HRIS Developer', filled: 1, target: 3, label: '1 of 3', dueDate: '2026-10-25', vacancyId: 'j1', vacancyCode: 'VAC-1',
    department: 'Information Technology', site: 'Cairo HQ', owner: { id: 'u-mariam', name: 'Mariam Adel' } };
  const base = { timezone: 'Africa/Cairo', today: '2026-10-19', day, date: day === 'tomorrow' ? '2026-10-20' : '2026-10-19', generatedAt: '2026-10-19T06:00:00.000Z', reminderWorkerHealthy: variant !== 'stale-worker' };
  const none = { counts: { overdue: 0, today: 0, waitingOnOthers: 0 }, overdue: [], dueToday: [], waitingOnOthers: [] };
  if (variant === 'empty') return { ...base, ...none, targets: [], empty: true, emptyMessage: 'No open work assigned to you.' };
  if (variant === 'targets-only') return { ...base, ...none, targets: [hris], empty: true, emptyMessage: 'No open work assigned to you.' };
  const targets = variant === 'multi-target'
    ? [hris, { title: 'Data Analyst', filled: 0, target: 2, label: '0 of 2', dueDate: null, vacancyId: 'j2', vacancyCode: 'VAC-2', department: 'Finance', site: 'Giza', owner: { id: 'u-mariam', name: 'Mariam Adel' } }]
    : [hris];
  const overdue: MyWorkResponse['overdue'] = [{
    id: 'i1', type: 'scorecard', title: 'Interview: Ahmed Embaby', dueAt: '2026-10-18T10:00:00.000Z', reason: 'Your scorecard is missing',
    nextAction: { code: 'submit-scorecard', label: 'Submit scorecard' }, entity: { type: 'interview', id: 'i1' },
    actions: [{ key: 'submit-scorecard', label: 'Submit scorecard', disabled: false }],
    applicationId: 'a1', candidate: { id: 'c1', name: 'Ahmed Embaby' }, stage: 'Interview',
  }];
  const waitingOnOthers: MyWorkResponse['waitingOnOthers'] = [
    { id: 'o1', type: 'offer', title: 'Offer OFF-1', dueAt: null, reason: 'Offer waiting for approval', nextAction: { code: 'open-offer', label: 'Open offer' },
      entity: { type: 'offer', id: 'o1' }, waitingOn: 'approver', approver: { id: 'u-karim', name: 'Karim Hassan' }, applicationId: 'a3', candidate: { id: 'c3', name: 'Salma Farouk' }, stage: 'Offer',
      actions: [{ key: 'open-offer', label: 'Open offer', disabled: false }, { key: 'send-offer', label: 'Send offer', disabled: true, reason: 'Waiting for approval' }] },
    { id: 'iv-done', type: 'scorecard', title: 'Interview: Omar Said', dueAt: '2026-10-18T12:00:00.000Z', reason: '2 scorecard(s) missing',
      nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'interview', id: 'iv-done' }, waitingOn: 'interviewer',
      applicationId: 'a4', candidate: { id: 'c4', name: 'Omar Said' }, stage: 'Interview',
      actions: [{ key: 'open-interview', label: 'Open interview', disabled: false }, { key: 'move-to-offer', label: 'Move to Offer', disabled: true, reason: 'Gate not met: scorecard not submitted' }] },
  ];
  const dueToday: MyWorkResponse['dueToday'] = day === 'tomorrow'
    ? [
        { id: 'iv5', type: 'interview', title: 'Technical interview: Nourhan Sami', dueAt: '2026-10-20T07:00:00.000Z', reason: 'Interview tomorrow',
          nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'interview', id: 'iv5' },
          startAt: '2026-10-20T07:00:00.000Z', endAt: '2026-10-20T08:00:00.000Z', room: { name: 'Room 4B', url: 'https://rooms.sgh.test/4b' },
          interviewer: { id: 'u-hana', name: 'Dr. Hana Saleh' }, interviewers: [{ id: 'u-hana', name: 'Dr. Hana Saleh' }, { id: 'u-kareem', name: 'Kareem Fathy' }],
          applicationId: 'a2', candidate: { id: 'c2', name: 'Nourhan Sami' }, stage: 'Interview',
          actions: [{ key: 'open-interview', label: 'Open interview', disabled: false }, { key: 'submit-scorecard', label: 'Submit scorecard', disabled: true, reason: 'Interview has not ended' }] },
        { id: 'iv6', type: 'interview', title: 'Panel interview: Youssef Hamdy', dueAt: '2026-10-20T10:30:00.000Z', reason: 'Interview tomorrow',
          nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'interview', id: 'iv6' },
          startAt: '2026-10-20T10:30:00.000Z', endAt: '2026-10-20T11:15:00.000Z', room: { name: null, url: null },
          interviewer: null, interviewers: [{ id: 'u-hana', name: 'Dr. Hana Saleh' }],
          applicationId: 'a6', candidate: { id: 'c6', name: 'Youssef Hamdy' }, stage: 'Interview',
          actions: [{ key: 'open-interview', label: 'Open interview', disabled: false }, { key: 'submit-scorecard', label: 'Submit scorecard', disabled: true, reason: 'You are not an interviewer on this interview' }] },
      ]
    : [
        { id: 'j1', type: 'job', title: 'HRIS Developer (VAC-1)', dueAt: '2026-10-19', reason: '1 of 3 seats filled',
          nextAction: { code: 'review-applicants', label: 'Review applicants' }, entity: { type: 'job', id: 'j1' },
          actions: [{ key: 'review-applicants', label: 'Review applicants', disabled: false }, { key: 'hold-job', label: 'Put on hold', disabled: false }] },
        { id: 'iv2', type: 'interview', title: 'Screening: Nourhan Sami', dueAt: '2026-10-19T08:30:00.000Z', reason: 'Interview today',
          nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'interview', id: 'iv2' },
          startAt: '2026-10-19T08:30:00.000Z', endAt: '2026-10-19T09:00:00.000Z', room: { name: 'Room 2A', url: 'https://rooms.sgh.test/2a' },
          interviewer: { id: 'u-mariam', name: 'Mariam Adel' }, interviewers: [{ id: 'u-mariam', name: 'Mariam Adel' }],
          applicationId: 'a2', candidate: { id: 'c2', name: 'Nourhan Sami' }, stage: 'Screening',
          actions: [{ key: 'open-interview', label: 'Open interview', disabled: false }, { key: 'submit-scorecard', label: 'Submit scorecard', disabled: true, reason: 'Interview has not ended' }] },
      ];
  return { ...base, counts: { overdue: overdue.length, today: dueToday.length, waitingOnOthers: waitingOnOthers.length }, overdue, dueToday, waitingOnOthers, targets, empty: false, emptyMessage: null };
}
