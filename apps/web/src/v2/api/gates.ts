/**
 * B5 (#11) gates. The API answers a blocked move with 409 and a GATE_* code, but
 * #11's global error normalizer only passes registry codes, so on the wire the
 * body is { statusCode: 409, code: 'CONFLICT', message } (gate/missing dropped).
 * gateFromError() accepts the raw code if Backend registers it, else maps #11's
 * exact messages. Room/interviewer/scorecard 400/409 codes are mapped the same way.
 */
export const GATE_CODES = ['GATE_SCREEN_NOTE_MISSING', 'GATE_SCORECARD_NOT_SUBMITTED', 'GATE_OFFER_NOT_ACCEPTED', 'GATE_JOINING_CHECKS_INCOMPLETE', 'GATE_REJECT_REASON_REQUIRED'] as const;
export type GateCode = (typeof GATE_CODES)[number];
export type DomainCode = GateCode | 'ROOM_REQUIRED' | 'ROOM_URL_INVALID' | 'ROOM_URL_NOT_HTTPS' | 'ROOM_URL_HOST_NOT_ALLOWED'
  | 'INTERVIEWER_REQUIRED' | 'INTERVIEWER_NOT_A_USER' | 'SCORECARD_ALREADY_SUBMITTED' | 'SCORECARD_NOT_SUBMITTED' | 'REVISION_REASON_REQUIRED' | 'WITHDRAWN_NOT_AN_EXIT';

/** Clear inline copy per gate (v2 §8). */
export const GATE_COPY: Record<GateCode, { gate: string; message: string; fix: string }> = {
  GATE_SCREEN_NOTE_MISSING: { gate: 'Screen note', message: 'Interview needs a saved screen note.', fix: 'Log the screen with a note first.' },
  GATE_SCORECARD_NOT_SUBMITTED: { gate: 'Scorecard', message: 'Offer needs a submitted interview scorecard.', fix: 'Submit or chase the scorecard first.' },
  GATE_OFFER_NOT_ACCEPTED: { gate: 'Offer accepted', message: 'Pre-hire needs an accepted offer.', fix: 'Record the candidate\'s acceptance first.' },
  GATE_JOINING_CHECKS_INCOMPLETE: { gate: 'Joining checks', message: 'Joined needs ID, contract and SCFHS licence checked.', fix: 'Check all three in the pre-hire checklist.' },
  GATE_REJECT_REASON_REQUIRED: { gate: 'Reject reason', message: 'Rejected needs a reason from the rejection reasons list.', fix: 'Pick a reason.' },
};

const BY_MESSAGE: Array<[RegExp, DomainCode]> = [
  [/^Interview needs a saved screen note\.$/, 'GATE_SCREEN_NOTE_MISSING'],
  [/^Offer needs a submitted interview scorecard\.$/, 'GATE_SCORECARD_NOT_SUBMITTED'],
  [/^Pre-Hire needs an accepted offer\.$/, 'GATE_OFFER_NOT_ACCEPTED'],
  [/^Joined needs ID, contract and SCFHS licence checked\./, 'GATE_JOINING_CHECKS_INCOMPLETE'],
  [/^Rejected needs a reason from the rejection reasons list\.$/, 'GATE_REJECT_REASON_REQUIRED'],
  [/is not in the rejection reasons list\.$/, 'GATE_REJECT_REASON_REQUIRED'],
  [/^Add a meeting room URL \(online\) or a physical room\.$/, 'ROOM_REQUIRED'],
  [/^The meeting link is not a valid URL\.$/, 'ROOM_URL_INVALID'],
  [/^The meeting link must use https\.$/, 'ROOM_URL_NOT_HTTPS'],
  [/^The meeting link must be on an approved meeting host/, 'ROOM_URL_HOST_NOT_ALLOWED'],
  [/^Add at least one interviewer/, 'INTERVIEWER_REQUIRED'],
  [/^(Interviewers must be users|Every interviewer must be an active user)/, 'INTERVIEWER_NOT_A_USER'],
  [/^This scorecard was submitted and cannot be edited/, 'SCORECARD_ALREADY_SUBMITTED'],
  [/^Only a submitted scorecard can be revised/, 'SCORECARD_NOT_SUBMITTED'],
  [/^A reason is required to revise a scorecard\.$/, 'REVISION_REASON_REQUIRED'],
  [/^Withdrawn is not a manual exit\./, 'WITHDRAWN_NOT_AN_EXIT'],
];

export interface DomainError { code: DomainCode; message: string; missing?: string[]; gate?: GateCode }

export function gateFromError(error: unknown): DomainError | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: unknown; message?: unknown; details?: unknown; statusCode?: unknown };
  const details = (e.details && typeof e.details === 'object' ? e.details : {}) as { code?: unknown; message?: unknown; missing?: unknown };
  const raw = typeof e.code === 'string' ? e.code : typeof details.code === 'string' ? details.code : undefined;
  const message = typeof details.message === 'string' ? details.message : typeof e.message === 'string' ? e.message : '';
  let code: DomainCode | undefined;
  if (raw && (GATE_CODES as readonly string[]).includes(raw)) code = raw as DomainCode;
  else if (raw && BY_MESSAGE.some(([, c]) => c === raw)) code = raw as DomainCode;
  else code = BY_MESSAGE.find(([re]) => re.test(message.trim()))?.[1];
  if (!code) return null;
  const missingFromMsg = /Missing: (.+)\.$/.exec(message)?.[1]?.split(', ');
  const missing = Array.isArray(details.missing) ? (details.missing as string[]) : missingFromMsg;
  const isGate = (GATE_CODES as readonly string[]).includes(code);
  return { code, message: message || (isGate ? GATE_COPY[code as GateCode].message : ''), ...(missing ? { missing } : {}), ...(isGate ? { gate: code as GateCode } : {}) };
}

/** Same matching as #11's JOINING_CHECKS. */
export const JOINING_CHECKS = [
  { key: 'id', label: 'ID', match: /(^|[^a-z])(id|identity|passport|emirates id|national id|iqama)([^a-z]|$)/i },
  { key: 'contract', label: 'Contract', match: /contract/i },
  { key: 'licence', label: 'SCFHS licence', match: /scfhs|licen[cs]e/i },
] as const;

export const SYSTEM_REJECTION_REASONS = ['Requisition cancelled', 'Declined offer', 'Withdrawn by candidate'];
export const WITHDRAWN_BY_CANDIDATE_REASON = 'Withdrawn by candidate';
