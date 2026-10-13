import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Job-profile joining rules shared by the application-stage path and the hiring-case path.
 * A stored snapshot wins over the current job profile, so later configuration does not rewrite an accepted case.
 */
export const JOINING_CHECK_TYPES = ['ID', 'CONTRACT', 'SCFHS_LICENCE'] as const;
export type JoiningCheckType = (typeof JOINING_CHECK_TYPES)[number];
export const JOINING_CHECK_LABELS: Record<JoiningCheckType, string> = {
  ID: 'ID',
  CONTRACT: 'contract',
  SCFHS_LICENCE: 'SCFHS licence',
};

export type RequirementProfile = 'technical' | 'clinical' | 'legacy';

export interface RequirementSnapshot {
  profile: RequirementProfile;
  checks: JoiningCheckType[];
}

export const RECORD_ACTUAL_JOINING = 'RECORD_ACTUAL_JOINING';

export function joiningTypeForRequirement(req: { type: string; name: string }): JoiningCheckType | null {
  if (req.type === 'License' || req.name === 'SCFHS licence') return 'SCFHS_LICENCE';
  if (req.name === 'Identity Document') return 'ID';
  if (req.name === 'Employment contract') return 'CONTRACT';
  return null;
}

export function complianceNameForCheck(type: JoiningCheckType): string {
  if (type === 'ID') return 'Identity Document';
  if (type === 'CONTRACT') return 'Employment contract';
  return 'SCFHS licence';
}

const CHECKS: Record<RequirementProfile, JoiningCheckType[]> = {
  technical: ['ID', 'CONTRACT'],
  clinical: ['ID', 'CONTRACT', 'SCFHS_LICENCE'],
  legacy: ['ID', 'CONTRACT', 'SCFHS_LICENCE'],
};

export interface JoiningActor {
  userId: string;
  organizationId: string;
  permissions: readonly string[];
}

export interface JoiningCheckFact {
  type: string;
  verified: boolean;
  expiryDate?: Date | string | null;
  documentId?: string | null;
}

export interface JoiningFacts {
  organizationId: string;
  actor?: JoiningActor | null;
  enforceActor: boolean;
  enforceRecord: boolean;
  actualJoiningDate: Date | null;
  caseOwnerId: string | null;
  primaryRecruiterId: string | null;
  vacancyPrimaryRecruiterId: string | null;
  snapshot: RequirementSnapshot;
  acceptedOfferVersionId: string | null;
  hiringCaseStatus: string | null;
  approvalFingerprint: string | null;
  approvals: Array<{ status: string; invalidatedAt?: Date | string | null; decisionFingerprint?: string | null; roleCode?: string | null }>;
  checks: JoiningCheckFact[];
  joinedHeadcount: number;
  approvedHeadcount: number;
}

export interface JoiningBlock {
  ok: false;
  httpStatus: 400 | 403 | 404 | 409;
  code: string;
  message: string;
  missing: string[];
  gate?: string;
}

export interface JoiningAllow {
  ok: true;
  snapshot: RequirementSnapshot;
  fingerprint: string;
}

export type JoiningDecision = JoiningAllow | JoiningBlock;

export function isJoiningCheckType(value: string): value is JoiningCheckType {
  return (JOINING_CHECK_TYPES as readonly string[]).includes(value);
}

export function requirementProfileFromMetadata(metadata: unknown): RequirementProfile | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as { requirementProfile?: unknown; joiningProfile?: unknown }).requirementProfile
    ?? (metadata as { joiningProfile?: unknown }).joiningProfile;
  if (value === 'clinical' || value === 'technical') return value;
  return null;
}

export function parseSnapshot(value: unknown): RequirementSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const profile = (value as { profile?: unknown }).profile;
  const checks = (value as { checks?: unknown }).checks;
  if (profile !== 'technical' && profile !== 'clinical' && profile !== 'legacy') return null;
  if (!Array.isArray(checks)) return null;
  const typed = checks.filter(isJoiningCheckType);
  if (!typed.length) return null;
  return { profile, checks: typed };
}

/** Stored snapshot first. An explicit job profile is next. Anything else keeps the historical three checks. */
export function resolveSnapshot(stored: unknown, positionMetadata: unknown): RequirementSnapshot {
  const parsed = parseSnapshot(stored);
  if (parsed) return parsed;
  const configured = requirementProfileFromMetadata(positionMetadata);
  if (configured) return { profile: configured, checks: [...CHECKS[configured]] };
  return { profile: 'legacy', checks: [...CHECKS.legacy] };
}

