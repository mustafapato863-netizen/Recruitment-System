import { HttpException, HttpStatus } from '@nestjs/common';
import type {
  ErrorCode,
  ErrorEnvelope,
  ErrorFieldErrors,
} from '@recruitflow/contracts';

/**
 * M1-G3 — Single source of truth for translating any exception thrown inside
 * the API into the shared stable error envelope.
 *
 * Security rules enforced here:
 * - Never expose raw Prisma codes/meta/messages, SQL, stack traces, schema
 *   details, filesystem paths, tokens, passwords, or internal service names.
 * - Preserve HTTP status codes established by existing contracts.
 * - Preserve safe, pre-authored public messages that are part of known
 *   contracts.
 * - Never convert an authorization failure into a successful response.
 * - Tenant-isolation 404/403 behavior must stay a safe, existence-neutral 404.
 */

export const GENERIC_500_MESSAGE =
  'An unexpected server error occurred. Please contact support if the issue persists.';

/** Server log includes the resolved request ID so operators can correlate. */
export const GENERIC_503_MESSAGE =
  'A required service is temporarily unavailable. Please try again shortly.';

const VALIDATION_MESSAGE = 'Please correct the highlighted fields.';
const UNAUTHENTICATED_MESSAGE =
  'Authentication is required. Please sign in to continue.';
const FORBIDDEN_MESSAGE =
  'You do not have permission to perform this action.';
const NOT_FOUND_MESSAGE = 'The requested record or resource was not found.';
const CONFLICT_MESSAGE =
  'The request conflicts with the current state of the resource.';
const FILE_TOO_LARGE_MESSAGE = 'The uploaded file is too large.';
const FILE_INVALID_MESSAGE = 'The uploaded file is invalid or unsupported.';
const TOKEN_INVALID_MESSAGE =
  'Your sign-in token is invalid. Please sign in again.';
const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again to continue.';

/**
 * Legacy machine codes thrown by services before M1-G3 are mapped onto the
 * stable public registry. The existing `message` strings are preserved because
 * they are part of known frontend contracts.
 */
const LEGACY_CODE_MAP: Record<string, ErrorCode> = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INACTIVE_ACCOUNT: 'UNAUTHENTICATED',
  ACCOUNT_LOCKED: 'RATE_LIMITED',
  USER_NOT_FOUND: 'UNAUTHENTICATED',
  INVALID_REFRESH_TOKEN: 'TOKEN_INVALID',
  INVALID_PASSWORD_RESET_TOKEN: 'TOKEN_INVALID',
  INVALID_EMAIL_VERIFICATION_TOKEN: 'TOKEN_INVALID',
  INVALID_VERIFICATION_TOKEN: 'TOKEN_INVALID',
};

const FAIL_SAFE_AUDIT_REASON = 'An unexpected server error occurred';

type PrismaErrorLike = {
  name: string;
  code?: string;
  message?: string;
  meta?: unknown;
};

type MulterErrorLike = {
  name: string;
  code?: string;
  message?: string;
};

type JwtErrorLike = {
  name: string;
  message?: string;
  expiredAt?: Date;
};

function isPrismaKnownError(err: unknown): err is PrismaErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as PrismaErrorLike).name === 'PrismaClientKnownRequestError'
  );
}

function isPrismaValidationError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as PrismaErrorLike).name === 'PrismaClientValidationError'
  );
}

function isPrismaInitError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as PrismaErrorLike).name === 'PrismaClientInitializationError'
  );
}

function isMulterError(err: unknown): err is MulterErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as MulterErrorLike).name === 'MulterError'
  );
}

function isTokenExpiredError(err: unknown): err is JwtErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as JwtErrorLike).name === 'TokenExpiredError'
  );
}

function isJsonWebTokenError(err: unknown): err is JwtErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as JwtErrorLike).name === 'JsonWebTokenError'
  );
}

function stableCodeByStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'INTEGRATION_UNAVAILABLE';
    case HttpStatus.BAD_GATEWAY:
      return 'ASYNC_JOB_FAILED';
    default:
      return 'INTERNAL_ERROR';
  }
}

function isRetryableStatus(status: number): boolean {
  return (
    status === HttpStatus.TOO_MANY_REQUESTS ||
    status === HttpStatus.SERVICE_UNAVAILABLE ||
    status === HttpStatus.BAD_GATEWAY
  );
}

