import type {
  CreateVacancyRequestInput,
  Vacancy,
  VacancyCoreContext,
  VacancyRequest,
} from '@recruitflow/contracts';

export const VACANCY_CORE_REPOSITORY = Symbol('VACANCY_CORE_REPOSITORY');

export interface VacancyCoreRepository {
  getContext(): Promise<VacancyCoreContext>;
  listRequests(): Promise<VacancyRequest[]>;
  getRequest(id: string): Promise<VacancyRequest | null>;
  saveRequest(request: VacancyRequest): Promise<VacancyRequest>;
  createRequest(input: CreateVacancyRequestInput): Promise<VacancyRequest>;
  listVacancies(): Promise<Vacancy[]>;
  getVacancyByRequestId(requestId: string): Promise<Vacancy | null>;
  saveVacancy(vacancy: Vacancy): Promise<Vacancy>;
  nextVacancyCode(): string;
}
