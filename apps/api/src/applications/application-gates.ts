import { findActiveReason } from '../master-data/reason-lists';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';

/**
 * B5 (v2 §3 "Gates: five API checks", §8 table). Server-side, independent of
 * the configurable pipeline. Each blocked move is a 409 naming the gate.
 *
 *  # | From                 | To        | v2 requires                               | code
 *  1 | Applied or Screening | Interview | Screen note saved                         | GATE_SCREEN_NOTE_MISSING
 *  2 | Interview            | Offer     | Scorecard submitted                       | GATE_SCORECARD_NOT_SUBMITTED
 *  3 | Offer                | Pre-Hire  | (blank in v2) -> accepted offer version   | GATE_OFFER_NOT_ACCEPTED
 *  4 | Pre-Hire             | Joined    | typed joining checks ID, CONTRACT, SCFHS_LICENCE verified    | GATE_JOINING_CHECKS_INCOMPLETE
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

/** B5 follow-up: typed joining checks (no name matching). Gate 4 needs all three verified. */
export const JOINING_CHECK_TYPES = ['ID', 'CONTRACT', 'SCFHS_LICENCE'] as const;
export type JoiningCheckType = (typeof JOINING_CHECK_TYPES)[number];
export const JOINING_CHECK_LABELS: Record<JoiningCheckType, string> = { ID: 'ID', CONTRACT: 'contract', SCFHS_LICENCE: 'SCFHS licence' };

type Tx = Prisma.TransactionClient;

/** Gate 409 body: always { code, gate, message, missing[] } (kept by the error normalizer). */
export function blocked(code: string, gate: string, message: string, missing: string[]): ConflictException {
  return new ConflictException({ code, gate, message, missing });
}

/** Missing typed checks (types, e.g. ['CONTRACT']). */
export async function missingJoiningChecks(tx: Pick<Tx, 'joiningCheck'>, applicationId: string): Promise<JoiningCheckType[]> {
  const done = await tx.joiningCheck.findMany({ where: { applicationId, verified: true }, select: { type: true } });
  return JOINING_CHECK_TYPES.filter((t) => !done.some((d) => d.type === t));
}

export async function assertJoiningChecks(tx: Pick<Tx, 'joiningCheck'>, applicationId: string): Promise<void> {
  const missing = await missingJoiningChecks(tx, applicationId);
  if (missing.length) {
    throw blocked(GATE_CODES.joining, 'joining-checks', `Joined needs ID, contract and SCFHS licence verified. Missing: ${missing.map((m) => JOINING_CHECK_LABELS[m]).join(', ')}.`, missing);
  }
}

/** Resolves a rejection reason against the org's active list (plus the system reasons). */
export async function resolveRejectionReason(tx: Tx, organizationId: string, reason: string | null | undefined): Promise<string> {
  const text = reason?.trim() ?? '';
  if (!text) throw blocked(GATE_CODES.rejectReason, 'reject-reason', 'Rejected needs a reason from the rejection reasons list.', ['reason']);
  const system = SYSTEM_REJECTION_REASONS.find((r) => r.toLowerCase() === text.toLowerCase());
  if (system) return system;
  const value = await findActiveReason(tx, organizationId, 'rejection-reasons', text); // C3: shared reason-list base
  if (!value) throw blocked(GATE_CODES.rejectReason, 'reject-reason', `"${text}" is not in the rejection reasons list.`, ['reason']);
  return value.name;
}

/** Gates 1-4 for a forward move. Gate 5 (reject) is resolveRejectionReason. */
export async function assertStageGate(tx: Tx, application: { id: string; stage: string }, to: string): Promise<void> {
  const from = application.stage;
  if (to === 'Interview' && (from === 'Applied' || from === 'Screening')) {
    const note = await tx.screeningLog.findFirst({ where: { applicationId: application.id, notes: { not: null } }, select: { notes: true }, orderBy: { createdAt: 'desc' } });
    if (!note?.notes?.trim()) throw blocked(GATE_CODES.screenNote, 'screen-note', 'Interview needs a saved screen note.', ['screen note']);
  }
  if (to === 'Offer') {
    const submitted = await tx.interviewScorecard.count({
      where: { status: 'Submitted', interview: { applicationId: application.id, status: { not: 'Cancelled' } } },
    });
    if (submitted === 0) throw blocked(GATE_CODES.scorecard, 'scorecard', 'Offer needs a submitted interview scorecard.', ['submitted scorecard']);
  }
  if (to === 'Pre-Hire') {
    const accepted = await tx.offerVersion.count({ where: { status: 'Accepted', offer: { applicationId: application.id } } });
    if (accepted === 0) throw blocked(GATE_CODES.offer, 'offer-accepted', 'Pre-Hire needs an accepted offer.', ['accepted offer']);
  }
  if (to === 'Joined') await assertJoiningChecks(tx, application.id);
}

