import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyAssignment,
  VacancyCoreContext,
  VacancyRequest,
  VacancyRequestApproval,
} from '@recruitflow/contracts';
import type { VacancyCoreRepository } from './vacancy-core.repository';

type RequestWithApprovals = Prisma.VacancyRequestGetPayload<{
  include: { approvals: true };
}>;

type VacancyWithAssignments = Prisma.VacancyGetPayload<{
  include: { assignments: true };
}>;

type ApprovalRecord = Prisma.VacancyRequestApprovalGetPayload<{}>;
type AssignmentRecord = Prisma.VacancyAssignmentGetPayload<{}>;

@Injectable()
export class PrismaVacancyCoreRepository implements VacancyCoreRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getContext(): Promise<VacancyCoreContext> {
    const organization = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!organization) {
      throw new Error(
        'Prisma vacancy context is empty. Seed an organization before using the Prisma adapter.',
      );
    }

    const [branch, position, requester] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.position.findFirst({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findFirst({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!branch || !position || !requester) {
      throw new Error(
        'Prisma vacancy context requires an organization, branch, position, and user.',
      );
    }

    return {
      organization: { id: organization.id, name: organization.name },
      branch: { id: branch.id, name: branch.name },
      position: { id: position.id, title: position.title },
      requester: { id: requester.id, displayName: requester.displayName },
    };
  }

  async listRequests(): Promise<VacancyRequest[]> {
    const requests = await this.prisma.vacancyRequest.findMany({
      include: { approvals: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => this.toVacancyRequest(request));
  }

  async getRequest(id: string): Promise<VacancyRequest | null> {
    const request = await this.prisma.vacancyRequest.findUnique({
      where: { id },
      include: { approvals: true },
    });

    return request ? this.toVacancyRequest(request) : null;
  }

  async saveRequest(request: VacancyRequest): Promise<VacancyRequest> {
    return this.prisma.$transaction((transaction) =>
      this.saveRequestInTransaction(transaction, request),
    );
  }

  async saveRequestAndVacancy(
    request: VacancyRequest,
    vacancy: Vacancy,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.saveRequestInTransaction(transaction, request);
      await this.upsertVacancy(transaction, vacancy);
    });
  }

  async createRequest(input: CreateVacancyRequestInput): Promise<VacancyRequest> {
    const requestCode = await this.nextBusinessCode('VR');
    const request = await this.prisma.vacancyRequest.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        legalEntityId: input.legalEntityId ?? null,
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
        submittedAt: null,
        approvalRevision: 1,
      },
      include: { approvals: true },
    });

    return this.toVacancyRequest(request);
  }

  async listVacancies(): Promise<Vacancy[]> {
    const vacancies = await this.prisma.vacancy.findMany({
      include: { assignments: true },
      orderBy: { createdAt: 'desc' },
    });

    return vacancies.map((vacancy) => this.toVacancy(vacancy));
  }

  async getVacancyByRequestId(requestId: string): Promise<Vacancy | null> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { vacancyRequestId: requestId },
      include: { assignments: true },
    });

    return vacancy ? this.toVacancy(vacancy) : null;
  }

  async saveVacancy(vacancy: Vacancy): Promise<Vacancy> {
    const saved = await this.prisma.$transaction((transaction) =>
      this.upsertVacancy(transaction, vacancy),
    );

    return this.toVacancy(saved);
  }

  async nextVacancyCode(): Promise<string> {
    return this.nextBusinessCode('VAC');
  }

  private async saveRequestInTransaction(
    transaction: Prisma.TransactionClient,
    request: VacancyRequest,
  ): Promise<VacancyRequest> {
    await transaction.vacancyRequest.update({
      where: { id: request.id },
      data: {
        organizationId: request.organizationId,
        legalEntityId: request.legalEntityId,
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
    return transaction.vacancy.upsert({
      where: { id: vacancy.id },
      create: {
        id: vacancy.id,
        organizationId: vacancy.organizationId,
        legalEntityId: vacancy.legalEntityId,
        branchId: vacancy.branchId,
        positionId: vacancy.positionId,
        vacancyRequestId: vacancy.vacancyRequestId,
        vacancyCode: vacancy.vacancyCode,
        status: vacancy.status,
        approvedHeadcount: vacancy.approvedHeadcount,
        joinedHeadcount: vacancy.joinedHeadcount,
        openedAt: toDateTime(vacancy.openedAt),
        targetStartDate: toDate(vacancy.targetStartDate),
        createdAt: toDateTime(vacancy.createdAt) ?? new Date(),
        updatedAt: toDateTime(vacancy.updatedAt) ?? new Date(),
      },
      update: {
        organizationId: vacancy.organizationId,
        legalEntityId: vacancy.legalEntityId,
        branchId: vacancy.branchId,
        positionId: vacancy.positionId,
        vacancyRequestId: vacancy.vacancyRequestId,
        vacancyCode: vacancy.vacancyCode,
        status: vacancy.status,
        approvedHeadcount: vacancy.approvedHeadcount,
        joinedHeadcount: vacancy.joinedHeadcount,
        openedAt: toDateTime(vacancy.openedAt),
        targetStartDate: toDate(vacancy.targetStartDate),
        updatedAt: toDateTime(vacancy.updatedAt) ?? new Date(),
      },
      include: { assignments: true },
    });
  }

  private async nextBusinessCode(prefix: 'VR' | 'VAC'): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await this.prisma.codeSequence.upsert({
      where: { key: `${prefix}:${year}` },
      create: { key: `${prefix}:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });

    return `${prefix}-${year}-${String(sequence.lastIssued).padStart(3, '0')}`;
  }

  private toVacancyRequest(request: NonNullable<RequestWithApprovals>): VacancyRequest {
    return {
      id: request.id,
      organizationId: request.organizationId,
      legalEntityId: request.legalEntityId,
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
      submittedAt: toIsoString(request.submittedAt),
      approvalRevision: request.approvalRevision,
      approvals: request.approvals.map((approval) => this.toApproval(approval)),
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
    return {
      id: vacancy.id,
      organizationId: vacancy.organizationId,
      legalEntityId: vacancy.legalEntityId,
      branchId: vacancy.branchId,
      positionId: vacancy.positionId,
      vacancyRequestId: vacancy.vacancyRequestId,
      vacancyCode: vacancy.vacancyCode,
      status: vacancy.status as Vacancy['status'],
      approvedHeadcount: vacancy.approvedHeadcount,
      joinedHeadcount: vacancy.joinedHeadcount,
      openedAt: toIsoString(vacancy.openedAt),
      targetStartDate: toDateOnlyString(vacancy.targetStartDate),
      assignments: vacancy.assignments.map((assignment) =>
        this.toAssignment(assignment),
      ),
      createdAt: vacancy.createdAt.toISOString(),
      updatedAt: vacancy.updatedAt.toISOString(),
    };
  }

  private toAssignment(assignment: AssignmentRecord): VacancyAssignment {
    return {
      id: assignment.id,
      userId: assignment.userId,
      roleCode: assignment.roleCode,
      isActive: assignment.isActive,
      assignedAt: assignment.assignedAt.toISOString(),
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
