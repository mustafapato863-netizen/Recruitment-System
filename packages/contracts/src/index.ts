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

/**
 * M1-G3 — Stable API error contract.
 * Every API failure is normalized into this envelope. The `code` value is a
 * stable machine-readable identifier from `ERROR_CODES`. `fields` is present
 * only when field-level validation errors exist. `requestId` matches the
 * `X-Request-Id` response header. `retryable`/`retryAfterSeconds` guide client
 * retry behavior (rate limits, temporary integration failures).
 */
export const errorCodes = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'STAGE_GATE_BLOCKED',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'FILE_INVALID',
  'FILE_TOO_LARGE',
  'FILE_UNSAFE',
  'IMPORT_INVALID',
  'IMPORT_CONFLICT',
  'EXPORT_FAILED',
  'ASYNC_JOB_FAILED',
  'INTEGRATION_UNAVAILABLE',
  'INTERNAL_ERROR',
  ...domainErrorCodes(),
  // B1 ownership/scope codes (PR #4); clients branch on these.
  'FILE_NOT_OWNED',
  'JOB_NOT_OWNED',
  'LICENSE_CHECK_SCOPE',
  'ADMIN_CANNOT_REASSIGN',
  'OWNER_NOT_ELIGIBLE',
  'ADMIN_ONLY',
  'DOCUMENT_DOWNLOAD_DENIED',
  // B6 suggest / compare / skill evidence / duplicates (kept as-is by the API error normalizer)
  'APPLICATION_EXISTS', 'COMPARE_CANDIDATE_NOT_FOUND', 'COMPARE_COUNT', 'CONTACT_REQUIRED', 'EVIDENCE_SNIPPET_REQUIRED',
  'EVIDENCE_SOURCE_INVALID', 'NOT_JOB_OWNER', 'USER_OWNS_OPEN_WORK', 'JOB_HAS_OPEN_APPLICATIONS', 'CANDIDATE_EXISTS', 'SKILL_INACTIVE', 'SKILL_NOT_IN_LIBRARY',
  // B9 admin
  'SINGLE_PIPELINE_TEMPLATE', 'OVERRIDE_REASON_REQUIRED', 'OVERRIDE_NOT_ALLOWED', 'USER_DELETE_NOT_ALLOWED',
] as const;

/**
 * B3/B4/B5 domain codes. Services throw `{ code, message, ... }`; the API error
 * normalizer keeps these codes as-is (instead of collapsing to CONFLICT etc.).
 * Gate codes (GATE_*) also carry `gate` and `missing[]` in the envelope.
 */
function domainErrorCodes() {
  return [
    // B3 requisition / job lifecycle
    'ADMIN_CANNOT_CHANGE_JOB_STATUS', 'ASSIGNEE_NOT_ELIGIBLE', 'ASSIGNEE_REQUIRED', 'DUE_DATE_REQUIRED', 'SEATS_BELOW_JOINED', 'COMMITMENTS_UNRESOLVED', 'REQUISITION_NOT_APPROVED', 'REQUISITION_NOT_ACTIVE', 'DEPARTMENT_NOT_FOUND', 'FILE_CLOSED', 'ASSIGNEE_NOT_IN_TEAM',
    'GRADE_NOT_FOUND', 'ILLEGAL_JOB_TRANSITION', 'JOB_NOT_ACCEPTING_APPLICATIONS', 'NOT_JOB_OWNER',
    'REASON_REQUIRED', 'REQUISITION_CANCELLED', 'REASON_NOT_IN_LIST', 'HOLD_UNTIL_NOT_FUTURE',
    // B5 gates
    'GATE_SCREEN_NOTE_MISSING', 'GATE_SCORECARD_NOT_SUBMITTED', 'GATE_OFFER_NOT_ACCEPTED',
    'GATE_JOINING_CHECKS_INCOMPLETE', 'GATE_REJECT_REASON_REQUIRED',
    // B5 interviews / scorecards
    'INTERVIEWER_NOT_A_USER', 'INTERVIEWER_REQUIRED', 'ROOM_REQUIRED', 'ROOM_URL_INVALID', 'ROOM_URL_NOT_HTTPS',
    'ROOM_URL_HOST_NOT_ALLOWED', 'SCORECARD_ALREADY_SUBMITTED', 'SCORECARD_NOT_SUBMITTED', 'REVISION_REASON_REQUIRED', 'SCORECARD_REMINDER_ALREADY_SENT',
    // B5 file / offers
    'OFFER_CLOSED', 'OFFER_NOT_DRAFT', 'OFFER_NOT_APPROVED', 'OFFER_SEND_REQUIRES_TEMPLATE', 'OFFER_CHANNEL_INVALID',
    'OFFER_TEMPLATE_INVALID', 'OFFER_TEMPLATE_CHANNEL_MISMATCH', 'OFFER_CANDIDATE_NO_CONTACT',
    'REOPEN_NOT_OWNER', 'REOPEN_REASON_REQUIRED', 'WITHDRAWN_NOT_AN_EXIT',
    'FOLLOW_UP_NOT_OWNER', 'JOINING_CHECK_TYPE_INVALID',
    'JOINING_PERMISSION_REQUIRED', 'JOINING_NOT_OWNER', 'WRONG_ORGANIZATION', 'FINAL_APPROVAL_REQUIRED',
    'APPROVAL_STALE', 'LICENCE_EXPIRED', 'LICENCE_EXPIRY_REQUIRED', 'CAPACITY_FULL', 'JOINING_DATE_REQUIRED',
    'JOINING_CHECK_NOT_REQUIRED',
    // B7 grade bands, manager decision, reassign
    'GRADE_BAND_MISSING', 'OFFER_PAY_VIEW_REQUIRED', 'OFFER_PAY_OUTSIDE_BAND', 'GRADE_BAND_AMOUNT_INVALID', 'GRADE_BAND_FIELDS_REQUIRED',
    'GRADE_BAND_IDENTITY_IMMUTABLE', 'GRADE_BAND_MIN_GT_MAX', 'GRADE_BAND_OVERLAP', 'GRADE_INVALID', 'SITE_INVALID', 'CURRENCY_INVALID',
    'OFFER_BASE_CURRENCY_MIXED', 'OFFER_BASE_PAY_MISSING', 'OFFER_DECISION_NOT_MANAGER', 'OFFER_NOT_PENDING_APPROVAL',
    'DECISION_INVALID', 'DECISION_REASON_REQUIRED',
    'REASSIGN_ADMIN_FORBIDDEN', 'REASSIGN_CONFLICT', 'REASSIGN_FILE_CLOSED', 'REASSIGN_FILE_NOT_FOUND', 'REASSIGN_NOT_MANAGER',
    'REASSIGN_REASON_REQUIRED', 'REASSIGN_SCOPE', 'REASSIGN_TARGET_INELIGIBLE', 'REASSIGN_TARGET_NOT_IN_TEAM',
  ] as const;
}

