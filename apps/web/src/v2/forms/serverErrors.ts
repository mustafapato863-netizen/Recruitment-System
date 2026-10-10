import { ApiError } from '../../api/client';

/**
 * Backend batch 2 (#21/#23, B2-15/B2-7): every 400 carries
 * - `fields`: { "<dotted path>": string[] } for each offending input ("basePay", "allowances.0.amount", "note"),
 * - `field`: the first offending path (also set alone by domain 400s such as REASON_REQUIRED {field:'note'}).
 * Forms show those messages inline on the matching inputs; whatever no input claims stays in the form banner.
 */
export interface ServerFormErrors {
  /** dotted path → message (fields[] joined; a lone `field` gets the error message). */
  byField: Record<string, string>;
  /** The error's own message (without the client's "(field: msg)" suffix). */
  message: string | null;
  code: string | null;
}

export const NO_SERVER_ERRORS: ServerFormErrors = { byField: {}, message: null, code: null };

const envelope = (e: unknown): Record<string, unknown> | null => {
  if (!(e instanceof ApiError)) return null;
  return e.details && typeof e.details === 'object' && !Array.isArray(e.details) ? (e.details as Record<string, unknown>) : null;
};

export function serverFormErrors(e: unknown): ServerFormErrors {
  if (!e) return NO_SERVER_ERRORS;
  const env = envelope(e);
  const raw = typeof env?.message === 'string' && env.message.trim() ? env.message.trim() : e instanceof Error ? e.message : null;
  const byField: Record<string, string> = {};
  const fields = e instanceof ApiError ? e.fields : undefined;
  if (fields) for (const [k, v] of Object.entries(fields)) {
    const text = (Array.isArray(v) ? v : [v]).filter((s) => typeof s === 'string' && s.trim()).join(' ');
    if (text) byField[k] = text;
  }
  const one = typeof env?.field === 'string' ? env.field : null;
  if (one && !byField[one] && raw) byField[one] = raw;
  return { byField, message: raw, code: e instanceof ApiError ? e.code ?? null : null };
}

/** The message for an input: exact path first, then any nested path under it ("allowances" ← "allowances.0.amount"). */
export function fieldError(errs: ServerFormErrors | null | undefined, ...names: string[]): string | undefined {
  if (!errs) return undefined;
  for (const n of names) if (errs.byField[n]) return errs.byField[n];
  for (const n of names) {
    const hit = Object.keys(errs.byField).find((k) => k.startsWith(`${n}.`));
    if (hit) return errs.byField[hit];
  }
  return undefined;
}

/**
 * Banner text once the inputs in `shown` have taken their messages: null when every server message
 * landed on an input, else the error message (so nothing is ever silently dropped).
 */
export function bannerError(errs: ServerFormErrors | null | undefined, shown: readonly string[]): string | null {
  if (!errs || !errs.message) return null;
  const keys = Object.keys(errs.byField);
  if (!keys.length) return errs.message;
  const claimed = (k: string) => shown.some((n) => k === n || k.startsWith(`${n}.`));
  return keys.every(claimed) ? null : errs.message;
}
