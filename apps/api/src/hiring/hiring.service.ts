import { JOINING_CHECK_LABELS } from '../applications/application-gates';
import { claimApplicationJoin, recordJoin } from '../vacancy-core/vacancy-lifecycle';
import {
  RECORD_ACTUAL_JOINING,
  assertCanMarkJoined,
  compliancePlan,
  currentCaseFingerprint,
  invalidateStaleApproval,
  isResponsibleRecruiter,
  joiningTypeForRequirement,
  parseSnapshot,
  snapshotForNewCase,
} from './joining-policy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
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
import { AccessControlService } from '../access-control/access-control.service';
import { loadAccessProfile } from '../common/access/file-access';

@Injectable()
export class HiringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() @Inject(AccessControlService) private readonly accessControl?: AccessControlService,
  ) {}

  private async applicationVisibility(user?: AuthUser) {
    return user && this.accessControl
      ? this.accessControl.getApplicationVisibilityWhere(user)
      : undefined;
  }

  /** Read-only: owners plus the current final-hire/offer approver of the file (B1 follow-up). */
  private async applicationReadVisibility(user?: AuthUser) {
    return user && this.accessControl
      ? this.accessControl.getApplicationReadVisibilityWhere(user)
      : undefined;
  }

  /**
   * LICENSE_CHECK: the hiring cases in the caller's role data scope (ownership not required).
   * Null when the caller doesn't hold LICENSE_CHECK.
   */
  private async licenseScope(user?: AuthUser): Promise<Prisma.ApplicationWhereInput | null> {
    if (!user || !this.accessControl) return null;
    const profile = await loadAccessProfile(this.prisma, user);
    if (!profile.permissions.includes('LICENSE_CHECK')) return null;
    if (profile.isOversight || profile.permissions.includes('APPLICATION_VIEW')) {
      return this.accessControl.getApplicationScopeWhere(user);
    }
    return licenseAssignmentWhere(user.userId, user.organizationId);
  }

  private async userHas(user: AuthUser, code: string): Promise<boolean> {
    return (await loadAccessProfile(this.prisma, user)).permissions.includes(code);
  }

  /** Normal visibility OR, for LICENSE_CHECK holders, their data scope. */
  private withLicense(visibility: Prisma.ApplicationWhereInput | undefined, license: Prisma.ApplicationWhereInput | null) {
    if (!visibility) return undefined;
    return license ? { OR: [visibility, license] } : visibility;
  }

  /** True when LICENSE_CHECK is the caller's only hiring access (no APPLICATION_VIEW / approval permissions, not oversight). */
  private async isLicenseOnly(user?: AuthUser): Promise<boolean> {
    if (!user) return false;
    const profile = await loadAccessProfile(this.prisma, user);
    if (profile.isOversight || !profile.permissions.includes('LICENSE_CHECK')) return false;
    return !['APPLICATION_VIEW', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL'].some((c) => profile.permissions.includes(c));
  }

  /** Final approval does not open the rest of the file. Oversight and file owners are unchanged. */
  private async isFinalApproverOnly(user?: AuthUser): Promise<boolean> {
    if (!user) return false;
    const profile = await loadAccessProfile(this.prisma, user);
    if (profile.isOversight || !profile.permissions.includes('FINAL_HIRING_APPROVAL')) return false;
    return !['APPLICATION_VIEW', 'CANDIDATE_VIEW', 'LICENSE_CHECK', 'APPROVE_OFFERS'].some((c) => profile.permissions.includes(c));
  }

  async createHiringCase(organizationId: string, dto: CreateHiringCaseDto, user: AuthUser) {
    const offerFile = await this.prisma.offer.findFirst({ where: { id: dto.offerId, organizationId }, select: { applicationId: true } });
    if (offerFile && this.accessControl) await this.accessControl.assertApplicationAccess(user, offerFile.applicationId);
    const visibility = await this.applicationVisibility(user);
    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, organizationId, ...(visibility ? { application: visibility } : {}) },
      include: { application: { include: { vacancy: { include: { position: { select: { metadata: true } } } } } } },
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

    const snapshot = snapshotForNewCase(offer.application.vacancy.position?.metadata);
    const hiringCase = await this.prisma.$transaction(async (tx) => {
      const verified = await tx.joiningCheck.findMany({ where: { applicationId: offer.applicationId, verified: true } });
      const created = await tx.hiringCase.create({
        data: {
          organizationId,
          applicationId: offer.applicationId,
          offerId: offer.id,
          status: 'Pending Compliance',
          ownerUserId: user.userId,
          requirementSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          complianceRequirements: {
            create: compliancePlan(snapshot).map((item) => {
              const checkType = joiningTypeForRequirement(item);
              const row = checkType ? verified.find((check) => check.type === checkType) : undefined;
              return {
                ...item,
                status: row ? 'Verified' : 'Pending',
                ...(row?.verifiedAt ? { verifiedAt: row.verifiedAt } : {}),
                ...(row?.verifiedById ? { verifiedById: row.verifiedById } : {}),
                ...(row?.expiryDate ? { expiryDate: row.expiryDate } : {}),
                ...(row?.documentId ? { documentId: row.documentId } : {}),
              };
            }),
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

  async getMetrics(organizationId: string, user?: AuthUser) {
    const visibility = await this.applicationVisibility(user);
    const counts = await this.prisma.hiringCase.groupBy({
      by: ['status'],
      where: { organizationId, ...(visibility ? { application: visibility } : {}) },
      _count: { _all: true },
    });

    return counts.reduce((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);
  }

  async listHiringCases(organizationId: string, status?: string, user?: AuthUser, applicationId?: string) {
    const visibility = this.withLicense(await this.applicationVisibility(user), await this.licenseScope(user));
    const cases = await this.prisma.hiringCase.findMany({
      where: { organizationId, ...(status ? { status } : {}), ...(applicationId ? { applicationId } : {}), ...(visibility ? { application: visibility } : {}) },
      include: {
        application: {
          include: { candidate: true, vacancy: { include: { position: true, branch: true } } }
        },
        complianceRequirements: {
          include: { verifier: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    if (await this.isLicenseOnly(user)) return cases.map(licenseView);
    if (await this.isFinalApproverOnly(user)) return cases.map(finalApproverView);
    return cases.map(c => {
      const totalItems = c.complianceRequirements.length;
      const completedItems = c.complianceRequirements.filter(
        req => req.status === 'Verified' || req.status === 'Not Required'
      ).length;

      return {
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
        approvedHeadcount: c.application.vacancy.approvedHeadcount,
        joinedHeadcount: c.application.vacancy.joinedHeadcount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        completedItems,
        totalItems,
        complianceRequirements: c.complianceRequirements.map(req => ({
          ...req,
          verifiedBy: req.verifier ? req.verifier.displayName : null,
          verifiedAt: req.verifiedAt?.toISOString() ?? null,
          expiryDate: req.expiryDate?.toISOString() ?? null,
          createdAt: req.createdAt.toISOString(),
          updatedAt: req.updatedAt.toISOString(),
        })),
      };
    });
  }

  async getHiringCase(organizationId: string, id: string, user?: AuthUser) {
    const visibility = this.withLicense(await this.applicationReadVisibility(user), await this.licenseScope(user));
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id, organizationId, ...(visibility ? { application: visibility } : {}) },
      include: {
        complianceRequirements: true,
        approvals: { include: { approver: true } },
        application: { include: { candidate: true, vacancy: { include: { position: true, branch: true } } } }
      }
    });

    if (!hiringCase) {
      throw new NotFoundException('Hiring case not found');
    }
    if (await this.isLicenseOnly(user)) return licenseView(hiringCase);
    if (await this.isFinalApproverOnly(user)) return finalApproverView(hiringCase);
    const seeSalary = user ? await this.userHas(user, 'VIEW_CURRENT_SALARY') : false;

    return {
      ...hiringCase,
      createdAt: hiringCase.createdAt.toISOString(),
      updatedAt: hiringCase.updatedAt.toISOString(),
      candidateName: `${hiringCase.application.candidate.firstName} ${hiringCase.application.candidate.lastName}`,
      positionTitle: hiringCase.application.vacancy.position.title,
      branchName: hiringCase.application.vacancy.branch.name,
      approvedHeadcount: hiringCase.application.vacancy.approvedHeadcount,
      joinedHeadcount: hiringCase.application.vacancy.joinedHeadcount,
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
      })),
      application: seeSalary ? hiringCase.application : omitCandidateSalary(hiringCase.application),
    };
  }

  async updateCompliance(organizationId: string, caseId: string, reqId: string, dto: UpdateComplianceDto, user: AuthUser) {
    const license = await this.licenseScope(user);
    const visibility = this.withLicense(await this.applicationVisibility(user), license);
    const requirement = await this.prisma.complianceRequirement.findFirst({
      where: { id: reqId, hiringCaseId: caseId, hiringCase: { organizationId, ...(visibility ? { application: visibility } : {}) } },
      include: { hiringCase: { select: { applicationId: true } } },
    });

    if (!requirement) {
      throw new NotFoundException('Compliance requirement not found');
    }
    // LICENSE_CHECK alone only verifies license requirements; other items stay with CANDIDATE_EDIT.
    if (license && requirement.type !== 'License' && !(await this.userHas(user, 'CANDIDATE_EDIT'))) {
      throw new ForbiddenException({ code: 'LICENSE_CHECK_SCOPE', message: 'LICENSE_CHECK only covers license requirements.' });
    }

    const data: Prisma.ComplianceRequirementUpdateInput = {
      status: dto.status,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
    };

    if (dto.status === 'Verified') {
      data.verifiedAt = new Date();
      data.verifier = { connect: { id: user.userId } };
    }

    const applicationId = requirement.hiringCase.applicationId;
    let invalidated = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.complianceRequirement.update({ where: { id: reqId }, data });
      const checkType = joiningTypeForRequirement(requirement);
      if (checkType) {
        const verified = dto.status === 'Verified';
        const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
        await tx.joiningCheck.upsert({
          where: { applicationId_type: { applicationId, type: checkType } },
          create: { applicationId, type: checkType, verified, verifiedById: verified ? user.userId : null, verifiedAt: verified ? new Date() : null, expiryDate },
          update: { verified, verifiedById: verified ? user.userId : null, verifiedAt: verified ? new Date() : null, expiryDate },
        });
      }
      invalidated = await invalidateStaleApproval(tx, applicationId);
      return row;
    });
    if (invalidated) {
      this.auditService.log({ organizationId, actorUserId: user.userId, action: 'HIRING_APPROVAL_INVALIDATED', entityType: 'HiringCase', entityId: caseId, result: 'Success', reason: 'Compliance changed after final approval.' });
    }

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
    const visibility = await this.applicationVisibility(user);
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id: caseId, organizationId, ...(visibility ? { application: visibility } : {}) },
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

  async getFinalApprovalInbox(organizationId: string, user?: AuthUser) {
    const visibility = await this.applicationReadVisibility(user);
    const cases = await this.prisma.hiringCase.findMany({
      where: { organizationId, status: 'Pending Final Approval', ...(visibility ? { application: visibility } : {}) },
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
    const visibility = await this.applicationReadVisibility(user);
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id: caseId, organizationId, ...(visibility ? { application: visibility } : {}) },
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
      user.roleCodes.includes(approval.roleCode) ||
      user.roleCodes.includes('ADMINISTRATOR');
    if (!isAuthorized) {
      throw new ForbiddenException('Not authorized to decide this approval');
    }

    const status = dto.decision === 'Approve' ? 'Approved' : 'Rejected';

    const fingerprint = dto.decision === 'Approve'
      ? await currentCaseFingerprint(this.prisma, hiringCase.applicationId, organizationId)
      : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.hiringCaseApproval.update({
        where: { id: approval.id },
        data: {
          status,
          comment: dto.comment,
          approverUserId: user.userId,
          decidedAt: new Date(),
          decisionFingerprint: fingerprint,
          invalidatedAt: null,
        },
      });

      await tx.hiringCase.update({
        where: { id: caseId },
        data: {
          status: dto.decision === 'Approve' ? 'Awaiting Joining' : 'Withdrawn',
          approvalFingerprint: fingerprint,
        },
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
    const visibility = await this.applicationVisibility(user);
    const hiringCase = await this.prisma.hiringCase.findFirst({
      where: { id: caseId, organizationId, ...(visibility ? { application: visibility } : {}) },
      include: { application: { include: { vacancy: true } } }
    });

    if (!hiringCase) throw new NotFoundException({ code: 'WRONG_ORGANIZATION', message: 'Hiring case not found.' });

    const profile = await loadAccessProfile(this.prisma, user);
    const actor = { userId: profile.userId, organizationId: profile.organizationId, permissions: profile.permissions };
    if (!profile.permissions.includes(RECORD_ACTUAL_JOINING)) {
      throw new ForbiddenException({ code: 'JOINING_PERMISSION_REQUIRED', message: 'Recording actual joining needs the RECORD_ACTUAL_JOINING permission. Final hiring approval does not include it.' });
    }
    if (profile.organizationId !== organizationId) {
      throw new NotFoundException({ code: 'WRONG_ORGANIZATION', message: 'Hiring case not found.' });
    }
    if (!isResponsibleRecruiter(user.userId, {
      caseOwnerId: hiringCase.ownerUserId,
      primaryRecruiterId: hiringCase.application.primaryRecruiterId,
      vacancyPrimaryRecruiterId: hiringCase.application.vacancy.primaryRecruiterId,
    })) {
      throw new ForbiddenException({ code: 'JOINING_NOT_OWNER', message: 'Only the responsible recruiter can record actual joining.' });
    }
    if (hiringCase.status === 'Joined' || hiringCase.application.stage === 'Joined') {
      return { success: true, alreadyJoined: true };
    }
    if (hiringCase.status !== 'Awaiting Joining') {
      throw new ConflictException({ code: 'FINAL_APPROVAL_REQUIRED', message: 'Joined needs a current final hiring approval. Offer approval does not replace it.', missing: ['final hiring approval'], gate: 'final-approval' });
    }

    const joiningDate = dto.actualJoiningDate ? new Date(dto.actualJoiningDate) : null;
    if (dto.status === 'Joined') {
      await assertCanMarkJoined(this.prisma, { applicationId: hiringCase.applicationId, actor, actualJoiningDate: joiningDate, enforceActor: true, enforceRecord: true });
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      if (dto.status !== 'Joined') {
        await tx.hiringCase.update({
          where: { id: caseId },
          data: { status: dto.status, ...(joiningDate ? { actualJoiningDate: joiningDate } : {}) },
        });
        return 'updated' as const;
      }
      await assertCanMarkJoined(tx, { applicationId: hiringCase.applicationId, actor, actualJoiningDate: joiningDate, enforceActor: true, enforceRecord: true });
      const claimed = await claimApplicationJoin(tx, hiringCase.applicationId);
      if (!claimed) return 'already' as const;
      const vacancy = await tx.vacancy.findUnique({ where: { id: hiringCase.application.vacancyId } });
      if (!vacancy) throw new NotFoundException('Hiring case not found');
      await recordJoin(tx, vacancy, user.userId);
      await tx.hiringCase.updateMany({
        where: { id: caseId, status: { not: 'Joined' } },
        data: { status: 'Joined', ...(joiningDate ? { actualJoiningDate: joiningDate } : {}) },
      });
      await tx.applicationStatusHistory.create({
        data: { applicationId: hiringCase.applicationId, fromStage: hiringCase.application.stage, toStage: 'Joined', changedById: user.userId, reason: 'Candidate joined' },
      });
      return 'joined' as const;
    });

    if (outcome === 'already') return { success: true, alreadyJoined: true };

    await this.auditService.log({
      organizationId,
      actorUserId: user.userId,
      action: 'Confirm Joining',
      entityType: 'HiringCase',
      entityId: caseId,
      result: 'Success',
    });

    return { success: true, alreadyJoined: false };
  }
}

/** FINAL-2: what a LICENSE_CHECK-only caller sees of a hiring case. */
type CaseForLicense = {
  id: string;
  status: string;
  application: { candidate: { firstName: string; lastName: string }; vacancy: { position: { title: string }; branch: { name: string } } };
  complianceRequirements: Array<{ id: string; type: string; name: string; status: string; isRequired: boolean; expiryDate: Date | string | null; verifiedAt: Date | string | null; documentId: string | null }>;
};
export function licenseView(c: CaseForLicense) {
  const iso = (d: Date | string | null) => (d instanceof Date ? d.toISOString() : d);
  return {
    id: c.id,
    status: c.status,
    candidateName: `${c.application.candidate.firstName} ${c.application.candidate.lastName}`,
    positionTitle: c.application.vacancy.position.title,
    branchName: c.application.vacancy.branch.name,
    complianceRequirements: c.complianceRequirements
      .filter((r) => r.type === 'License')
      .map((r) => ({ id: r.id, type: r.type, name: r.name, status: r.status, isRequired: r.isRequired, documentId: r.documentId, expiryDate: iso(r.expiryDate), verifiedAt: iso(r.verifiedAt) })),
  };
}

/**
 * Adds the SCFHS licence item when the accepted-case snapshot requires it.
 * A null snapshot keeps the historical licence. An explicit technical snapshot does not.
 * Idempotent: no-op when the case already has a licence item.
 */
export async function ensureLicenseRequirement(
  tx: Pick<Prisma.TransactionClient, 'complianceRequirement'> & {
    hiringCase?: { findFirst(args: unknown): Promise<{ requirementSnapshot: unknown } | null> };
  },
  hiringCaseId: string,
): Promise<void> {
  if (typeof tx.hiringCase?.findFirst === 'function') {
    const hiringCase = await tx.hiringCase.findFirst({ where: { id: hiringCaseId }, select: { requirementSnapshot: true } });
    const snapshot = parseSnapshot(hiringCase?.requirementSnapshot);
    if (snapshot && !snapshot.checks.includes('SCFHS_LICENCE')) return;
  }
  const existing = await tx.complianceRequirement.findFirst({ where: { hiringCaseId, type: 'License' }, select: { id: true } });
  if (existing) return;
  await tx.complianceRequirement.create({ data: { hiringCaseId, type: 'License', name: JOINING_CHECK_LABELS.SCFHS_LICENCE, isRequired: true, status: 'Pending' } });
}

/** Licence specialists without file access see only assigned licence work. */
export function licenseAssignmentWhere(userId: string, organizationId: string): Prisma.ApplicationWhereInput {
  return {
    organizationId,
    OR: [
      { vacancy: { assignments: { some: { userId, isActive: true, roleCode: { in: ['LICENSE_SPECIALIST', 'LICENSE_CHECK'] } } } } },
      { hiringCase: { is: { complianceRequirements: { some: { type: 'License', verifiedById: userId } } } } },
    ],
  };
}

type ApproverCase = {
  id: string;
  status: string;
  application: { candidate: { firstName: string; lastName: string }; vacancy: { position: { title: string }; branch: { name: string } } };
  approvals?: Array<{ id: string; roleCode: string; status: string; comment?: string | null; decidedAt?: Date | string | null; invalidatedAt?: Date | string | null }>;
};

export function finalApproverView(c: ApproverCase) {
  const iso = (d: Date | string | null | undefined) => (d instanceof Date ? d.toISOString() : d ?? null);
  return {
    id: c.id,
    status: c.status,
    candidateName: `${c.application.candidate.firstName} ${c.application.candidate.lastName}`,
    positionTitle: c.application.vacancy.position.title,
    branchName: c.application.vacancy.branch.name,
    approvals: (c.approvals ?? []).map((approval) => ({
      id: approval.id,
      roleCode: approval.roleCode,
      status: approval.status,
      comment: approval.comment ?? null,
      decidedAt: iso(approval.decidedAt),
      invalidatedAt: iso(approval.invalidatedAt),
    })),
  };
}

function omitCandidateSalary<T extends { candidate?: Record<string, unknown> | null }>(application: T): T {
  if (!application.candidate) return application;
  const { currentSalary: _current, expectedSalary: _expected, salaryCurrency: _currency, ...candidate } = application.candidate;
  return { ...application, candidate };
}
