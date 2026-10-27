import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { actionHref, entityHref, getMyWork, isEndpointMissing, joiningCaseHref, normalizeMyWork, resolveSourceMode, upcomingInterviewHref, waitingOfferTitle, type MyWorkResponse, type WorkItem } from '../myWork';
import { myWorkFixture } from '../myWork.fixtures';

const apiErr = (status: number) => new ApiError(status, `status ${status}`);
const dev = { prod: false } as const;

describe('My Work adapter: #9 contract typing', () => {
  it('fixtures satisfy the #9 shape and carry no pay fields', () => {
    const fx = myWorkFixture();
    expectTypeOf(fx).toEqualTypeOf<MyWorkResponse>();
    expectTypeOf<WorkItem['type']>().toEqualTypeOf<'job' | 'requisition' | 'task' | 'interview' | 'scorecard' | 'offer'>();
    expectTypeOf<NonNullable<WorkItem['waitingOn']>>().toEqualTypeOf<'approver' | 'interviewer' | 'candidate'>();
    expectTypeOf<WorkItem['entity']['type']>().toEqualTypeOf<'application' | 'interview' | 'offer' | 'requisition' | 'job' | 'task'>();
    expect(Object.keys(fx).sort()).toEqual(['counts', 'date', 'day', 'dueToday', 'empty', 'emptyMessage', 'generatedAt', 'joiningSoon', 'overdue', 'reminderWorkerHealthy', 'targets', 'timezone', 'today', 'upcomingInterviews', 'waitingOnOthers']);
    expect(Object.keys(fx.counts).sort()).toEqual(['overdue', 'today', 'waitingOnOthers']);
    expect(Object.keys(fx.targets[0]).sort()).toEqual(['department', 'dueDate', 'filled', 'label', 'owner', 'site', 'target', 'title', 'vacancyCode', 'vacancyId']);
    const json = JSON.stringify(['mariam', 'empty', 'targets-only', 'multi-target', 'stale-worker'].flatMap((variant) => (['today', 'tomorrow'] as const).map((day) => myWorkFixture({ variant: variant as never, day }))));
    expect(json).not.toMatch(/salary|"pay|compensation|currency|AED|EGP|SAR/i);
  });

  it('normalizes partial payloads without inventing data', () => {
    expect(normalizeMyWork({})).toMatchObject({ timezone: 'Africa/Cairo', day: 'today', overdue: [], dueToday: [], waitingOnOthers: [], targets: [], empty: true, emptyMessage: null, reminderWorkerHealthy: false, counts: { overdue: 0, today: 0, waitingOnOthers: 0 } });
    for (const day of ['today', 'tomorrow'] as const) { const fx = myWorkFixture({ day }); expect(normalizeMyWork(fx, day)).toEqual(fx); }
    // legacy (pre-829983a) casing is lowered rather than crashing; missing actions → []
    const legacy = normalizeMyWork({ dueToday: [{ id: 'x', type: 'job', title: 't', dueAt: null, reason: 'r', nextAction: { code: 'c', label: 'l' }, entity: { type: 'Application' as never, id: 'a' } } as never] });
    expect(legacy.dueToday[0].entity.type).toBe('application');
    expect(legacy.dueToday[0].actions).toEqual([]);
    const partial = normalizeMyWork({ overdue: [], dueToday: [], waitingOnOthers: [] });
    expect(partial.upcomingInterviews).toBeUndefined();
    expect(partial.joiningSoon).toBeUndefined();
    expect(normalizeMyWork({ upcomingInterviews: [], joiningSoon: [] }).upcomingInterviews).toEqual([]);
    const stripped = normalizeMyWork({ upcomingInterviews: [{ id: 'iv', title: 'Rana', candidateName: 'Rana', jobTitle: 'Analyst', startAt: '2026-10-21T06:00:00.000Z', endAt: null, room: { name: null, url: null }, interviewers: [], access: 'evaluation', applicationId: 'secret-file', held: false, status: 'assigned', action: { key: 'open-interview', label: 'Open evaluation', disabled: false } }] });
    expect(stripped.upcomingInterviews?.[0].applicationId).toBeUndefined();
    expect(JSON.stringify(stripped.upcomingInterviews)).not.toContain('secret-file');
    const base = { id: 'iv', title: 'Rana', candidateName: 'Rana', jobTitle: 'Analyst', startAt: '2026-10-21T06:00:00.000Z', endAt: null, room: { name: null, url: null }, interviewers: [], held: false, status: 'assigned' as const };
    const malformed = normalizeMyWork({
      upcomingInterviews: [
        null,
        { ...base, access: 'mystery', applicationId: 'secret-file', action: { key: 'open-interview', label: 'Manage interview', disabled: false } },
        { ...base, id: 'no-action', access: 'file', applicationId: 'a1' },
        { ...base, id: 'no-access', action: { key: 'open-interview', label: 'Manage interview', disabled: false } },
        { ...base, id: 'bad-key', access: 'file', applicationId: 'a9', action: { key: 'invented', label: 'Manage interview', disabled: false } },
        { ...base, id: 'kept', access: 'evaluation', applicationId: 'secret-file', action: { key: 'open-interview', label: 'Open evaluation', disabled: false } },
      ] as never,
      joiningSoon: [{ id: 'hc', applicationId: 'a1', candidateName: 'Lina', jobTitle: 'Role', checksComplete: 2, checksRequired: 2, readiness: 'not-a-state', detail: 'Ready to record joining', held: false }] as never,
    });
    expect(malformed.upcomingInterviews?.map((row) => row.id)).toEqual(['kept']);
    expect(JSON.stringify(malformed.upcomingInterviews)).not.toMatch(/Manage interview|secret-file|a9/);
    expect(malformed.joiningSoon?.[0]).toMatchObject({ readiness: 'review', detail: 'Review readiness', joined: false });
    expect(normalizeMyWork({}).upcomingInterviews).toBeUndefined();
  });

  it('maps the #9 entity enum to v1 routes; tasks have no page', () => {
    expect(entityHref({ type: 'application', id: 'a 1' })).toBe('/applications/a%201');
    expect(entityHref({ type: 'job', id: 'j1' })).toBe('/vacancies/j1');
    expect(entityHref({ type: 'requisition', id: 'r1' })).toBe('/vacancy-requests?req=r1');
    expect(entityHref({ type: 'interview', id: 'i1' })).toBe('/my-interviews?interview=i1');
    expect(entityHref({ type: 'offer', id: 'o1' })).toBe('/offers/o1');
    expect(entityHref({ type: 'task', id: 't1' })).toBeNull();
    const item = myWorkFixture().waitingOnOthers[1];
    expect(actionHref(item, { key: 'move-to-offer', label: 'Move to Offer', disabled: false })).toBe('/applications/a4');
  });
});

describe('My Work adapter: source selection', () => {
  it('production is always the real API', () => {
    expect(resolveSourceMode({ prod: true, mode: 'fixture', query: 'fixture' })).toBe('api');
  });
  it('dev: query > env > auto', () => {
    expect(resolveSourceMode({ prod: false, mode: 'api', query: 'fixture' })).toBe('fixture');
    expect(resolveSourceMode({ prod: false, mode: 'api' })).toBe('api');
    expect(resolveSourceMode({ prod: false })).toBe('auto');
  });

  it.each(['today', 'tomorrow'] as const)('calls GET /me/work?day=%s through the api client', async (day) => {
    vi.resetModules();
    const getApi = vi.fn().mockResolvedValue(myWorkFixture());
    vi.doMock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), getApi }));
    const mod = await import('../myWork');
    const res = await mod.getMyWork(day, { env: { prod: true } });
    expect(getApi).toHaveBeenCalledWith(`/me/work?day=${day}`);
    expect(res.source).toBe('api');
    vi.doUnmock('../../../api/client');
  });

  it('auto uses the API when it responds', async () => {
    const fixture = vi.fn();
    const r = await getMyWork('today', { env: dev, api: vi.fn().mockResolvedValue(myWorkFixture()), fixture });
    expect(r.source).toBe('api');
    expect(fixture).not.toHaveBeenCalled();
  });
  it.each([404, 405, 501])('auto falls back in dev on a missing endpoint (%i)', async (s) => {
    expect((await getMyWork('today', { env: dev, api: vi.fn().mockRejectedValue(apiErr(s)), fixture: async () => myWorkFixture() })).source).toBe('fixture');
  });
  it.each([401, 403, 500])('auto never masks a real error (%i)', async (s) => {
    await expect(getMyWork('today', { env: dev, api: vi.fn().mockRejectedValue(apiErr(s)), fixture: async () => myWorkFixture() })).rejects.toMatchObject({ statusCode: s });
  });
  it('production: missing endpoint is an error, never fixtures', async () => {
    const fixture = vi.fn();
    await expect(getMyWork('today', { env: { prod: true }, api: vi.fn().mockRejectedValue(apiErr(404)), fixture })).rejects.toBeInstanceOf(ApiError);
    expect(fixture).not.toHaveBeenCalled();
  });
  it('classifies missing endpoints', () => {
    expect(isEndpointMissing(apiErr(404))).toBe(true);
    expect(isEndpointMissing(new TypeError('Failed to fetch'))).toBe(true);
    expect(isEndpointMissing(apiErr(403))).toBe(false);
  });
});

