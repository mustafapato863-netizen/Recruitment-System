export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export const vacancyRequestStatuses = [
  'Draft',
  'Pending Approval',
  'Changes Requested',
  'Approved',
  'Rejected',
  'Cancelled',
  'Converted to Vacancy',
] as const;

export type VacancyRequestStatus = (typeof vacancyRequestStatuses)[number];

export const vacancyRequestApprovalStatuses = [
  'Pending',
  'Approved',
  'Rejected',
  'Changes Requested',
] as const;

export type VacancyRequestApprovalStatus =
  (typeof vacancyRequestApprovalStatuses)[number];

export const vacancyStatuses = [
  'Pending Activation',
  'Open',
  'On Hold',
  'Partially Filled',
  'Filled',
  'Cancelled',
] as const;

export type VacancyStatus = (typeof vacancyStatuses)[number];

export interface VacancyRequestApproval {
  id: string;
  revision: number;
  step: number;
  roleCode: string;
  assigneeUserId: string | null;
  status: VacancyRequestApprovalStatus;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface VacancyRequest {
  id: string;
  organizationId: string;
  legalEntityId: string | null;
  branchId: string;
  positionId: string;
  requesterId: string;
  requestCode: string;
  status: VacancyRequestStatus;
  requestedHeadcount: number;
  employmentType: string | null;
  reason: string | null;
  budgetStatus: string | null;
  criticality: string | null;
  targetStartDate: string | null;
  justification: string | null;
  submittedAt: string | null;
  approvalRevision: number;
  approvals: VacancyRequestApproval[];
  createdAt: string;
  updatedAt: string;
}

export interface Vacancy {
  id: string;
  organizationId: string;
  legalEntityId: string | null;
  branchId: string;
  positionId: string;
  vacancyRequestId: string;
  vacancyCode: string;
  status: VacancyStatus;
  approvedHeadcount: number;
  joinedHeadcount: number;
  openedAt: string | null;
  targetStartDate: string | null;
  assignments: VacancyAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface VacancyAssignment {
  id: string;
  userId: string;
  roleCode: string;
  isActive: boolean;
  assignedAt: string;
}

export interface CreateVacancyRequestInput {
  organizationId: string;
  legalEntityId?: string | null;
  branchId: string;
  positionId: string;
  requesterId: string;
  requestedHeadcount: number;
  employmentType?: string | null;
  reason?: string | null;
  budgetStatus?: string | null;
  criticality?: string | null;
  targetStartDate?: string | null;
  justification?: string | null;
}

export interface VacancyRequestActionInput {
  comment?: string;
}

export interface VacancyCoreContext {
  organization: { id: string; name: string };
  branch: { id: string; name: string };
  position: { id: string; title: string };
  requester: { id: string; displayName: string };
}

export interface VacancyRequestActionResult {
  request: VacancyRequest;
  vacancy?: Vacancy;
  idempotent?: boolean;
}
