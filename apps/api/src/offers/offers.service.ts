import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CreateOfferDto,
  CreateOfferRevisionDto,
  OfferDecisionDto,
  UpdateOfferStatusDto,
} from './offers.dto';
import type { AuthUser } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { NotificationsService } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

type CompensationDisclosure = { viewSalary: boolean };

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
  isLocked: boolean;
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
    candidate?: { firstName: string; lastName: string } | null;
    vacancy?: { position?: { title: string } | null } | null;
  } | null;
  versions?: OfferVersionRecord[];
};

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  async getOffers(user: AuthUser, query: { status?: string; search?: string }, disclosure: CompensationDisclosure) {
    const where: Prisma.OfferWhereInput = {
      organizationId: user.organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { offerCode: { contains: query.search, mode: 'insensitive' } },
        { application: { candidate: { firstName: { contains: query.search, mode: 'insensitive' } } } },
        { application: { candidate: { lastName: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const offers = await this.prisma.offer.findMany({
      where,
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true } },
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map((o) => this.mapOfferSummary(o, disclosure));
  }

  async getOfferById(user: AuthUser, id: string, disclosure: CompensationDisclosure) {
    const offer = await this.prisma.offer.findUnique({
      where: { id, organizationId: user.organizationId },
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true } },
          },
        },
        versions: {
          include: {
            components: true,
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
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId, organizationId: user.organizationId },
    });

    if (!application) throw new NotFoundException('Application not found');

    const year = new Date().getUTCFullYear();
    const offerCode = await this.nextOfferCode(year);
    const { monthlyPackage, annualFixed } = this.calculatePackage(dto.components);

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
          workLocation: dto.workLocation ?? null,
          workingSchedule: dto.workingSchedule ?? null,
          approvalStatus: 'Pending',
          components: {
            create: dto.components.map((c) => ({
              type: c.type,
              name: c.name,
              amount: c.amount ?? null,
              currency: c.currency ?? null,
              frequency: c.frequency ?? null,
              isTaxable: c.isTaxable,
            })),
          },
          approvals: {
            create: [
              { roleCode: 'OFFER_APPROVER', status: 'Pending' },
            ],
          },
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { currentVersionId: version.id, status: 'Pending Approval' },
      });

      return offer.id;
    });

    const approverIds = await this.findActiveRoleUserIds(user.organizationId, 'OFFER_APPROVER');
    for (const recipientUserId of approverIds) {
      if (recipientUserId === user.userId) continue;
      await this.notify({
        organizationId: user.organizationId,
        recipientUserId,
        type: 'OfferApprovalRequested',
        title: 'Offer awaiting your approval',
        message: `Offer ${offerCode} was submitted and is pending approval.`,
        entityType: 'Offer',
        entityId: offerId,
      });
    }

    return offerId;
  }

  async createOfferRevision(user: AuthUser, id: string, dto: CreateOfferRevisionDto) {
    const offer = await this.prisma.offer.findUnique({
      where: { id, organizationId: user.organizationId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!offer) throw new NotFoundException('Offer not found');

    const lastVersion = offer.versions[0];
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;
    const { monthlyPackage, annualFixed } = this.calculatePackage(dto.components);

    const versionId = await this.prisma.$transaction(async (tx) => {
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
          workLocation: dto.workLocation ?? null,
          workingSchedule: dto.workingSchedule ?? null,
          approvalStatus: 'Pending',
          components: {
            create: dto.components.map((c) => ({
              type: c.type,
              name: c.name,
              amount: c.amount ?? null,
              currency: c.currency ?? null,
              frequency: c.frequency ?? null,
              isTaxable: c.isTaxable,
            })),
          },
          approvals: {
            create: [
              { roleCode: 'OFFER_APPROVER', status: 'Pending' },
            ],
          },
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { currentVersionId: version.id, status: 'Pending Approval' },
      });

      return version.id;
    });

    const approverIds = await this.findActiveRoleUserIds(user.organizationId, 'OFFER_APPROVER');
    for (const recipientUserId of approverIds) {
      if (recipientUserId === user.userId) continue;
      await this.notify({
        organizationId: user.organizationId,
        recipientUserId,
        type: 'OfferApprovalRequested',
        title: 'Offer revision awaiting approval',
        message: `Revision ${newVersionNumber} of offer ${offer.offerCode} is pending approval.`,
        entityType: 'Offer',
        entityId: offer.id,
      });
    }

    return versionId;
  }

  async getApprovalInbox(user: AuthUser, disclosure: CompensationDisclosure) {
    const userRoleCodes = user.roleCodes;
    const isAdmin = userRoleCodes.includes('ADMINISTRATOR');

    const where: Prisma.OfferApprovalWhereInput = {
      status: 'Pending',
      offerVersion: {
        offer: {
          organizationId: user.organizationId,
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
            offer: {
              include: {
                application: {
                  include: {
                    candidate: true,
                    vacancy: { include: { position: true, branch: true } },
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
      offerVersionId: app.offerVersionId,
      offerCode: app.offerVersion.offer.offerCode,
      candidateName: app.offerVersion.offer.application.candidate
        ? `${app.offerVersion.offer.application.candidate.firstName} ${app.offerVersion.offer.application.candidate.lastName}`
        : '',
      positionTitle: app.offerVersion.offer.application.vacancy.position.title,
      branchName: app.offerVersion.offer.application.vacancy.branch?.name,
      versionNumber: app.offerVersion.versionNumber,
      monthlyPackage: disclosure.viewSalary ? Number(app.offerVersion.monthlyPackage) : null,
      roleCode: app.roleCode,
      status: app.status,
    }));
  }

  async submitDecision(user: AuthUser, approvalId: string, dto: OfferDecisionDto) {
    const approval = await this.prisma.offerApproval.findUnique({
      where: { id: approvalId },
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
    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
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
          data: { approvalStatus: 'Rejected' },
        });
        await tx.offer.update({
          where: { id: approval.offerVersion.offerId },
          data: { status: 'Draft' }, // Revert offer status back to allow edits
        });
        return { decided: 'Rejected' as const };
      } else if (pendingRemaining === 0) {
        await tx.offerVersion.update({
          where: { id: approval.offerVersionId },
          data: { approvalStatus: 'Approved', isLocked: true },
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
    const offer = await this.prisma.offer.findUnique({
      where: { id, organizationId: user.organizationId },
      include: { versions: true },
    });

    if (!offer) throw new NotFoundException('Offer not found');

    const allowedTransitions: Record<string, string[]> = {
      Draft: ['Withdrawn'],
      'Pending Approval': ['Withdrawn'],
      Approved: ['Sent', 'Withdrawn'],
      Sent: ['Accepted', 'Declined', 'Expired', 'Withdrawn'],
      Accepted: [],
      Declined: [],
      Expired: [],
      Withdrawn: [],
    };
    if (!allowedTransitions[offer.status]?.includes(dto.status)) {
      throw new BadRequestException(`Cannot update status from ${offer.status} to ${dto.status}`);
    }

    const currentVersion = offer.versions.find((version) => version.id === offer.currentVersionId);
    if (!currentVersion) {
      throw new BadRequestException('Offer has no current version');
    }
    if (dto.status === 'Sent' && currentVersion.approvalStatus !== 'Approved') {
      throw new BadRequestException('Only an approved offer version can be sent');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'Sent') {
        await tx.offerVersion.update({
          where: { id: currentVersion.id },
          data: { isLocked: true },
        });
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
      offerCode: offer.offerCode,
      status: offer.status,
      candidateName: offer.application?.candidate
        ? `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`
        : undefined,
      positionTitle: offer.application?.vacancy?.position?.title,
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
      offerCode: offer.offerCode,
      status: offer.status,
      candidateName: offer.application?.candidate
        ? `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`
        : undefined,
      positionTitle: offer.application?.vacancy?.position?.title,
      currentVersionId: offer.currentVersionId,
      currentVersion: currentVersion ? this.mapVersion(currentVersion, disclosure) : null,
      versions: offer.versions?.map((v) => this.mapVersion(v, disclosure)) || [],
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  private mapVersion(v: OfferVersionRecord, disclosure: CompensationDisclosure) {
    const showCompensation = disclosure.viewSalary;
    return {
      id: v.id,
      offerId: v.offerId,
      versionNumber: v.versionNumber,
      monthlyPackage: showCompensation && v.monthlyPackage ? Number(v.monthlyPackage) : null,
      annualFixed: showCompensation && v.annualFixed ? Number(v.annualFixed) : null,
      contractType: v.contractType,
      probationPeriod: v.probationPeriod,
      offerExpiry: v.offerExpiry ? v.offerExpiry.toISOString() : null,
      proposedJoiningDate: v.proposedJoiningDate ? v.proposedJoiningDate.toISOString() : null,
      workLocation: v.workLocation,
      workingSchedule: v.workingSchedule,
      approvalStatus: v.approvalStatus,
      isLocked: v.isLocked,
      components:
        v.components?.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          amount: showCompensation && c.amount ? Number(c.amount) : null,
          currency: c.currency,
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
