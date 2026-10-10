import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { UserPermissionsService } from '../common/user-permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { fileOwnerIds, isAdmin, isManagerOfFile } from './file-ownership';

export type ManagerDecision = 'Approve' | 'Reject' | 'RequestChanges';

/** Decision -> B5 version state (and offer status). Only "Pending Approval" versions can be decided. */
export const DECISION_OUTCOME: Record<ManagerDecision, { version: string; approvalStatus: string; offer: string; approvals: string }> = {
  Approve: { version: 'Approved', approvalStatus: 'Approved', offer: 'Approved', approvals: 'Approved' },
  RequestChanges: { version: 'Changes Requested', approvalStatus: 'Changes Requested', offer: 'Draft', approvals: 'Rejected' },
  // Mustafa: Reject withdraws only THIS version. The offer goes back to Draft and the file stays in Offer;
  // the owner drafts a new version or rejects the file.
  Reject: { version: 'Withdrawn', approvalStatus: 'Rejected', offer: 'Draft', approvals: 'Rejected' },
};

const ALLOWANCE_TYPES = new Set(['allowance', 'benefit']);

/**
 * Monthly BASE pay from "Salary" components only (Annual / 12). Allowances and benefits
 * are excluded from the band check by design.
 */
export function monthlyBase(components: Array<{ type: string; amount: Prisma.Decimal | number | null; currency: string | null; frequency: string | null }>) {
  const salary = components.filter((c) => !ALLOWANCE_TYPES.has(c.type.trim().toLowerCase()) && c.type.trim().toLowerCase() === 'salary');
  if (salary.length === 0) return null;
  const currencies = [...new Set(salary.map((c) => (c.currency ?? 'AED').toUpperCase()))];
  if (currencies.length > 1) throw new ConflictException({ code: 'OFFER_BASE_CURRENCY_MIXED', message: 'Base pay components use more than one currency.' });
  let total = 0;
  for (const c of salary) {
    const amount = c.amount === null ? 0 : Number(c.amount);
    total += (c.frequency ?? 'Monthly').toLowerCase().startsWith('annual') ? amount / 12 : amount;
  }
  return { amount: Math.round(total * 100) / 100, currency: currencies[0]! };
}

@Injectable()
export class OfferDecisionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserPermissionsService) private readonly permissions: UserPermissionsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async decide(user: AuthUser, offerId: string, versionId: string, input: { decision: ManagerDecision; reason?: string | null; basePay?: number; allowances?: Array<{ name: string; amount: number; frequency?: string }>; currency?: string }) {
    const sendsPay = input.basePay !== undefined || (input.allowances?.length ?? 0) > 0 || input.currency !== undefined;
    if (sendsPay) {
      if (input.decision !== 'Approve') throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Pay can only be sent with Approve.' });
      if (!(await this.permissions.hasPermission(user.userId, user.organizationId, 'OFFER_PAY_VIEW'))) {
        throw new ForbiddenException({ code: 'OFFER_PAY_VIEW_REQUIRED', message: 'Sending offer pay needs the OFFER_PAY_VIEW permission.' });
      }
      if (input.basePay === undefined || !input.currency || !/^[A-Za-z]{3}$/.test(input.currency)) {
        throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'basePay and a 3-letter currency are required when sending pay.' });
      }
    }
    if (!(input.decision in DECISION_OUTCOME)) throw new BadRequestException({ code: 'DECISION_INVALID', message: 'decision must be Approve, Reject or RequestChanges.' });
    const reason = input.reason?.trim() || null;
    if (input.decision !== 'Approve' && !reason) {
      throw new BadRequestException({ code: 'DECISION_REASON_REQUIRED', message: 'A reason is required to reject or request changes.' });
    }
    const version = await this.prisma.offerVersion.findFirst({
      where: { id: versionId, offerId, offer: { organizationId: user.organizationId } },
      include: {
        components: { where: { supersededAt: null } },
        offer: { include: { application: { include: { vacancy: { select: { id: true, branchId: true, branch: { select: { name: true } }, vacancyRequest: { select: { gradeId: true, grade: { select: { name: true } } } } } } } } } },
      },
    });
    if (!version) throw new NotFoundException('Offer version not found.');
    const app = version.offer.application;

    if (isAdmin(user.roleCodes)) throw new ForbiddenException({ code: 'OFFER_DECISION_NOT_MANAGER', message: 'Only the file owner\'s manager can decide; administrators cannot.' });
    const owners = await fileOwnerIds(this.prisma, app);
    if (!(await isManagerOfFile(this.prisma, owners, user.userId))) {
      throw new ForbiddenException({ code: 'OFFER_DECISION_NOT_MANAGER', message: 'Only the manager of this file\'s owner can decide on its offer.' });
    }
    if (version.status !== 'Pending Approval' || version.offer.currentVersionId !== version.id) {
      throw new ConflictException({ code: 'OFFER_NOT_PENDING_APPROVAL', message: `Only the current version in Pending Approval can be decided (this one is ${version.status}).` });
    }

    // M3: the manager's pay replaces the version's components (Salary = basePay monthly; allowances stay separate
    // and are NOT part of the band check). Stored in the same transaction as the decision.
    const currency = input.currency?.toUpperCase();
    const newComponents = sendsPay ? [
      { type: 'Salary', name: 'Base pay', amount: input.basePay!, currency: currency!, frequency: 'Monthly' },
      ...(input.allowances ?? []).map((a) => ({ type: 'Allowance', name: a.name.trim(), amount: a.amount, currency: currency!, frequency: a.frequency ?? 'Monthly' })),
    ] : null;
    const toDecimalish = (c: { type: string; amount: number; currency: string; frequency: string }) => ({ ...c, amount: c.amount as unknown as Prisma.Decimal | null, currency: c.currency as string | null, frequency: c.frequency as string | null });
    let bandId: string | null = null;
    if (input.decision === 'Approve') bandId = await assertOfferInsideBand(this.prisma, user.organizationId, () => this.permissions.hasPermission(user.userId, user.organizationId, 'OFFER_PAY_VIEW'), newComponents ? newComponents.map(toDecimalish) : version.components, app.vacancy);

    const outcome = DECISION_OUTCOME[input.decision];
    const now = new Date();
    const decision = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.offerVersion.updateMany({ where: { id: version.id, status: 'Pending Approval' }, data: { status: outcome.version, approvalStatus: outcome.approvalStatus } });
      if (locked.count !== 1) throw new ConflictException({ code: 'OFFER_NOT_PENDING_APPROVAL', message: 'This version was decided by someone else.' });
      if (newComponents) {
        // B2-21: no hard delete. The submitted pay rows are kept as superseded history; the approver's figures become the live rows.
        await tx.offerComponent.updateMany({ where: { offerVersionId: version.id, supersededAt: null }, data: { supersededAt: now } });
        await tx.offerComponent.createMany({ data: newComponents.map((c) => ({ offerVersionId: version.id, ...c })) });
        const monthlyAllow = (input.allowances ?? []).reduce((t, a) => t + ((a.frequency ?? 'Monthly') === 'Monthly' ? a.amount : (a.frequency === 'Annual' ? a.amount / 12 : 0)), 0);
        const monthly = Math.round((input.basePay! + monthlyAllow) * 100) / 100;
        await tx.offerVersion.update({ where: { id: version.id }, data: { monthlyPackage: monthly, annualFixed: Math.round(monthly * 12 * 100) / 100 } });
      }
      await tx.offer.update({ where: { id: offerId }, data: { status: outcome.offer } });
      await tx.offerApproval.updateMany({
        where: { offerVersionId: version.id, status: 'Pending' },
        data: { status: outcome.approvals, approverUserId: user.userId, decidedAt: now, comment: reason ?? 'Approved by the manager on the file.' },
      });
      const row = await tx.offerVersionDecision.create({
        data: { organizationId: user.organizationId, offerVersionId: version.id, decision: input.decision, fromStatus: version.status, toStatus: outcome.version, reason, decidedById: user.userId, gradeBandId: bandId },
      });
      await tx.auditLog.create({
        data: { action: 'OFFER_MANAGER_DECISION', actorUserId: user.userId, organizationId: user.organizationId, entityType: 'OfferVersion', entityId: version.id, result: input.decision.toUpperCase(), reason },
      });
      return row;
    });

    for (const ownerId of owners) {
      await this.notifications.create({
        organizationId: user.organizationId, recipientUserId: ownerId, type: 'OfferManagerDecision',
        title: `Offer ${input.decision === 'RequestChanges' ? 'changes requested' : input.decision === 'Approve' ? 'approved' : 'rejected'}`,
        message: `${version.offer.offerCode} v${version.versionNumber}: ${input.decision}${reason ? ` (${reason})` : ''}.`,
        entityType: 'Offer', entityId: offerId,
      }).catch(() => undefined);
    }
    return { id: decision.id, offerId, offerVersionId: version.id, decision: input.decision, fromStatus: decision.fromStatus, toStatus: decision.toStatus, reason, decidedById: user.userId, decidedAt: decision.createdAt.toISOString() };
  }
}

