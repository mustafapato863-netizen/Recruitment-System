import { constants, brotliCompressSync, gzipSync } from 'node:zlib';
import type { NextFunction, Request, Response } from 'express';

const MIN_COMPRESS_BYTES = 1024;
const COMPRESSIBLE_CONTENT_TYPE_RE =
  /^(?:text\/|application\/(?:json|javascript|xml|ld\+json)|image\/svg\+xml)|(?:\+json|\+xml)(?:\s*;|$)/i;

type SupportedEncoding = 'br' | 'gzip';

function pickEncoding(acceptEncoding: unknown): SupportedEncoding | null {
  if (typeof acceptEncoding !== 'string' || !acceptEncoding.trim()) return null;
  if (/\bbr\b(?!\s*;\s*q=0(?:\.0+)?\b)/i.test(acceptEncoding)) return 'br';
  if (/\bgzip\b(?!\s*;\s*q=0(?:\.0+)?\b)/i.test(acceptEncoding)) return 'gzip';
  return null;
}

function appendVaryAcceptEncoding(res: Response): void {
  const existing = res.getHeader('Vary');
  if (!existing) {
    res.setHeader('Vary', 'Accept-Encoding');
    return;
  }
  const currentList = Array.isArray(existing) ? existing.join(',') : String(existing);
  const tokens = currentList.split(',').map((t) => t.trim()).filter(Boolean);
  if (!tokens.some((t) => t.toLowerCase() === 'accept-encoding' || t === '*')) {
    res.setHeader('Vary', [...tokens, 'Accept-Encoding'].join(', '));
  }
}

function isCompressibleResponse(res: Response): boolean {
  if (res.statusCode === 204 || res.statusCode === 304) return false;
  if (res.getHeader('Content-Encoding')) return false;
  const contentType = res.getHeader('Content-Type');
  if (!contentType) return false;
  const normalized = Array.isArray(contentType) ? contentType.join(';') : String(contentType);
  return COMPRESSIBLE_CONTENT_TYPE_RE.test(normalized.trim());
}

function toBuffer(body: unknown): Buffer | null {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  if (body instanceof Uint8Array) return Buffer.from(body);
  return null;
}

/**
 * Zero-dependency Express compression middleware for JSON/text API payloads >= 1 KB.
 * Preserves streaming file downloads and already-encoded/binary assets untouched.
 */
export function createResponseCompressionMiddleware() {
  return function responseCompressionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    appendVaryAcceptEncoding(res);
    if (req.method === 'HEAD') {
      next();
      return;
    }

    const encoding = pickEncoding(req.headers['accept-encoding']);
    if (!encoding) {
      next();
      return;
    }

    const origSend = res.send.bind(res);
    res.send = function compressedSend(body?: unknown): Response {
      if (!isCompressibleResponse(res)) {
        return origSend(body);
      }

      const rawBuffer = toBuffer(body);
      if (!rawBuffer || rawBuffer.byteLength < MIN_COMPRESS_BYTES) {
        return origSend(body);
      }

      const compressed =
        encoding === 'br'
          ? brotliCompressSync(rawBuffer, {
              params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
            })
          : gzipSync(rawBuffer, { level: 6 });

      // Skip if compression does not reduce wire bytes
      if (compressed.byteLength >= rawBuffer.byteLength) {
        return origSend(body);
      }

      const existingEtag = res.getHeader('ETag');
      if (typeof existingEtag === 'string' && !existingEtag.startsWith('W/')) {
        res.setHeader('ETag', `W/${existingEtag}`);
      }

      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Content-Length', compressed.byteLength);
      return origSend(compressed);
    } as Response['send'];

    next();
  };
}
