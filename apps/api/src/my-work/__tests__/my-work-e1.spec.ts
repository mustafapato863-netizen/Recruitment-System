import { describe, expect, it } from 'vitest';
import { myWorkEntityTypes } from '@recruitflow/contracts';
import { buildMyWork, toEntityType, type MyWorkInput } from '../my-work.buckets';
import { reminderWorkerHealthy } from '../my-work.service';

// 19 Oct 2026, 09:00 Cairo.
const NOW = new Date('2026-10-19T06:00:00Z');
const base: MyWorkInput = { jobs: [], requisitions: [], tasks: [], interviews: [], myMissingScorecards: [], othersMissingScorecards: [], offers: [] };
const app = { applicationId: 'a1', candidate: { id: 'c1', name: 'Ahmed Embaby' }, stage: 'Interview' };
const iv = (id: string, startZ: string, extra: Partial<MyWorkInput['interviews'][number]> = {}) => ({
  id, title: `Interview ${id}`, start: new Date(startZ), end: new Date(new Date(startZ).getTime() + 3_600_000), applicationId: 'a1', ...extra,
});

describe('E1 additions to GET /me/work', () => {
  it('1) day=tomorrow lists tomorrow\'s interviews (with times) and items due tomorrow, in Cairo days', () => {
    const input: MyWorkInput = {
      ...base,
      interviews: [iv('today', '2026-10-19T08:00:00Z'), iv('tmr', '2026-10-20T07:30:00Z'), iv('late-night', '2026-10-20T21:30:00Z')],
      tasks: [{ id: 't-tmr', title: 'Call back', dueAt: new Date('2026-10-20T09:00:00Z'), entityType: 'Application', entityId: 'a1' },
        { id: 't-old', title: 'Old', dueAt: new Date('2026-10-17T09:00:00Z'), entityType: null, entityId: null }],
      requisitions: [{ id: 'r-draft', code: 'R1', title: 'Nurse', status: 'Draft', dueDate: null }],
    };
    const tomorrow = buildMyWork(input, NOW, 'tomorrow');
    expect(tomorrow).toMatchObject({ day: 'tomorrow', today: '2026-10-19', date: '2026-10-20' });
    // 21:30Z on the 20th is 00:30 on the 21st in Cairo -> not tomorrow.
    expect(tomorrow.dueToday.map((i) => i.id)).toEqual(['tmr', 't-tmr']);
    expect(tomorrow.dueToday[0]).toMatchObject({ startAt: '2026-10-20T07:30:00.000Z', endAt: '2026-10-20T08:30:00.000Z', reason: 'Interview tomorrow' });
    expect(tomorrow.overdue.map((i) => i.id)).toEqual(['t-old']);
    const today = buildMyWork(input, NOW);
    expect(today).toMatchObject({ day: 'today', date: '2026-10-19' });
    expect(today.dueToday.map((i) => i.id)).toEqual(['today', 'r-draft']);
  });

  it('2) interview items carry room{name,url}, interviewer (first) and interviewers[]', () => {
    const work = buildMyWork({ ...base, interviews: [iv('i1', '2026-10-19T08:00:00Z', {
      roomUrl: 'https://meet.google.com/x', roomName: null, app,
      interviewers: [{ id: 'u1', name: 'Karim Hassan' }, { id: 'u2', name: 'Mariam Farag' }],
    })] }, NOW);
    expect(work.dueToday[0]).toMatchObject({
      room: { name: null, url: 'https://meet.google.com/x' },
      interviewer: { id: 'u1', name: 'Karim Hassan' },
      interviewers: [{ id: 'u1', name: 'Karim Hassan' }, { id: 'u2', name: 'Mariam Farag' }],
    });
    const none = buildMyWork({ ...base, interviews: [iv('i2', '2026-10-19T08:00:00Z')] }, NOW);
    expect(none.dueToday[0]).toMatchObject({ room: { name: null, url: null }, interviewer: null, interviewers: [] });
  });

  it('3) reminderWorkerHealthy: last sweep within 2x the interval', () => {
    const at = (msAgo: number, intervalMs?: number) => ({ observedAt: new Date(NOW.getTime() - msAgo), metadata: intervalMs ? { intervalMs } : null });
    expect(reminderWorkerHealthy(null, NOW)).toBe(false);
    expect(reminderWorkerHealthy(at(60_000, 300_000), NOW)).toBe(true);
    expect(reminderWorkerHealthy(at(600_000, 300_000), NOW)).toBe(true);
    expect(reminderWorkerHealthy(at(600_001, 300_000), NOW)).toBe(false);
    expect(reminderWorkerHealthy(at(9 * 60_000), NOW)).toBe(true); // default 5 min interval
    expect(reminderWorkerHealthy(at(11 * 60_000), NOW)).toBe(false);
    expect(buildMyWork(base, NOW).reminderWorkerHealthy).toBe(false);
    expect(buildMyWork({ ...base, reminderWorkerHealthy: true }, NOW).reminderWorkerHealthy).toBe(true);
  });

  it('4) application items carry candidate{id,name} and stage', () => {
    const work = buildMyWork({
      ...base,
      myMissingScorecards: [{ interviewId: 'i1', title: 'x', end: new Date('2026-10-18T10:00:00Z'), app }],
      offers: [{ id: 'o1', code: 'OFF-1', status: 'Sent', applicationId: 'a1', updatedAt: NOW, app: { ...app, stage: 'Offer' } }],
    }, NOW);
    expect(work.overdue[0]).toMatchObject({ applicationId: 'a1', candidate: { id: 'c1', name: 'Ahmed Embaby' }, stage: 'Interview' });
    expect(work.waitingOnOthers[0]).toMatchObject({ candidate: { id: 'c1', name: 'Ahmed Embaby' }, stage: 'Offer' });
  });

  it('5) targets carry department, site and owner', () => {
    const work = buildMyWork({ ...base, jobs: [{ id: 'j1', code: 'V1', title: 'HRIS Developer', status: 'Open', joined: 1, target: 3, dueDate: '2026-10-25', department: 'IT', site: 'Offshore', owner: { id: 'u9', name: 'Mariam Farag' } }] }, NOW);
    expect(work.targets[0]).toMatchObject({ department: 'IT', site: 'Offshore', owner: { id: 'u9', name: 'Mariam Farag' }, label: '1 of 3' });
    const bare = buildMyWork({ ...base, jobs: [{ id: 'j2', code: 'V2', title: 'x', status: 'Open', joined: 0, target: 1, dueDate: null }] }, NOW);
    expect(bare.targets[0]).toMatchObject({ department: null, site: null, owner: null });
  });

  it('6) entity.type is always one of the fixed contract enum', () => {
    expect([...myWorkEntityTypes]).toEqual(['application', 'interview', 'offer', 'requisition', 'job', 'task']);
    expect(['Vacancy', 'VacancyRequest', 'Application', 'Candidate', null, 'Interview', 'Offer'].map(toEntityType))
      .toEqual(['job', 'requisition', 'application', 'task', 'task', 'interview', 'offer']);
    const work = buildMyWork({
      ...base,
      jobs: [{ id: 'j1', code: 'V1', title: 'x', status: 'Open', joined: 0, target: 1, dueDate: '2026-10-19' }],
      requisitions: [{ id: 'r1', code: 'R1', title: 'x', status: 'Pending Approval', dueDate: '2026-10-25' }],
      tasks: [{ id: 't1', title: 'x', dueAt: new Date('2026-10-19T09:00:00Z'), entityType: 'Candidate', entityId: 'c1' }],
      interviews: [iv('i1', '2026-10-19T08:00:00Z')],
      othersMissingScorecards: [{ interviewId: 'i9', title: 'x', end: new Date('2026-10-18T10:00:00Z'), missing: 1 }],
      offers: [{ id: 'o1', code: 'O', status: 'Pending Approval', applicationId: 'a1', updatedAt: NOW }],
    }, NOW);
    const items = [...work.overdue, ...work.dueToday, ...work.waitingOnOthers];
    expect(items.length).toBe(6);
    for (const item of items) expect(myWorkEntityTypes).toContain(item.entity.type);
    expect(items.find((i) => i.id === 't1')!.entity).toEqual({ type: 'task', id: 't1' });
    expect(items.find((i) => i.id === 'o1')!.entity).toEqual({ type: 'offer', id: 'o1' });
  });

  it('7) every item has actions[]; disabled ones say why', () => {
    const work = buildMyWork({
      ...base,
      requisitions: [{ id: 'r-draft', code: 'R1', title: 'x', status: 'Draft', dueDate: null }, { id: 'r-pend', code: 'R2', title: 'x', status: 'Pending Approval', dueDate: '2026-10-25' }],
      interviews: [iv('i-future', '2026-10-19T10:00:00Z', { iAmInterviewer: true }), iv('i-notme', '2026-10-19T04:00:00Z', { iAmInterviewer: false })],
      othersMissingScorecards: [{ interviewId: 'i9', title: 'x', end: new Date('2026-10-18T10:00:00Z'), missing: 1 }],
      offers: [{ id: 'o1', code: 'O', status: 'Pending Approval', applicationId: 'a1', updatedAt: NOW }],
    }, NOW);
    const items = [...work.overdue, ...work.dueToday, ...work.waitingOnOthers];
    for (const item of items) {
      expect(item.actions.length).toBeGreaterThan(0);
      for (const a of item.actions) {
        expect(typeof a.disabled).toBe('boolean');
        if (a.disabled) expect(a.reason).toBeTruthy(); else expect(a.reason).toBeUndefined();
      }
    }
    const get = (id: string, key: string) => items.find((i) => i.id === id)!.actions.find((a) => a.key === key);
    expect(get('r-draft', 'submit-requisition')).toEqual({ key: 'submit-requisition', label: 'Submit for approval', disabled: true, reason: 'Set a due date first' });
    expect(get('r-draft', 'cancel-requisition')).toMatchObject({ disabled: false }); // Draft w/o due date can still be cancelled
    expect(get('r-pend', 'activate-requisition')).toMatchObject({ disabled: true, reason: 'Waiting for approval' });
    expect(get('i-future', 'submit-scorecard')).toMatchObject({ disabled: true, reason: 'Interview has not ended' });
    expect(get('i-notme', 'submit-scorecard')).toMatchObject({ disabled: true, reason: 'You are not an interviewer on this interview' });
    expect(get('i9', 'move-to-offer')).toMatchObject({ disabled: true, reason: 'Gate not met: scorecard not submitted' });
    expect(get('o1', 'send-offer')).toMatchObject({ disabled: true, reason: 'Waiting for approval' });
  });

  it('8) targets with no work items still give empty=true', () => {
    const work = buildMyWork({ ...base, jobs: [{ id: 'j1', code: 'V1', title: 'x', status: 'Open', joined: 0, target: 2, dueDate: '2026-11-30' }] }, NOW);
    expect(work.targets).toHaveLength(1);
    expect(work.counts).toEqual({ overdue: 0, today: 0, waitingOnOthers: 0 });
    expect(work.empty).toBe(true);
    expect(work.emptyMessage).toBe('No open work assigned to you.');
  });

  it('due dates stay plain facts: no timer/countdown fields', () => {
    const work = buildMyWork({ ...base, tasks: [{ id: 't', title: 'x', dueAt: new Date('2026-10-19T09:00:00Z'), entityType: null, entityId: null }] }, NOW);
    expect(JSON.stringify(work)).not.toMatch(/countdown|remaining|slaMs|secondsLeft|timer/i);
  });
});

describe('E1 GET /me/work?day=', () => {
  it('defaults to today, accepts tomorrow, rejects anything else with 400', async () => {
    const { MyWorkController } = await import('../my-work.controller');
    const calls: unknown[] = [];
    const c = new MyWorkController({ getMyWork: async (...a: unknown[]) => { calls.push(a[2]); return {}; } } as never);
    const u = { userId: 'u', organizationId: 'o', tokenVersion: 0, roleCodes: [] };
    await c.getMyWork(u, undefined);
    await c.getMyWork(u, 'tomorrow');
    expect(calls).toEqual(['today', 'tomorrow']);
    expect(() => c.getMyWork(u, 'yesterday')).toThrow(/today or tomorrow/);
  });
});
