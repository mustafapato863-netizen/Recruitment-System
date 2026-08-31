import { z } from 'zod';

export const idSchema = z.uuid();

export const vacancyRequestStatusSchema = z.enum([
  'Draft',
  'Pending Approval',
  'Changes Requested',
  'Approved',
  'Rejected',
  'Cancelled',
  'Converted to Vacancy',
]);

export type VacancyRequestStatus = z.infer<typeof vacancyRequestStatusSchema>;

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const createVacancyRequestSchema = z.object({
  organizationId: idSchema,
  legalEntityId: idSchema.nullable().optional(),
  branchId: idSchema,
  positionId: idSchema,
  requesterId: idSchema,
  requestedHeadcount: z.coerce.number().int().min(1).max(10_000),
  employmentType: optionalText(60),
  reason: optionalText(120),
  budgetStatus: optionalText(60),
  criticality: optionalText(40),
  targetStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  justification: optionalText(5_000),
});

export const updateVacancyRequestSchema = z.object({
  legalEntityId: idSchema.nullable().optional(),
  branchId: idSchema.optional(),
  positionId: idSchema.optional(),
  requestedHeadcount: z.coerce.number().int().min(1).max(10_000).optional(),
  employmentType: optionalText(60),
  reason: optionalText(120),
  budgetStatus: optionalText(60),
  criticality: optionalText(40),
  targetStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  justification: optionalText(5_000),
});

export const updateVacancyStatusSchema = z.object({
  status: z.enum(['Open', 'On Hold', 'Cancelled']),
  reason: z.string().trim().max(1_000).optional(),
});

export const vacancyRequestActionSchema = z.object({
  comment: z.string().trim().max(1_000).optional(),
});

// ─── Auth ────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

// ─── Users ───────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(128),
});

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});

// ─── Roles ───────────────────────────────────────────────────

export const createRoleSchema = z.object({
  code: z.string().trim().min(1).max(80).regex(/^[A-Z_]+$/),
  name: z.string().trim().min(1).max(120),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});

// ─── Master Data ─────────────────────────────────────────────

export const createLegalEntitySchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
});

export const createBranchSchema = z.object({
  legalEntityId: idSchema,
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).nullable().optional(),
});

export const createPositionSchema = z.object({
  code: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).nullable().optional(),
});

// ─── Candidates ─────────────────────────────────────────────

export const createCandidateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).nullable().optional(),
  currentTitle: z.string().trim().max(120).nullable().optional(),
  currentCompany: z.string().trim().max(120).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional(),
});

export const updateCandidateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  currentTitle: z.string().trim().max(120).nullable().optional(),
  currentCompany: z.string().trim().max(120).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional(),
  status: z.enum(['Active', 'Blacklisted', 'Archived']).optional(),
});

// ─── Applications ───────────────────────────────────────────

export const applicationStageEnum = z.enum([
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Pre-Hire',
  'Joined',
  'Rejected',
  'Withdrawn',
]);

export const createApplicationSchema = z.object({
  vacancyId: idSchema,
  candidateId: idSchema,
  source: z.string().trim().max(80).nullable().optional(),
  primaryRecruiterId: idSchema.nullable().optional(),
  taskOwnerId: idSchema.nullable().optional(),
});

export const updateApplicationStageSchema = z.object({
  stage: applicationStageEnum,
  reason: z.string().trim().max(1_000).optional(),
});

// ─── Phase 4 — Screening & Interviews ────────────────────────

export const screeningOutcomeEnum = z.enum(['Passed', 'Failed', 'On Hold']);

export const createScreeningLogSchema = z.object({
  applicationId: idSchema,
  outcome: screeningOutcomeEnum,
  notes: z.string().trim().max(5_000).optional(),
});

export const interviewTypeEnum = z.enum([
  'Screening',
  'Technical',
  'Behavioral',
  'Managerial',
  'Executive',
]);

export const interviewStatusEnum = z.enum([
  'Scheduled',
  'Completed',
  'Cancelled',
  'Rescheduled',
]);

export const createInterviewSchema = z.object({
  applicationId: idSchema,
  title: z.string().trim().min(1).max(200),
  interviewType: interviewTypeEnum,
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  timezone: z.string().trim().max(50).default('UTC'),
  locationUrl: z.string().trim().url().max(500).nullable().optional(),
  attendeeUserIds: z.array(idSchema).min(1),
});

