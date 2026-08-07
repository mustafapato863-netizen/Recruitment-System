import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AuthUser } from '@recruitflow/contracts';
import type {
  CreateHiringCaseDto,
  FinalApprovalDto,
  JoiningUpdateDto,
  UpdateComplianceDto,
} from './hiring.dto';

@Injectable()
export class HiringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createHiringCase(organizationId: string, dto: CreateHiringCaseDto, user: AuthUser) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, organizationId },
      include: { application: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'Accepted') {
      throw new BadRequestException('Offer must be Accepted to create a hiring case');
    }

    const existingCase = await this.prisma.hiringCase.findFirst({
      where: { applicationId: offer.applicationId, organizationId },
    });

    if (existingCase) {
      throw new BadRequestException('Hiring case already exists for this application');
    }

    const hiringCase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hiringCase.create({
        data: {
          organizationId,
          applicationId: offer.applicationId,
          offerId: offer.id,
          status: 'Pending Compliance',
          ownerUserId: user.userId,
          complianceRequirements: {
            create: [
              { type: 'Document', name: 'Identity Document', isRequired: true, status: 'Pending' },
              { type: 'Check', name: 'Background Check', isRequired: true, status: 'Pending' },
            ],
          },
          approvals: {
            create: [{ roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending' }],
          },
        },
      });

      await tx.application.update({
        where: { id: offer.applicationId },
        data: { stage: 'Pre-Hire' },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: offer.applicationId,
          fromStage: offer.application.stage,
          toStage: 'Pre-Hire',
          changedById: user.userId,
          reason: 'Hiring case created',
        },
      });

      return created;
    });

    this.auditService.log({
      organizationId,
      actorUserId: user.userId,
      action: 'Create Hiring Case',
      entityType: 'HiringCase',
      entityId: hiringCase.id,
      result: 'Success',
    });

    return hiringCase;
  }

  async getMetrics(organizationId: string) {
    const counts = await this.prisma.hiringCase.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    });

    return counts.reduce((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);
  }

  async listHiringCases(organizationId: string, status?: string) {
    const cases = await this.prisma.hiringCase.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: {
        application: {
          include: { candidate: true, vacancy: { include: { position: true, branch: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return cases.map(c => ({
      id: c.id,
      organizationId: c.organizationId,
      applicationId: c.applicationId,
      offerId: c.offerId,
      status: c.status,
      plannedJoiningDate: c.plannedJoiningDate?.toISOString() ?? null,
      actualJoiningDate: c.actualJoiningDate?.toISOString() ?? null,
      ownerUserId: c.ownerUserId,
      candidateName: `${c.application.candidate.firstName} ${c.application.candidate.lastName}`,
      positionTitle: c.application.vacancy.position.title,
      branchName: c.application.vacancy.branch.name,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async getHiringCase(organizationId: string, id: string) {
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id, organizationId },
      include: {
        complianceRequirements: true,
        approvals: { include: { approver: true } },
        application: { include: { candidate: true, vacancy: { include: { position: true, branch: true } } } }
      }
    });

    if (!hiringCase) {
      throw new NotFoundException('Hiring case not found');
    }

    return {
      ...hiringCase,
      createdAt: hiringCase.createdAt.toISOString(),
      updatedAt: hiringCase.updatedAt.toISOString(),
      candidateName: `${hiringCase.application.candidate.firstName} ${hiringCase.application.candidate.lastName}`,
      positionTitle: hiringCase.application.vacancy.position.title,
      branchName: hiringCase.application.vacancy.branch.name,
      plannedJoiningDate: hiringCase.plannedJoiningDate?.toISOString() ?? null,
      actualJoiningDate: hiringCase.actualJoiningDate?.toISOString() ?? null,
      complianceRequirements: hiringCase.complianceRequirements.map(req => ({
         ...req,
         expiryDate: req.expiryDate?.toISOString() ?? null,
         verifiedAt: req.verifiedAt?.toISOString() ?? null,
      })),
      approvals: hiringCase.approvals.map(app => ({
        ...app,
        decidedAt: app.decidedAt?.toISOString() ?? null,
        approverName: app.approver ? app.approver.displayName : null,
      }))
    };
  }

  async updateCompliance(organizationId: string, caseId: string, reqId: string, dto: UpdateComplianceDto, user: AuthUser) {
    const requirement = await this.prisma.complianceRequirement.findFirst({
      where: { id: reqId, hiringCaseId: caseId, hiringCase: { organizationId } }
    });

    if (!requirement) {
      throw new NotFoundException('Compliance requirement not found');
    }

    const data: Prisma.ComplianceRequirementUpdateInput = {
      status: dto.status,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
    };

    if (dto.status === 'Verified') {
      data.verifiedAt = new Date();
      data.verifier = { connect: { id: user.userId } };
    }

    const updated = await this.prisma.complianceRequirement.update({
      where: { id: reqId },
      data
    });

    this.auditService.log({
      organizationId,
      actorUserId: user.userId,
      action: 'Update Compliance',
      entityType: 'ComplianceRequirement',
      entityId: reqId,
      result: 'Success',
    });

    return updated;
  }

  async submitForFinalApproval(organizationId: string, caseId: string, user: AuthUser) {
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id: caseId, organizationId },
      include: { complianceRequirements: true }
    });

    if (!hiringCase) throw new NotFoundException('Hiring case not found');

    if (hiringCase.status !== 'Pending Compliance') {
      throw new BadRequestException('Hiring case is not pending compliance');
    }

    const allVerified = hiringCase.complianceRequirements
      .filter(req => req.isRequired)
      .every(req => req.status === 'Verified' || req.status === 'Not Required');

    if (!allVerified) {
      throw new BadRequestException('Not all required compliance checks are verified');
    }

    const updated = await this.prisma.hiringCase.update({
      where: { id: caseId },
      data: { status: 'Pending Final Approval' }
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.userId,
      action: 'Submit Hiring Case For Final Approval',
      entityType: 'HiringCase',
      entityId: caseId,
      result: 'Success',
    });

    return { success: true, status: updated.status };
  }

  async getFinalApprovalInbox(organizationId: string) {
    const cases = await this.prisma.hiringCase.findMany({
      where: { organizationId, status: 'Pending Final Approval' },
      include: {
        application: { include: { candidate: true, vacancy: { include: { position: true, branch: true } } } }
      }
    });

    return cases.map(c => ({
      id: c.id,
      candidateName: `${c.application.candidate.firstName} ${c.application.candidate.lastName}`,
      positionTitle: c.application.vacancy.position.title,
      branchName: c.application.vacancy.branch.name,
      status: c.status
    }));
  }

  async decideFinalApproval(organizationId: string, caseId: string, dto: FinalApprovalDto, user: AuthUser) {
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id: caseId, organizationId },
      include: { approvals: true }
    });

    if (!hiringCase) throw new NotFoundException('Hiring case not found');
    if (hiringCase.status !== 'Pending Final Approval') {
      throw new BadRequestException('Hiring case is not pending final approval');
    }

    const approval = hiringCase.approvals.find(
      (a) => a.roleCode === 'FINAL_HIRING_APPROVER' && a.status === 'Pending',
    );
    if (!approval) throw new BadRequestException('No pending final approval found');

    const isAuthorized =
      approval.approverUserId === user.userId ||
      user.roleCodes.includes(approval.roleCode);
    if (!isAuthorized) {
      throw new ForbiddenException('Not authorized to decide this approval');
    }

    const status = dto.decision === 'Approve' ? 'Approved' : 'Rejected';

    await this.prisma.$transaction(async (tx) => {
      await tx.hiringCaseApproval.update({
        where: { id: approval.id },
        data: {
          status,
          comment: dto.comment,
          approverUserId: user.userId,
          decidedAt: new Date(),
        },
      });

      await tx.hiringCase.update({
        where: { id: caseId },
        data: { status: dto.decision === 'Approve' ? 'Awaiting Joining' : 'Withdrawn' },
      });
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.userId,
      action: 'Decide Hiring Case Final Approval',
      entityType: 'HiringCaseApproval',
      entityId: approval.id,
      result: 'Success',
      reason: dto.comment,
    });

    return { success: true };
  }

  async confirmJoining(
    organizationId: string,
    caseId: string,
    dto: JoiningUpdateDto,
    user: AuthUser,
  ) {
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id: caseId, organizationId },
      include: { application: { include: { vacancy: true } } }
    });

    if (!hiringCase) throw new NotFoundException('Hiring case not found');

    if (hiringCase.status !== 'Awaiting Joining') {
      throw new BadRequestException('Hiring case is not awaiting joining');
    }

    if (dto.status === 'Joined' && hiringCase.application.vacancy.joinedHeadcount >= hiringCase.application.vacancy.approvedHeadcount) {
      throw new BadRequestException('Vacancy headcount is already full');
    }

    const updateData: Prisma.HiringCaseUpdateInput = { status: dto.status };
    if (dto.actualJoiningDate) {
      updateData.actualJoiningDate = new Date(dto.actualJoiningDate);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.hiringCase.update({
        where: { id: caseId },
        data: updateData,
      });

      if (dto.status === 'Joined') {
        const vacancyUpdate = await tx.vacancy.updateMany({
          where: {
            id: hiringCase.application.vacancyId,
            organizationId,
            joinedHeadcount: { lt: hiringCase.application.vacancy.approvedHeadcount },
          },
          data: { joinedHeadcount: { increment: 1 } },
        });

        if (vacancyUpdate.count !== 1) {
          throw new BadRequestException('Vacancy headcount is already full');
        }

        await tx.application.update({
          where: { id: hiringCase.applicationId },
          data: { stage: 'Joined' },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId: hiringCase.applicationId,
            fromStage: hiringCase.application.stage,
            toStage: 'Joined',
            changedById: user.userId,
            reason: 'Candidate joined',
          },
        });
      }
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.userId,
      action: 'Confirm Joining',
      entityType: 'HiringCase',
      entityId: caseId,
      result: 'Success',
    });

    return { success: true };
  }
}
