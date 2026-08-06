import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyRequest,
  VacancyRequestActionResult,
} from '@recruitflow/contracts';
import type {
  CreateVacancyRequestDto,
  VacancyRequestActionDto,
} from './vacancy-core.dto';
import {
  VACANCY_CORE_REPOSITORY,
  type VacancyCoreRepository,
} from './vacancy-core.repository';

@Injectable()
export class VacancyCoreService {
  constructor(
    @Inject(VACANCY_CORE_REPOSITORY)
    private readonly repository: VacancyCoreRepository,
  ) {}

  listRequests(): Promise<VacancyRequest[]> {
    return this.repository.listRequests();
  }

  listVacancies(): Promise<Vacancy[]> {
    return this.repository.listVacancies();
  }

  getContext() {
    return this.repository.getContext();
  }

  async createRequest(input: CreateVacancyRequestDto): Promise<VacancyRequest> {
    const payload: CreateVacancyRequestInput = {
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId ?? null,
      branchId: input.branchId,
      positionId: input.positionId,
      requesterId: input.requesterId,
      requestedHeadcount: input.requestedHeadcount,
      employmentType: input.employmentType ?? null,
      reason: input.reason ?? null,
      budgetStatus: input.budgetStatus ?? null,
      criticality: input.criticality ?? null,
      targetStartDate: input.targetStartDate ?? null,
      justification: input.justification ?? null,
    };

    return this.repository.createRequest(payload);
  }

  async submitRequest(
    id: string,
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    const request = await this.requireRequest(id);

    if (request.status !== 'Draft' && request.status !== 'Changes Requested') {
      throw new ConflictException(
        `Request ${request.requestCode} cannot be submitted from ${request.status}.`,
      );
    }

    const now = new Date().toISOString();
    const revision =
      request.status === 'Changes Requested'
        ? request.approvalRevision + 1
        : request.approvalRevision;

    request.status = 'Pending Approval';
    request.approvalRevision = revision;
    request.submittedAt = now;
    request.updatedAt = now;
    request.approvals.push({
      id: randomUUID(),
      revision,
      step: 1,
      roleCode: 'HIRING_MANAGER',
      assigneeUserId: null,
      status: 'Pending',
      comment: action.comment ?? null,
      decidedAt: null,
      createdAt: now,
    });

    return this.repository.saveRequest(request);
  }

  approveRequest(
    id: string,
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    return this.decideRequest(id, 'Approved', action);
  }

  requestChanges(
    id: string,
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    return this.decideRequest(id, 'Changes Requested', action);
  }

  rejectRequest(
    id: string,
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    return this.decideRequest(id, 'Rejected', action);
  }

  async convertToVacancy(
    id: string,
  ): Promise<VacancyRequestActionResult> {
    const request = await this.requireRequest(id);
    const existingVacancy = await this.repository.getVacancyByRequestId(id);

    if (existingVacancy) {
      return { request, vacancy: existingVacancy, idempotent: true };
    }

    if (request.status !== 'Approved') {
      throw new ConflictException(
        `Request ${request.requestCode} must be approved before conversion.`,
      );
    }

    const now = new Date().toISOString();
    const vacancy: Vacancy = {
      id: randomUUID(),
      organizationId: request.organizationId,
      legalEntityId: request.legalEntityId,
      branchId: request.branchId,
      positionId: request.positionId,
      vacancyRequestId: request.id,
      vacancyCode: await this.repository.nextVacancyCode(),
      status: 'Pending Activation',
      approvedHeadcount: request.requestedHeadcount,
      joinedHeadcount: 0,
      openedAt: null,
      targetStartDate: request.targetStartDate,
      assignments: [],
      createdAt: now,
      updatedAt: now,
    };

    request.status = 'Converted to Vacancy';
    request.updatedAt = now;
    await this.repository.saveRequestAndVacancy(request, vacancy);

    return { request, vacancy, idempotent: false };
  }

  private async decideRequest(
    id: string,
    outcome: 'Approved' | 'Changes Requested' | 'Rejected',
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    const request = await this.requireRequest(id);

    if (request.status !== 'Pending Approval') {
      throw new ConflictException(
        `Request ${request.requestCode} cannot be decided from ${request.status}.`,
      );
    }

    const approval = [...request.approvals]
      .reverse()
      .find(
        (candidate) =>
          candidate.revision === request.approvalRevision &&
          candidate.status === 'Pending',
      );

    if (!approval) {
      throw new ConflictException(
        `Request ${request.requestCode} has no pending approval step.`,
      );
    }

    const now = new Date().toISOString();
    approval.status = outcome;
    approval.comment = action.comment ?? null;
    approval.decidedAt = now;
    request.status = outcome;
    request.updatedAt = now;

    return this.repository.saveRequest(request);
  }

  private async requireRequest(id: string): Promise<VacancyRequest> {
    if (!id.trim()) {
      throw new BadRequestException('A vacancy request id is required.');
    }

    const request = await this.repository.getRequest(id);
    if (!request) {
      throw new NotFoundException(`Vacancy request ${id} was not found.`);
    }

    return request;
  }
}
