import { DECLINED_OFFER_REASON } from '../applications/application-gates';
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Optional } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { EmailOutboxService } from '../email/email-outbox.service';
import { UserPermissionsService } from '../common/user-permissions.service';
import { assertOfferInsideBand } from '../manager-decision/offer-decision.service';
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CreateOfferDto,
  CreateOfferRevisionDto,
  OfferDecisionDto,
  UpdateOfferStatusDto,
} from './offers.dto';
import type { AuthUser, OfferApprovalInboxItem } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { NotificationsService } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PAY_VIEW_PERMISSION } from '../common/access/pay-visibility';
import { AccessControlService } from '../access-control/access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanUuidParam(value?: string | null): string | null | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * B7: offer pay (base, package, component amounts) needs OFFER_PAY_VIEW. Fields are
 * OMITTED (absent), never null, without it. Same rule as current/expected salary on
 * screening (common/access/pay-visibility.ts).
 */
type CompensationDisclosure = { viewOfferPay: boolean };

type OfferVersionRecord = {
  id: string;
  offerId: string;
  versionNumber: number;
  monthlyPackage: Prisma.Decimal | null;
  annualFixed: Prisma.Decimal | null;
  contractType: string | null;
  probationPeriod: string | null;
  offerExpiry: Date | null;
  proposedJoiningDate: Date | null;
  workLocation: string | null;
  workingSchedule: string | null;
  approvalStatus: string;
  status: string;
  sentChannel?: string | null;
  sentTemplateId?: string | null;
  sentAt?: Date | null;
  createdAt: Date;
  components?: Array<{
    id: string;
    type: string;
    name: string;
    amount: Prisma.Decimal | null;
    currency: string | null;
    frequency: string | null;
    isTaxable: boolean;
  }>;
  approvals?: Array<{
    id: string;
    offerVersionId: string;
    approverUserId: string | null;
    approver?: { displayName: string } | null;
    roleCode: string;
    status: string;
    comment: string | null;
    decidedAt: Date | null;
  }>;
};

type OfferRecord = {
  id: string;
  organizationId: string;
  applicationId: string;
  offerCode: string;
  status: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  application?: {
    vacancyId?: string;
    candidate?: { firstName: string; lastName: string } | null;
    vacancy?: {
      id: string;
      branchId?: string;
      location?: string | null;
      vacancyRequest?: { grade?: { id: string; name: string } | null } | null;
      branch?: { name: string } | null;
      position?: { title: string } | null;
    } | null;
  } | null;
  versions?: OfferVersionRecord[];
};