type BandVacancy = { branchId: string; branch: { name: string }; vacancyRequest: { gradeId: string | null; grade: { name: string } | null } };

/**
 * B7 band check, shared by the manager decision and the offer-approver inbox decision.
 * 409 OFFER_BASE_PAY_MISSING / GRADE_BAND_MISSING / OFFER_PAY_OUTSIDE_BAND (band in the error;
 * pay figures only when canSeePay() is true, i.e. OFFER_PAY_VIEW). Returns the band id.
 */
export async function assertOfferInsideBand(
  prisma: Pick<Prisma.TransactionClient, 'gradeBand'>,
  organizationId: string,
  canSeePay: () => Promise<boolean>,
  components: Array<{ type: string; amount: Prisma.Decimal | null; currency: string | null; frequency: string | null }>,
  vacancy: BandVacancy,
): Promise<string> {
  const base = monthlyBase(components);
  if (!base) throw new ConflictException({ code: 'OFFER_BASE_PAY_MISSING', message: 'The offer has no base pay (Salary) component.' });
  const gradeId = vacancy.vacancyRequest.gradeId;
  const band = gradeId ? await prisma.gradeBand.findFirst({
    where: { organizationId, gradeId, branchId: vacancy.branchId, currency: base.currency, status: 'Active' },
    orderBy: { createdAt: 'asc' },
  }) : null;
  const where = { grade: vacancy.vacancyRequest.grade?.name ?? null, site: vacancy.branch.name, currency: base.currency };
  if (!band) throw new ConflictException({ code: 'GRADE_BAND_MISSING', message: gradeId ? 'No active band for this job\'s grade, site and currency.' : 'The job has no grade, so no band applies.', band: where });
  const min = Number(band.minMonthlyBase); const max = Number(band.maxMonthlyBase);
  if (base.amount < min || base.amount > max) {
    const pay = await canSeePay();
    throw new ConflictException({
      code: 'OFFER_PAY_OUTSIDE_BAND',
      message: 'Base pay is outside the band for this job\'s grade, site and currency.',
      band: { id: band.id, ...where, ...(pay ? { minMonthlyBase: min, maxMonthlyBase: max } : {}) },
      ...(pay ? { offeredMonthlyBase: base.amount } : {}),
    });
  }
  return band.id;
}
