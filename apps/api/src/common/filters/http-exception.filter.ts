import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  buildErrorEnvelope,
  normalizeError,
  safeStackForLogs,
} from '../errors/error-normalizer';

/**
 * M1-G3 — Global API error normalization.
 *
 * Every failure from any controller/guard/service/pipe is normalized into the
 * shared stable envelope: { statusCode, code, message, fields?, requestId,
 * retryable, retryAfterSeconds }. Detailed internal context is written only to
 * server logs (with the request ID), never to the response body.
 *
 * Deliberate exception: the operational `/health/readiness` endpoint keeps its
 * intentional `{ status: 'down', ... }` payload when the database is
 * unreachable. That endpoint is an infrastructure readiness contract, not a
 * client-facing error surface.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      'unknown';

    if (isReadinessException(request, exception)) {
      const http = exception as HttpException;
      return response.status(http.getStatus()).json(http.getResponse());
    }

    const normalized = normalizeError(exception, request.path);

    if (normalized.statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${normalized.message} | context=${normalized.logContext ?? 'none'} | ${request.method} ${request.path}`,
        safeStackForLogs(exception),
      );
    } else if (normalized.code === 'UNAUTHENTICATED' || normalized.code === 'TOKEN_INVALID' || normalized.code === 'TOKEN_EXPIRED' || normalized.code === 'SESSION_EXPIRED') {
      this.logger.warn(
        `[${requestId}] Authentication failure ${normalized.code} on ${request.method} ${request.path}`,
      );
    }

    const envelope = buildErrorEnvelope(normalized, requestId);

    response.status(normalized.statusCode).json(envelope);
  }
}

function isReadinessException(
  request: Request,
  exception: unknown,
): exception is HttpException {
  return (
    exception instanceof HttpException &&
    exception.getStatus() >= 500 &&
    request.path.endsWith('/readiness') &&
    typeof exception.getResponse() === 'object' &&
    exception.getResponse() !== null &&
    'status' in (exception.getResponse() as Record<string, unknown>)
  );
}
