import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getApi, postApi } from './client';
import { getErrorMessage } from './errors';

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe('B1: api client 401 vs 403', () => {
  const fetchSpy = vi.fn<typeof fetch>();
  let original: typeof fetch;
  beforeEach(() => {
    original = globalThis.fetch;
    fetchSpy.mockReset();
    globalThis.fetch = fetchSpy;
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });
  afterEach(() => { globalThis.fetch = original; vi.restoreAllMocks(); });

  const calledPaths = () => fetchSpy.mock.calls.map(([url]) => String(url));

  it('does NOT refresh the session on 403 and surfaces the ownership message', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, { code: 'FILE_NOT_OWNED', message: 'Access denied: this file belongs to another owner.' }));
    const err = await getApi('/applications/a1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(403);
    expect((err as ApiError).code).toBe('FILE_NOT_OWNED');
    expect(getErrorMessage(err)).toBe('Access denied: this file belongs to another owner.');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(calledPaths().some((p) => p.endsWith('/auth/refresh'))).toBe(false);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('shows the JOB_NOT_OWNED message on action failures', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, { code: 'JOB_NOT_OWNED', message: 'Access denied: this job belongs to another owner.' }));
    await expect(postApi('/vacancies/v1/assignments', {})).rejects.toThrow('Access denied: this job belongs to another owner.');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the generic message for other 403s', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, { code: 'SOMETHING', message: 'internal detail' }));
    await expect(getApi('/x')).rejects.toThrow('Access denied: you do not have permission to perform this action.');
  });

  it('still refreshes once on 401', async () => {
    fetchSpy
      .mockResolvedValueOnce(res(401, { code: 'TOKEN_EXPIRED' }))
      .mockResolvedValueOnce(res(200, {}))
      .mockResolvedValueOnce(res(200, { ok: true }));
    await expect(getApi('/vacancies')).resolves.toEqual({ ok: true });
    expect(calledPaths().filter((p) => p.endsWith('/auth/refresh'))).toHaveLength(1);
  });
});