export const REOPEN_TARGETS = ['Applied', 'Screening', 'Interview'];

/**
 * B5 (Mustafa): reopening a Rejected file to Applied/Screening/Interview is
 * allowed only for the file's owner or the owner's manager (403 otherwise),
 * with a reason (400 otherwise). The caller writes the history row and clears
 * Application.rejectionReason (the rejection stays in history with its reason).
 * Owner signals (B1 not on this base): primaryRecruiterId, taskOwnerId, or the
 * job's active PRIMARY assignee. TODO(B1): use file-access.ts ownership once #4 merges.
 */
export async function assertReopenAllowed(
  tx: Tx,
  application: { id: string; vacancyId: string; primaryRecruiterId?: string | null | undefined; taskOwnerId?: string | null | undefined },
  actorUserId: string,
  reason: string | null | undefined,
): Promise<string> {
  const text = reason?.trim() ?? '';
  if (!text) throw new BadRequestException({ code: 'REOPEN_REASON_REQUIRED', message: 'A reason is required to reopen a rejected application.' });
  const primary = await tx.vacancyAssignment.findMany({
    where: { vacancyId: application.vacancyId, isActive: true, assignmentKind: 'PRIMARY' },
    select: { userId: true },
  });
  const owners = new Set([application.primaryRecruiterId, application.taskOwnerId, ...primary.map((p) => p.userId)].filter((x): x is string => Boolean(x)));
  if (owners.has(actorUserId)) return text;
  const managed = await tx.user.count({ where: { id: { in: [...owners] }, managerId: actorUserId } });
  if (managed > 0) return text;
  throw new ForbiddenException({ code: 'REOPEN_NOT_OWNER', message: 'Only the owner of this file or their manager can reopen it.' });
}

export type GateKey = 'screen-note' | 'scorecard' | 'offer-accepted' | 'joining-checks' | 'reject-reason';
export interface GateState { gate: GateKey; code: string; met: boolean; missing: string[] }

/**
 * B5/E3: state of the five gates for a page of applications (batched, read-only).
 * met = the gate's requirement is satisfied today. Gate 5 (reject reason) is only
 * "met" for a Rejected file that carries a reason; for open files it reports
 * missing ['reason'] because a reason must be given at the time of rejecting.
 */
export async function gateStates(
  tx: Pick<Tx, 'screeningLog' | 'interviewScorecard' | 'offerVersion' | 'joiningCheck'>,
  apps: Array<{ id: string; stage: string; rejectionReason?: string | null }>,
): Promise<Map<string, GateState[]>> {
  const ids = apps.map((a) => a.id);
  const out = new Map<string, GateState[]>();
  if (!ids.length) return out;
  const [notes, cards, offers, checks] = await Promise.all([
    tx.screeningLog.findMany({ where: { applicationId: { in: ids }, notes: { not: null } }, select: { applicationId: true, notes: true } }),
    tx.interviewScorecard.findMany({ where: { status: 'Submitted', interview: { applicationId: { in: ids }, status: { not: 'Cancelled' } } }, select: { interview: { select: { applicationId: true } } } }),
    tx.offerVersion.findMany({ where: { status: 'Accepted', offer: { applicationId: { in: ids } } }, select: { offer: { select: { applicationId: true } } } }),
    tx.joiningCheck.findMany({ where: { applicationId: { in: ids }, verified: true }, select: { applicationId: true, type: true } }),
  ]);
  const noted = new Set(notes.filter((n) => n.notes?.trim()).map((n) => n.applicationId));
  const carded = new Set(cards.map((c) => c.interview.applicationId));
  const accepted = new Set(offers.map((o) => o.offer.applicationId));
  for (const a of apps) {
    const done = new Set(checks.filter((c) => c.applicationId === a.id).map((c) => c.type));
    const missingChecks = JOINING_CHECK_TYPES.filter((t) => !done.has(t));
    const rejectedWithReason = a.stage === 'Rejected' && Boolean(a.rejectionReason?.trim());
    out.set(a.id, [
      { gate: 'screen-note', code: GATE_CODES.screenNote, met: noted.has(a.id), missing: noted.has(a.id) ? [] : ['screen note'] },
      { gate: 'scorecard', code: GATE_CODES.scorecard, met: carded.has(a.id), missing: carded.has(a.id) ? [] : ['submitted scorecard'] },
      { gate: 'offer-accepted', code: GATE_CODES.offer, met: accepted.has(a.id), missing: accepted.has(a.id) ? [] : ['accepted offer'] },
      { gate: 'joining-checks', code: GATE_CODES.joining, met: missingChecks.length === 0, missing: [...missingChecks] },
      { gate: 'reject-reason', code: GATE_CODES.rejectReason, met: rejectedWithReason, missing: rejectedWithReason ? [] : ['reason'] },
    ]);
  }
  return out;
}
