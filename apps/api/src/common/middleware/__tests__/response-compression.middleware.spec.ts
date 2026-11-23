import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createResponseCompressionMiddleware } from '../response-compression.middleware';

function createMockContext(acceptEncoding?: string, method = 'GET') {
  const headers = new Map<string, string | number>();
  let sentPayload: unknown;

  const req = {
    method,
    headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {},
  } as unknown as Request;

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    send(body?: unknown) {
      sentPayload = body;
      return this;
    },
  } as unknown as Response;

  return {
    req,
    res,
    headers,
    getSentPayload: () => sentPayload,
  };
}

describe('createResponseCompressionMiddleware', () => {
  const middleware = createResponseCompressionMiddleware();

  it('compresses large JSON payloads with gzip when accepted', () => {
    const { req, res, headers, getSentPayload } = createMockContext('gzip, deflate');
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const payload = JSON.stringify({
      items: Array.from({ length: 40 }, (_, i) => ({
        id: i,
        role: 'ICU Registered Nurse',
        branch: 'SGH Dubai Hospital',
      })),
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('ETag', '"strong-etag"');
    res.send(payload);

    expect(headers.get('vary')).toBe('Accept-Encoding');
    expect(headers.get('content-encoding')).toBe('gzip');
    expect(headers.get('etag')).toBe('W/"strong-etag"');
    const compressed = getSentPayload() as Buffer;
    expect(Buffer.isBuffer(compressed)).toBe(true);
    expect(compressed.byteLength).toBeLessThan(Buffer.byteLength(payload));
    expect(gunzipSync(compressed).toString('utf8')).toBe(payload);
  });

  it('prefers brotli when supported by the client', () => {
    const { req, res, headers, getSentPayload } = createMockContext('gzip, deflate, br');
    middleware(req, res, vi.fn() as unknown as NextFunction);

    const payload = JSON.stringify({
      rows: Array.from({ length: 80 }, (_, idx) => `Saudi German Health Candidate Row ${idx}`),
    });
    res.setHeader('Content-Type', 'application/json');
    res.send(payload);

    expect(headers.get('content-encoding')).toBe('br');
    expect(brotliDecompressSync(getSentPayload() as Buffer).toString('utf8')).toBe(payload);
  });

  it('skips payloads smaller than 1024 bytes', () => {
    const { req, res, headers, getSentPayload } = createMockContext('br, gzip');
    middleware(req, res, vi.fn() as unknown as NextFunction);

    res.setHeader('Content-Type', 'application/json');
    res.send('{"ok":true}');

    expect(headers.get('vary')).toBe('Accept-Encoding');
    expect(headers.get('content-encoding')).toBeUndefined();
    expect(getSentPayload()).toBe('{"ok":true}');
  });

  it('never compresses binary file downloads such as PDF or Excel workbooks', () => {
    const { req, res, headers, getSentPayload } = createMockContext('br, gzip');
    middleware(req, res, vi.fn() as unknown as NextFunction);

    const binary = Buffer.alloc(4096, 0x41);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(binary);

    expect(headers.get('content-encoding')).toBeUndefined();
    expect(getSentPayload()).toBe(binary);
  });

  it('leaves HEAD responses untouched', () => {
    const { req, res, headers, getSentPayload } = createMockContext('br, gzip', 'HEAD');
    middleware(req, res, vi.fn() as unknown as NextFunction);

    res.setHeader('Content-Type', 'application/json');
    res.send('x'.repeat(2048));

    expect(headers.get('vary')).toBe('Accept-Encoding');
    expect(headers.get('content-encoding')).toBeUndefined();
    expect(getSentPayload()).toBe('x'.repeat(2048));
  });
});