export function snapshotForNewCase(positionMetadata: unknown): RequirementSnapshot {
  const configured = requirementProfileFromMetadata(positionMetadata);
  const profile = configured ?? 'legacy';
  return { profile, checks: [...CHECKS[profile]] };
}

export function compliancePlan(snapshot: RequirementSnapshot): Array<{ type: string; name: string; isRequired: boolean }> {
  if (snapshot.profile === 'legacy') {
    return [
      { type: 'Document', name: 'Identity Document', isRequired: true },
      { type: 'Check', name: 'Background Check', isRequired: true },
      { type: 'License', name: 'SCFHS licence', isRequired: true },
    ];
  }
  const items = [
    { type: 'Document', name: 'Identity Document', isRequired: true },
    { type: 'Document', name: 'Employment contract', isRequired: true },
  ];
  if (snapshot.checks.includes('SCFHS_LICENCE')) {
    items.push({ type: 'License', name: 'SCFHS licence', isRequired: true });
  }
  return items;
}

export function isResponsibleRecruiter(actorUserId: string, parties: {
  caseOwnerId?: string | null;
  primaryRecruiterId?: string | null;
  vacancyPrimaryRecruiterId?: string | null;
}): boolean {
  return [parties.caseOwnerId, parties.primaryRecruiterId, parties.vacancyPrimaryRecruiterId].includes(actorUserId);
}