export type ErrorCode = (typeof errorCodes)[number];

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (errorCodes as readonly string[]).includes(value);

export type ErrorFieldErrors = Record<string, string[]>;

export interface ErrorEnvelope {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fields?: ErrorFieldErrors;
  /** Safe, resource-specific context for recoverable client workflows such as optimistic-concurrency conflicts. */
  details?: Record<string, unknown>;
  /** B5: present on GATE_* 409s: which gate blocked and what is missing. */
  gate?: string;
  missing?: string[];
  /** B7: on GRADE_BAND_MISSING / OFFER_PAY_OUTSIDE_BAND. Pay figures only for OFFER_PAY_VIEW holders. */
  band?: Record<string, string | number | null>;
  offeredMonthlyBase?: number;
  /** B2-15: on 400s, the first offending input (dotted path, e.g. "basePay", "allowances.0.amount", "pay"). */
  field?: string;
  /** B2-9: on USER_OWNS_OPEN_WORK / JOB_HAS_OPEN_APPLICATIONS 409s, e.g. { openApplicationsPrimary: 2, openJobs: 1 }. */
  counts?: Record<string, number>;
  requestId: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
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

/**
 * B3: display labels for requisition statuses. The stored/API value
 * 'Converted to Vacancy' is unchanged (no data mapping); it is shown as "Active".
 */
export const vacancyRequestStatusLabels: Record<VacancyRequestStatus, string> = {
  Draft: 'Draft',
  'Pending Approval': 'Pending Approval',
  'Changes Requested': 'Changes Requested',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
  'Converted to Vacancy': 'Active',
};

/** B4 (v2 §7): "HRIS Developer, 1 of 3, due 19 Oct". Seats filled vs the requisition's target. */
export interface TargetChip {
  title: string;
  filled: number;
  target: number;
  label: string;
  dueDate: string | null;
}

export function buildTargetChip(input: { title: string; filled: number; target: number; dueDate: string | null }): TargetChip {
  const target = Math.max(0, Math.trunc(input.target || 0));
  const filled = Math.max(0, Math.trunc(input.filled || 0));
  return { title: input.title, filled, target, label: `${filled} of ${target}`, dueDate: input.dueDate };
}

export function vacancyRequestStatusLabel(status: string): string {
  return (vacancyRequestStatusLabels as Record<string, string>)[status] ?? status;
}

export const vacancyRequestApprovalStatuses = [
  'Pending',
  'Approved',
  'Rejected',
  'Changes Requested',
] as const;

export type VacancyRequestApprovalStatus =
  (typeof vacancyRequestApprovalStatuses)[number];

// B3 (v2 §3/§4): Cancelled lives only on the requisition; Pending Activation is gone.
export const vacancyStatuses = [
  'Open',
  'On Hold',
  'Partially Filled',
  'Filled',
  'Closed',
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
  position?: { title: string } | null;
  id: string;
  organizationId: string;
  branchId: string;
  positionId: string;
  requesterId: string;
  requestCode: string;
  status: VacancyRequestStatus;
  /** B3: display label for status ('Converted to Vacancy' -> 'Active'). */
  statusLabel?: string;
  /** B4: seats filled (job joined headcount) of the requisition target. */
  targetChip?: TargetChip;
  requestedHeadcount: number;
  employmentType: string | null;
  reason: string | null;
  budgetStatus: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: 'AED' | 'EGP' | null;
  criticality: string | null;
  targetStartDate: string | null;
  targetFillDate: string | null;
  recruitmentTiming: 'After Approval' | 'Deferred' | null;
  plannedOpenDate: string | null;
  justification: string | null;
  jobSummary: string | null;
  description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
  submittedAt: string | null;
  approvalRevision: number;
  /** B3: v2 due date (same value as targetFillDate). */
  dueDate?: string | null;
  /** B3: master-data grade (category 'grades'). */
  gradeId?: string | null;
  /** M1: master-data department. */
  departmentId?: string | null;
  /** M1 (GET /vacancy-requests): display fields. */
  title?: string;
  site?: { id: string; name: string };
  grade?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  requester?: { id: string; name: string };
  requesterName?: string;
  owner?: { id: string; name: string } | null;
  ownerName?: string | null;
  /** B2-16: the job's owner once activated, else the assigned employee. */
  primaryRecruiter?: { id: string; name: string } | null;
  /** B3: active, non-admin user who owns the job once activated. */
  assignedEmployeeId?: string | null;
  activatedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  approvals: VacancyRequestApproval[];
  createdAt: string;
  updatedAt: string;
}

export interface Vacancy {
  id: string;
  organizationId: string;
  branchId: string;
  positionId: string;
  position?: { id: string; title: string; code?: string } | null;
  branch?: { id: string; name: string; code?: string } | null;
  title?: string | null;
  location?: string | null;
  department?: string | null;
  requiredSkills?: string[] | null;
  minExperienceYears?: number | null;
  jobSummary?: string | null;
  description?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  benefits?: string | null;
  vacancyRequestId: string;
  vacancyCode: string;
  status: VacancyStatus;
  approvedHeadcount: number;
  joinedHeadcount: number;
  /** B4: seats filled of the requisition target, with its due date. */
  targetChip?: TargetChip;
  openedAt: string | null;
  targetStartDate: string | null;
  /** B1: the single job owner (never an administrator). */
  primaryRecruiterId?: string | null;
  assignments: VacancyAssignment[];
  createdAt: string;
  updatedAt: string;
}

/**
 * B1 (Roadmap v2 §5): another owner's job as seen by a non-oversight user.
 * Only title, site and seats; every other field is withheld server-side.
 */
export interface RedactedVacancy {
  id: string;
  redacted: true;
  title: string | null;
  site: { id: string; name: string } | null;
  seats: { filled: number; target: number };
}

export * from './candidate-activity.ts';

export interface VacancyAssignment {
  id: string;
  userId: string;
  roleCode: string;
  assignmentKind?: 'PRIMARY' | 'SUPPORT';
  isActive: boolean;
  assignedAt: string;
  user?: {
    id: string;
    displayName: string;
  };
}

export type WorkHealthState = 'healthy' | 'attention' | 'blocked';

export interface WorkHealth {
  state: WorkHealthState;
  reason?: string;
  dueAt?: string;
}

export interface NextActionDescriptor {
  code: string;
  label: string;
  enabled: boolean;
  targetStage?: ApplicationStage;
  blockedReason?: string;
  requiresReason: boolean;
}

/** Server-calculated operational summary for the jobs work queue. */
export interface JobWorkQueueItem {
  id: string;
  code: string;
  title: string;
  branch: { id: string; name: string; code?: string } | null;
  status: VacancyStatus;
  owner: { id: string; displayName: string } | null;
  headcount: { approved: number; joined: number; remaining: number };
  pipelineCounts: Record<ApplicationStage, number>;
  needsActionCount: number;
  health: WorkHealth | null;
  lastActivity: { at: string; label: string } | null;
  nextAction: NextActionDescriptor | null;
  /** B3/E3: requisition due date (YYYY-MM-DD, plain fact) and department. */
  dueDate?: string | null;
  department?: string | null;
  /** B3: optional hold-until date (data only). */
  holdUntil?: string | null;
}

export interface CreateVacancyRequestInput {
  organizationId: string;
  branchId: string;
  positionId: string;
  requesterId: string;
  requestedHeadcount: number;
  employmentType?: string | null;
  reason?: string | null;
  budgetStatus?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetCurrency?: 'AED' | 'EGP' | null;
  criticality?: string | null;
  targetStartDate?: string | null;
  targetFillDate?: string | null;
  recruitmentTiming?: 'After Approval' | 'Deferred' | null;
  plannedOpenDate?: string | null;
  justification?: string | null;
  jobSummary?: string | null;
  description?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  benefits?: string | null;
  dueDate?: string | null;
  gradeId?: string | null;
  /** M1: master-data department. */
  departmentId?: string | null;
  assignedEmployeeId?: string | null;
}

export interface VacancyRequestActionInput {
  comment?: string;
}

export interface VacancyCoreContext {
  organization: { id: string; name: string };
  branch: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  requester: { id: string; displayName: string };
  branches?: { id: string; name: string }[];
  positions?: { id: string; title: string }[];
}

export interface UpdateVacancyRequestInput {
  branchId?: string;
  positionId?: string;
  requestedHeadcount?: number;
  employmentType?: string | null;
  reason?: string | null;
  budgetStatus?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetCurrency?: 'AED' | 'EGP' | null;
  criticality?: string | null;
  targetStartDate?: string | null;
  targetFillDate?: string | null;
  recruitmentTiming?: 'After Approval' | 'Deferred' | null;
  plannedOpenDate?: string | null;
  justification?: string | null;
  jobSummary?: string | null;
  description?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  benefits?: string | null;
  dueDate?: string | null;
  gradeId?: string | null;
  /** M1: master-data department. */
  departmentId?: string | null;
  assignedEmployeeId?: string | null;
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
  organizationCode?: string | undefined;
  branchName?: string | undefined;
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
  /** B10 rollout switch: the caller's seat, the seats on v2 (org config > env RF_V2_SEATS > ['employee']), and whether this user gets v2. */
  seat?: 'employee' | 'manager' | 'admin';
  v2Seats?: Array<'employee' | 'manager' | 'admin'>;
  v2Enabled?: boolean;
  /** Same list, under flags (as promised in FRONTEND_GAP F4). */
  flags?: { v2Seats: Array<'employee' | 'manager' | 'admin'> };
}

export type UserThemePreference = 'light' | 'dark';
export type UserTimeFormat = '12h' | '24h';

export interface UserPreferences {
  theme: UserThemePreference;
  timezone: string;
  dateFormat: string;
  timeFormat: UserTimeFormat;
  reducedMotion: boolean;
  inAppNotifications: boolean;
  emailNotifications: boolean;
  interviewReminders: boolean;
  approvalReminders: boolean;
  taskReminders: boolean;
  updatedAt: string;
}

export interface UpdateSelfProfileInput {
  displayName: string;
}

export interface UpdateUserPreferencesInput {
  theme?: UserThemePreference;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: UserTimeFormat;
  reducedMotion?: boolean;
  inAppNotifications?: boolean;
  emailNotifications?: boolean;
  interviewReminders?: boolean;
  approvalReminders?: boolean;
  taskReminders?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface CompletePasswordResetInput {
  token: string;
  newPassword: string;
}

export interface RequestEmailVerificationInput {
  email: string;
}

export interface CompleteEmailVerificationInput {
  token: string;
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
  displayName?: string;
}

export type AuthDeliveryStatus = 'development' | 'not_configured' | 'queued';

export interface AuthActionResponse {
  accepted: true;
  delivery?: AuthDeliveryStatus;
  expiresAt?: string;
  devToken?: string;
}

export interface CreateInvitationInput {
  email: string;
  displayName: string;
  roleIds?: string[];
}

export interface InvitationResponse {
  id: string;
  email: string;
  displayName: string;
  expiresAt: string;
  delivery: AuthDeliveryStatus;
  devToken?: string;
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
  jobTitle?: string | null;
  status: string;
  organizationId: string;
  /** Direct manager (reports-to) link; null means top of the reporting tree. */
  managerId: string | null;
  roles: RoleSummary[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  password: string;
  roles?: string[];
  jobTitle?: string | null;
}

export interface UpdateUserInput {
  displayName?: string;
  jobTitle?: string | null;
  status?: string;
  /** Set the reports-to manager (admin only); null clears the link. */
  managerId?: string | null;
}

// ─── Roles & Permissions ────────────────────────────────────

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  status: string;
  /** 'system' roles are shared catalog entries; 'organization' roles are tenant-local. */
  scope?: 'system' | 'organization';
  permissions: PermissionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** 'system' permissions are shared catalog entries; organization permissions are tenant-local. */
  scope?: 'system' | 'organization';
  /** B2: Active | Inactive | Retired. Only Active is effective. */
  status?: string;
}

export interface CreatePermissionInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdatePermissionInput {
  name?: string;
  description?: string;
}

export {
  NAVIGATION_CATALOG,
  PERMISSION_LABELS,
  formatPermissionRequirement,
  getNavigationCatalogItem,
  getPermissionLabel,
} from './access-control.ts';

export interface NavigationItemRecord {
  key: string;
  route: string;
  label: string;
  icon: string;
  group: string;
  sortOrder: number;
  visible: boolean;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
}

export interface CreateRoleInput {
  /**
   * Deprecated input retained for older clients. Role codes are now assigned
   * by the API so they remain unique under concurrent creation.
   */
  code?: string;
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

export interface BranchRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  country: string;
  city: string | null;
  status: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionRecord {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  status: string;
  version?: number;
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
  email: string | null;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  summary?: string | null;
  source?: string | null;
  status: 'Active' | 'Blacklisted' | 'Archived';
  consentStatus?: string;
  consentCapturedAt?: string | null;
  consentSource?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[];
  languages?: string[];
  availability?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateMetrics {
  totalCandidates: number;
  activeInPipeline: number;
  talentPool: number;
  disqualified: number;
  directReferralPercentage: number | null;
}

export interface CreateCandidateInput {
  organizationId?: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  summary?: string | null;
  source?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[];
  languages?: string[];
  availability?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateCandidateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  summary?: string | null;
  source?: string | null;
  status?: 'Active' | 'Blacklisted' | 'Archived';
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[];
  languages?: string[];
  availability?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CandidateFilterInput {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}

export interface PublicJob {
  vacancyCode: string;
  organizationCode: string;
  organizationName: string;
  positionTitle: string;
  description: string | null;
  jobSummary: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
  branchName: string;
  location: string | null;
  employmentType: string | null;
  requiredSkills: string[];
  minExperienceYears: number | null;
  targetStartDate: string | null;
  publishedAt: string;
  detailPath: string;
  applyPath: string;
}

export interface PublicJobsResponse {
  organization: { code: string; name: string };
  data: PublicJob[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicApplicationResponse {
  accepted: true;
  applicationCode: string;
  vacancyCode: string;
  message: string;
  /** On-screen receipt path. No message is sent to the candidate's own address. */
  portalPath: string;
  receipt: 'on-screen';
}

export type ApplicationStage =
  | 'Applied'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Pre-Hire'
  | 'Joined'
  | 'Rejected'
  | 'Withdrawn'
  // Pipeline templates can add organization-specific labels. Keep the
  // standard literals for autocomplete while allowing persisted custom stages.
  | (string & {});

export interface Application {
  id: string;
  organizationId: string;
  applicationCode: string;
  vacancyId: string;
  vacancyLocation?: string | null | undefined;
  vacancyBranchName?: string | null | undefined;
  candidateId: string;
  stage: ApplicationStage;
  allowedTransitions: ApplicationStage[];
  /** Incremented atomically for every workflow transition. */
  version: number;
  source?: string | null | undefined;
  primaryRecruiterId?: string | null | undefined;
  primaryRecruiterName?: string | null | undefined;
  taskOwnerId?: string | null | undefined;
  taskOwnerName?: string | null | undefined;
  candidate?: Candidate | undefined;
  vacancyCode?: string | undefined;
  positionTitle?: string | undefined;
  /** Set when the file is Rejected. History keeps the same reason. */
  rejectionReason?: string | null | undefined;
  /** Most recent persisted application event, used by pipeline summaries. */
  lastActivityAt?: string | null | undefined;
  lastActivityLabel?: string | null | undefined;
  /** Earliest persisted follow-up due date, when one is visible to the caller. */
  nextFollowUpAt?: string | null | undefined;
  /** B5: owner-editable follow-up date (YYYY-MM-DD). */
  followUpDate?: string | null | undefined;
  /** E3 (list only): the five gates for this file. */
  gates?: Array<{ gate: 'screen-note' | 'scorecard' | 'offer-accepted' | 'joining-checks' | 'reject-reason'; code: string; met: boolean; missing: string[] }> | undefined;
  /** E3 (list/board card only): next upcoming interview, else the last one. */
  interview?: { when: 'next' | 'last'; startAt: string; endAt: string; room: { name: string | null; url: string | null } } | null | undefined;
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
  expectedStage: ApplicationStage;
  expectedVersion: number;
  reason?: string | undefined;
}

export interface ApplicationFilterInput {
  vacancyId?: string | undefined;
  candidateId?: string | undefined;
  stage?: ApplicationStage | undefined;
  primaryRecruiterId?: string | undefined;
  search?: string | undefined;
  sortBy?: 'createdAt' | 'updatedAt' | 'appliedAt' | undefined;
  sortDirection?: 'asc' | 'desc' | undefined;
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

export interface ApplicationNote {
  id: string;
  organizationId: string;
  applicationId: string;
  // null = system/automation actor; string = user UUID
  authorId: string | null;
  authorName?: string | undefined;
  authorEmail?: string | undefined;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationNoteInput {
  content: string;
}

// ── Phase 4 — Documents, Screening, and Interviews ──────────

export interface CandidateDocument {
  id: string;
  organizationId: string;
  candidateId: string;
  candidateName?: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Internal storage reference; never returned to browser clients. */
  storageKey?: string;
  storageProvider?: string;
  sha256?: string | null | undefined;
  extractionText?: string | null | undefined;
  scanStatus: string;
  scanProvider?: string | null | undefined;
  scanMessage?: string | null | undefined;
  scannedAt?: string | null | undefined;
  parserStatus?: string | undefined;
  parserVersion?: string | null | undefined;
  retentionExpiresAt?: string | null | undefined;
  consentStatus?: string | undefined;
  deletedAt?: string | null | undefined;
  hasFile?: boolean;
  uploadedById?: string | null | undefined;
  uploadedByName?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CvBankBackupStatus {
  provider: string;
  storageProvider: string;
  manifestOnly: boolean;
  backupConfigured: boolean;
  totalRecords: number;
  storedFiles: number;
  cleanFiles: number;
  pendingFiles: number;
  rejectedFiles: number;
  metadataOnlyFiles: number;
  missingFiles: number;
  archivedRecords: number;
  lastBackupAt?: string | null;
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
  noticePeriodDays?: number | null | undefined;
  expectedSalary?: number | null | undefined;
  currentSalary?: number | null | undefined;
  salaryCurrency?: string | undefined;
  method?: string | null | undefined;
  evidenceSource?: string | null | undefined;
  nextStep?: string | null | undefined;
  screenedAt: string;
  createdAt: string;
}

export interface CreateScreeningLogInput {
  applicationId: string;
  outcome: ScreeningOutcome;
  notes?: string | undefined;
  noticePeriodDays?: number | undefined;
  expectedSalary?: number | undefined;
  currentSalary?: number | undefined;
  salaryCurrency?: string | undefined;
  method?: string | null | undefined;
  evidenceSource?: string | null | undefined;
  nextStep?: string | null | undefined;
}

/** Private to one signed-in user, organization, and application. No pay, documents, or tokens. */
export interface ScreeningDraft {
  id: string;
  organizationId: string;
  userId: string;
  applicationId: string;
  outcome: ScreeningOutcome;
  notes?: string | null;
  noticePeriodDays?: number | null;
  method?: string | null;
  evidenceSource?: string | null;
  nextStep?: string | null;
  moveToInterview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertScreeningDraftInput {
  outcome: ScreeningOutcome;
  notes?: string | null;
  noticePeriodDays?: number | null;
  method?: string | null;
  evidenceSource?: string | null;
  nextStep?: string | null;
  moveToInterview?: boolean;
}

export type InterviewType = 'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive' | (string & {});
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled' | 'No-show';

export interface InterviewAttendeeItem {
  id: string;
  interviewId: string;
  userId: string;
  userName?: string | undefined;
  role: string;
  jobTitle?: string | null | undefined;
  response: string;
}

export type InterviewAttendeeResponse = 'Pending' | 'Accepted' | 'Confirmed' | 'Reschedule Requested' | 'Declined';

export type MasterDataCategory = 'departments' | 'skills' | 'candidate-sources' | 'interview-types';

export interface MasterDataValueRecord {
  id: string;
  organizationId: string;
  category: MasterDataCategory;
  code: string | null;
  name: string;
  metadata?: Record<string, unknown> | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStageRequirementKind = 'entry' | 'exit';

export interface ApplicationStageRequirement {
  id: string;
  code: string;
  label: string;
  kind: ApplicationStageRequirementKind;
  required: boolean;
  complete: boolean;
  blocking: boolean;
  reason?: string | null;
  actionLabel?: string | null;
  actionTab?: string | null;
}

export interface ApplicationWorkspaceStage {
  id: string;
  name: string;
  stageType: string;
  sortOrder: number;
  slaDays?: number | null;
  defaultOwner?: string | null;
  entryGate?: string | null;
  exitGate?: string | null;
  required: boolean;
  isCurrent: boolean;
  isCompleted: boolean;
  isNext: boolean;
  isAvailable: boolean;
  requirements: ApplicationStageRequirement[];
}

export interface ApplicationWorkspaceResponse {
  application: Application;
  templateId?: string | null;
  templateName?: string | null;
  stages: ApplicationWorkspaceStage[];
  nextStage?: string | null;
  nextStageRequirements: ApplicationStageRequirement[];
  canAdvance: boolean;
  summary?: {
    screeningOutcome?: string | null;
    interviewCount: number;
    completedInterviewCount: number;
    offerStatus?: string | null;
    hiringStatus?: string | null;
    actualJoiningDate?: string | null;
    documentCount: number;
  };
}

/** GET /me/interviews (B1, shape per the #7 frontend contract). */
export const MY_INTERVIEW_SCOPES = ['upcoming', 'past'] as const;
export type MyInterviewScope = (typeof MY_INTERVIEW_SCOPES)[number];
/** No "locked" state by rule: missing, draft or submitted only. */
export type MyInterviewScorecardStatus = 'missing' | 'draft' | 'submitted';
export interface MyInterviewItem {
  id: string;
  title: string;
  interviewType: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  candidateName: string | null;
  positionTitle: string | null;
  locationUrl: string | null;
  roomName: string | null;
  myResponse: string;
  scorecardStatus: MyInterviewScorecardStatus;
  status: string;
}
export interface MyInterviewsResponse {
  data: MyInterviewItem[];
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
  /** B5: Draft | Submitted. */
  status?: 'Draft' | 'Submitted';
  revision?: number;
  previousRevisionId?: string | null;
  revisedById?: string | null;
  revisionReason?: string | null;
  /** B5: derived (status === 'Submitted'); no longer stored. */
  /** TODO(E3): deprecated mirror of status === Submitted; removed once Frontend reads status. */
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
  /** B5: physical room when not online. */
  roomName?: string | null | undefined;
  /** B5: display name of the first interviewer (a user). Free text is no longer stored. */
  interviewerName?: string | null | undefined;
  /** B5: free-text name from before B5, read-only history. */
  legacyInterviewerName?: string | null | undefined;
  interviewerJobTitle?: string | null | undefined;
  status: InterviewStatus;
  attendees?: InterviewAttendeeItem[] | undefined;
  scorecards?: InterviewScorecardItem[] | undefined;
  cancellationReason?: string | null | undefined;
  rescheduleReason?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewerConflict {
  interviewerId: string;
  interviewerName?: string | undefined;
  interviewId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CheckAvailabilityQuery {
  interviewerUserIds: string[];
  startDate: string;
  endDate: string;
  excludeInterviewId?: string | undefined;
}

export interface AvailabilityResult {
  conflicts: InterviewerConflict[];
  hasConflict: boolean;
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
  allowConflict?: boolean | undefined;
}

export interface UpdateInterviewInput {
  title?: string | undefined;
  scheduledStart?: string | undefined;
  scheduledEnd?: string | undefined;
  locationUrl?: string | undefined;
  status?: InterviewStatus | undefined;
  cancellationReason?: string | undefined;
  rescheduleReason?: string | undefined;
  allowConflict?: boolean | undefined;
}

export interface SubmitScorecardInput {
  overallRating: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';
  strengths?: string | undefined;
  concerns?: string | undefined;
  notes: string;
}

export interface GenerateSelfScheduleInput {
  applicationId: string;
  title: string;
  interviewType: InterviewType;
  durationMinutes?: number | undefined;
  attendeeUserIds: string[];
  locationUrl?: string | undefined;
  expiresInHours?: number | undefined;
}

export interface GenerateSelfScheduleResult {
  token: string;
  scheduleUrl: string;
  expiresAt: string;
}

export interface CandidateSelfScheduleSlot {
  start: string;
  end: string;
  formattedTime: string;
}

export interface SelfScheduleInvitationView {
  valid: boolean;
  candidateName: string;
  positionTitle: string;
  interviewTitle: string;
  interviewType: InterviewType;
  durationMinutes: number;
  timezone: string;
  availableSlots: CandidateSelfScheduleSlot[];
  expiresAt: string;
}

export interface BookSelfScheduleInput {
  selectedSlot: string;
  timezone: string;
  candidateNotes?: string | undefined;
}

export interface BookSelfScheduleResult {
  success: boolean;
  interviewId: string;
  interviewCode: string;
  scheduledStart: string;
  scheduledEnd: string;
  message: string;
}

// ─── Offers (Phase 5) ────────────────────────────────────────

export type OfferStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
export type OfferVersionApprovalStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Changes Requested';
export type OfferComponentType = 'Salary' | 'Allowance' | 'Benefit';
export type OfferCurrency = 'AED' | 'EGP';

export interface OfferComponentItem {
  id?: string;
  type: OfferComponentType;
  name: string;
  amount?: number | null;
  currency?: OfferCurrency | null;
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

/** Flat, shared shape returned by both offer approval inbox endpoints. */
export interface OfferApprovalInboxItem {
  id: string;
  offerId: string;
  offerVersionId: string;
  offerCode: string;
  candidateName: string;
  positionTitle: string;
  branchName?: string | null;
  versionNumber: number;
  /** B5 follow-up: the job's grade (from its requisition). */
  grade?: { id: string; name: string } | null;
  /** M3: the job's site for band matching (siteId = branchId). */
  branchId?: string | null;
  siteId?: string | null;
  /** B7: omitted (absent) without OFFER_PAY_VIEW. */
  monthlyPackage?: number | null;
  packageCurrency?: OfferCurrency | null;
  roleCode: string;
  status: string;
  step: number;
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
  status?: string;
  sentChannel?: 'email' | 'whatsapp' | string | null;
  sentAt?: string | null;
  /** B5 follow-up: the approver's note (who, when, text). */
  approverNote?: { byUserId: string | null; byName: string | null; at: string; text: string } | null;
  /** TODO(E3): deprecated, derived from status; removed once Frontend reads status. */
  isLocked: boolean;
  components: OfferComponentItem[];
  approvals: OfferApprovalItem[];
  createdAt: string;
}

export interface Offer {
  vacancyId?: string;
  id: string;
  organizationId: string;
  applicationId: string;
  applicationCode?: string;
  candidateName?: string;
  positionTitle?: string;
  grade?: { id: string; name: string } | null;
  /** M3: the job's site for band matching (siteId = branchId). */
  branchId?: string | null;
  siteId?: string | null;
  location?: string | null;
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
  dataset?: 'candidates' | 'vacancy-requests' | string;
  sourceFormat?: 'json' | 'xlsx' | 'xls' | 'csv' | string;
  sheetName?: string | null;
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
  currentTitle?: string | null;
  currentCompany?: string | null;
  skills?: string[] | null;
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[] | null;
  languages?: string[] | null;
  education?: string | null;
  summary?: string | null;
  result: ImportRowResult;
  details?: string | null;
  decision?: ImportRowDecision | null;
}

export interface ImportRowDecisionInput {
  decision: ImportRowDecision;
}

export type BulkImportDataset =
  | 'candidates'
  | 'vacancy-requests'
  | 'branches'
  | 'positions'
  | 'departments'
  | 'skills'
  | 'candidate-sources'
  | 'interview-types';

export interface BulkImportSheetInfo {
  name: string;
  headers: string[];
  rowCount: number;
}

export interface BulkImportInspectResult {
  fileName: string;
  fileSize: number;
  sheets: BulkImportSheetInfo[];
  dataset: BulkImportDataset;
  requiredColumns: string[];
  optionalColumns: string[];
  warnings: string[];
}

export interface BulkImportRowItem {
  id: string;
  rowNumber: number;
  data: Record<string, unknown>;
  result: ImportRowResult;
  details?: string | null;
  decision?: 'Import' | 'Skip' | 'Update' | null;
}

// --- Phase 8: Reports, Pipeline & Integrations ---

export interface ReportKpis {
  timeToFill: { value: number; sampleCount?: number };
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
  conversionRate?: number | null;
}

export interface DepartmentHiring {
  department: string;
  target: number;
  joined: number;
}

export interface RecruiterWorkload {
  id?: string;
  name: string;
  vacancies: number;
  applications: number;
  overdueTasks: number;
}

export interface ReportRange {
  from: string;
  to: string;
}

export interface ReportTrendPoint {
  periodStart: string;
  label: string;
  applications: number;
  interviews: number;
  offers: number;
  joined: number;
}

export interface ReportSourceBreakdown {
  name: string;
  total: number;
  joined: number;
  conversionRate: number;
}

export interface HiringByPosition {
  positionId: string;
  position: string;
  target: number;
  joined: number;
}

export interface ReportFilterOption {
  id: string;
  label: string;
}

export interface RecruitmentKpiItem {
  id: string;
  position: string; // 'Recruitment'
  name: string;
  definition: string;
  currentValue: number;
  formattedValue: string;
  targetValue: number;
  formattedTarget: string;
  unit: '%' | 'Days';
  achievementRate: number;
  status: 'Exceeded' | 'On Target' | 'Under Target';
  notes?: string;
}

export interface ReportOverview {
  range: ReportRange;
  kpis: ReportKpis;
  trend: ReportTrendPoint[];
  sourceBreakdown: ReportSourceBreakdown[];
  funnel: FunnelStage[];
  hiringByPosition: HiringByPosition[];
  recruiterWorkload: RecruiterWorkload[];
  filterOptions: {
    branches: ReportFilterOption[];
    positions: ReportFilterOption[];
    recruiters: ReportFilterOption[];
  };
  recruitmentKpis?: RecruitmentKpiItem[];
}

export type GlobalSearchEntityType = 'candidate' | 'vacancy' | 'application' | 'task' | 'interview' | 'offer' | 'approval' | 'notification' | 'cv' | 'talent-pool' | 'master-data';

export interface GlobalSearchItem {
  entityType: GlobalSearchEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  status?: string;
  /** B1: another owner's job, shown as title/site/seats only. */
  redacted?: boolean;
}

export interface GlobalSearchGroup {
  entityType: GlobalSearchEntityType;
  label: string;
  items: GlobalSearchItem[];
}

export interface GlobalSearchResponse {
  query: string;
  groups: GlobalSearchGroup[];
  total: number;
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
  required?: boolean;
  status: string;
  // Phase C — Stage Automation fields
  emailTemplateId?: string | null;
  folded?: boolean;
  isHiredStage?: boolean;
  tooltip?: string | null;
}

export interface IntegrationItem {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  lastSyncAt?: string | null;
}

// ─── Phase C: Stage Automation — Email Templates ────────────────

export interface WhatsAppTemplateItem {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  interviewType: string;
  bodyTemplate: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppTemplateCategory =
  | 'ack'
  | 'interview_invite'
  | 'offer_next_step'
  | 'rejection'
  | 'misc';

export interface EmailTemplateItem {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  subject: string;
  bodyTemplate: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
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
  TargetPeriod,
  RecruiterTargetRecord,
  RecruiterTargetActual,
  RecruiterTargetProgressRecord,
} from './notifications-tasks.ts';

export interface CandidateWorkExperienceItem {
  jobTitle?: string | undefined;
  organization?: string | undefined;
  description?: string | undefined;
  isCurrent?: boolean | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface CandidateEducationItem {
  degree?: string | undefined;
  major?: string | undefined;
  organization?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface CandidateProjectItem {
  title?: string | undefined;
  description?: string | undefined;
}

export interface CandidateEvidenceChunk {
  text: string;
  source: 'Work Experience' | 'Skills' | 'Projects' | 'Education' | 'Certifications' | 'Summary' | 'Document';
  jobTitle?: string | undefined;
  organization?: string | undefined;
}

export interface ExtractedCandidate {
  firstName?: string | undefined;
  lastName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  title?: string | undefined;
  currentCompany?: string | undefined;
  rawText?: string | undefined;
  skills?: string[] | undefined;
  experienceYears?: number | undefined;
  location?: string | undefined;
  education?: string | undefined;
  certifications?: string[] | undefined;
  languages?: string[] | undefined;
  summary?: string | undefined;
  clinicalDomain?: string | undefined;
  subspecialties?: string[] | undefined;
  aiSummaryConfidence?: number | undefined;
  keyHighlights?: string[] | undefined;
  responsibilities?: string[] | undefined;
  projects?: string[] | undefined;
  workHistory?: CandidateWorkExperienceItem[] | undefined;
  educationHistory?: CandidateEducationItem[] | undefined;
  projectHistory?: CandidateProjectItem[] | undefined;
  evidenceChunks?: CandidateEvidenceChunk[] | undefined;
  parserSource?: 'affinda' | 'legacy' | undefined;
  parsingQuality?: 'high' | 'medium' | 'low' | undefined;
}

export * from './resume/index.ts';
export * from './joining.ts';


// ─── B4 / E1: GET /me/work ──────────────────────────────────────
/** E1: fixed entity types for My Work items. */
export const myWorkEntityTypes = ['application', 'interview', 'offer', 'requisition', 'job', 'task'] as const;
export type MyWorkEntityType = (typeof myWorkEntityTypes)[number];
export type MyWorkDay = 'today' | 'tomorrow';
export type MyWorkItemType = 'job' | 'requisition' | 'task' | 'interview' | 'scorecard' | 'offer';
export type MyWorkWaitingOn = 'approver' | 'interviewer' | 'candidate';

export interface MyWorkAction {
  key: string;
  label: string;
  disabled: boolean;
  /** Why it is disabled (gate not met, on hold, not the owner, ...). */
  reason?: string;
}

export interface MyWorkPerson {
  id: string | null;
  name: string;
}

export interface MyWorkItem {
  id: string;
  type: MyWorkItemType;
  title: string;
  /** Plain due fact (ISO date or instant). No timers or countdowns. */
  dueAt: string | null;
  reason: string;
  nextAction: { code: string; label: string };
  entity: { type: MyWorkEntityType; id: string };
  actions: MyWorkAction[];
  waitingOn?: MyWorkWaitingOn;
  /** Interview items. */
  startAt?: string;
  endAt?: string;
  room?: { name: string | null; url: string | null };
  interviewer?: MyWorkPerson | null;
  interviewers?: MyWorkPerson[];
  /** C6: offers waiting on approval: who it waits on (first pending approver, and all of them). */
  approver?: MyWorkPerson | null;
  approvers?: MyWorkPerson[];
  /** Application-linked items (interviews, scorecards, offers). */
  applicationId?: string;
  candidate?: { id: string; name: string };
  stage?: string;
}

export interface MyWorkTarget extends TargetChip {
  vacancyId: string;
  vacancyCode: string;
  department: string | null;
  site: string | null;
  owner: { id: string; name: string } | null;
}

/** File = caller owns the recruiting file. Evaluation = assigned interviewer only, no file link. */
export type MyWorkInterviewAccess = 'file' | 'evaluation';
export type MyWorkInterviewStatus = 'scheduled' | 'scorecard_overdue' | 'assigned';

/** Upcoming interviews for the caller. Display fields only. */
export interface MyWorkUpcomingInterview {
  id: string;
  title: string;
  candidateName: string | null;
  jobTitle: string | null;
  startAt: string;
  endAt: string | null;
  room: { name: string | null; url: string | null };
  interviewers: MyWorkPerson[];
  access: MyWorkInterviewAccess;
  /** Present only when access is file. Omitted for a narrow assigned interviewer. */
  applicationId?: string;
  held: boolean;
  status: MyWorkInterviewStatus;
  action: MyWorkAction;
}

/** `blocked` carries the joining policy message. `review` means the facts needed to judge readiness were not loaded. */
export type MyWorkJoiningReadiness = 'approval_pending' | 'licence_pending' | 'checks_pending' | 'ready' | 'postponed' | 'blocked' | 'review';

/**
 * Caller-owned accepted cases that have not joined.
 * `joined` is always false: a scheduled start or an approval is not a hire.
 */
export interface MyWorkJoiningSoon {
  id: string;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  /** Intended start (Cairo calendar date). Not an actual joining date. */
  intendedDate: string | null;
  checksComplete: number;
  checksRequired: number;
  readiness: MyWorkJoiningReadiness;
  detail: string;
  joined: false;
  held: boolean;
}

/** M2-M4: GET /team/work — direct reports' My Work, each item tagged with its owner. */
export type TeamWorkItem = MyWorkItem & { owner: { id: string; name: string } };
export interface TeamWorkResponse {
  timezone: string;
  day: MyWorkDay;
  date: string;
  generatedAt: string;
  people: Array<{ id: string; name: string }>;
  counts: { overdue: number; today: number; waitingOnOthers: number };
  overdue: TeamWorkItem[];
  dueToday: TeamWorkItem[];
  waitingOnOthers: TeamWorkItem[];
  targets: Array<MyWorkTarget & { owner: { id: string; name: string } }>;
  empty: boolean;
  emptyMessage: string | null;
}

export interface MyWorkResponse {
  timezone: string;
  today: string;
  /** E1: which day dueToday lists (Cairo). */
  day: MyWorkDay;
  date: string;
  generatedAt: string;
  counts: { overdue: number; today: number; waitingOnOthers: number };
  overdue: MyWorkItem[];
  /** Items due on `date` (today by default, tomorrow with ?day=tomorrow). */
  dueToday: MyWorkItem[];
  waitingOnOthers: MyWorkItem[];
  targets: MyWorkTarget[];
  /**
   * Caller-scoped schedule. Absent on older payloads: clients must show an
   * unavailable state rather than invent rows. Empty means none.
   */
  upcomingInterviews?: MyWorkUpcomingInterview[];
  /** Caller-owned accepted cases. Same absent-vs-empty rule as upcomingInterviews. */
  joiningSoon?: MyWorkJoiningSoon[];
  /** True when there are no work items; targets alone do not count. */
  empty: boolean;
  emptyMessage: string | null;
  /** Reminder worker swept within 2x its interval. */
  reminderWorkerHealthy: boolean;
}

/** B8: GET /results/me|team|org?month=YYYY-MM&vacancyId=&managerId= (Cairo months). No activity counters, no prior-period comparison. */
export interface ResultTile {
  value: number;
  of: number;
  sampleSize: number;
  detail: string;
  /** true when sampleSize < 5; seats are exempt (always false). */
  tooFewToJudge: boolean;
}
export interface ResultsResponse {
  scope: 'me' | 'team' | 'org';
  month: string;
  range: { from: string; to: string };
  filters: { vacancyId: string | null; managerId: string | null };
  people: Array<{ id: string; name: string }>;
  tiles: { seats: ResultTile; overdueFollowUps: ResultTile; screensReachedInterview: ResultTile; offersAccepted: ResultTile };
  /** M2-M4: /results/team only — one row per direct report (after the manager filter). */
  rows?: Array<{ person: { id: string; name: string }; tiles: ResultsResponse['tiles'] }>;
}
