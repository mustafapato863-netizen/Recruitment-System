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

export interface UpdateVacancyRequestInput {
  legalEntityId?: string | null;
  branchId?: string;
  positionId?: string;
  requestedHeadcount?: number;
  employmentType?: string | null;
  reason?: string | null;
  budgetStatus?: string | null;
  criticality?: string | null;
  targetStartDate?: string | null;
  justification?: string | null;
}

export interface VacancyRequestFilterInput {
  status?: VacancyRequestStatus;
  branchId?: string;
  positionId?: string;
  requesterId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface VacancyFilterInput {
  status?: VacancyStatus;
  branchId?: string;
  positionId?: string;
  criticality?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ApprovalInboxItem {
  request: VacancyRequest;
  currentStep: VacancyRequestApproval;
  dueStatus: 'Due Today' | 'Overdue' | 'Normal';
  isAssignedToCurrentUser: boolean;
}

export interface VacancyDetailView extends Vacancy {
  vacancyRequest?: VacancyRequest | undefined;
  organizationName?: string | undefined;
  branchName?: string | undefined;
  legalEntityName?: string | undefined;
  positionTitle?: string | undefined;
  funnelCounts: {
    applied: number;
    screening: number;
    interviews: number;
    offer: number;
    preHire: number;
    joined: number;
  };
}

export interface VacancyRequestActionResult {
  request: VacancyRequest;
  vacancy?: Vacancy;
  idempotent?: boolean;
}

// ─── Auth ────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  organizationId: string;
  tokenVersion: number;
  roleCodes: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  roles: RoleSummary[];
  permissions: string[];
  lastLoginAt: string | null;
}

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
}

// ─── Users ───────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  status: string;
  organizationId: string;
  roles: RoleSummary[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  password: string;
}

export interface UpdateUserInput {
  displayName?: string;
  status?: string;
}

// ─── Roles & Permissions ────────────────────────────────────

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  status: string;
  permissions: PermissionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRecord {
  id: string;
  code: string;
  description: string | null;
}

export interface CreateRoleInput {
  code: string;
  name: string;
}

export interface UpdateRoleInput {
  name?: string;
  status?: string;
}

// ─── Master Data ─────────────────────────────────────────────

