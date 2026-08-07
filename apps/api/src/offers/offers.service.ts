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
  constructor(private prisma: PrismaService) {}

  private async nextOfferCode(year: number): Promise<string> {
    const sequence = await this.prisma.codeSequence.upsert({
      where: { key: `OFR:${year}` },
      create: { key: `OFR:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `OFF-${sequence.lastIssued.toString().padStart(4, '0')}`;
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

  async getOffers(user: AuthUser, query: { status?: string; search?: string }) {
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

    return offers.map((o) => this.mapOfferSummary(o));
  }

  async getOfferById(user: AuthUser, id: string) {
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
    return this.mapOfferDetail(offer);
  }

  async createOffer(user: AuthUser, dto: CreateOfferDto) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId, organizationId: user.organizationId },
    });

    if (!application) throw new NotFoundException('Application not found');

    const year = new Date().getUTCFullYear();
    const offerCode = await this.nextOfferCode(year);
    const { monthlyPackage, annualFixed } = this.calculatePackage(dto.components);

    return this.prisma.$transaction(async (tx) => {
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

    return this.prisma.$transaction(async (tx) => {
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
  }

  async getApprovalInbox(user: AuthUser) {
    const userRoleCodes = user.roleCodes;

    const approvals = await this.prisma.offerApproval.findMany({
      where: {
        status: 'Pending',
        OR: [
          { approverUserId: user.userId },
          { roleCode: { in: userRoleCodes } },
        ],
        offerVersion: {
          offer: {
            organizationId: user.organizationId,
          },
        },
      },
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
      monthlyPackage: Number(app.offerVersion.monthlyPackage),
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
      user.roleCodes.includes(approval.roleCode);

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

    return this.prisma.$transaction(async (tx) => {
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
      } else if (pendingRemaining === 0) {
        await tx.offerVersion.update({
          where: { id: approval.offerVersionId },
          data: { approvalStatus: 'Approved', isLocked: true },
        });
        await tx.offer.update({
          where: { id: approval.offerVersion.offerId },
          data: { status: 'Approved' },
        });
      }
    });
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

    return this.prisma.$transaction(async (tx) => {
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
  }

  // --- Mappers ---

  private mapOfferSummary(offer: OfferRecord) {
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
      currentVersion: version ? this.mapVersion(version) : null,
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  private mapOfferDetail(offer: OfferRecord) {
    const currentVersion = offer.versions?.find((v) => v.id === offer.currentVersionId);
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
      currentVersion: currentVersion ? this.mapVersion(currentVersion) : null,
      versions: offer.versions?.map((v) => this.mapVersion(v)) || [],
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  private mapVersion(v: OfferVersionRecord) {
    return {
      id: v.id,
      offerId: v.offerId,
      versionNumber: v.versionNumber,
      monthlyPackage: v.monthlyPackage ? Number(v.monthlyPackage) : null,
      annualFixed: v.annualFixed ? Number(v.annualFixed) : null,
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
          amount: c.amount ? Number(c.amount) : null,
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
