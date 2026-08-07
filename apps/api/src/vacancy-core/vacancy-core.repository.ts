import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyCoreContext,
  VacancyDetailView,
  VacancyRequest,
} from '@recruitflow/contracts';

export const VACANCY_CORE_REPOSITORY = Symbol('VACANCY_CORE_REPOSITORY');

export interface VacancyCoreRepository {
  getContext(): Promise<VacancyCoreContext>;
  listRequests(organizationId: string): Promise<VacancyRequest[]>;
  getRequest(organizationId: string, id: string): Promise<VacancyRequest | null>;
  saveRequest(request: VacancyRequest): Promise<VacancyRequest>;
  saveRequestAndVacancy(
    request: VacancyRequest,
    vacancy: Vacancy,
  ): Promise<void>;
  createRequest(input: CreateVacancyRequestInput): Promise<VacancyRequest>;
  listVacancies(organizationId: string): Promise<Vacancy[]>;
  getVacancyByRequestId(organizationId: string, requestId: string): Promise<Vacancy | null>;
  getVacancy(organizationId: string, id: string): Promise<Vacancy | null>;
  saveVacancy(vacancy: Vacancy): Promise<Vacancy>;
  ensureUserInOrganization(organizationId: string, userId: string): Promise<void>;
  nextVacancyCode(): Promise<string>;
  getApproverInbox(organizationId: string, userRoleCodes: string[]): Promise<VacancyRequest[]>;
  getVacancyDetail(organizationId: string, id: string): Promise<VacancyDetailView | null>;
}
