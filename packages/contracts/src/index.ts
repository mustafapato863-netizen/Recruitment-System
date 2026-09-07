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
] as const;

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
  jobSummary: string | null;
  description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
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
  jobSummary?: string | null;
  description?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  benefits?: string | null;
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
  jobSummary?: string | null;
  description?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  benefits?: string | null;
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
  /** 'system' roles are shared catalog entries; 'organization' roles are tenant-local. */
  scope?: 'system' | 'organization';
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
  consentStatus?: string;
  consentCapturedAt?: string | null;
  consentSource?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[];
  languages?: string[];
  availability?: string | null;
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
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[];
  languages?: string[];
  availability?: string | null;
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
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[];
  languages?: string[];
  availability?: string | null;
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
  notes?: string | undefined;
}

export interface GenerateSelfScheduleInput {
  applicationId: string;
  title: string;
  interviewType: InterviewType;
  durationMinutes?: number | undefined;
  attendeeUserIds: string[];
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

export type BulkImportDataset = 'candidates' | 'vacancy-requests' | 'legal-entities' | 'branches' | 'positions';

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

export interface ReportOverview {
  range: ReportRange;
  comparisonRange: ReportRange;
  kpis: ReportKpis;
  comparison: {
    applications: number;
    offers: number;
    interviews: number;
    joined: number;
  };
  trend: ReportTrendPoint[];
  funnel: FunnelStage[];
  hiringByPosition: HiringByPosition[];
  recruiterWorkload: RecruiterWorkload[];
  filterOptions: {
    branches: ReportFilterOption[];
    positions: ReportFilterOption[];
    recruiters: ReportFilterOption[];
  };
}

export type GlobalSearchEntityType = 'candidate' | 'vacancy' | 'application' | 'task' | 'interview' | 'offer' | 'approval' | 'notification' | 'cv' | 'talent-pool' | 'master-data';

export interface GlobalSearchItem {
  entityType: GlobalSearchEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  status?: string;
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

export type EmailTemplateDetail = EmailTemplateItem;

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