export interface NormalizedError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fields?: ErrorFieldErrors;
  retryable: boolean;
  retryAfterSeconds?: number | null;
  /** Server-side diagnostic context (sanitized). Never returned to clients. */
  logContext?: string;
}

function safeMessage(input: unknown, fallback: string): string {
  let text = '';
  if (typeof input === 'string' && input.trim()) {
    text = input;
  } else if (Array.isArray(input)) {
    const strings = input.filter(
      (item): item is string => typeof item === 'string' && Boolean(item.trim()),
    );
    if (strings.length > 0) text = strings.join(', ');
  }

  if (!text) return fallback;

  if (text.length > 320 || containsUnsafeDiagnostic(text)) {
    return fallback;
  }

  return text;
}

/**
 * Error messages are server-authored today, but they can still accidentally
 * contain runtime diagnostics or secret material when a new integration is
 * added. Keep this check centralized and fail safe for both response messages
 * and persisted audit reasons.
 */
function containsUnsafeDiagnostic(input: string): boolean {
  return [
    /\b(?:prisma|sql|database|query|node_modules)\b/i,
    /\b(?:password|passwd|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|authorization|cookie)\b/i,
    /\b(?:bearer|jwt|stack(?:\s+trace)?|referenceerror|typeerror|exception)\b/i,
    /\b(?:select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from)\b/i,
    /(?:[a-z]:\\|\/home\/|\/usr\/|\/var\/|\/opt\/|\/tmp\/|\/etc\/|file:\/\/)/i,
    /\beyj[a-z0-9_-]{12,}\b/i,
    /\[object\s+object\]/i,
  ].some((pattern) => pattern.test(input));
}

function safeFallbackMessage(status: number, code: ErrorCode): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return VALIDATION_MESSAGE;
    case 'UNAUTHENTICATED':
      return UNAUTHENTICATED_MESSAGE;
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password';
    case 'TOKEN_INVALID':
    case 'TOKEN_EXPIRED':
      return TOKEN_INVALID_MESSAGE;
    case 'SESSION_EXPIRED':
      return SESSION_EXPIRED_MESSAGE;
    case 'FORBIDDEN':
      return FORBIDDEN_MESSAGE;
    case 'NOT_FOUND':
      return NOT_FOUND_MESSAGE;
    case 'CONFLICT':
      return CONFLICT_MESSAGE;
    case 'FILE_TOO_LARGE':
      return FILE_TOO_LARGE_MESSAGE;
    case 'FILE_INVALID':
    case 'FILE_UNSAFE':
      return FILE_INVALID_MESSAGE;
    case 'IMPORT_INVALID':
    case 'IMPORT_CONFLICT':
      return 'The import could not be processed safely.';
    case 'EXPORT_FAILED':
      return 'The export could not be completed. Please try again.';
    case 'ASYNC_JOB_FAILED':
    case 'INTEGRATION_UNAVAILABLE':
      return GENERIC_503_MESSAGE;
    case 'RATE_LIMITED':
      return 'Too many requests. Please try again later.';
    default:
      return status >= 500 ? GENERIC_500_MESSAGE : 'The request could not be completed.';
  }
}

function sanitizeDiagnostic(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) return 'redacted diagnostic';
  const text = input.trim();
  if (containsUnsafeDiagnostic(text)) return 'redacted diagnostic';
  return text.length > 1000 ? `${text.slice(0, 997)}...` : text;
}

export function safeStackForLogs(exception: unknown): string | undefined {
  if (!(exception instanceof Error)) return undefined;
  return sanitizeDiagnostic(exception.stack ?? exception.message);
}

/**
 * Convert an arbitrary exception into the stable envelope used by the global
 * filter and by audit logging. Pure function — performs no I/O and no logging.
 */
