import type { PrismaService } from '../../database/prisma.service';

/**
 * M1-G4 Tenant Resource Policy Registry
 *
 * Each entry maps a resource key to a typed verification function that checks
 * whether a record identified by `id` belongs to the given `tenantId`.
 *
 * For direct-organization models, we query `{ id, organizationId }`.
 * For child/junction models, we query through the parent relation.
 *
 * Adding a new resource requires only adding an entry here — no dynamic model
 * access, no `any`, no assumptions about schema shape.
 */

export interface TenantVerifyResult {
  exists: boolean;
  belongsToTenant: boolean;
}

type TenantVerifier = (
  prisma: PrismaService,
  id: string,
  tenantId: string,
) => Promise<TenantVerifyResult>;

/**
 * Helper for models that have a direct `organizationId` field.
 */
function directOrgScope(
  modelAccessor: (prisma: PrismaService) => { findUnique: (args: { where: { id: string } }) => Promise<{ organizationId: string } | null> },
): TenantVerifier {
  return async (prisma, id, tenantId) => {
    const record = await modelAccessor(prisma).findUnique({ where: { id } });
    if (!record) return { exists: false, belongsToTenant: false };
    return { exists: true, belongsToTenant: record.organizationId === tenantId };
  };
}

/**
 * Helper for child models that must be scoped through a parent relation.
 * The parentAccessor returns a query that includes the parent's organizationId.
 */
function parentRelationScope(
  queryFn: (prisma: PrismaService, id: string) => Promise<{ organizationId: string } | null>,
): TenantVerifier {
  return async (prisma, id, tenantId) => {
    const record = await queryFn(prisma, id);
    if (!record) return { exists: false, belongsToTenant: false };
    return { exists: true, belongsToTenant: record.organizationId === tenantId };
  };
}

// ---------------------------------------------------------------------------
// Policy Registry
// ---------------------------------------------------------------------------

export const TENANT_RESOURCE_POLICIES: Record<string, TenantVerifier> = {
  // ── Direct organization-owned models ──────────────────────────────────

  candidate: directOrgScope((p) => p.candidate),
  application: directOrgScope((p) => p.application),
  vacancy: directOrgScope((p) => p.vacancy),
  vacancyRequest: directOrgScope((p) => p.vacancyRequest),
  interview: directOrgScope((p) => p.interview),
  offer: directOrgScope((p) => p.offer),
  hiringCase: directOrgScope((p) => p.hiringCase),
  talentPool: directOrgScope((p) => p.talentPool),
  candidateDocument: directOrgScope((p) => p.candidateDocument),
  screeningLog: directOrgScope((p) => p.screeningLog),
  notification: directOrgScope((p) => p.notification),
  task: directOrgScope((p) => p.task),
  integration: directOrgScope((p) => p.integration),
  pipelineTemplate: directOrgScope((p) => p.pipelineTemplate),
  candidateImportJob: directOrgScope((p) => p.candidateImportJob),
  user: directOrgScope((p) => p.user),
  legalEntity: directOrgScope((p) => p.legalEntity),
  branch: directOrgScope((p) => p.branch),
  position: directOrgScope((p) => p.position),

  // Roles have optional organizationId (null = shared system role, non-null = tenant custom role)
  role: async (prisma, id, tenantId) => {
    const record = await prisma.role.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!record) return { exists: false, belongsToTenant: false };
    const visible = record.organizationId === null || record.organizationId === tenantId;
    return { exists: true, belongsToTenant: visible };
  },

  // ── Child/junction models scoped through parent relations ─────────────

  offerVersion: parentRelationScope(async (prisma, id) => {
    const record = await prisma.offerVersion.findUnique({
      where: { id },
      select: { offer: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.offer.organizationId } : null;
  }),

  offerApproval: parentRelationScope(async (prisma, id) => {
    const record = await prisma.offerApproval.findUnique({
      where: { id },
      select: { offerVersion: { select: { offer: { select: { organizationId: true } } } } },
    });
    return record ? { organizationId: record.offerVersion.offer.organizationId } : null;
  }),

  complianceRequirement: parentRelationScope(async (prisma, id) => {
    const record = await prisma.complianceRequirement.findUnique({
      where: { id },
      select: { hiringCase: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.hiringCase.organizationId } : null;
  }),

  hiringCaseApproval: parentRelationScope(async (prisma, id) => {
    const record = await prisma.hiringCaseApproval.findUnique({
      where: { id },
      select: { hiringCase: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.hiringCase.organizationId } : null;
  }),

  pipelineStage: parentRelationScope(async (prisma, id) => {
    const record = await prisma.pipelineStage.findUnique({
      where: { id },
      select: { template: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.template.organizationId } : null;
  }),

  candidateImportRow: parentRelationScope(async (prisma, id) => {
    const record = await prisma.candidateImportRow.findUnique({
      where: { id },
      select: { job: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.job.organizationId } : null;
  }),

  applicationStatusHistory: parentRelationScope(async (prisma, id) => {
    const record = await prisma.applicationStatusHistory.findUnique({
      where: { id },
      select: { application: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.application.organizationId } : null;
  }),

  interviewAttendee: parentRelationScope(async (prisma, id) => {
    const record = await prisma.interviewAttendee.findUnique({
      where: { id },
      select: { interview: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.interview.organizationId } : null;
  }),

  interviewScorecard: parentRelationScope(async (prisma, id) => {
    const record = await prisma.interviewScorecard.findUnique({
      where: { id },
      select: { interview: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.interview.organizationId } : null;
  }),

  talentPoolCandidate: parentRelationScope(async (prisma, id) => {
    const record = await prisma.talentPoolCandidate.findUnique({
      where: { id },
      select: { talentPool: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.talentPool.organizationId } : null;
  }),

  vacancyRequestApproval: parentRelationScope(async (prisma, id) => {
    const record = await prisma.vacancyRequestApproval.findUnique({
      where: { id },
      select: { vacancyRequest: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.vacancyRequest.organizationId } : null;
  }),

  vacancyAssignment: parentRelationScope(async (prisma, id) => {
    const record = await prisma.vacancyAssignment.findUnique({
      where: { id },
      select: { vacancy: { select: { organizationId: true } } },
    });
    return record ? { organizationId: record.vacancy.organizationId } : null;
  }),

  offerComponent: parentRelationScope(async (prisma, id) => {
    const record = await prisma.offerComponent.findUnique({
      where: { id },
      select: { offerVersion: { select: { offer: { select: { organizationId: true } } } } },
    });
    return record ? { organizationId: record.offerVersion.offer.organizationId } : null;
  }),
};

/**
 * Returns the set of all supported resource keys.
 */
export function getSupportedResources(): string[] {
  return Object.keys(TENANT_RESOURCE_POLICIES);
}
