import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyCoreContext,
  VacancyDetailView,
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

  async listRequests(organizationId: string): Promise<VacancyRequest[]> {
    return [...this.requests.values()]
      .filter((r) => r.organizationId === organizationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getRequest(organizationId: string, id: string): Promise<VacancyRequest | null> {
    const req = this.requests.get(id);
    return req?.organizationId === organizationId ? req : null;
  }

  async saveRequest(request: VacancyRequest): Promise<VacancyRequest> {
    this.requests.set(request.id, request);
    return request;
  }

  async saveRequestAndVacancy(
    request: VacancyRequest,
    vacancy: Vacancy,
  ): Promise<void> {
    this.requests.set(request.id, request);
    this.vacancies.set(vacancy.id, vacancy);
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

  async listVacancies(organizationId: string): Promise<Vacancy[]> {
    return [...this.vacancies.values()]
      .filter((v) => v.organizationId === organizationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getVacancyByRequestId(organizationId: string, requestId: string): Promise<Vacancy | null> {
    return (
      [...this.vacancies.values()].find(
        (vacancy) => vacancy.organizationId === organizationId && vacancy.vacancyRequestId === requestId,
      ) ?? null
    );
  }

  async getVacancy(organizationId: string, id: string): Promise<Vacancy | null> {
    const v = this.vacancies.get(id);
    return v?.organizationId === organizationId ? v : null;
  }

  async saveVacancy(vacancy: Vacancy): Promise<Vacancy> {
    this.vacancies.set(vacancy.id, vacancy);
    return vacancy;
  }

  async ensureUserInOrganization(): Promise<void> {
    return Promise.resolve();
  }

  async nextVacancyCode(): Promise<string> {
    return `VAC-${new Date().getUTCFullYear()}-${String(this.vacancySequence++).padStart(3, '0')}`;
  }

  async getApproverInbox(organizationId: string, userRoleCodes: string[]): Promise<VacancyRequest[]> {
    return [...this.requests.values()].filter(
      (r) =>
        r.organizationId === organizationId &&
        r.status === 'Pending Approval' &&
        r.approvals.some(
          (a) => a.revision === r.approvalRevision && a.status === 'Pending' && userRoleCodes.includes(a.roleCode),
        ),
    );
  }

  async getVacancyDetail(organizationId: string, id: string): Promise<VacancyDetailView | null> {
    const vacancy = await this.getVacancy(organizationId, id);
    if (!vacancy) return null;
    return {
      ...vacancy,
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
}