export const updateInterviewSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  locationUrl: z.string().trim().max(500).nullable().optional(),
  status: interviewStatusEnum.optional(),
});

export const scorecardRecommendationEnum = z.enum([
  'Strong Hire',
  'Hire',
  'Neutral',
  'No Hire',
  'Strong No Hire',
]);

export const submitScorecardSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  recommendation: scorecardRecommendationEnum,
  strengths: z.string().trim().max(5_000).optional(),
  concerns: z.string().trim().max(5_000).optional(),
  notes: z.string().trim().max(5_000).optional(),
});

// ─── Phase 5 — Offers ────────────────────────────────────────

export const offerStatusEnum = z.enum([
  'Draft',
  'Pending Approval',
  'Approved',
  'Sent',
  'Accepted',
  'Declined',
  'Withdrawn',
  'Expired',
]);

export const offerComponentTypeEnum = z.enum([
  'Salary',
  'Allowance',
  'Benefit',
]);

export const offerComponentSchema = z.object({
  type: offerComponentTypeEnum,
  name: z.string().trim().min(1).max(150),
  amount: z.number().nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  frequency: z.string().trim().max(50).nullable().optional(),
  isTaxable: z.boolean().default(true),
});

export const createOfferSchema = z.object({
  applicationId: idSchema,
  contractType: z.string().trim().max(100).nullable().optional(),
  probationPeriod: z.string().trim().max(100).nullable().optional(),
  offerExpiry: z.string().datetime().nullable().optional(),
  proposedJoiningDate: z.string().datetime().nullable().optional(),
  workLocation: z.string().trim().max(200).nullable().optional(),
  workingSchedule: z.string().trim().max(100).nullable().optional(),
  components: z.array(offerComponentSchema),
});

export const createOfferRevisionSchema = createOfferSchema.omit({ applicationId: true });

export const offerDecisionSchema = z.object({
  decision: z.enum(['Approve', 'Reject']),
  comment: z.string().trim().max(2_000).optional(),
});

// ─── Phase 6 — Hiring & Joining ──────────────────────────────

export const createHiringCaseSchema = z.object({
  offerId: idSchema,
});

export const complianceStatusEnum = z.enum([
  'Pending',
  'Submitted',
  'Verified',
  'Rejected',
  'Not Required',
]);

export const updateComplianceSchema = z.object({
  status: complianceStatusEnum,
  expiryDate: z.string().datetime().nullable().optional(),
});

export const finalApprovalSchema = z.object({
  decision: z.enum(['Approve', 'Reject']),
  comment: z.string().trim().min(1, 'A comment is required for final approval').max(2_000),
});

export const joiningUpdateSchema = z.object({
  status: z.enum(['Joined', 'Postponed', 'No-show']),
  actualJoiningDate: z.string().datetime().nullable().optional(),
});

// ─── Phase 7 — Talent Pool & Import ─────────────────────────

export const createTalentPoolSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).nullable().optional(),
  tags: z.array(z.string().trim().max(100)).max(20).optional(),
});

export const addToPoolSchema = z.object({
  candidateId: idSchema,
  source: z.string().trim().max(100).nullable().optional(),
  consentExpiry: z.string().datetime().nullable().optional(),
});

export const importRowDecisionSchema = z.object({
  decision: z.enum(['Update', 'NewApplication', 'Skip', 'KeepBoth']),
});

// ─── Phase 8 — Reports, Pipeline & Integrations ─────────────

export const createPipelineTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
});

export const createPipelineStageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  stageType: z.string().trim().min(1).max(50),
  sortOrder: z.number().int().min(0).optional(),
  slaDays: z.number().int().min(1).nullable().optional(),
  defaultOwner: z.string().trim().max(100).nullable().optional(),
  entryGate: z.string().trim().max(200).nullable().optional(),
  exitGate: z.string().trim().max(200).nullable().optional(),
});

export const updateIntegrationConfigSchema = z.object({
  status: z.enum(['Available', 'Connected', 'Planned', 'Disconnected']).optional(),
  configJson: z.record(z.string(), z.unknown()).optional(),
});
