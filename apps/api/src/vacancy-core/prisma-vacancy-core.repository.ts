import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyAssignment,
  VacancyCoreContext,
  VacancyDetailView,
  VacancyRequest,
  VacancyRequestApproval,
} from '@recruitflow/contracts';
import type { VacancyCoreRepository } from './vacancy-core.repository';

type RequestWithApprovals = Prisma.VacancyRequestGetPayload<{
  include: { approvals: true };
}>;

type VacancyWithAssignments = Prisma.VacancyGetPayload<{
  include: {
    assignments: {
      include: { user: { select: { id: true, displayName: true } } };
    };
    position: true;
    branch: true;
  };
}>;

type ApprovalRecord = Prisma.VacancyRequestApprovalGetPayload<{}>;
type AssignmentRecord = Prisma.VacancyAssignmentGetPayload<{
  include: { user: { select: { id: true, displayName: true } } };
}>;

const assignmentInclude = {
  user: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class PrismaVacancyCoreRepository implements VacancyCoreRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getContext(organizationId?: string, requesterUserId?: string): Promise<VacancyCoreContext> {
    const organization = organizationId
      ? await this.prisma.organization.findUnique({ where: { id: organizationId } })
      : await this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });

    if (!organization) {
      throw new Error(
        'Prisma vacancy context is empty. Seed an organization before using the Prisma adapter.',
      );
    }

    const [branch, position, requester, allBranches, allPositions] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { organizationId: organization.id, status: 'Active' },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.position.findFirst({
        where: { organizationId: organization.id, status: 'Active' },
        orderBy: { createdAt: 'asc' },
      }),
      requesterUserId
        ? this.prisma.user.findUnique({ where: { id: requesterUserId } })
        : this.prisma.user.findFirst({
            where: { organizationId: organization.id, status: 'Active' },
            orderBy: { createdAt: 'asc' },
          }),
      this.prisma.branch.findMany({
        where: { organizationId: organization.id, status: 'Active' },
        orderBy: { name: 'asc' },
      }),
      this.prisma.position.findMany({
        where: { organizationId: organization.id, status: 'Active' },
        orderBy: { title: 'asc' },
      }),
    ]);

    if (!requester) {
      throw new Error(
        'Prisma vacancy context requires an active requester user.',
      );
    }

    return {
      organization: { id: organization.id, name: organization.name },
      branch: branch ? { id: branch.id, name: branch.name } : null,
      position: position ? { id: position.id, title: position.title } : null,
      requester: { id: requester.id, displayName: requester.displayName },
      branches: allBranches.map((b) => ({ id: b.id, name: b.name })),
      positions: allPositions.map((p) => ({ id: p.id, title: p.title })),
    };
  }

  async listRequests(organizationId: string): Promise<VacancyRequest[]> {
    const requests = await this.prisma.vacancyRequest.findMany({
      where: { organizationId },
      include: { approvals: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => this.toVacancyRequest(request));
  }

  async getRequest(organizationId: string, id: string): Promise<VacancyRequest | null> {
    const request = await this.prisma.vacancyRequest.findUnique({
      where: { id },
      include: { approvals: true },
    });

    return request && request.organizationId === organizationId ? this.toVacancyRequest(request) : null;
  }

  async saveRequest(request: VacancyRequest): Promise<VacancyRequest> {
    await this.assertRequestReferences(request);
    return this.prisma.$transaction((transaction) =>
      this.saveRequestInTransaction(transaction, request),
    );
  }

  async saveRequestAndVacancy(
    request: VacancyRequest,
    vacancy: Vacancy,
  ): Promise<void> {
    await this.assertRequestReferences(request);
    await this.prisma.$transaction(async (transaction) => {
      await this.saveRequestInTransaction(transaction, request);
      await this.upsertVacancy(transaction, vacancy);
    });
  }

  async createRequest(input: CreateVacancyRequestInput): Promise<VacancyRequest> {
    const [branch, position, requester] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: input.branchId, organizationId: input.organizationId },
        select: { id: true },
      }),
      this.prisma.position.findFirst({
        where: { id: input.positionId, organizationId: input.organizationId },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { id: input.requesterId, organizationId: input.organizationId, status: 'Active' },
        select: { id: true },
      }),
    ]);

    if (!branch || !position || !requester) {
      throw new BadRequestException('Vacancy request references data outside the current organization.');
    }

    const requestCode = await this.nextBusinessCode('VR');
    const request = await this.prisma.vacancyRequest.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        branchId: input.branchId,
        positionId: input.positionId,
        requesterId: input.requesterId,
        requestCode,
        status: 'Draft',
        requestedHeadcount: input.requestedHeadcount,
        employmentType: input.employmentType ?? null,
        reason: input.reason ?? null,
        budgetStatus: input.budgetStatus ?? null,
        criticality: input.criticality ?? null,
        targetStartDate: toDate(input.targetStartDate),
        justification: input.justification ?? null,
        jobSummary: input.jobSummary ?? null,
        description: input.description ?? null,
        responsibilities: input.responsibilities ?? null,
        qualifications: input.qualifications ?? null,
        benefits: input.benefits ?? null,
        submittedAt: null,
        approvalRevision: 1,
      },
      include: { approvals: true },
    });

    return this.toVacancyRequest(request);
  }

  async listVacancies(organizationId: string): Promise<Vacancy[]> {
    const vacancies = await this.prisma.vacancy.findMany({
      where: { organizationId },
      include: { assignments: { include: assignmentInclude }, position: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });

    return vacancies.map((vacancy) => this.toVacancy(vacancy));
  }

  async getVacancyByRequestId(organizationId: string, requestId: string): Promise<Vacancy | null> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { vacancyRequestId: requestId },
      include: { assignments: { include: assignmentInclude }, position: true, branch: true },
    });

    return vacancy && vacancy.organizationId === organizationId ? this.toVacancy(vacancy) : null;
  }

  async getVacancy(organizationId: string, id: string): Promise<Vacancy | null> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id },
      include: { assignments: { include: assignmentInclude }, position: true, branch: true },
    });

    return vacancy && vacancy.organizationId === organizationId ? this.toVacancy(vacancy) : null;
  }

  async saveVacancy(vacancy: Vacancy): Promise<Vacancy> {
    const saved = await this.prisma.$transaction((transaction) =>
      this.upsertVacancy(transaction, vacancy),
    );

    return this.toVacancy(saved);
  }

  async ensureUserInOrganization(organizationId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, status: 'Active' },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('Assigned user does not belong to the current organization.');
    }
  }

  private async assertRequestReferences(request: VacancyRequest): Promise<void> {
    const [branch, position, requester] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: request.branchId, organizationId: request.organizationId },
        select: { id: true },
      }),
      this.prisma.position.findFirst({
        where: { id: request.positionId, organizationId: request.organizationId },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { id: request.requesterId, organizationId: request.organizationId },
        select: { id: true },
      }),
    ]);

    if (!branch || !position || !requester) {
      throw new BadRequestException('Vacancy request references data outside the current organization.');
    }
  }

  async nextVacancyCode(): Promise<string> {
    return this.nextBusinessCode('VAC');
  }

  async getApproverInbox(organizationId: string, userRoleCodes: string[]): Promise<VacancyRequest[]> {
    const isAdmin = userRoleCodes.includes('ADMINISTRATOR');
    const requests = await this.prisma.vacancyRequest.findMany({
      where: {
        organizationId,
        status: 'Pending Approval',
        ...(isAdmin
          ? {}
          : {
              approvals: {
                some: {
                  status: 'Pending',
                  roleCode: { in: userRoleCodes },
                },
              },
            }),
      },
      include: { approvals: true },
    });
    // Filter to ensure the *current* step matches
    return requests
      .filter((r) =>
        r.approvals.some(
          (a) =>
            a.revision === r.approvalRevision &&
            a.status === 'Pending' &&
            (isAdmin || userRoleCodes.includes(a.roleCode)),
        ),
      )
      .map((r) => this.toVacancyRequest(r));
  }

  async getVacancyDetail(organizationId: string, id: string): Promise<VacancyDetailView | null> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id },
      include: {
        assignments: { include: assignmentInclude },
        vacancyRequest: {
          include: { approvals: true },
        },
        organization: true,
        branch: true,
        position: true,
      },
    });

    if (!vacancy || vacancy.organizationId !== organizationId) return null;

    return {
      ...this.toVacancy(vacancy),
      vacancyRequest: vacancy.vacancyRequest ? this.toVacancyRequest(vacancy.vacancyRequest) : undefined,
      organizationName: vacancy.organization.name,
      organizationCode: vacancy.organization.code,
      branchName: vacancy.branch.name,
      positionTitle: vacancy.position.title,
      funnelCounts: {
        applied: 0,
        screening: 0,
        interviews: 0,
        offer: 0,
        preHire: 0,
        joined: vacancy.joinedHeadcount,
      },
    };
  }

  private async saveRequestInTransaction(
    transaction: Prisma.TransactionClient,
    request: VacancyRequest,
  ): Promise<VacancyRequest> {
    await transaction.vacancyRequest.update({
      where: { id: request.id },
      data: {
        organizationId: request.organizationId,
        branchId: request.branchId,
        positionId: request.positionId,
        requesterId: request.requesterId,
        requestCode: request.requestCode,
        status: request.status,
        requestedHeadcount: request.requestedHeadcount,
        employmentType: request.employmentType,
        reason: request.reason,
        budgetStatus: request.budgetStatus,
        criticality: request.criticality,
        targetStartDate: toDate(request.targetStartDate),
        justification: request.justification,
        jobSummary: request.jobSummary,
        description: request.description,
        responsibilities: request.responsibilities,
        qualifications: request.qualifications,
        benefits: request.benefits,
        submittedAt: toDateTime(request.submittedAt),
        approvalRevision: request.approvalRevision,
        updatedAt: toDateTime(request.updatedAt) ?? new Date(),
      },
    });

    for (const approval of request.approvals) {
      await transaction.vacancyRequestApproval.upsert({
        where: { id: approval.id },
        create: {
          id: approval.id,
          vacancyRequestId: request.id,
          revision: approval.revision,
          step: approval.step,
          roleCode: approval.roleCode,
          assigneeUserId: approval.assigneeUserId,
          status: approval.status,
          comment: approval.comment,
          decidedAt: toDateTime(approval.decidedAt),
          createdAt: toDateTime(approval.createdAt) ?? new Date(),
        },
        update: {
          revision: approval.revision,
          step: approval.step,
          roleCode: approval.roleCode,
          assigneeUserId: approval.assigneeUserId,
          status: approval.status,
          comment: approval.comment,
          decidedAt: toDateTime(approval.decidedAt),
        },
      });
    }

    const saved = await transaction.vacancyRequest.findUnique({
      where: { id: request.id },
      include: { approvals: true },
    });

    if (!saved) {
      throw new Error(`Vacancy request ${request.id} disappeared during save.`);
    }

    return this.toVacancyRequest(saved);
  }

  private async upsertVacancy(
    transaction: Prisma.TransactionClient,
    vacancy: Vacancy,
  ): Promise<VacancyWithAssignments> {
    await transaction.vacancy.upsert({
      where: { id: vacancy.id },
      create: {
        id: vacancy.id,
        organizationId: vacancy.organizationId,
        branchId: vacancy.branchId,
        positionId: vacancy.positionId,
        vacancyRequestId: vacancy.vacancyRequestId,
        vacancyCode: vacancy.vacancyCode,
        status: vacancy.status,
        approvedHeadcount: vacancy.approvedHeadcount,
        joinedHeadcount: vacancy.joinedHeadcount,
        openedAt: toDateTime(vacancy.openedAt),
        targetStartDate: toDate(vacancy.targetStartDate),
        requiredSkills: vacancy.requiredSkills ?? [],
        department: vacancy.department ?? null,
        jobSummary: vacancy.jobSummary ?? null,
        description: vacancy.description ?? null,
        responsibilities: vacancy.responsibilities ?? null,
        qualifications: vacancy.qualifications ?? null,
        benefits: vacancy.benefits ?? null,
        createdAt: toDateTime(vacancy.createdAt) ?? new Date(),
        updatedAt: toDateTime(vacancy.updatedAt) ?? new Date(),
      },
      update: {
        organizationId: vacancy.organizationId,
        branchId: vacancy.branchId,
        positionId: vacancy.positionId,
        vacancyRequestId: vacancy.vacancyRequestId,
        vacancyCode: vacancy.vacancyCode,
        status: vacancy.status,
        approvedHeadcount: vacancy.approvedHeadcount,
        joinedHeadcount: vacancy.joinedHeadcount,
        openedAt: toDateTime(vacancy.openedAt),
        targetStartDate: toDate(vacancy.targetStartDate),
        requiredSkills: vacancy.requiredSkills ?? [],
        department: vacancy.department ?? null,
        jobSummary: vacancy.jobSummary ?? null,
        description: vacancy.description ?? null,
        responsibilities: vacancy.responsibilities ?? null,
        qualifications: vacancy.qualifications ?? null,
        benefits: vacancy.benefits ?? null,
        updatedAt: toDateTime(vacancy.updatedAt) ?? new Date(),
      },
    });

    // Team membership is maintained by the dedicated assignment transaction in
    // VacancyCoreService. Never replay a stale vacancy snapshot here: doing so
    // can silently revoke a concurrent assignment or create duplicate history.

    const saved = await transaction.vacancy.findUnique({
      where: { id: vacancy.id },
      include: { assignments: { include: assignmentInclude }, position: true, branch: true },
    });
    if (!saved) {
      throw new Error(`Vacancy ${vacancy.id} disappeared during save.`);
    }
    return saved;
  }

  private async nextBusinessCode(prefix: 'VR' | 'VAC'): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await this.prisma.codeSequence.upsert({
      where: { key: `${prefix}:${year}` },
      create: { key: `${prefix}:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `${prefix}-${year}-${String(seq.lastIssued).padStart(3, '0')}`;
  }

  private toVacancyRequest(request: NonNullable<RequestWithApprovals>): VacancyRequest {
    return {
      id: request.id,
      organizationId: request.organizationId,
      branchId: request.branchId,
      positionId: request.positionId,
      requesterId: request.requesterId,
      requestCode: request.requestCode,
      status: request.status as VacancyRequest['status'],
      requestedHeadcount: request.requestedHeadcount,
      employmentType: request.employmentType,
      reason: request.reason,
      budgetStatus: request.budgetStatus,
      criticality: request.criticality,
      targetStartDate: toDateOnlyString(request.targetStartDate),
      justification: request.justification,
      jobSummary: request.jobSummary,
      description: request.description,
      responsibilities: request.responsibilities,
      qualifications: request.qualifications,
      benefits: request.benefits,
      submittedAt: toIsoString(request.submittedAt),
      approvalRevision: request.approvalRevision,
      approvals: request.approvals.map((approval) =>
        this.toApproval(approval),
      ),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private toApproval(approval: ApprovalRecord): VacancyRequestApproval {
    return {
      id: approval.id,
      revision: approval.revision,
      step: approval.step,
      roleCode: approval.roleCode,
      assigneeUserId: approval.assigneeUserId,
      status: approval.status as VacancyRequestApproval['status'],
      comment: approval.comment,
      decidedAt: toIsoString(approval.decidedAt),
      createdAt: approval.createdAt.toISOString(),
    };
  }

  private toVacancy(vacancy: NonNullable<VacancyWithAssignments>): Vacancy {
    const position = vacancy.position
      ? { id: vacancy.position.id, title: vacancy.position.title, code: vacancy.position.code }
      : null;
    const branch = vacancy.branch
      ? { id: vacancy.branch.id, name: vacancy.branch.name, code: vacancy.branch.code }
      : null;

    return {
      id: vacancy.id,
      organizationId: vacancy.organizationId,
      branchId: vacancy.branchId,
      positionId: vacancy.positionId,
      position,
      branch,
      title: position?.title ?? null,
      location: vacancy.location ?? branch?.name ?? null,
      department: vacancy.department,
      jobSummary: vacancy.jobSummary,
      description: vacancy.description,
      responsibilities: vacancy.responsibilities,
      qualifications: vacancy.qualifications,
      benefits: vacancy.benefits,
      vacancyRequestId: vacancy.vacancyRequestId,
      vacancyCode: vacancy.vacancyCode,
      status: vacancy.status as Vacancy['status'],
      approvedHeadcount: vacancy.approvedHeadcount,
      joinedHeadcount: vacancy.joinedHeadcount,
      openedAt: toIsoString(vacancy.openedAt),
      targetStartDate: toDateOnlyString(vacancy.targetStartDate),
      requiredSkills: vacancy.requiredSkills ?? [],
      minExperienceYears: vacancy.minExperienceYears ?? null,
      assignments: vacancy.assignments
        .filter((assignment) => assignment.isActive)
        .map((assignment) => this.toAssignment(assignment)),
      createdAt: vacancy.createdAt.toISOString(),
      updatedAt: vacancy.updatedAt.toISOString(),
    };
  }

  private toAssignment(assignment: AssignmentRecord): VacancyAssignment {
    return {
      id: assignment.id,
      userId: assignment.userId,
      roleCode: assignment.roleCode,
      assignmentKind: assignment.assignmentKind as 'PRIMARY' | 'SUPPORT',
      isActive: assignment.isActive,
      assignedAt: assignment.assignedAt.toISOString(),
      ...(assignment.user
        ? { user: { id: assignment.user.id, displayName: assignment.user.displayName } }
        : {}),
    };
  }
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  return value.includes('T')
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);
}

function toDateTime(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toDateOnlyString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
