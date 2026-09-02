import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * M1-G3 — Safe request/correlation ID middleware.
 *
 * An inbound `x-correlation-id` or `x-request-id` is accepted only when it is
 * strictly bounded (maximum length, printable safe characters, no CRLF or
 * control characters). Unsafe or missing inbound values are replaced with a
 * generated server-side ID. The resolved ID is mirrored to both
 * `X-Request-Id` and the legacy `x-correlation-id` response headers and is
 * echoed in the JSON error envelope by the global exception filter.
 */

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]{1,100}$/;
const MAX_INBOUND_LENGTH = 100;

function isSafeInboundRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_INBOUND_LENGTH &&
    SAFE_REQUEST_ID_PATTERN.test(value)
  );
}

function generateRequestId(): string {
  return `req_${randomUUID()}`;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const inbound =
      req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
    const requestId = isSafeInboundRequestId(inbound)
      ? inbound
      : generateRequestId();

    req.headers['x-request-id'] = requestId;
    req.headers['x-correlation-id'] = requestId;

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('x-correlation-id', requestId);
    next();
  }
}