export const OFFER_SEND_CHANNELS = ['email', 'whatsapp'] as const;
export type OfferSendChannel = (typeof OFFER_SEND_CHANNELS)[number];

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly accessControl: AccessControlService,
    @Optional() private readonly outbox?: EmailOutboxService,
    @Optional() private readonly userPermissions?: UserPermissionsService,
  ) {}

  private applicationVisibility(user: AuthUser) {
    return this.accessControl.getApplicationVisibilityWhere(user);
  }

  /** Read-only: owners plus the current approver of the file (B1 follow-up). */
  private applicationReadVisibility(user: AuthUser) {
    return this.accessControl.getApplicationReadVisibilityWhere(user);
  }

  private notify(input: {
    organizationId: string;
    recipientUserId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }): Promise<void> {
    return this.notifications.create(input);
  }

  private async findActiveRoleUserIds(organizationId: string, roleCode: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        status: 'Active',
        userRoles: { some: { role: { code: roleCode, status: 'Active' } } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async nextOfferCode(year: number): Promise<string> {
    const seq = await this.prisma.codeSequence.upsert({
      where: { key: `OFF:${year}` },
      create: { key: `OFF:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `OFF-${year}-${String(seq.lastIssued).padStart(4, '0')}`;
  }

  private calculatePackage(components: { amount?: number | null; frequency?: string | null }[]) {
    let monthly = 0;
    let annual = 0;

    for (const comp of components) {
      if (comp.amount) {
        if (comp.frequency === 'Monthly') {
          monthly += comp.amount;
          annual += comp.amount * 12;
        } else if (comp.frequency === 'Annual') {
          annual += comp.amount;
          monthly += comp.amount / 12;
        }
      }
    }

    return { monthlyPackage: monthly, annualFixed: annual };
  }

  async getOffers(
    user: AuthUser,
    query: { status?: string; search?: string; candidateId?: string; vacancyId?: string; applicationId?: string },
    disclosure: CompensationDisclosure,
  ) {
    const cleanCandidateId = cleanUuidParam(query.candidateId);
    const cleanVacancyId = cleanUuidParam(query.vacancyId);
    const cleanApplicationId = cleanUuidParam(query.applicationId);
    if (query.applicationId && cleanApplicationId === null) return [];

    // If candidateId or vacancyId was provided but is not a valid UUID,
    // safely return empty list rather than triggering database UUID syntax errors.
    if ((query.candidateId && cleanCandidateId === null) || (query.vacancyId && cleanVacancyId === null)) {
      return [];
    }

    const visibility = await this.applicationVisibility(user);
    // Id filters are ANDed with the access scope; they never replace it.
    const idFilters: Prisma.ApplicationWhereInput[] = [];
    if (cleanCandidateId) idFilters.push({ candidateId: cleanCandidateId });
    if (cleanVacancyId) idFilters.push({ vacancyId: cleanVacancyId });
    if (cleanApplicationId) idFilters.push({ id: cleanApplicationId });

    const where: Prisma.OfferWhereInput = {
      organizationId: user.organizationId,
      // applicationId is ANDed with visibility (never overrides an id-based scope).
      application: idFilters.length ? { AND: [visibility, ...idFilters] } : visibility,
    };

    if (query.status && query.status !== 'ALL' && query.status !== 'undefined' && query.status !== 'null') {
      where.status = query.status.trim();
    }

    if (query.search && query.search !== 'undefined' && query.search !== 'null') {
      const term = query.search.trim();
      where.OR = [
        { offerCode: { contains: term, mode: 'insensitive' } },
        { application: { candidate: { firstName: { contains: term, mode: 'insensitive' } } } },
        { application: { candidate: { lastName: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const offers = await this.prisma.offer.findMany({
      where,
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true, branch: true, vacancyRequest: { select: { grade: { select: { id: true, name: true } } } } } },
          },
        },
        versions: {
          include: { components: { where: { supersededAt: null } }, approvals: { include: { approver: true } } },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map((o) => this.mapOfferSummary(o, disclosure));
  }

  async getOfferById(user: AuthUser, id: string, disclosure: CompensationDisclosure) {
    const visibility = await this.applicationReadVisibility(user);
    const offer = await this.prisma.offer.findFirst({
      where: { id, organizationId: user.organizationId, application: visibility },
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true, branch: true, vacancyRequest: { select: { grade: { select: { id: true, name: true } } } } } },
          },
        },
        versions: {
          include: {
            components: { where: { supersededAt: null } },
            approvals: { include: { approver: true } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!offer) throw new NotFoundException('Offer not found');
    return this.mapOfferDetail(offer, disclosure);
  }

  async createOffer(user: AuthUser, dto: CreateOfferDto) {
    await this.accessControl.assertApplicationAccess(user, dto.applicationId);
    const visibility = await this.applicationVisibility(user);
    const application = await this.prisma.application.findFirst({
      where: { AND: [visibility, { id: dto.applicationId }] },
      include: { vacancy: { include: { branch: true } } },
    });

    if (!application) throw new NotFoundException('Application not found');

    const year = new Date().getUTCFullYear();
    const offerCode = await this.nextOfferCode(year);
    const { monthlyPackage, annualFixed } = this.calculatePackage(dto.components);
    const vacancyWorkLocation = application.vacancy?.location?.trim() || application.vacancy?.branch?.name?.trim() || null;
    const workLocation = dto.workLocation?.trim() || vacancyWorkLocation;

    const offerId = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          organizationId: user.organizationId,
          applicationId: application.id,
          offerCode,
          status: 'Draft',
        },
      });

      const version = await tx.offerVersion.create({
        data: {
          offerId: offer.id,
          versionNumber: 1,
          monthlyPackage,
          annualFixed,
          contractType: dto.contractType ?? null,
          probationPeriod: dto.probationPeriod ?? null,
          offerExpiry: dto.offerExpiry ?? null,
          proposedJoiningDate: dto.proposedJoiningDate ?? null,
          workLocation,
          workingSchedule: dto.workingSchedule ?? null,
          // B5 follow-up: a new offer is a Draft; POST /offers/:id/submit sends it for approval.
          approvalStatus: 'Draft',
          status: 'Draft',
          components: {
            create: dto.components.map((c) => ({
              type: c.type,
              name: c.name,
              amount: c.amount ?? null,
              currency: c.currency ?? 'AED',
              frequency: c.frequency ?? null,
              isTaxable: c.isTaxable,
            })),
          },
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { currentVersionId: version.id, status: 'Draft' },
      });

      return offer.id;
    });

    return offerId;
  }

  async createOfferRevision(user: AuthUser, id: string, dto: CreateOfferRevisionDto) {
    const visibility = await this.applicationVisibility(user);
    const offer = await this.prisma.offer.findFirst({
      where: { id, organizationId: user.organizationId, application: visibility },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        application: { include: { vacancy: { include: { branch: true } } } },
      },
    });

    if (!offer) throw new NotFoundException('Offer not found');

    // B5: an Expired offer leaves the file in Offer; the owner drafts a new version
    // (allowed) or rejects. Closed outcomes cannot be revised.
    if (['Accepted', 'Declined', 'Withdrawn'].includes(offer.status)) {
      throw new ConflictException({ code: 'OFFER_CLOSED', message: `An ${offer.status.toLowerCase()} offer cannot get a new version.` });
    }
    const lastVersion = offer.versions[0];
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;
    const { monthlyPackage, annualFixed } = this.calculatePackage(dto.components);
    const vacancyWorkLocation = offer.application?.vacancy?.location?.trim() || offer.application?.vacancy?.branch?.name?.trim() || null;
    const workLocation = dto.workLocation?.trim() || vacancyWorkLocation;

    const versionId = await this.prisma.$transaction(async (tx) => {
      // A version that never got approved is superseded by the new Draft.
      if (offer.currentVersionId) {
        await tx.offerVersion.updateMany({ where: { id: offer.currentVersionId, status: { in: ['Draft', 'Changes Requested', 'Pending Approval'] } }, data: { status: 'Withdrawn' } });
        await tx.offerApproval.updateMany({ where: { offerVersionId: offer.currentVersionId, status: 'Pending' }, data: { status: 'Cancelled' } });
      }
      const version = await tx.offerVersion.create({
        data: {
          offerId: offer.id,
          versionNumber: newVersionNumber,
          monthlyPackage,
          annualFixed,
          contractType: dto.contractType ?? null,
          probationPeriod: dto.probationPeriod ?? null,
          offerExpiry: dto.offerExpiry ?? null,
          proposedJoiningDate: dto.proposedJoiningDate ?? null,
          workLocation,
          workingSchedule: dto.workingSchedule ?? null,
          approvalStatus: 'Draft',
          status: 'Draft',
          components: {
            create: dto.components.map((c) => ({
              type: c.type,
              name: c.name,
              amount: c.amount ?? null,
              currency: c.currency ?? 'AED',
              frequency: c.frequency ?? null,
              isTaxable: c.isTaxable,
            })),
          },
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { currentVersionId: version.id, status: 'Draft' },
      });

      return version.id;
    });

    return versionId;
  }

  /** B5 follow-up: Draft (or Changes Requested) -> Pending Approval; opens the approval step and notifies approvers. */
  async submitOffer(user: AuthUser, id: string) {
    const visibility = await this.applicationVisibility(user);
    const offer = await this.prisma.offer.findFirst({ where: { id, organizationId: user.organizationId, application: visibility } });
    if (!offer) throw new NotFoundException('Offer not found');
    const current = offer.currentVersionId ? await this.prisma.offerVersion.findUnique({ where: { id: offer.currentVersionId } }) : null;
    if (!current || !['Draft', 'Changes Requested'].includes(current.status)) {
      throw new ConflictException({ code: 'OFFER_NOT_DRAFT', message: `Only a Draft (or Changes Requested) version can be submitted; this one is ${current?.status ?? 'missing'}.` });
    }
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.offerVersion.updateMany({ where: { id: current.id, status: current.status }, data: { status: 'Pending Approval', approvalStatus: 'Pending' } });
      if (moved.count !== 1) throw new ConflictException({ code: 'OFFER_NOT_DRAFT', message: 'The version changed; reload and try again.' });
      await tx.offerApproval.create({ data: { offerVersionId: current.id, roleCode: 'OFFER_APPROVER', status: 'Pending' } });
      await tx.offer.update({ where: { id }, data: { status: 'Pending Approval' } });
    });
    const approverIds = await this.findActiveRoleUserIds(user.organizationId, 'OFFER_APPROVER');
    for (const recipientUserId of approverIds) {
      if (recipientUserId === user.userId) continue;
      await this.notify({
        organizationId: user.organizationId, recipientUserId, type: 'OfferApprovalRequested',
        title: 'Offer awaiting your approval', message: `Offer ${offer.offerCode} v${current.versionNumber} was submitted and is pending approval.`,
        entityType: 'Offer', entityId: offer.id,
      });
    }
    return { id, status: 'Pending Approval', versionId: current.id };
  }

  /**
   * B5 follow-up: send an Approved offer with { channel, templateId }.
   * email: the template must be an active EmailTemplate; the rendered message goes to the
   *   existing email outbox (template "notification"). whatsapp: an active WhatsAppTemplate;
   *   there is no WhatsApp provider, so the rendered text and a wa.me link are returned for a
   *   manual send. Either way the version records channel, template, who and when.
   */
  async sendOffer(user: AuthUser, id: string, dto: { channel: string; templateId: string }) {
    const channel = (dto.channel ?? '').trim().toLowerCase();
    if (!OFFER_SEND_CHANNELS.includes(channel as OfferSendChannel)) {
      throw new BadRequestException({ code: 'OFFER_CHANNEL_INVALID', message: 'channel must be email or whatsapp.' });
    }
    const visibility = await this.applicationVisibility(user);
    const offer = await this.prisma.offer.findFirst({
      where: { id, organizationId: user.organizationId, application: visibility },
      include: { application: { include: { candidate: true, vacancy: { include: { position: true } } } }, organization: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    const current = offer.currentVersionId ? await this.prisma.offerVersion.findUnique({ where: { id: offer.currentVersionId } }) : null;
    if (!current || current.status !== 'Approved' || offer.status !== 'Approved') {
      throw new ConflictException({ code: 'OFFER_NOT_APPROVED', message: 'Only an approved offer version can be sent.' });
    }
    const template = await this.resolveSendTemplate(user.organizationId, channel as OfferSendChannel, dto.templateId);
    const candidate = offer.application.candidate;
    const vars: Record<string, string> = {
      candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      positionTitle: offer.application.vacancy?.position?.title ?? '',
      organizationName: offer.organization?.name ?? '',
      offerCode: offer.offerCode,
    };
    const render = (text: string) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? '');
    const body = render(template.body);
    const subject = render(template.subject ?? `Your offer ${offer.offerCode}`);
    if (channel === 'email' && !candidate.email) throw new ConflictException({ code: 'OFFER_CANDIDATE_NO_CONTACT', message: 'The candidate has no email address.' });
    if (channel === 'whatsapp' && !candidate.phone) throw new ConflictException({ code: 'OFFER_CANDIDATE_NO_CONTACT', message: 'The candidate has no phone number.' });

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.offerVersion.updateMany({
        where: { id: current.id, status: 'Approved' },
        data: { status: 'Sent', sentChannel: channel, sentTemplateId: template.id, sentAt: new Date(), sentById: user.userId },
      });
      if (moved.count !== 1) throw new ConflictException({ code: 'OFFER_NOT_APPROVED', message: 'The version changed; reload and try again.' });
      await tx.offer.update({ where: { id }, data: { status: 'Sent' } });
      if (channel === 'email' && this.outbox) {
        await this.outbox.enqueueWithTx(tx, { organizationId: user.organizationId, toEmail: candidate.email!, subject, template: 'notification', payload: { title: subject, message: body } });
      }
    });
    const waLink = channel === 'whatsapp' ? `https://wa.me/${candidate.phone!.replace(/\D/g, '')}?text=${encodeURIComponent(body)}` : undefined;
    return { id, status: 'Sent', channel, templateId: template.id, ...(channel === 'email' ? { queued: Boolean(this.outbox) } : { message: body, waLink }) };
  }

  private async resolveSendTemplate(organizationId: string, channel: OfferSendChannel, templateId: string): Promise<{ id: string; subject: string | null; body: string }> {
    if (!templateId) throw new BadRequestException({ code: 'OFFER_TEMPLATE_INVALID', message: 'templateId is required.' });
    const [email, whatsapp] = await Promise.all([
      this.prisma.emailTemplate.findFirst({ where: { id: templateId, organizationId } }),
      this.prisma.whatsAppTemplate.findFirst({ where: { id: templateId, organizationId } }),
    ]);
    const mine = channel === 'email' ? email : whatsapp;
    const other = channel === 'email' ? whatsapp : email;
    if (!mine && other) throw new BadRequestException({ code: 'OFFER_TEMPLATE_CHANNEL_MISMATCH', message: `That template is a ${channel === 'email' ? 'WhatsApp' : 'email'} template.` });
    if (!mine || mine.status !== 'Active') throw new BadRequestException({ code: 'OFFER_TEMPLATE_INVALID', message: 'The template does not exist or is not active.' });
    return { id: mine.id, subject: email && channel === 'email' ? email.subject : null, body: mine.bodyTemplate };
  }

  async getApprovalInbox(user: AuthUser, disclosure: CompensationDisclosure): Promise<OfferApprovalInboxItem[]> {
    const userRoleCodes = user.roleCodes;
    const isAdmin = userRoleCodes.includes('ADMINISTRATOR');
    const visibility = await this.applicationReadVisibility(user);

    const where: Prisma.OfferApprovalWhereInput = {
      status: 'Pending',
      offerVersion: {
        offer: {
          organizationId: user.organizationId,
          application: visibility,
        },
      },
    };

    if (!isAdmin) {
      where.OR = [
        { approverUserId: user.userId },
        { roleCode: { in: userRoleCodes } },
      ];
    }

    const approvals = await this.prisma.offerApproval.findMany({
      where,
      include: {
        offerVersion: {
          include: {
            components: { where: { type: 'Salary', supersededAt: null }, take: 1 },
            offer: {
              include: {
                application: {
                  include: {
                    candidate: true,
                    vacancy: { include: { position: true, branch: true, vacancyRequest: { select: { grade: { select: { id: true, name: true } } } } } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return approvals.map((app) => ({
      id: app.id,
      offerId: app.offerVersion.offer.id,
      offerVersionId: app.offerVersionId,
      offerCode: app.offerVersion.offer.offerCode,
      candidateName: app.offerVersion.offer.application.candidate
        ? `${app.offerVersion.offer.application.candidate.firstName} ${app.offerVersion.offer.application.candidate.lastName}`
        : '',
      positionTitle: app.offerVersion.offer.application.vacancy.position.title,
      branchName: app.offerVersion.offer.application.vacancy.branch?.name,
      versionNumber: app.offerVersion.versionNumber,
      grade: app.offerVersion.offer.application.vacancy.vacancyRequest?.grade ?? null,
      ...(disclosure.viewOfferPay ? {
        monthlyPackage: app.offerVersion.monthlyPackage !== null ? Number(app.offerVersion.monthlyPackage) : null,
        packageCurrency: app.offerVersion.components[0]?.currency?.toUpperCase() === 'EGP' ? 'EGP' as const : 'AED' as const,
      } : {}),
      roleCode: app.roleCode,
      status: app.status,
      step: 1,
    }));
  }

  async submitDecision(user: AuthUser, approvalId: string, dto: OfferDecisionDto) {
    const visibility = await this.applicationReadVisibility(user);
    const approval = await this.prisma.offerApproval.findFirst({
      where: {
        id: approvalId,
        offerVersion: { offer: { organizationId: user.organizationId, application: visibility } },
      },
      include: { offerVersion: { include: { offer: true } } },
    });

    if (!approval || approval.offerVersion.offer.organizationId !== user.organizationId) {
      throw new NotFoundException('Approval not found');
    }

    if (approval.status !== 'Pending') {
      throw new BadRequestException('Approval has already been decided');
    }

    const isAuthorized =
      approval.approverUserId === user.userId ||
      user.roleCodes.includes(approval.roleCode) ||
      user.roleCodes.includes('ADMINISTRATOR');

    if (!isAuthorized) {
      throw new ForbiddenException('Not authorized to decide this approval');
    }

    const updateData: Prisma.OfferApprovalUpdateInput = {
      status: dto.decision === 'Approve' ? 'Approved' : 'Rejected',
      approver: { connect: { id: user.userId } },
      decidedAt: new Date(),
    };
    const note = (dto.note ?? dto.comment)?.trim();
    if (note) updateData.comment = note;

    // B7 (Mustafa): the approver inbox runs the same band check as the manager decision
    // (same codes; pay figures in the error only for OFFER_PAY_VIEW holders).
    if (dto.decision === 'Approve') {
      const v = await this.prisma.offerVersion.findUniqueOrThrow({
        where: { id: approval.offerVersionId },
        include: { components: { where: { supersededAt: null } }, offer: { include: { application: { include: { vacancy: { select: { branchId: true, branch: { select: { name: true } }, vacancyRequest: { select: { gradeId: true, grade: { select: { name: true } } } } } } } } } } },
      });
      await assertOfferInsideBand(
        this.prisma, user.organizationId,
        async () => Boolean(await this.userPermissions?.hasPermission(user.userId, user.organizationId, PAY_VIEW_PERMISSION)),
        v.components, v.offer.application.vacancy,
      );
    }

    const application = await this.prisma.application.findUnique({
      where: { id: approval.offerVersion.offer.applicationId },
      select: { primaryRecruiterId: true },
    });

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.offerApproval.update({
        where: { id: approvalId },
        data: updateData,
      });

      const pendingRemaining = await tx.offerApproval.count({
        where: { offerVersionId: approval.offerVersionId, status: 'Pending' },
      });

      if (dto.decision === 'Reject') {
        await tx.offerVersion.update({
          where: { id: approval.offerVersionId },
          data: { approvalStatus: 'Rejected', status: 'Changes Requested' },
        });
        await tx.offer.update({
          where: { id: approval.offerVersion.offerId },
          data: { status: 'Draft' }, // Revert offer status back to allow edits
        });
        return { decided: 'Rejected' as const };
      } else if (pendingRemaining === 0) {
        await tx.offerVersion.update({
          where: { id: approval.offerVersionId },
          data: { approvalStatus: 'Approved', status: 'Approved' },
        });
        await tx.offer.update({
          where: { id: approval.offerVersion.offerId },
          data: { status: 'Approved' },
        });
        return { decided: 'Approved' as const };
      }
      return { decided: 'StepApproved' as const };
    });

    const recruiterId = application?.primaryRecruiterId ?? null;
    if (recruiterId && recruiterId !== user.userId && outcome.decided !== 'StepApproved') {
      await this.notify({
        organizationId: user.organizationId,
        recipientUserId: recruiterId,
        type: 'OfferApprovalDecision',
        title: `Offer ${outcome.decided.toLowerCase()}`,
        message: `${user.roleCodes.includes('ADMINISTRATOR') ? 'An administrator' : 'An approver'} ${outcome.decided.toLowerCase()} offer version for ${approval.offerVersion.offer.offerCode}.`,
        entityType: 'Offer',
        entityId: approval.offerVersion.offer.id,
      });
    }
  }

  async updateOfferStatus(user: AuthUser, id: string, dto: UpdateOfferStatusDto) {
    const visibility = await this.applicationVisibility(user);
    const offer = await this.prisma.offer.findFirst({
      where: { id, organizationId: user.organizationId, application: visibility },
      include: { versions: true },
    });

    if (!offer) throw new NotFoundException('Offer not found');

    const allowedTransitions: Record<string, string[]> = {
      Draft: ['Withdrawn'],
      'Pending Approval': ['Withdrawn'],
      Approved: ['Sent', 'Expired', 'Withdrawn'],
      Sent: ['Accepted', 'Declined', 'Expired', 'Withdrawn'],
      Accepted: [],
      Declined: [],
      Expired: [],
      Withdrawn: [],
    };
    if (dto.status === 'Sent') {
      throw new BadRequestException({ code: 'OFFER_SEND_REQUIRES_TEMPLATE', message: 'Send an offer with POST /offers/:id/send { channel, templateId }.' });
    }
    if (!allowedTransitions[offer.status]?.includes(dto.status)) {
      throw new BadRequestException(`Cannot update status from ${offer.status} to ${dto.status}`);
    }

    const currentVersion = offer.versions.find((version) => version.id === offer.currentVersionId);
    if (!currentVersion) {
      throw new BadRequestException('Offer has no current version');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // B5: the version carries the state (replaces isLocked).
      await tx.offerVersion.update({
        where: { id: currentVersion.id },
        data: { status: dto.status },
      });

      // B5 exit rule: a declined offer rejects the file with reason "Declined offer".
      if (dto.status === 'Declined') {
        const app = await tx.application.findUnique({ where: { id: offer.applicationId }, select: { stage: true } });
        if (app && !['Joined', 'Rejected', 'Withdrawn'].includes(app.stage)) {
          await tx.application.update({
            where: { id: offer.applicationId },
            data: { stage: 'Rejected', rejectionReason: DECLINED_OFFER_REASON, version: { increment: 1 } },
          });
          await tx.applicationStatusHistory.create({
            data: { applicationId: offer.applicationId, fromStage: app.stage, toStage: 'Rejected', changedById: user.userId, reason: DECLINED_OFFER_REASON },
          });
        }
      }

      await tx.offer.update({
        where: { id },
        data: { status: dto.status },
      });

      if (dto.status === 'Accepted') {
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: offer.applicationId,
            toStage: 'Pre-Hire',
            changedById: user.userId,
            reason: `Offer ${offer.offerCode} accepted. Transitioned to Pre-Hire.`,
          },
        });
        await tx.application.update({
          where: { id: offer.applicationId },
          data: { stage: 'Pre-Hire' },
        });
      }
      return { success: true, status: dto.status };
    });

    if (['Sent', 'Accepted', 'Declined'].includes(dto.status)) {
      const application = await this.prisma.application.findUnique({
        where: { id: offer.applicationId },
        select: { primaryRecruiterId: true },
      });
      const recruiterId = application?.primaryRecruiterId ?? null;
      if (recruiterId && recruiterId !== user.userId) {
        await this.notify({
          organizationId: user.organizationId,
          recipientUserId: recruiterId,
          type: `Offer${dto.status}`,
          title: `Offer ${offer.offerCode} ${dto.status.toLowerCase()}`,
          message: `Offer ${offer.offerCode} is now ${dto.status}.`,
          entityType: 'Offer',
          entityId: offer.id,
        });
      }
    }

    return result;
  }

  // --- Mappers ---

  private mapOfferSummary(offer: OfferRecord, disclosure: CompensationDisclosure) {
    const version = offer.versions?.[0];
    return {
      id: offer.id,
      organizationId: offer.organizationId,
      applicationId: offer.applicationId,
      vacancyId: offer.application?.vacancy?.id,
      offerCode: offer.offerCode,
      status: offer.status,
      candidateName: offer.application?.candidate
        ? `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`
        : undefined,
      positionTitle: offer.application?.vacancy?.position?.title,
      grade: offer.application?.vacancy?.vacancyRequest?.grade ?? null,
      /** M3: the job's site (branch) for band matching; siteId is an alias of branchId. */
      branchId: offer.application?.vacancy?.branchId ?? null,
      siteId: offer.application?.vacancy?.branchId ?? null,
      location: offer.application?.vacancy?.location ?? offer.application?.vacancy?.branch?.name ?? null,
      currentVersionId: offer.currentVersionId,
      currentVersion: version ? this.mapVersion(version, disclosure) : null,
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  private mapOfferDetail(offer: OfferRecord, disclosure: CompensationDisclosure) {
    const currentVersion = (offer.currentVersionId ? offer.versions?.find((v) => v.id === offer.currentVersionId) : null) ?? offer.versions?.[0];
    return {
      id: offer.id,
      organizationId: offer.organizationId,
      applicationId: offer.applicationId,
      vacancyId: offer.application?.vacancy?.id,
      offerCode: offer.offerCode,
      status: offer.status,
      candidateName: offer.application?.candidate
        ? `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`
        : undefined,
      positionTitle: offer.application?.vacancy?.position?.title,
      grade: offer.application?.vacancy?.vacancyRequest?.grade ?? null,
      /** M3: the job's site (branch) for band matching; siteId is an alias of branchId. */
      branchId: offer.application?.vacancy?.branchId ?? null,
      siteId: offer.application?.vacancy?.branchId ?? null,
      location: offer.application?.vacancy?.location ?? offer.application?.vacancy?.branch?.name ?? null,
      currentVersionId: offer.currentVersionId,
      currentVersion: currentVersion ? this.mapVersion(currentVersion, disclosure) : null,
      versions: offer.versions?.map((v) => this.mapVersion(v, disclosure)) || [],
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  private mapVersion(v: OfferVersionRecord, disclosure: CompensationDisclosure) {
    const showCompensation = disclosure.viewOfferPay;
    return {
      id: v.id,
      offerId: v.offerId,
      versionNumber: v.versionNumber,
      ...(showCompensation ? {
        monthlyPackage: v.monthlyPackage ? Number(v.monthlyPackage) : null,
        annualFixed: v.annualFixed ? Number(v.annualFixed) : null,
      } : {}),
      contractType: v.contractType,
      probationPeriod: v.probationPeriod,
      offerExpiry: v.offerExpiry ? v.offerExpiry.toISOString() : null,
      proposedJoiningDate: v.proposedJoiningDate ? v.proposedJoiningDate.toISOString() : null,
      workLocation: v.workLocation,
      workingSchedule: v.workingSchedule,
      approvalStatus: v.approvalStatus,
      status: v.status,
      sentChannel: v.sentChannel ?? null,
      sentAt: v.sentAt ? v.sentAt.toISOString() : null,
      /** B5 follow-up: the approver's note (latest decided approval with a comment). */
      approverNote: (() => {
        const a = [...(v.approvals ?? [])].filter((x) => x.decidedAt && x.comment?.trim()).sort((x, y) => y.decidedAt!.getTime() - x.decidedAt!.getTime())[0];
        return a ? { byUserId: a.approverUserId, byName: a.approver?.displayName ?? null, at: a.decidedAt!.toISOString(), text: a.comment! } : null;
      })(),
      /** derived: a version is frozen once it left Draft/Pending/Changes Requested. */
      // TODO(E3): remove isLocked once Frontend reads `status` (derived, read-only).
      isLocked: !['Draft', 'Pending Approval', 'Changes Requested'].includes(v.status),
      components:
        v.components?.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          ...(showCompensation ? { amount: c.amount ? Number(c.amount) : null } : {}),
          currency: c.currency?.toUpperCase() === 'EGP' ? 'EGP' : 'AED',
          frequency: c.frequency,
          isTaxable: c.isTaxable,
        })) || [],
      approvals:
        v.approvals?.map((a) => ({
          id: a.id,
          offerVersionId: a.offerVersionId,
          approverUserId: a.approverUserId,
          approverName: a.approver?.displayName,
          roleCode: a.roleCode,
          status: a.status,
          comment: a.comment,
          decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        })) || [],
      createdAt: v.createdAt.toISOString(),
    };
  }
}
