import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { actionHref, entityHref, getMyWork, isEndpointMissing, normalizeMyWork, resolveSourceMode, type MyWorkResponse, type WorkItem } from '../myWork';
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
    expect(Object.keys(fx).sort()).toEqual(['counts', 'date', 'day', 'dueToday', 'empty', 'emptyMessage', 'generatedAt', 'overdue', 'reminderWorkerHealthy', 'targets', 'timezone', 'today', 'waitingOnOthers']);
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
  });

  it('maps the #9 entity enum to v1 routes; tasks have no page', () => {
    expect(entityHref({ type: 'application', id: 'a 1' })).toBe('/applications/a%201');
    expect(entityHref({ type: 'job', id: 'j1' })).toBe('/vacancies/j1');
    expect(entityHref({ type: 'requisition', id: 'r1' })).toBe('/vacancy-requests/r1');
    expect(entityHref({ type: 'interview', id: 'i1' })).toBe('/interviews/i1');
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