export function normalizeError(
  exception: unknown,
  path?: string,
): NormalizedError {
  const requestPath = path ?? '';

  // ── Multer / file upload errors ─────────────────────────────────────────
  if (isMulterError(exception)) {
    if (exception.code === 'LIMIT_FILE_SIZE') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'FILE_TOO_LARGE',
        message: FILE_TOO_LARGE_MESSAGE,
        retryable: false,
        retryAfterSeconds: null,
        logContext: sanitizeDiagnostic(`Multer file size limit exceeded: ${exception.message}`),
      };
    }
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'FILE_INVALID',
      message: FILE_INVALID_MESSAGE,
      retryable: false,
      retryAfterSeconds: null,
      logContext: sanitizeDiagnostic(`Multer upload error: ${exception.message}`),
    };
  }

  // ── Prisma known request errors ─────────────────────────────────────────
  if (isPrismaKnownError(exception)) {
    const code = exception.code;
    const logContext = `Prisma request error (internal code ${code ?? 'unknown'})`;
    switch (code) {
      case 'P2002':
      case 'P2003':
      case 'P2011':
      case 'P2014':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: CONFLICT_MESSAGE,
          retryable: false,
          retryAfterSeconds: null,
          logContext,
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: NOT_FOUND_MESSAGE,
          retryable: false,
          retryAfterSeconds: null,
          logContext,
        };
      case 'P2034':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message:
            'A temporary conflict prevented this request from completing. Please try again.',
          retryable: true,
          retryAfterSeconds: null,
          logContext,
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: GENERIC_500_MESSAGE,
          retryable: false,
          retryAfterSeconds: null,
          logContext,
        };
    }
  }

  // ── Prisma validation errors ────────────────────────────────────────────
  if (isPrismaValidationError(exception)) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: VALIDATION_MESSAGE,
      retryable: false,
      retryAfterSeconds: null,
      logContext: 'Prisma validation error',
    };
  }

  // ── Prisma initialization / connection errors ───────────────────────────
  if (isPrismaInitError(exception)) {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'INTEGRATION_UNAVAILABLE',
      message: GENERIC_503_MESSAGE,
      retryable: true,
      retryAfterSeconds: null,
      logContext: 'Prisma client initialization/connection error',
    };
  }

  // ── JWT expiry / invalidity surfaced by passport strategies ─────────────
  if (isTokenExpiredError(exception)) {
    const onRefresh = requestPath.endsWith('/auth/refresh');
    return {
      statusCode: HttpStatus.UNAUTHORIZED,
      code: onRefresh ? 'SESSION_EXPIRED' : 'TOKEN_EXPIRED',
      message: onRefresh ? SESSION_EXPIRED_MESSAGE : TOKEN_INVALID_MESSAGE,
      retryable: false,
      retryAfterSeconds: null,
      logContext: onRefresh ? 'Refresh token expired' : 'Access token expired',
    };
  }

  if (isJsonWebTokenError(exception)) {
    return {
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'TOKEN_INVALID',
      message: TOKEN_INVALID_MESSAGE,
      retryable: false,
      retryAfterSeconds: null,
      logContext: 'JWT validation failed',
    };
  }

  // ── NestJS HttpException (controllers, services, guards, pipes) ─────────
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();

    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return {
        statusCode: status,
        code: 'FILE_TOO_LARGE',
        message: FILE_TOO_LARGE_MESSAGE,
        retryable: false,
        retryAfterSeconds: null,
        logContext: 'Upload payload exceeded the configured file size limit',
      };
    }

    if (typeof res === 'string') {
      const code = stableCodeByStatus(status);
      return {
        statusCode: status,
        code,
        message: status >= 500
          ? code === 'INTEGRATION_UNAVAILABLE'
            ? GENERIC_503_MESSAGE
            : GENERIC_500_MESSAGE
          : safeMessage(res, safeFallbackMessage(status, code)),
        retryable: isRetryableStatus(status),
        retryAfterSeconds: null,
        ...(status >= 500
          ? { logContext: `HttpException (${status}) with plain message` }
          : {}),
      };
    }

    if (typeof res === 'object' && res !== null) {
      const resObj = res as Record<string, unknown>;

      const bodyCode =
        typeof resObj.code === 'string' ? resObj.code : undefined;
      const stableCode: ErrorCode | null = resolveStableCode(
        bodyCode,
        status,
      );

      const hasFieldErrors = isFieldErrors(resObj.fields);
      const fields = hasFieldErrors
        ? (resObj.fields as ErrorFieldErrors)
        : undefined;

      const rawMessage = Array.isArray(resObj.message)
        ? resObj.message
        : typeof resObj.message === 'string'
          ? resObj.message
          : undefined;

      let message: string;
      if (status >= 500) {
        message =
          stableCode === 'INTEGRATION_UNAVAILABLE'
            ? GENERIC_503_MESSAGE
            : GENERIC_500_MESSAGE;
      } else if (hasFieldErrors) {
        message = VALIDATION_MESSAGE;
      } else if (rawMessage !== undefined) {
        message = safeMessage(rawMessage, safeFallbackMessage(status, stableCode));
      } else if (stableCode === 'VALIDATION_ERROR') {
        message = VALIDATION_MESSAGE;
      } else if (status === HttpStatus.UNAUTHORIZED) {
        message = UNAUTHENTICATED_MESSAGE;
      } else if (status === HttpStatus.FORBIDDEN) {
        message = FORBIDDEN_MESSAGE;
      } else {
        message = GENERIC_500_MESSAGE;
      }

      const retryAfter =
        typeof resObj.retryAfterSeconds === 'number'
          ? resObj.retryAfterSeconds
          : typeof resObj.retryAfterSeconds === 'string' &&
              /^\d+$/.test(resObj.retryAfterSeconds)
            ? Number(resObj.retryAfterSeconds)
            : undefined;

      const retryable =
        typeof resObj.retryable === 'boolean'
          ? resObj.retryable
          : stableCode === 'RATE_LIMITED' ||
            status === HttpStatus.TOO_MANY_REQUESTS ||
            (status >= 500 && status <= 599 && retryable5xx(stableCode));

      return {
        statusCode: status,
        code: stableCode,
        message,
        ...(hasFieldErrors && fields ? { fields } : {}),
        retryable,
        retryAfterSeconds:
          retryAfter ?? (status === HttpStatus.TOO_MANY_REQUESTS ? null : null),
        ...(status >= 500
          ? { logContext: `HttpException (${status}) code=${stableCode}` }
          : {}),
      };
    }

    // Defensive fallback for exotic HttpException shapes.
    return {
      statusCode: status,
      code: stableCodeByStatus(status),
      message:
        status === HttpStatus.UNAUTHORIZED
          ? UNAUTHENTICATED_MESSAGE
          : GENERIC_500_MESSAGE,
      retryable: isRetryableStatus(status),
      retryAfterSeconds:
        status === HttpStatus.TOO_MANY_REQUESTS ? null : null,
    };
  }

  // ── Unknown runtime errors ──────────────────────────────────────────────
  if (exception instanceof Error) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: GENERIC_500_MESSAGE,
      retryable: false,
      retryAfterSeconds: null,
      logContext: sanitizeDiagnostic(exception.message || exception.name),
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: GENERIC_500_MESSAGE,
    retryable: false,
    retryAfterSeconds: null,
    logContext: 'Unknown non-Error exception',
  };
}