function day(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function caseFingerprint(input: {
  snapshot: RequirementSnapshot;
  acceptedOfferVersionId: string | null;
  checks: JoiningCheckFact[];
}): string {
  const checks = input.snapshot.checks.map((type) => {
    const row = input.checks.find((item) => item.type === type);
    return [
      type,
      row?.verified ? '1' : '0',
      day(row?.expiryDate) ?? '',
      row?.documentId ?? '',
    ].join(':');
  }).join(',');
  return `profile:${input.snapshot.profile}|offer:${input.acceptedOfferVersionId ?? ''}|${checks}`;
}

export function decideJoining(facts: JoiningFacts): JoiningDecision {
  const missing = (code: string, message: string, items: string[] = [], httpStatus: JoiningBlock['httpStatus'] = 409, gate?: string): JoiningBlock =>
    ({ ok: false, httpStatus, code, message, missing: items, ...(gate ? { gate } : {}) });

  if (facts.enforceActor) {
    const actor = facts.actor;
    if (!actor) return missing('JOINING_PERMISSION_REQUIRED', 'Recording actual joining needs the RECORD_ACTUAL_JOINING permission.', [], 403);
    if (actor.organizationId !== facts.organizationId) {
      return missing('WRONG_ORGANIZATION', 'Hiring case not found.', [], 404);
    }
    if (!actor.permissions.includes(RECORD_ACTUAL_JOINING)) {
      return missing('JOINING_PERMISSION_REQUIRED', 'Recording actual joining needs the RECORD_ACTUAL_JOINING permission. Final hiring approval does not include it.', [], 403);
    }
    if (!isResponsibleRecruiter(actor.userId, facts)) {
      return missing('JOINING_NOT_OWNER', 'Only the responsible recruiter can record actual joining.', [], 403);
    }
  }

  const absent = facts.snapshot.checks.filter((type) => !facts.checks.some((check) => check.type === type && check.verified));
  if (absent.length) {
    return missing(
      'GATE_JOINING_CHECKS_INCOMPLETE',
      `Joined needs the job's required checks verified. Missing: ${absent.map((type) => JOINING_CHECK_LABELS[type]).join(', ')}.`,
      [...absent],
      409,
      'joining-checks',
    );
  }

  if (facts.snapshot.checks.includes('SCFHS_LICENCE')) {
    const licence = facts.checks.find((check) => check.type === 'SCFHS_LICENCE');
    const expiry = day(licence?.expiryDate);
    const joiningDay = day(facts.actualJoiningDate) ?? day(new Date());
    if (facts.snapshot.profile === 'clinical' && !expiry) {
      return missing('LICENCE_EXPIRY_REQUIRED', 'A clinical hire needs a valid SCFHS licence expiry before joining.', ['SCFHS licence expiry'], 409, 'licence-expiry');
    }
    if (expiry && joiningDay && expiry < joiningDay) {
      return missing('LICENCE_EXPIRED', 'The required SCFHS licence expires before the actual joining date.', ['SCFHS licence expiry'], 409, 'licence-expiry');
    }
  }

  if (!facts.acceptedOfferVersionId) {
    return missing('GATE_OFFER_NOT_ACCEPTED', 'Joined needs an accepted offer.', ['accepted offer'], 409, 'offer-accepted');
  }
  if (facts.hiringCaseStatus !== 'Awaiting Joining') {
    return missing('FINAL_APPROVAL_REQUIRED', 'Joined needs a current final hiring approval. Offer approval does not replace it.', ['final hiring approval'], 409, 'final-approval');
  }

  const fingerprint = caseFingerprint(facts);
  const authorizing = facts.approvals.find((approval) =>
    approval.status === 'Approved' && !approval.invalidatedAt && (approval.roleCode ?? 'FINAL_HIRING_APPROVER') === 'FINAL_HIRING_APPROVER');
  if (!authorizing) {
    return missing('FINAL_APPROVAL_REQUIRED', 'Joined needs a current final hiring approval. Offer approval does not replace it.', ['final hiring approval'], 409, 'final-approval');
  }
  const authorized = authorizing.decisionFingerprint ?? facts.approvalFingerprint;
  if (!authorized || authorized !== fingerprint) {
    return missing('APPROVAL_STALE', 'The final hiring approval does not match the current offer and checks. Review the case again.', ['current final hiring approval'], 409, 'approval-stale');
  }

  if (facts.joinedHeadcount >= facts.approvedHeadcount) {
    return missing('CAPACITY_FULL', 'Approved capacity is already filled.', ['available seat'], 409, 'capacity');
  }
  if (facts.enforceRecord && !facts.actualJoiningDate) {
    return missing('JOINING_DATE_REQUIRED', 'Actual joining needs the date the candidate joined.', ['actualJoiningDate'], 400);
  }
  return { ok: true, snapshot: facts.snapshot, fingerprint };
}

export function throwJoiningDecision(decision: JoiningDecision): asserts decision is JoiningAllow {
  if (decision.ok) return;
  const body = { code: decision.code, message: decision.message, missing: decision.missing, gate: decision.gate };
  if (decision.httpStatus === 404) throw new NotFoundException(body);
  if (decision.httpStatus === 403) throw new ForbiddenException(body);
  if (decision.httpStatus === 400) throw new BadRequestException(body);
  throw new ConflictException(body);
}

interface LoadedApplication {
  id: string;
  organizationId: string;
  primaryRecruiterId: string | null;
  vacancy: { approvedHeadcount: number; joinedHeadcount: number; primaryRecruiterId: string | null; position: { metadata: unknown } | null };
  offers: Array<{ versions: Array<{ id: string; status: string; versionNumber: number }> }>;
  hiringCase: null | {
    id: string;
    status: string;
    ownerUserId: string | null;
    requirementSnapshot: unknown;
    approvalFingerprint: string | null;
    approvals: Array<{ id: string; status: string; roleCode: string; invalidatedAt: Date | null; decisionFingerprint: string | null }>;
  };
  joiningChecks: JoiningCheckFact[];
}

/** Prisma's promise type is invariant, so the loader accepts the client structurally and narrows the row itself. */
export interface JoiningReadTx {
  application: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst(args: unknown): Promise<any>;
  };
}

