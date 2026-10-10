import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { entityHref, getMyWork, isEndpointMissing, normalizeMyWork, resolveSourceMode, type MyWorkResponse, type WorkItem } from '../myWork';
import { myWorkFixture } from '../myWork.fixtures';

const apiErr = (status: number) => new ApiError(status, `status ${status}`);
const dev = { prod: false } as const;

describe('My Work adapter: #9 contract typing', () => {
  it('fixtures satisfy the #9 shape and carry no pay fields', () => {
    const fx = myWorkFixture();
    expectTypeOf(fx).toEqualTypeOf<MyWorkResponse>();
    expectTypeOf<WorkItem['type']>().toEqualTypeOf<'job' | 'requisition' | 'task' | 'interview' | 'scorecard' | 'offer'>();
    expectTypeOf<NonNullable<WorkItem['waitingOn']>>().toEqualTypeOf<'approver' | 'interviewer' | 'candidate'>();
    expect(Object.keys(fx).sort()).toEqual(['counts', 'dueToday', 'empty', 'emptyMessage', 'generatedAt', 'overdue', 'targets', 'timezone', 'today', 'waitingOnOthers']);
    expect(Object.keys(fx.counts).sort()).toEqual(['overdue', 'today', 'waitingOnOthers']);
    expect(Object.keys(fx.targets[0]).sort()).toEqual(['dueDate', 'filled', 'label', 'target', 'title', 'vacancyCode', 'vacancyId']);
    const json = JSON.stringify(['mariam', 'empty', 'targets-only', 'multi-target'].map((variant) => myWorkFixture({ variant: variant as never })));
    expect(json).not.toMatch(/salary|"pay|compensation|currency|AED|EGP|SAR/i);
  });

  it('normalizes partial payloads without inventing data', () => {
    expect(normalizeMyWork({})).toMatchObject({ timezone: 'Africa/Cairo', overdue: [], dueToday: [], waitingOnOthers: [], targets: [], empty: true, emptyMessage: null, counts: { overdue: 0, today: 0, waitingOnOthers: 0 } });
    const fx = myWorkFixture();
    expect(normalizeMyWork(fx)).toEqual(fx);
  });

  it('maps entity types to v1 routes, null when unknown', () => {
    expect(entityHref({ type: 'Application', id: 'a 1' })).toBe('/applications/a%201');
    expect(entityHref({ type: 'Vacancy', id: 'j1' })).toBe('/vacancies/j1');
    expect(entityHref({ type: 'VacancyRequest', id: 'r1' })).toBe('/vacancy-requests/r1');
    expect(entityHref({ type: 'Interview', id: 'i1' })).toBe('/interviews/i1');
    expect(entityHref({ type: 'Task', id: 't1' })).toBeNull();
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

  it('calls GET /me/work (no query params) through the api client', async () => {
    vi.resetModules();
    const getApi = vi.fn().mockResolvedValue(myWorkFixture());
    vi.doMock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), getApi }));
    const mod = await import('../myWork');
    const res = await mod.getMyWork({ env: { prod: true } });
    expect(getApi).toHaveBeenCalledWith('/me/work');
    expect(res.source).toBe('api');
    vi.doUnmock('../../../api/client');
  });

  it('auto uses the API when it responds', async () => {
    const fixture = vi.fn();
    const r = await getMyWork({ env: dev, api: vi.fn().mockResolvedValue(myWorkFixture()), fixture });
    expect(r.source).toBe('api');
    expect(fixture).not.toHaveBeenCalled();
  });
  it.each([404, 405, 501])('auto falls back in dev on a missing endpoint (%i)', async (s) => {
    expect((await getMyWork({ env: dev, api: vi.fn().mockRejectedValue(apiErr(s)), fixture: async () => myWorkFixture() })).source).toBe('fixture');
  });
  it.each([401, 403, 500])('auto never masks a real error (%i)', async (s) => {
    await expect(getMyWork({ env: dev, api: vi.fn().mockRejectedValue(apiErr(s)), fixture: async () => myWorkFixture() })).rejects.toMatchObject({ statusCode: s });
  });
  it('production: missing endpoint is an error, never fixtures', async () => {
    const fixture = vi.fn();
    await expect(getMyWork({ env: { prod: true }, api: vi.fn().mockRejectedValue(apiErr(404)), fixture })).rejects.toBeInstanceOf(ApiError);
    expect(fixture).not.toHaveBeenCalled();
  });
  it('classifies missing endpoints', () => {
    expect(isEndpointMissing(apiErr(404))).toBe(true);
    expect(isEndpointMissing(new TypeError('Failed to fetch'))).toBe(true);
    expect(isEndpointMissing(apiErr(403))).toBe(false);
  });
});
