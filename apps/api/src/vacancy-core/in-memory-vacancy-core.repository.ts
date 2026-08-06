import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyCoreContext,
  VacancyRequest,
} from '@recruitflow/contracts';
import type { VacancyCoreRepository } from './vacancy-core.repository';

@Injectable()
export class InMemoryVacancyCoreRepository implements VacancyCoreRepository {
  private readonly requests = new Map<string, VacancyRequest>();
  private readonly vacancies = new Map<string, Vacancy>();
  private requestSequence = 101;
  private vacancySequence = 1;

  async getContext(): Promise<VacancyCoreContext> {
    return {
      organization: {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'RecruitFlow Demo Organization',
      },
      branch: {
        id: '10000000-0000-4000-8000-000000000002',
        name: 'Head Office',
      },
      position: {
        id: '10000000-0000-4000-8000-000000000003',
        title: 'Senior Software Engineer',
      },
      requester: {
        id: '10000000-0000-4000-8000-000000000004',
        displayName: 'Ahmed Mohamed',
      },
    };
  }

  async listRequests(): Promise<VacancyRequest[]> {
    return [...this.requests.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async getRequest(id: string): Promise<VacancyRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async saveRequest(request: VacancyRequest): Promise<VacancyRequest> {
    this.requests.set(request.id, request);
    return request;
  }

  async createRequest(input: CreateVacancyRequestInput): Promise<VacancyRequest> {
    const now = new Date().toISOString();
    const request: VacancyRequest = {
      id: randomUUID(),
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId ?? null,
      branchId: input.branchId,
      positionId: input.positionId,
      requesterId: input.requesterId,
      requestCode: `VR-${new Date().getUTCFullYear()}-${this.requestSequence++}`,
      status: 'Draft',
      requestedHeadcount: input.requestedHeadcount,
      employmentType: input.employmentType ?? null,
      reason: input.reason ?? null,
      budgetStatus: input.budgetStatus ?? null,
      criticality: input.criticality ?? null,
      targetStartDate: input.targetStartDate ?? null,
      justification: input.justification ?? null,
      submittedAt: null,
      approvalRevision: 1,
      approvals: [],
      createdAt: now,
      updatedAt: now,
    };

    this.requests.set(request.id, request);
    return request;
  }

  async listVacancies(): Promise<Vacancy[]> {
    return [...this.vacancies.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async getVacancyByRequestId(requestId: string): Promise<Vacancy | null> {
    return (
      [...this.vacancies.values()].find(
        (vacancy) => vacancy.vacancyRequestId === requestId,
      ) ?? null
    );
  }

  async saveVacancy(vacancy: Vacancy): Promise<Vacancy> {
    this.vacancies.set(vacancy.id, vacancy);
    return vacancy;
  }

  nextVacancyCode(): string {
    return `VAC-${new Date().getUTCFullYear()}-${String(this.vacancySequence++).padStart(3, '0')}`;
  }
}
