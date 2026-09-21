import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { getErrorMessage, toErrorToast } from './errors';

describe('getErrorMessage', () => {
  it('reads ApiError message', () => {
    const err = new ApiError(500, 'Prisma query failed', undefined, { code: 'INTERNAL' });
    expect(getErrorMessage(err)).toBe('Prisma query failed');
  });

  it('falls back for unknown values', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});

describe('toErrorToast', () => {
  it('includes request id when present', () => {
    const err = new ApiError(500, 'Boom', undefined, { requestId: 'req_123' });
    const toast = toErrorToast(err, 'Load failed');
    expect(toast.tone).toBe('error');
    expect(toast.title).toBe('Load failed');
    expect(toast.message).toContain('req_123');
  });
});