describe('E2: My Work actions open the v2 file', () => {
  it('maps application-linked actions to E13 / drawers', async () => {
    const { fileActionHref } = await import('../myWork');
    const fx = myWorkFixture();
    const sc = fx.overdue[0];
    expect(fileActionHref(sc, sc.actions[0])).toBe('/applications/a1?drawer=scorecard&interview=i1');
    const offer = fx.waitingOnOthers[0];
    expect(fileActionHref(offer, { key: 'screen', label: 'Log screen', disabled: false })).toBe('/applications/a3?drawer=screen');
    expect(fileActionHref(offer, { key: 'schedule', label: 'Schedule interview', disabled: false })).toBe('/applications/a3?drawer=schedule');
    expect(fileActionHref(offer, { key: 'scorecard', label: 'Open scorecard', disabled: false })).toBe('/applications/a3?drawer=scorecard');
    expect(fileActionHref(offer, { key: 'send-offer', label: 'Send offer', disabled: false })).toBe('/applications/a3?drawer=send');
    expect(fileActionHref(offer, { key: 'record-response', label: 'Record response', disabled: false })).toBe('/applications/a3?drawer=answer');
    expect(fileActionHref(offer, { key: 'pre-hire', label: 'Pre-hire checklist', disabled: false })).toBe('/applications/a3?drawer=prehire');
    expect(fileActionHref(offer, offer.actions[0])).toBe('/applications/a3?drawer=offer');
    expect(fileActionHref(fx.waitingOnOthers[1], { key: 'move-to-offer', label: 'Move to Offer', disabled: false })).toBe('/applications/a4?drawer=offer');
    const job = fx.dueToday[0];
    expect(fileActionHref(job, job.actions[0])).toBe('/vacancies/j1');
  });

  it('labels the waitingOn blocker and does not treat a sent offer as approval', () => {
    const sent = { ...(myWorkFixture().waitingOnOthers[0]), waitingOn: 'candidate' as const, approver: undefined, approvers: undefined, candidate: { id: 'c9', name: 'Lina Hassan' }, reason: 'Offer waiting for approval' };
    expect(waitingOfferTitle(sent)).toBe('Lina Hassan — offer waiting on the candidate');
    expect(waitingOfferTitle(sent)).not.toMatch(/approval/i);
    const approver = myWorkFixture().waitingOnOthers[0];
    expect(waitingOfferTitle(approver)).toBe('Salma Farouk — offer waiting on Karim Hassan');
  });

  it('upcoming and joining links stay inside the caller access the payload already grants', () => {
    const fx = myWorkFixture();
    const file = { canOpenFile: true } as const;
    const [fileRow, held, assigned] = fx.upcomingInterviews!;
    expect(upcomingInterviewHref(fileRow!, file)).toBe('/applications/a2?drawer=schedule&interview=iv2');
    expect(upcomingInterviewHref(held!, file)).toBe('/applications/a6?drawer=schedule&interview=iv-held');
    expect(upcomingInterviewHref({ ...fileRow!, id: 'iv-score', action: { key: 'open-interview', label: 'View scorecard', disabled: false } }, file)).toBe('/applications/a2?drawer=scorecard&interview=iv-score');
    expect(upcomingInterviewHref({ ...fileRow!, action: { key: 'submit-scorecard', label: 'Submit scorecard', disabled: false } }, file)).toBe('/applications/a2?drawer=scorecard&interview=iv2');
    expect(upcomingInterviewHref(fileRow!)).toBeNull();
    expect(upcomingInterviewHref(fileRow!, { canOpenFile: false })).toBeNull();
    expect(upcomingInterviewHref(assigned!)).toBe('/my-interviews?interview=iv-assigned');
    expect(upcomingInterviewHref(assigned!, { canOpenFile: false })).toBe('/my-interviews?interview=iv-assigned');
    expect(upcomingInterviewHref(assigned!)).not.toContain('scorecard');
    expect(upcomingInterviewHref(assigned!)).not.toContain('/applications/');
    const assignedScore = upcomingInterviewHref({ ...assigned!, action: { key: 'submit-scorecard', label: 'Submit scorecard', disabled: false } }, { canOpenFile: false });
    expect(assignedScore).toBe('/my-interviews?interview=iv-assigned&scorecard=1');
    expect(assignedScore).not.toContain('/applications/');
    const [approval, licence] = fx.joiningSoon!;
    expect(joiningCaseHref(approval!, true)).toEqual({ href: '/applications/a3?drawer=prehire', label: 'Open checklist' });
    expect(joiningCaseHref(licence!, true)).toEqual({ href: '/applications/a8?drawer=prehire', label: 'View readiness' });
    expect(joiningCaseHref(licence!, false)).toEqual({ href: '/applications/a8?drawer=prehire', label: 'View readiness' });
    expect(joiningCaseHref({ ...licence!, readiness: 'ready', detail: 'Ready to join' }, false)).toEqual({ href: '/applications/a8?drawer=prehire', label: 'View readiness' });
    expect(joiningCaseHref({ ...licence!, readiness: 'blocked', detail: 'Approved capacity is already filled.' }, false)).toEqual({ href: '/applications/a8?drawer=prehire', label: 'View readiness' });
    expect(joiningCaseHref({ ...licence!, readiness: 'review', detail: 'Review readiness' }, false)).toEqual({ href: '/applications/a8?drawer=prehire', label: 'View readiness' });
    expect(joiningCaseHref(approval!, false).href).toBe('/hires/hc1');
    expect(fx.joiningSoon!.every((row) => row.joined === false)).toBe(true);
  });

  it.each(['licence_pending', 'ready', 'blocked', 'review'] as const)(
    'joining readiness %s uses the pre-hire drawer /applications/:id?drawer=prehire',
    (readiness) => {
      const licence = myWorkFixture().joiningSoon!.find((row) => row.readiness === 'licence_pending')!;
      expect(joiningCaseHref({ ...licence, readiness }, false)).toEqual({
        href: '/applications/a8?drawer=prehire',
        label: 'View readiness',
      });
    },
  );
});