function retryable5xx(code: ErrorCode): boolean {
  return (
    code === 'INTEGRATION_UNAVAILABLE' ||
    code === 'ASYNC_JOB_FAILED' ||
    code === 'EXPORT_FAILED'
  );
}

function resolveStableCode(
  bodyCode: string | undefined,
  status: number,
): ErrorCode {
  if (bodyCode) {
    const direct = LEGACY_CODE_MAP[bodyCode];
    if (direct) return direct;
    if (isStableCode(bodyCode)) return bodyCode as ErrorCode;
  }
  return stableCodeByStatus(status);
}

function isStableCode(value: string): boolean {
  const stableCodes: readonly string[] = [
    'VALIDATION_ERROR',
    'UNAUTHENTICATED',
    'SESSION_EXPIRED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'INVALID_CREDENTIALS',
    'TOKEN_INVALID',
    'TOKEN_EXPIRED',
    'FILE_INVALID',
    'FILE_TOO_LARGE',
    'FILE_UNSAFE',
    'IMPORT_INVALID',
    'IMPORT_CONFLICT',
    'EXPORT_FAILED',
    'ASYNC_JOB_FAILED',
    'INTEGRATION_UNAVAILABLE',
    'INTERNAL_ERROR',
  ];
  return stableCodes.includes(value);
}

function isFieldErrors(value: unknown): value is ErrorFieldErrors {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (item) =>
        Array.isArray(item) && item.every((entry) => typeof entry === 'string'),
    )
  );
}

/** Builds the exact public envelope emitted to API clients. */
export function buildErrorEnvelope(normalized: NormalizedError, requestId: string): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    statusCode: normalized.statusCode,
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    retryAfterSeconds: normalized.retryAfterSeconds ?? null,
    requestId,
  };
  if (normalized.fields && Object.keys(normalized.fields).length > 0) {
    envelope.fields = normalized.fields;
  }
  return envelope;
}

/**
 * Safe human-readable reason for audit-log persistence. Never exposes Prisma
 * codes, SQL, or raw stack text to the audit record.
 */
export function auditReasonFrom(exception: unknown): string {
  const normalized = normalizeError(exception);
  if (normalized.code === 'INTERNAL_ERROR') return FAIL_SAFE_AUDIT_REASON;
  return normalized.message;
}
