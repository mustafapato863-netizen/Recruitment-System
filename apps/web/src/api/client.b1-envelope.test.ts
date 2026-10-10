import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError} from './client';
import { filenameFromDisposition, getApi, patchApi, postApi } from './client';
import { isOwnershipDenied } from '../utils/vacancyAccess';

/** Exact bodies the #4 backend sends after the global error normalizer (http-exception.filter.ts + error-normalizer.ts). */
const envelope = (statusCode: number, code: string, message: string) => ({ statusCode, code, message, retryable: false, retryAfterSeconds: null, requestId: 'req-1' });
const res = (status: number, body: unknown) => ({ ok: false, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe('B1 error codes on the #4 envelope (codes, not messages)', () => {
  const fetchSpy = vi.fn<typeof fetch>();
  let original: typeof fetch;
  beforeEach(() => { original = globalThis.fetch; fetchSpy.mockReset(); globalThis.fetch = fetchSpy; vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true); });
  afterEach(() => { globalThis.fetch = original; vi.restoreAllMocks(); });

  it.each([
    [403, 'FILE_NOT_OWNED', 'Access denied: this file belongs to another owner.'],
    [403, 'FILE_NOT_OWNED', 'Access denied: you are not approving a file for this candidate.'],
    [403, 'JOB_NOT_OWNED', 'Access denied: this job belongs to another owner.'],
    [403, 'ADMIN_CANNOT_REASSIGN', 'Administrators cannot assign or reassign file owners.'],
    [403, 'ADMIN_CANNOT_REASSIGN', 'Administrators cannot reassign a job owner.'],
    [403, 'DOCUMENT_DOWNLOAD_DENIED', 'Access denied: downloading this document requires DOWNLOAD_DOCUMENTS, or a pending approval on this candidate (CV only).'],
    [403, 'ADMIN_ONLY', 'Access denied: only administrators can manage templates.'],
    [400, 'OWNER_NOT_ELIGIBLE', 'Owner must be a user in this organization.'],
    [400, 'OWNER_NOT_ELIGIBLE', 'An inactive user cannot own a job or file.'],
    [400, 'OWNER_NOT_ELIGIBLE', 'An administrator cannot own a job or file.'],
  ])('%s %s on the wire → read as the code, server message kept, no refresh', async (status, code, message) => {
    fetchSpy.mockResolvedValueOnce(res(status, envelope(status, code, message)));
    const err = (await getApi('/applications/a1').catch((e: unknown) => e)) as ApiError;
    expect(err.statusCode).toBe(status);
    expect(err.code).toBe(code);
    expect(err.message).toBe(message);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('no message matching: the same text under a generic code stays generic', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, envelope(403, 'FORBIDDEN', 'Access denied: this file belongs to another owner.')));
    expect(((await getApi('/a').catch((e: unknown) => e)) as ApiError).code).toBe('FORBIDDEN');
    fetchSpy.mockResolvedValueOnce(res(400, envelope(400, 'VALIDATION_ERROR', 'An inactive user cannot own a job or file.')));
    expect(((await patchApi('/a', {}).catch((e: unknown) => e)) as ApiError).code).toBe('VALIDATION_ERROR');
  });

  it('FILE_NOT_OWNED/JOB_NOT_OWNED count as ownership denials (Forbidden pages trigger)', async () => {
    fetchSpy.mockResolvedValueOnce(res(403, envelope(403, 'FILE_NOT_OWNED', 'Access denied: this file belongs to another owner.')));
    expect(isOwnershipDenied(await getApi('/applications/a1').catch((e: unknown) => e))).toBe(true);
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
