import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';

/**
 * B5 (v2 §3 "Gates: five API checks", §8 table). Server-side, independent of
 * the configurable pipeline. Each blocked move is a 409 naming the gate.
 *
 *  # | From                 | To        | v2 requires                               | code
 *  1 | Applied or Screening | Interview | Screen note saved                         | GATE_SCREEN_NOTE_MISSING
 *  2 | Interview            | Offer     | Scorecard submitted                       | GATE_SCORECARD_NOT_SUBMITTED
 *  3 | Offer                | Pre-Hire  | (blank in v2) -> accepted offer version   | GATE_OFFER_NOT_ACCEPTED
 *  4 | Pre-Hire             | Joined    | ID, contract and SCFHS licence checked    | GATE_JOINING_CHECKS_INCOMPLETE
 *  5 | any open stage       | Rejected  | Reason (from rejection-reasons list)      | GATE_REJECT_REASON_REQUIRED
 */
export const GATE_CODES = {
  screenNote: 'GATE_SCREEN_NOTE_MISSING',
  scorecard: 'GATE_SCORECARD_NOT_SUBMITTED',
  offer: 'GATE_OFFER_NOT_ACCEPTED',
  joining: 'GATE_JOINING_CHECKS_INCOMPLETE',
  rejectReason: 'GATE_REJECT_REASON_REQUIRED',
} as const;

export const DECLINED_OFFER_REASON = 'Declined offer';
export const REQUISITION_CANCELLED_REASON = 'Requisition cancelled';
export const WITHDRAWN_BY_CANDIDATE_REASON = 'Withdrawn by candidate';

/** Always valid even before an org's master data is seeded. */
export const SYSTEM_REJECTION_REASONS = [REQUISITION_CANCELLED_REASON, DECLINED_OFFER_REASON, WITHDRAWN_BY_CANDIDATE_REASON];

export const JOINING_CHECKS = [
  { key: 'id', label: 'ID', match: /(^|[^a-z])(id|identity|passport|emirates id|national id|iqama)([^a-z]|$)/i },
  { key: 'contract', label: 'contract', match: /contract/i },
  { key: 'licence', label: 'SCFHS licence', match: /scfhs|licen[cs]e/i },
] as const;

type Tx = Prisma.TransactionClient;

function blocked(code: string, gate: string, message: string, missing?: string[]): ConflictException {
  return new ConflictException({ code, gate, message, ...(missing ? { missing } : {}) });
}

export async function missingJoiningChecks(tx: Tx, applicationId: string): Promise<string[]> {
  const reqs = await tx.complianceRequirement.findMany({
    where: { hiringCase: { applicationId } },
    select: { name: true, status: true },
  });
  return JOINING_CHECKS.filter((check) => !reqs.some((r) => r.status === 'Verified' && check.match.test(r.name))).map((c) => c.label);
}

export async function assertJoiningChecks(tx: Tx, applicationId: string): Promise<void> {
  const missing = await missingJoiningChecks(tx, applicationId);
  if (missing.length) {
    throw blocked(GATE_CODES.joining, 'Joining checks', `Joined needs ID, contract and SCFHS licence checked. Missing: ${missing.join(', ')}.`, missing);
  }
}

/** Resolves a rejection reason against the org's active list (plus the system reasons). */
export async function resolveRejectionReason(tx: Tx, organizationId: string, reason: string | null | undefined): Promise<string> {
  const text = reason?.trim() ?? '';
  if (!text) throw blocked(GATE_CODES.rejectReason, 'Reject reason', 'Rejected needs a reason from the rejection reasons list.');
  const system = SYSTEM_REJECTION_REASONS.find((r) => r.toLowerCase() === text.toLowerCase());
  if (system) return system;
  const value = await tx.masterDataValue.findFirst({
    where: { organizationId, category: 'rejection-reasons', status: 'Active', OR: [{ name: { equals: text, mode: 'insensitive' } }, { code: { equals: text, mode: 'insensitive' } }] },
    select: { name: true },
  });
  if (!value) throw blocked(GATE_CODES.rejectReason, 'Reject reason', `"${text}" is not in the rejection reasons list.`);
  return value.name;
}

/** Gates 1-4 for a forward move. Gate 5 (reject) is resolveRejectionReason. */
export async function assertStageGate(tx: Tx, application: { id: string; stage: string }, to: string): Promise<void> {
  const from = application.stage;
  if (to === 'Interview' && (from === 'Applied' || from === 'Screening')) {
    const note = await tx.screeningLog.findFirst({ where: { applicationId: application.id, notes: { not: null } }, select: { notes: true }, orderBy: { createdAt: 'desc' } });
    if (!note?.notes?.trim()) throw blocked(GATE_CODES.screenNote, 'Screen note', 'Interview needs a saved screen note.');
  }
  if (to === 'Offer') {
    const submitted = await tx.interviewScorecard.count({
      where: { status: 'Submitted', interview: { applicationId: application.id, status: { not: 'Cancelled' } } },
    });
    if (submitted === 0) throw blocked(GATE_CODES.scorecard, 'Scorecard', 'Offer needs a submitted interview scorecard.');
  }
  if (to === 'Pre-Hire') {
    const accepted = await tx.offerVersion.count({ where: { status: 'Accepted', offer: { applicationId: application.id } } });
    if (accepted === 0) throw blocked(GATE_CODES.offer, 'Offer accepted', 'Pre-Hire needs an accepted offer.');
  }
  if (to === 'Joined') await assertJoiningChecks(tx, application.id);
}