export async function assertCanMarkJoined(tx: JoiningReadTx, args: {
  applicationId: string;
  actor?: JoiningActor | null;
  actualJoiningDate?: Date | null;
  enforceActor?: boolean;
  enforceRecord?: boolean;
}): Promise<JoiningAllow> {
  const application = await tx.application.findFirst({
    where: {
      id: args.applicationId,
      ...(args.actor ? { organizationId: args.actor.organizationId } : {}),
    },
    include: {
      vacancy: { select: { approvedHeadcount: true, joinedHeadcount: true, primaryRecruiterId: true, position: { select: { metadata: true } } } },
      offers: { include: { versions: { where: { status: 'Accepted' }, select: { id: true, status: true, versionNumber: true }, orderBy: { versionNumber: 'desc' } } } },
      hiringCase: { include: { approvals: true } },
      joiningChecks: { select: { type: true, verified: true, expiryDate: true, documentId: true } },
    },
  }) as LoadedApplication | null;
  if (!application) throw new NotFoundException({ code: 'WRONG_ORGANIZATION', message: 'Hiring case not found.' });
  const accepted = application.offers.flatMap((offer) => offer.versions).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
  const decision = decideJoining({
    organizationId: application.organizationId,
    actor: args.actor ?? null,
    enforceActor: args.enforceActor ?? Boolean(args.actor),
    enforceRecord: args.enforceRecord ?? false,
    actualJoiningDate: args.actualJoiningDate ?? null,
    caseOwnerId: application.hiringCase?.ownerUserId ?? null,
    primaryRecruiterId: application.primaryRecruiterId,
    vacancyPrimaryRecruiterId: application.vacancy.primaryRecruiterId,
    snapshot: resolveSnapshot(application.hiringCase?.requirementSnapshot, application.vacancy.position?.metadata),
    acceptedOfferVersionId: accepted?.id ?? null,
    hiringCaseStatus: application.hiringCase?.status ?? null,
    approvalFingerprint: application.hiringCase?.approvalFingerprint ?? null,
    approvals: application.hiringCase?.approvals ?? [],
    checks: application.joiningChecks,
    joinedHeadcount: application.vacancy.joinedHeadcount,
    approvedHeadcount: application.vacancy.approvedHeadcount,
  });
  throwJoiningDecision(decision);
  return decision;
}

/** Facts a final approval authorizes. Does not require the case to be joinable yet. */
export async function currentCaseFingerprint(tx: JoiningReadTx, applicationId: string, organizationId?: string): Promise<string | null> {
  const application = await tx.application.findFirst({
    where: { id: applicationId, ...(organizationId ? { organizationId } : {}) },
    include: {
      vacancy: { select: { approvedHeadcount: true, joinedHeadcount: true, primaryRecruiterId: true, position: { select: { metadata: true } } } },
      offers: { include: { versions: { where: { status: 'Accepted' }, select: { id: true, status: true, versionNumber: true }, orderBy: { versionNumber: 'desc' } } } },
      hiringCase: { include: { approvals: true } },
      joiningChecks: { select: { type: true, verified: true, expiryDate: true, documentId: true } },
    },
  }) as LoadedApplication | null;
  if (!application) return null;
  const accepted = application.offers.flatMap((offer) => offer.versions).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
  return caseFingerprint({
    snapshot: resolveSnapshot(application.hiringCase?.requirementSnapshot, application.vacancy.position?.metadata),
    acceptedOfferVersionId: accepted?.id ?? null,
    checks: application.joiningChecks,
  });
}

export interface ApprovalWriteTx {
  hiringCase: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst(args: unknown): Promise<any>;
    update(args: unknown): Promise<unknown>;
  };
  hiringCaseApproval: {
    updateMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  application: JoiningReadTx['application'];
}

/** A material change after approval can no longer authorize joining. The old approval row stays, marked invalidated. */
export async function invalidateStaleApproval(tx: ApprovalWriteTx & JoiningReadTx, applicationId: string, actor?: JoiningActor | null): Promise<boolean> {
  const hiringCase = await tx.hiringCase.findFirst({ where: { applicationId }, select: { id: true, status: true, approvalFingerprint: true } });
  if (!hiringCase || hiringCase.status !== 'Awaiting Joining') return false;
  let current: string;
  try {
    const allowed = await assertCanMarkJoined(tx, { applicationId, actor: actor ?? null, enforceActor: false, enforceRecord: false });
    current = allowed.fingerprint;
  } catch {
    current = '';
  }
  if (current && current === hiringCase.approvalFingerprint) return false;
  await tx.hiringCaseApproval.updateMany({
    where: { hiringCaseId: hiringCase.id, status: 'Approved', invalidatedAt: null },
    data: { invalidatedAt: new Date() },
  });
  await tx.hiringCase.update({ where: { id: hiringCase.id }, data: { status: 'Pending Final Approval', approvalFingerprint: null } });
  await tx.hiringCaseApproval.create({ data: { hiringCaseId: hiringCase.id, roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending' } });
  return true;
}
