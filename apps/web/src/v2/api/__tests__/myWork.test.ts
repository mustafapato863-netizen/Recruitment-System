import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { getMyWork, isEndpointMissing, normalizeMyWork, resolveSourceMode, type MyWorkResponse, type MyWorkTask } from '../myWork';
import { myWorkFixture } from '../myWork.fixtures';

const apiErr = (status: number) => new ApiError(status, `status ${status}`);
const dev = { prod: false } as const;

describe('My Work adapter: contract typing', () => {
  it('fixtures satisfy the contract types and carry no pay fields', () => {
    const today = myWorkFixture('today');
    expectTypeOf(today).toEqualTypeOf<MyWorkResponse>();
    expectTypeOf<MyWorkTask['nextAction']['kind']>().toEqualTypeOf<'open_file' | 'log_screening' | 'chase_scorecard' | 'schedule_interview' | 'send_offer' | 'view_file'>();
    const json = JSON.stringify([today, myWorkFixture('tomorrow')]);
    expect(json).not.toMatch(/salary|pay|compensation|currency|AED|EGP|SAR/i);
    expect(today.sections.overdue[0].section).toBe('overdue');
  });

  it('normalizes partial payloads and strips SLA when the worker is stale', () => {
    const fx = myWorkFixture('today');
    const n = normalizeMyWork({ ...fx, reminderWorkerHealthy: false }, 'today');
    expect([...n.sections.overdue, ...n.sections.today].every((t) => t.sla === null)).toBe(true);
    const empty = normalizeMyWork({}, 'tomorrow');
    expect(empty).toMatchObject({ day: 'tomorrow', job: null, scheduled: [], counts: { total: 0 }, reminderWorkerHealthy: true });
  });
});

describe('My Work adapter: source selection', () => {
  it('production is always the real API, even when asked for fixtures', () => {
    expect(resolveSourceMode({ prod: true, mode: 'fixture', query: 'fixture' })).toBe('api');
  });
  it('dev: query > env > auto', () => {
    expect(resolveSourceMode({ prod: false, mode: 'api', query: 'fixture' })).toBe('fixture');
    expect(resolveSourceMode({ prod: false, mode: 'api' })).toBe('api');
    expect(resolveSourceMode({ prod: false })).toBe('auto');
  });

  it('calls GET /me/work?day= through the api client', async () => {
    vi.resetModules();
    const getApi = vi.fn().mockResolvedValue(myWorkFixture('tomorrow'));
    vi.doMock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), getApi }));
    const mod = await import('../myWork');
    const res = await mod.getMyWork('tomorrow', { env: { prod: true } });
    expect(getApi).toHaveBeenCalledWith('/me/work?day=tomorrow');
    expect(res.source).toBe('api');
    expect(res.data.scheduled).toHaveLength(1);
    vi.doUnmock('../../../api/client');
  });

  it('auto: uses the API when it responds', async () => {
    const api = vi.fn().mockResolvedValue(myWorkFixture('today'));
    const fixture = vi.fn();
    const r = await getMyWork('today', { env: dev, api, fixture });
    expect(r.source).toBe('api');
    expect(fixture).not.toHaveBeenCalled();
  });

  it.each([404, 405, 501])('auto: falls back to fixtures in dev when the endpoint is missing (%i)', async (status) => {
    const r = await getMyWork('today', { env: dev, api: vi.fn().mockRejectedValue(apiErr(status)), fixture: async (d) => myWorkFixture(d) });
    expect(r.source).toBe('fixture');
  });

  it.each([401, 403, 500])('auto: never masks a real error (%i)', async (status) => {
    await expect(getMyWork('today', { env: dev, api: vi.fn().mockRejectedValue(apiErr(status)), fixture: async (d) => myWorkFixture(d) })).rejects.toMatchObject({ statusCode: status });
  });

  it('production: a missing endpoint is an error, never fixtures', async () => {
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
