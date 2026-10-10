/**
 * B5 (#11 @e2f1296) gates and domain errors. The shared registry in @recruitflow/contracts
 * is now the error normalizer's allowlist, so every custom code (GATE_*, room, scorecard,
 * offer, B3, B6, B7) reaches the client as `code`, and gate 409s also carry
 * `{ gate, missing[] }`. No message matching: we read the code.
 */
export const GATE_CODES = ['GATE_SCREEN_NOTE_MISSING', 'GATE_SCORECARD_NOT_SUBMITTED', 'GATE_OFFER_NOT_ACCEPTED', 'GATE_JOINING_CHECKS_INCOMPLETE', 'GATE_REJECT_REASON_REQUIRED'] as const;
export type GateCode = (typeof GATE_CODES)[number];

/** Clear inline copy per gate (v2 §8). */
export const GATE_COPY: Record<GateCode, { gate: string; message: string; fix: string }> = {
  GATE_SCREEN_NOTE_MISSING: { gate: 'Screen note', message: 'Interview needs a saved screen note.', fix: 'Log the screen with a note first.' },
  GATE_SCORECARD_NOT_SUBMITTED: { gate: 'Scorecard', message: 'Offer needs a submitted interview scorecard.', fix: 'Submit or chase the scorecard first.' },
  GATE_OFFER_NOT_ACCEPTED: { gate: 'Offer accepted', message: 'Pre-hire needs an accepted offer.', fix: 'Record the candidate\'s acceptance first.' },
  GATE_JOINING_CHECKS_INCOMPLETE: { gate: 'Joining checks', message: 'Joined needs ID, contract and SCFHS licence verified.', fix: 'Verify all three in the pre-hire checklist.' },
  GATE_REJECT_REASON_REQUIRED: { gate: 'Reject reason', message: 'Rejected needs a reason from the rejection reasons list.', fix: 'Pick a reason.' },
};

/** Registry codes that only say "generic failure": not a domain answer. */
const GENERIC = new Set(['VALIDATION_ERROR', 'UNAUTHENTICATED', 'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED', 'INTERNAL_ERROR', 'INTEGRATION_UNAVAILABLE', 'TOKEN_INVALID', 'TOKEN_EXPIRED']);

export interface DomainError { code: string; message: string; statusCode?: number; gate?: GateCode; gateKey?: string; missing?: string[] }

/** The domain code of an ApiError (or null for generic/unknown failures). */
export function domainError(error: unknown): DomainError | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: unknown; message?: unknown; statusCode?: unknown; gate?: unknown; missing?: unknown; details?: unknown };
  const body = (e.details && typeof e.details === 'object' ? e.details : {}) as { code?: unknown; message?: unknown; gate?: unknown; missing?: unknown };
  const code = typeof e.code === 'string' ? e.code : typeof body.code === 'string' ? body.code : undefined;
  if (!code || GENERIC.has(code)) return null;
  const message = typeof body.message === 'string' ? body.message : typeof e.message === 'string' ? e.message : '';
  const missingRaw = Array.isArray(e.missing) ? e.missing : Array.isArray(body.missing) ? body.missing : undefined;
  const gateKey = typeof e.gate === 'string' ? e.gate : typeof body.gate === 'string' ? body.gate : undefined;
  const isGate = (GATE_CODES as readonly string[]).includes(code);
  return {
    code, message, ...(typeof e.statusCode === 'number' ? { statusCode: e.statusCode } : {}),
    ...(isGate ? { gate: code as GateCode } : {}), ...(gateKey ? { gateKey } : {}),
    ...(missingRaw ? { missing: missingRaw.filter((m): m is string => typeof m === 'string') } : {}),
  };
}
/** @deprecated name kept for call sites; same as domainError. */
export const gateFromError = domainError;

/** B5 typed joining checks (gate 4). */
export const JOINING_CHECK_TYPES = [
  { type: 'ID', label: 'ID' },
  { type: 'CONTRACT', label: 'Contract' },
  { type: 'SCFHS_LICENCE', label: 'SCFHS licence' },
] as const;
export type JoiningCheckType = (typeof JOINING_CHECK_TYPES)[number]['type'];

export const SYSTEM_REJECTION_REASONS = ['Requisition cancelled', 'Declined offer', 'Withdrawn by candidate'];
export const WITHDRAWN_BY_CANDIDATE_REASON = 'Withdrawn by candidate';
