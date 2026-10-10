const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export interface ErrorFieldErrors {
  [field: string]: string[];
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;
  readonly code?: string;
  readonly fields?: ErrorFieldErrors;
  readonly requestId?: string;
  readonly retryable?: boolean;
  readonly retryAfterSeconds?: number | null;

  constructor(
    statusCode: number,
    message: string,
    details?: unknown,
    meta?: {
      code?: string;
      fields?: ErrorFieldErrors;
      requestId?: string;
      retryable?: boolean;
      retryAfterSeconds?: number | null;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = meta?.code;
    this.fields = meta?.fields;
    this.requestId = meta?.requestId;
    this.retryable = meta?.retryable;
    this.retryAfterSeconds = meta?.retryAfterSeconds;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

interface ErrorEnvelopeBody {
  statusCode?: number;
  code?: string;
  error?: string;
  message?: string | string[];
  fields?: ErrorFieldErrors;
  requestId?: string;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
}

function normalizeFieldErrors(value: unknown): ErrorFieldErrors | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const result: ErrorFieldErrors = {};
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item) && item.every((entry) => typeof entry === 'string')) {
      result[key] = item;
    } else if (typeof item === 'string') {
      result[key] = [item];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** 403 codes from B1 ownership checks whose server message is shown as-is. */
const OWNERSHIP_403_CODES = new Set(['JOB_NOT_OWNED', 'FILE_NOT_OWNED', 'ADMIN_CANNOT_REASSIGN', 'OWNER_NOT_ELIGIBLE', 'DOCUMENT_DOWNLOAD_DENIED']);

/**
 * QA BUG-1: on #4 the global error normalizer only passes registry codes
 * (packages/contracts `errorCodes`), so B1 domain codes reach the client as
 * `code: "FORBIDDEN"` (403) or `"VALIDATION_ERROR"` (400) while the server
 * `message` is kept. Recover the domain code from the exact #4 messages so each
 * branch still triggers; a raw domain code (if Backend adds them to the
 * registry) is used as-is.
 */
const B1_MESSAGE_CODES: ReadonlyArray<[number, string, string]> = [
  [403, 'Access denied: this file belongs to another owner.', 'FILE_NOT_OWNED'],
  [403, 'Access denied: you are not approving a file for this candidate.', 'FILE_NOT_OWNED'],
  [403, 'Access denied: this job belongs to another owner.', 'JOB_NOT_OWNED'],
  [403, 'Administrators cannot assign or reassign file owners.', 'ADMIN_CANNOT_REASSIGN'],
  [403, 'Administrators cannot reassign a job owner.', 'ADMIN_CANNOT_REASSIGN'],
  [403, 'Access denied: downloading this document requires DOWNLOAD_DOCUMENTS, or a pending approval on this candidate (CV only).', 'DOCUMENT_DOWNLOAD_DENIED'],
  [400, 'Owner must be a user in this organization.', 'OWNER_NOT_ELIGIBLE'],
  [400, 'An inactive user cannot own a job or file.', 'OWNER_NOT_ELIGIBLE'],
  [400, 'An administrator cannot own a job or file.', 'OWNER_NOT_ELIGIBLE'],
];

export function resolveDomainCode(status: number, code: string | undefined, message: unknown): string | undefined {
  if (code && OWNERSHIP_403_CODES.has(code)) return code;
  if (typeof message !== 'string') return code;
  const text = message.trim();
  const hit = B1_MESSAGE_CODES.find(([s, m]) => s === status && m === text);
  return hit ? hit[2] : code;
}

let refreshPromise: Promise<boolean> | null = null;

function shouldRefreshSession(path: string): boolean {
  return !['/auth/login', '/auth/logout', '/auth/refresh'].includes(path);
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function handleResponseError(response: Response, path: string): Promise<never> {
  const problem = (await response.json().catch(() => null)) as ErrorEnvelopeBody | null;
  const code = resolveDomainCode(
    response.status,
    typeof problem?.code === 'string' && problem.code ? problem.code : undefined,
    problem?.message,
  );
  const fields = normalizeFieldErrors(problem?.fields);
  const requestId =
    response.headers.get('X-Request-Id') ??
    (typeof problem?.requestId === 'string' && problem.requestId ? problem.requestId : undefined);
  const retryableBody =
    typeof problem?.retryable === 'boolean' ? problem.retryable : undefined;
  const retryAfterSeconds =
    typeof problem?.retryAfterSeconds === 'number' ? problem.retryAfterSeconds : undefined;
  let message: string;

  if (response.status === 401) {
    if (code === 'INVALID_CREDENTIALS') {
      message = typeof problem?.message === 'string' && problem.message.trim()
        ? problem.message
        : 'The email or password is incorrect.';
    } else if (code === 'SESSION_EXPIRED' || code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') {
      message = 'Your session has expired. Please sign in again to continue.';
    } else {
      message = 'Your session has expired or authentication is required. Please sign in to continue.';
    }
    if (typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { path } }));
    }
  } else if (response.status === 403) {
    if (code === 'ACCOUNT_LOCKED') {
      const minutes = typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.ceil(retryAfterSeconds / 60)
        : null;
      message = 'Sign-in is temporarily locked after too many failed attempts.';
      message += minutes !== null
        ? ` Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
        : ' Please try again later.';
    } else if (code && OWNERSHIP_403_CODES.has(code) && typeof problem?.message === 'string' && problem.message.trim()) {
      // B1: ownership denials carry a specific, user-safe message.
      message = problem.message.trim();
    } else {
      message = 'Access denied: you do not have permission to perform this action.';
    }
  } else if (Array.isArray(problem?.message)) {
    message = problem.message.join(', ');
  } else if (typeof problem?.message === 'string' && problem.message.trim() && problem.message !== 'Unauthorized') {
    message = problem.message;
  } else if (response.status === 404) {
    message = 'The requested resource was not found.';
  } else {
    message = `Request failed with status ${response.status}`;
  }

  if (fields && Object.keys(fields).length > 0) {
    const fieldDetails = Object.entries(fields)
      .map(([field, fieldMsg]) => `${field}: ${Array.isArray(fieldMsg) ? fieldMsg.join(', ') : fieldMsg}`)
      .join(', ');
    if (message.endsWith('.')) {
      message = `${message.slice(0, -1)} (${fieldDetails}).`;
    } else {
      message = `${message} (${fieldDetails})`;
    }
  }

  throw new ApiError(response.status, message, problem, {
    code,
    fields,
    requestId,
    retryable: retryableBody,
    retryAfterSeconds,
  });
}

export async function fetchApi<T>(path: string, options?: RequestInit, allowRefresh = true): Promise<T> {
  const requestHeaders = new Headers(options?.headers);
  if (!(options?.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: requestHeaders,
    credentials: 'include',
  });

  if (response.status === 401 && allowRefresh && shouldRefreshSession(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchApi<T>(path, options, false);
    }
  }

  if (!response.ok) {
    return handleResponseError(response, path);
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function getApi<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'GET' });
}

export function postApi<T>(path: string, body?: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function postFormDataApi<T>(path: string, formData: FormData): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: formData,
  });
}

/** Blob download that also returns the filename from Content-Disposition. */
export async function downloadFileApi(path: string, fallbackName = 'download', allowRefresh = true): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', credentials: 'include' });
  if (response.status === 401 && allowRefresh && shouldRefreshSession(path)) {
    if (await refreshAccessToken()) return downloadFileApi(path, fallbackName, false);
  }
  if (!response.ok) return handleResponseError(response, path);
  return { blob: await response.blob(), filename: filenameFromDisposition(response.headers.get('Content-Disposition')) ?? fallbackName };
}

export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch { /* fall through */ }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

export async function downloadApi(path: string, allowRefresh = true): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401 && allowRefresh && shouldRefreshSession(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return downloadApi(path, false);
    }
  }

  if (!response.ok) {
    return handleResponseError(response, path);
  }
  return response.blob();
}

export function patchApi<T>(path: string, body?: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function putApi<T>(path: string, body?: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function deleteApi<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'DELETE' });
}