export interface OrganizationDetail {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface LegalEntityRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchRecord {
  id: string;
  organizationId: string;
  legalEntityId: string;
  code: string;
  name: string;
  city: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionRecord {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit ───────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorDisplayName?: string;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  reason: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Pagination ──────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Phase 3 Candidate & Application ─────────────────────────────

export interface Candidate {
  id: string;
  organizationId: string;
  candidateCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  source?: string | null;
  status: 'Active' | 'Blacklisted' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateInput {
  organizationId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  source?: string | null;
}

export interface UpdateCandidateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  source?: string | null;
  status?: 'Active' | 'Blacklisted' | 'Archived';
}

export interface CandidateFilterInput {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}

export type ApplicationStage =
  | 'Applied'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Pre-Hire'
  | 'Joined'
  | 'Rejected'
  | 'Withdrawn';

export interface Application {
  id: string;
  organizationId: string;
  applicationCode: string;
  vacancyId: string;
  candidateId: string;
  stage: ApplicationStage;
  source?: string | null | undefined;
  primaryRecruiterId?: string | null | undefined;
  primaryRecruiterName?: string | null | undefined;
  taskOwnerId?: string | null | undefined;
  taskOwnerName?: string | null | undefined;
  candidate?: Candidate | undefined;
  vacancyCode?: string | undefined;
  positionTitle?: string | undefined;
  appliedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  vacancyId: string;
  candidateId: string;
  source?: string | null | undefined;
  primaryRecruiterId?: string | null | undefined;
  taskOwnerId?: string | null | undefined;
}

export interface UpdateApplicationStageInput {
  stage: ApplicationStage;
  reason?: string | undefined;
}

export interface ApplicationFilterInput {
  vacancyId?: string | undefined;
  candidateId?: string | undefined;
  stage?: ApplicationStage | undefined;
  primaryRecruiterId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ApplicationStatusHistoryItem {
  id: string;
  applicationId: string;
  fromStage?: string | null | undefined;
  toStage: string;
  changedById?: string | null | undefined;
  changedByName?: string | undefined;
  reason?: string | null | undefined;
  createdAt: string;
}

// ── Phase 4 — Documents, Screening, and Interviews ──────────

export interface CandidateDocument {
  id: string;
  organizationId: string;
  candidateId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Internal storage reference; never returned to browser clients. */
  storageKey?: string;
  extractionText?: string | null | undefined;
  scanStatus: string;
  uploadedById?: string | null | undefined;
  uploadedByName?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export type ScreeningOutcome = 'Passed' | 'Failed' | 'On Hold';

export interface ScreeningLog {
  id: string;
  organizationId: string;
  applicationId: string;
  screenerId: string;
  screenerName?: string | undefined;
  outcome: ScreeningOutcome;
  notes?: string | null | undefined;
  screenedAt: string;
  createdAt: string;
}

export interface CreateScreeningLogInput {
  applicationId: string;
  outcome: ScreeningOutcome;
  notes?: string | undefined;
}

export type InterviewType = 'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive';
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';

export interface InterviewAttendeeItem {
  id: string;
  interviewId: string;
  userId: string;
  userName?: string | undefined;
  role: string;
  response: string;
}

export interface InterviewScorecardItem {
  id: string;
  interviewId: string;
  interviewerId: string;
  interviewerName?: string | undefined;
  overallRating: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';
  strengths?: string | null | undefined;
  concerns?: string | null | undefined;
  notes?: string | null | undefined;
  isLocked: boolean;
  submittedAt: string;
}

export interface Interview {
  id: string;
  organizationId: string;
  interviewCode: string;
  applicationId: string;
  applicationCode?: string | undefined;
  candidateName?: string | undefined;
  positionTitle?: string | undefined;
  title: string;
  interviewType: InterviewType;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  locationUrl?: string | null | undefined;
  status: InterviewStatus;
  attendees?: InterviewAttendeeItem[] | undefined;
  scorecards?: InterviewScorecardItem[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterviewInput {
  applicationId: string;
  title: string;
  interviewType: InterviewType;
  scheduledStart: string;
  scheduledEnd: string;
  timezone?: string | undefined;
  locationUrl?: string | undefined;
  attendeeUserIds: string[];
}

export interface UpdateInterviewInput {
  title?: string | undefined;
  scheduledStart?: string | undefined;
  scheduledEnd?: string | undefined;
  locationUrl?: string | undefined;
  status?: InterviewStatus | undefined;
}

export interface SubmitScorecardInput {
  overallRating: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';
  strengths?: string | undefined;
  concerns?: string | undefined;
  notes?: string | undefined;
}

// ─── Offers (Phase 5) ────────────────────────────────────────

export type OfferStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
export type OfferVersionApprovalStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Changes Requested';
export type OfferComponentType = 'Salary' | 'Allowance' | 'Benefit';

export interface OfferComponentItem {
  id?: string;
  type: OfferComponentType;
  name: string;
  amount?: number | null;
  currency?: string | null;
  frequency?: string | null;
  isTaxable: boolean;
}

export interface OfferApprovalItem {
  id: string;
  offerVersionId: string;
  approverUserId?: string | null;
  approverName?: string | null;
  roleCode: string;
  status: string;
  comment?: string | null;
  decidedAt?: string | null;
}

export interface OfferVersionItem {
  id: string;
  offerId: string;
  versionNumber: number;
  monthlyPackage?: number | null;
  annualFixed?: number | null;
  contractType?: string | null;
  probationPeriod?: string | null;
  offerExpiry?: string | null;
  proposedJoiningDate?: string | null;
  workLocation?: string | null;
  workingSchedule?: string | null;
  approvalStatus: OfferVersionApprovalStatus;
  isLocked: boolean;
  components: OfferComponentItem[];
  approvals: OfferApprovalItem[];
  createdAt: string;
}

export interface Offer {
  id: string;
  organizationId: string;
  applicationId: string;
  applicationCode?: string;
  candidateName?: string;
  positionTitle?: string;
  offerCode: string;
  currentVersionId?: string | null;
  status: OfferStatus;
  versions?: OfferVersionItem[];
  currentVersion?: OfferVersionItem | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferInput {
  applicationId: string;
  contractType?: string;
  probationPeriod?: string;
  offerExpiry?: string;
  proposedJoiningDate?: string;
  workLocation?: string;
  workingSchedule?: string;
  components: OfferComponentItem[];
}

export interface CreateOfferRevisionInput extends Omit<CreateOfferInput, 'applicationId'> {}

export interface OfferDecisionInput {
  decision: 'Approve' | 'Reject';
  comment?: string;
}

// --- Phase 6: Hiring & Joining ---

export type HiringCaseStatus =
  | 'Pending Compliance'
  | 'Pending Final Approval'
  | 'Awaiting Joining'
  | 'Joined'
  | 'Postponed'
  | 'No-show'
  | 'Withdrawn';

export type ComplianceStatus = 'Pending' | 'Submitted' | 'Verified' | 'Rejected' | 'Not Required';

export interface ComplianceRequirementItem {
  id: string;
  type: string;
  name: string;
  status: ComplianceStatus;
  isRequired: boolean;
  documentId?: string | null;
  expiryDate?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
}

export interface HiringCaseApprovalItem {
  id: string;
  roleCode: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  comment?: string | null;
  approverName?: string | null;
  decidedAt?: string | null;
}

export interface HiringCase {
  id: string;
  organizationId: string;
  applicationId: string;
  offerId: string;
  status: HiringCaseStatus;
  plannedJoiningDate?: string | null;
  actualJoiningDate?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;

  // Relations mapped flat or nested
  candidateName?: string;
  positionTitle?: string;
  branchName?: string;
  packageTotal?: number;

  complianceRequirements?: ComplianceRequirementItem[];
  approvals?: HiringCaseApprovalItem[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateHiringCaseInput {
  offerId: string;
}

export interface UpdateComplianceInput {
  status: ComplianceStatus;
  expiryDate?: string | null;
}

export interface FinalApprovalInput {
  decision: 'Approve' | 'Reject';
  comment: string;
}

export interface JoiningUpdateInput {
  status: 'Joined' | 'Postponed' | 'No-show';
  actualJoiningDate?: string | null;
}

// --- Phase 7: Talent Pool & Import ---

export interface TalentPoolItem {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  status: string;
  candidateCount: number;
  updatedAt: string;
}

export interface TalentPoolCandidateItem {
  id: string;
  candidateId: string;
  candidateName: string;
  poolName: string;
  eligibility: string;
  coolingOffUntil?: string | null;
  consentStatus: string;
  consentExpiry?: string | null;
  source?: string | null;
  addedAt: string;
}

export interface TalentPoolHealthMetrics {
  activeConsentPercent: number;
  profileFreshPercent: number;
  recentContactPercent: number;
}

export interface CreateTalentPoolInput {
  name: string;
  description?: string | null;
  tags?: string[];
}

export interface AddToPoolInput {
  candidateId: string;
  source?: string | null;
  consentExpiry?: string | null;
}

// Import types
export type ImportRowResult = 'Valid' | 'Invalid' | 'Duplicate' | 'Warning';
export type ImportRowDecision = 'Update' | 'NewApplication' | 'Skip' | 'KeepBoth';

export interface ImportJobSummary {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  unresolvedDuplicateRows?: number;
  newRows: number;
  updateRows: number;
  createdAt: string;
}

export interface ImportRowItem {
  id: string;
  rowNumber: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  result: ImportRowResult;
  details?: string | null;
  decision?: ImportRowDecision | null;
}

export interface ImportRowDecisionInput {
  decision: ImportRowDecision;
}

// --- Phase 8: Reports, Pipeline & Integrations ---

export interface ReportKpis {
  timeToFill: { value: number; change: number };
  timeToOffer: { value: number; target: number };
  offerAcceptanceRate: { value: number; accepted: number; total: number };
  interviewNoShowRate: { value: number; noShows: number; total: number };
  topSource: { name: string; conversionRate: number };
  totalJoined: { count: number; branches: number };
}

export interface FunnelStage {
  name: string;
  count: number;
  percent: number;
}

export interface DepartmentHiring {
  department: string;
  target: number;
  joined: number;
}

export interface RecruiterWorkload {
  name: string;
  vacancies: number;
  applications: number;
  overdueTasks: number;
}

export interface PipelineTemplateItem {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
  stageCount: number;
  vacancyCount?: number | null;
}

export interface PipelineStageItem {
  id: string;
  name: string;
  stageType: string;
  sortOrder: number;
  slaDays?: number | null;
  defaultOwner?: string | null;
  entryGate?: string | null;
  exitGate?: string | null;
  status: string;
}

export interface IntegrationItem {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  lastSyncAt?: string | null;
}

// ─── Phase 10 Notifications & Tasks ───────────────────────────
export type {
  NotificationRecord,
  UnreadCountResponse,
  NotificationFilterInput,
  TaskPriority,
  TaskStatus,
  TaskRecord,
  UpdateTaskStatusInput,
  TaskFilterInput,
} from './notifications-tasks';
