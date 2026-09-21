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

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (isApiError(error)) {
    const message = error.message?.trim();
    if (message) return message;
  }
  if (error instanceof Error) {
    const message = error.message?.trim();
    if (message) return message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return fallback;
}

export type FeedbackToastTone = 'success' | 'error' | 'info' | 'warning';

export interface FeedbackToast {
  tone: FeedbackToastTone;
  title: string;
  message?: string;
  duration?: number;
}

export function toErrorToast(error: unknown, title = 'Request failed'): FeedbackToast {
  const message = getErrorMessage(error);
  const requestId = getRequestId(error);
  return {
    tone: 'error',
    title,
    message: requestId ? `${message} (ref ${requestId})` : message,
    duration: isRetryable(error) ? 8000 : 6000,
  };
}

export function toSuccessToast(title: string, message?: string): FeedbackToast {
  return { tone: 'success', title, message };
}

export function toWarningToast(title: string, message?: string): FeedbackToast {
  return { tone: 'warning', title, message };
}

export function toInfoToast(title: string, message?: string): FeedbackToast {
  return { tone: 'info', title, message };
}

