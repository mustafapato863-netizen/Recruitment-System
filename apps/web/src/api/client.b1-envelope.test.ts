import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError} from './client';
import { filenameFromDisposition, getApi, patchApi, postApi } from './client';
import { isOwnershipDenied } from '../utils/vacancyAccess';

/** Exact bodies the #4 backend sends after the global error normalizer (http-exception.filter.ts + error-normalizer.ts). */
const envelope = (statusCode: number, code: string, message: string) => ({ statusCode, code, message, retryable: false, retryAfterSeconds: null, requestId: 'req-1' });
const res = (status: number, body: unknown) => ({ ok: false, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe('QA BUG-1: B1 error codes through the #4 envelope', () => {
  const fetchSpy = vi.fn<typeof fetch>();
  let original: typeof fetch;
  beforeEach(() => { original = globalThis.fetch; fetchSpy.mockReset(); globalThis.fetch = fetchSpy; vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true); });
  afterEach(() => { globalThis.fetch = original; vi.restoreAllMocks(); });

  it.each([
    [403, 'Access denied: this file belongs to another owner.', 'FILE_NOT_OWNED'],
    [403, 'Access denied: you are not approving a file for this candidate.', 'FILE_NOT_OWNED'],
    [403, 'Access denied: this job belongs to another owner.', 'JOB_NOT_OWNED'],
    [403, 'Administrators cannot assign or reassign file owners.', 'ADMIN_CANNOT_REASSIGN'],
    [403, 'Administrators cannot reassign a job owner.', 'ADMIN_CANNOT_REASSIGN'],
  ])('403 FORBIDDEN envelope "%s" → %s with the server message, no refresh', async (status, message, expected) => {
    fetchSpy.mockResolvedValueOnce(res(status, envelope(status, 'FORBIDDEN', message)));
    const err = (await getApi('/applications/a1').catch((e: unknown) => e)) as ApiError;
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(expected);
    expect(err.message).toBe(message);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('FILE_NOT_OWNED/JOB_NOT_OWNED count as ownership denials (Forbidden pages trigger)', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, envelope(403, 'FORBIDDEN', 'Access denied: this file belongs to another owner.')));
    expect(isOwnershipDenied(await getApi('/applications/a1').catch((e: unknown) => e))).toBe(true);
  });

  it.each([
    'Owner must be a user in this organization.',
    'An inactive user cannot own a job or file.',
    'An administrator cannot own a job or file.',
  ])('400 VALIDATION_ERROR "%s" → OWNER_NOT_ELIGIBLE with the server message', async (message) => {
    fetchSpy.mockResolvedValueOnce(res(400, envelope(400, 'VALIDATION_ERROR', message)));
    const err = (await patchApi('/applications/a1', { primaryRecruiterId: 'u' }).catch((e: unknown) => e)) as ApiError;
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('OWNER_NOT_ELIGIBLE');
    expect(err.message).toBe(message);
  });

  it('the generic #4 FORBIDDEN body keeps the generic copy and code', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, envelope(403, 'FORBIDDEN', 'You do not have permission to perform this action.')));
    const err = (await postApi('/x', {}).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Access denied: you do not have permission to perform this action.');
  });

  it('raw domain codes (if Backend adds them to the registry) still work', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, envelope(403, 'JOB_NOT_OWNED', 'Access denied: this job belongs to another owner.')));
    expect(((await getApi('/v').catch((e: unknown) => e)) as ApiError).code).toBe('JOB_NOT_OWNED');
  });
});

describe('filenameFromDisposition', () => {
  it('reads plain and RFC 5987 names', () => {
    expect(filenameFromDisposition('attachment; filename="Ahmed Embaby CV.pdf"')).toBe('Ahmed Embaby CV.pdf');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''Ahmed%20CV.pdf")).toBe('Ahmed CV.pdf');
    expect(filenameFromDisposition(null)).toBeNull();
  });
});
