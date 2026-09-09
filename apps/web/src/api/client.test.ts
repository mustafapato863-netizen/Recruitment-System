import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadApi, postApi, ApiError } from './client';

describe('API Client Error Handling', () => {
  const fetchSpy = vi.fn<typeof fetch>();
  let windowDispatchSpy: ReturnType<typeof vi.spyOn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy.mockReset();
    globalThis.fetch = fetchSpy;
    windowDispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
      json: async () => body,
      text: async () => JSON.stringify(body),
      blob: async () => new Blob([JSON.stringify(body)]),
    } as Response;
  }

  function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
    fetchSpy.mockResolvedValue(makeResponse(status, body, headers));
  }

  describe('downloadApi', () => {
    it('explains login lockout and retains the retry time', async () => {
      mockResponse(403, { code: 'ACCOUNT_LOCKED', retryAfterSeconds: 125 });
      await expect(postApi('/auth/login', {})).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_LOCKED',
        retryAfterSeconds: 125,
        message: 'Sign-in is temporarily locked after too many failed attempts. Try again in 3 minutes.',
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    it('throws ApiError with envelope on 403 Forbidden', async () => {
      mockResponse(403, {
        code: 'FORBIDDEN',
        message: 'Access denied: you do not have permission to perform this action.',
        requestId: 'req-403',
      });

      await expect(downloadApi('/api/test-download')).rejects.toThrowError(ApiError);
      await expect(downloadApi('/api/test-download')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied: you do not have permission to perform this action.',
        code: 'FORBIDDEN',
        requestId: 'req-403',
      });
    });

    it('throws ApiError with envelope on 404 Not Found', async () => {
      mockResponse(404, {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        requestId: 'req-404',
      });

      try {
        await downloadApi('/api/test-download');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        if (!(err instanceof ApiError)) return;
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('The requested resource was not found.');
      }
    });

    it('handles 429 Too Many Requests with retryAfterSeconds', async () => {
      mockResponse(429, {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryable: true,
        retryAfterSeconds: 60,
      });

      try {
        await downloadApi('/api/test-download');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        if (!(err instanceof ApiError)) return;
        expect(err.statusCode).toBe(429);
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.retryable).toBe(true);
        expect(err.retryAfterSeconds).toBe(60);
      }
    });

    it('handles 502/503 Integration Unavailable', async () => {
      mockResponse(503, {
        code: 'INTEGRATION_UNAVAILABLE',
        message: 'Service unavailable',
        retryable: true,
      });

      try {
        await downloadApi('/api/test-download');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        if (!(err instanceof ApiError)) return;
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe('INTEGRATION_UNAVAILABLE');
        expect(err.retryable).toBe(true);
      }
    });

    it('dispatches auth:unauthorized on 401 and handles session expired', async () => {
      // First call returns 401
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {
          code: 'SESSION_EXPIRED',
          message: 'Session expired',
        }));

      // We need to also mock the refresh endpoint which happens in downloadApi if allowRefresh is true.
      // Let's mock refresh to fail so it propagates the 401.
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {}));

      try {
        await downloadApi('/api/test-download');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        if (!(err instanceof ApiError)) return;
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('SESSION_EXPIRED');
        expect(err.message).toBe('Your session has expired. Please sign in again to continue.');
        expect(windowDispatchSpy).toHaveBeenCalled();
        expect(windowDispatchSpy.mock.calls[0][0].type).toBe('auth:unauthorized');
      }
    });

    it('formats validation fields into message on 400 Bad Request', async () => {
      mockResponse(400, {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields.',
        fields: {
          experienceYears: ['experienceYears must be an integer number'],
          summary: ['property summary should not exist'],
        },
      });

      try {
        await postApi('/candidates', { experienceYears: 2.5 });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        if (!(err instanceof ApiError)) return;
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.message).toBe(
          'Please correct the highlighted fields (experienceYears: experienceYears must be an integer number, summary: property summary should not exist).'
        );
        expect(err.fields).toEqual({
          experienceYears: ['experienceYears must be an integer number'],
          summary: ['property summary should not exist'],
        });
      }
    });
  });
});
