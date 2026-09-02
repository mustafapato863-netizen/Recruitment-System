import {
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ErrorCode, ErrorFieldErrors } from '@recruitflow/contracts';

/**
 * M1-G3 — Authoring helpers for throwing stable-coded exceptions from
 * controllers and services. All returned exceptions carry the shared envelope
 * fields (`statusCode`, `code`, `message`) so the global filter normalizes
 * them losslessly while preserving the safe public message.
 */

export interface ApiExceptionBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fields?: ErrorFieldErrors;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
}

export function apiException(
  statusCode: HttpStatus,
  code: ErrorCode,
  message: string,
  extra: Partial<Pick<ApiExceptionBody, 'fields' | 'retryable' | 'retryAfterSeconds'>> = {},
): HttpException {
  return new HttpException(
    {
      statusCode,
      code,
      message,
      retryable: extra.retryable ?? false,
      retryAfterSeconds: extra.retryAfterSeconds ?? null,
      ...(extra.fields ? { fields: extra.fields } : {}),
    },
    statusCode,
  );
}

export function badRequest(
  code: ErrorCode,
  message: string,
  fields?: ErrorFieldErrors,
): HttpException {
  return apiException(HttpStatus.BAD_REQUEST, code, message, {
    ...(fields ? { fields } : {}),
  });
}

export function fileInvalid(message: string): HttpException {
  return badRequest('FILE_INVALID', message);
}

export function fileTooLarge(message: string): HttpException {
  return badRequest('FILE_TOO_LARGE', message);
}

export function fileUnsafe(message: string): HttpException {
  return badRequest('FILE_UNSAFE', message);
}

export function importInvalid(message: string, fields?: ErrorFieldErrors): HttpException {
  return badRequest('IMPORT_INVALID', message, fields);
}

export function importConflict(message: string): HttpException {
  return apiException(HttpStatus.CONFLICT, 'IMPORT_CONFLICT', message);
}

export function exportFailed(message: string, retryable = false): HttpException {
  return apiException(HttpStatus.BAD_GATEWAY, 'EXPORT_FAILED', message, {
    retryable,
  });
}

export function asyncJobFailed(message: string, retryable = true): HttpException {
  return apiException(HttpStatus.BAD_GATEWAY, 'ASYNC_JOB_FAILED', message, {
    retryable,
  });
}

export function integrationUnavailable(
  message: string,
  retryable = true,
  retryAfterSeconds?: number,
): HttpException {
  return apiException(HttpStatus.SERVICE_UNAVAILABLE, 'INTEGRATION_UNAVAILABLE', message, {
    retryable,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  });
}