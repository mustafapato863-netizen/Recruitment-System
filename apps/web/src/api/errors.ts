import { ApiError } from './client';

export interface ErrorFieldErrors {
  [field: string]: string[];
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

export function getErrorFields(error: unknown): ErrorFieldErrors | undefined {
  return error instanceof ApiError ? error.fields : undefined;
}

export function getFieldError(error: unknown, field: string): string | undefined {
  const fields = getErrorFields(error);
  const messages = fields?.[field];
  return Array.isArray(messages) ? messages.find(Boolean) : undefined;
}

export function getRequestId(error: unknown): string | undefined {
  return error instanceof ApiError ? error.requestId : undefined;
}

export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && error.retryable === true;
}

export function retryAfterMs(error: unknown): number | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (typeof error.retryAfterSeconds === 'number' && error.retryAfterSeconds > 0) {
    return Math.max(0, Math.floor(error.retryAfterSeconds) - 1) * 1000;
  }
  return undefined;
}