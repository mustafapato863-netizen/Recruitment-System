import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  DataVisibilityScope,
  RoleRlsPolicy,
  UpdateRlsPoliciesDto,
  RlsGovernanceResponse,
  UpdateUserResponsibilityDto,
  UserResponsibilitiesResponse,
  UserResponsibilityConfig,
  ResponsibilityItem,
} from './access-control.dto';

const STANDARD_RESPONSIBILITIES: ResponsibilityItem[] = [
  {
    id: 'REQUISITIONS',
    name: 'Requisition Management',
    category: 'Intake & Planning',
    description: 'Create, route, and submit vacancy requests with budget & justification.',
    icon: 'file-text',
  },
  {
    id: 'SOURCING',
    name: 'Talent Sourcing & CV Intake',
    category: 'Acquisition',
    description: 'Fast CV intake, candidate extraction, and talent pool management.',
    icon: 'users',
  },
  {
    id: 'SCREENING',
    name: 'Pre-Screening & Document Verification',
    category: 'Screening',
    description: 'Review initial applicant qualifications, eligibility, and checklist criteria.',
    icon: 'check-circle',
  },
  {
    id: 'INTERVIEWS',
    name: 'Interview Coordination & Scoring',
    category: 'Assessment',
    description: 'Schedule panel sessions, conduct interviews, and submit structured clinical scorecards.',
    icon: 'calendar',
  },
  {
    id: 'COMPENSATION',
    name: 'Salary & Compensation Structuring',
    category: 'Offers',
    description: 'Access salary expectations, benchmark compensation, and define monetary offers.',
    icon: 'dollar-sign',
  },
  {
    id: 'OFFER_APPROVAL',
    name: 'Offer Authority & Digital Sign-off',
    category: 'Approvals',
    description: 'Grant formal approval on offer letters and employment agreements.',
    icon: 'pen-tool',
  },
  {
    id: 'CREDENTIALING',
    name: 'Medical Credentialing & Licenses',
    category: 'Compliance',
    description: 'Verify SCFHS professional registrations, DataFlow, and health authority clearances.',
    icon: 'shield',
  },
  {
    id: 'ONBOARDING',
    name: 'Joining & Hiring Dossier Handoff',
    category: 'Onboarding',
    description: 'Complete pre-employment checklists, onboarding logistics, and ERP handover.',
    icon: 'briefcase',
  },
];

const STANDARD_DEPARTMENTS: string[] = [
  'Cardiology & Cardiovascular',
  'Internal Medicine & Subspecialties',
  'Emergency & Critical Care',
  'General & Minimally Invasive Surgery',
  'Pediatrics & Neonatology',
  'Obstetrics & Gynecology',
  'Orthopedic Surgery & Trauma',
  'Neurology & Neurosurgery',
  'Radiology & Diagnostic Imaging',
  'Pathology & Laboratory Medicine',
  'Anesthesiology & Pain Management',
  'Oncology & Hematology',
  'Nursing & Patient Services',
  'Clinical Pharmacy',
  'Hospital Administration & Operations',
  'Human Resources & Talent Management',
  'Quality & Patient Safety',
  'Information Technology & Healthcare Informatics',
];

const DEFAULT_SCOPES: Array<{ id: DataVisibilityScope; name: string; description: string }> = [
  {
    id: 'ALL',
    name: 'All Organization',
    description: 'Full visibility across all hospital facilities, branches, and departments.',
  },
  {
    id: 'ASSIGNED_ONLY',
    name: 'Assigned Requisitions Only',
    description: 'Scoped strictly to jobs & candidates where user is assigned recruiter, reviewer, or interviewer.',
  },
  {
    id: 'BRANCH',
    name: 'Branch / Facility Scoped',
    description: 'Scoped to the specific hospital branch or regional medical facility.',
  },
  {
    id: 'DEPARTMENT',
    name: 'Department Scoped',
    description: 'Scoped strictly to the user’s designated medical or operational department.',
  },
];

const DEFAULT_ROLE_POLICIES: Record<string, RoleRlsPolicy> = {
  ADMINISTRATOR: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: true,
    canDownloadDocs: true,
    canApprove: true,
  },
  TALENT_MANAGER: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: true,
    canDownloadDocs: true,
    canApprove: true,
  },
  HR_MANAGER: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: true,
    canDownloadDocs: true,
    canApprove: true,
  },
  RECRUITER: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: false,
    canDownloadDocs: true,
    canApprove: false,
  },
  HIRING_MANAGER: {
    dataScope: 'DEPARTMENT',
    canViewPii: false,
    canViewSalary: false,
    canDownloadDocs: false,
    canApprove: true,
  },
  INTERVIEWER: {
    dataScope: 'ASSIGNED_ONLY',
    canViewPii: false,
    canViewSalary: false,
    canDownloadDocs: false,
    canApprove: false,
  },
  HR_OPERATIONS: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: false,
    canDownloadDocs: true,
    canApprove: false,
  },
  LICENSE_SPECIALIST: {
    dataScope: 'ALL',
    canViewPii: false,
    canViewSalary: false,
    canDownloadDocs: true,
    canApprove: false,
  },
  OFFER_APPROVER: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: true,
    canDownloadDocs: true,
    canApprove: true,
  },
  FINAL_HIRING_APPROVER: {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: true,
    canDownloadDocs: true,
    canApprove: true,
  },
  VIEWER: {
    dataScope: 'ALL',
    canViewPii: false,
    canViewSalary: false,
    canDownloadDocs: false,
    canApprove: false,
  },
};

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRlsPolicies(organizationId: string): Promise<RlsGovernanceResponse> {
    const [roles, integrationRecord] = await Promise.all([
      this.prisma.role.findMany({
        where: {
          OR: [{ organizationId: null }, { organizationId }],
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.integration.findFirst({
        where: {
          organizationId,
          name: 'RLS_ACCESS_POLICY',
        },
      }),
    ]);

    const savedConfig = (integrationRecord?.configJson as {
      roles?: Record<string, RoleRlsPolicy>;
      userOverrides?: Record<string, Partial<RoleRlsPolicy>>;
    } | null) || {};

    const mergedRoles: Record<string, RoleRlsPolicy> = {};
    for (const r of roles) {
      mergedRoles[r.code] = savedConfig.roles?.[r.code] || DEFAULT_ROLE_POLICIES[r.code] || {
        dataScope: 'ALL',
        canViewPii: false,
        canViewSalary: false,
        canDownloadDocs: false,
        canApprove: false,
      };
    }

    return {
      organizationId,
      roles: mergedRoles,
      userOverrides: savedConfig.userOverrides || {},
      availableScopes: DEFAULT_SCOPES,
      availableRoles: roles.map((r) => ({ code: r.code, name: r.name })),
    };
  }

  async updateRlsPolicies(
    organizationId: string,
    dto: UpdateRlsPoliciesDto,
  ): Promise<RlsGovernanceResponse> {
    const existing = await this.prisma.integration.findFirst({
      where: {
        organizationId,
        name: 'RLS_ACCESS_POLICY',
      },
    });

    const payload = {
      roles: dto.roles,
      userOverrides: dto.userOverrides || {},
    };

    if (existing) {
      await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          configJson: payload as unknown as Prisma.InputJsonValue,
          lastSyncAt: new Date(),
          status: 'Active',
        },
      });
    } else {
      await this.prisma.integration.create({
        data: {
          organizationId,
          name: 'RLS_ACCESS_POLICY',
          provider: 'INTERNAL_RLS',
          category: 'SECURITY',
          status: 'Active',
          configJson: payload as unknown as Prisma.InputJsonValue,
          lastSyncAt: new Date(),
        },
      });
    }

    // Synchronize permission links in database based on policy toggles
    await this.syncRolePermissionsFromPolicy(organizationId, dto.roles);

    return this.getRlsPolicies(organizationId);
  }

  async getUserEffectiveScope(
    organizationId: string,
    userId: string,
    roleCodes: string[],
  ): Promise<RoleRlsPolicy> {
    if (roleCodes.includes('ADMINISTRATOR')) {
      return {
        dataScope: 'ALL',
        canViewPii: true,
        canViewSalary: true,
        canDownloadDocs: true,
        canApprove: true,
      };
    }

    const { roles, userOverrides } = await this.getRlsPolicies(organizationId);

    // 1. User-specific override takes precedence if defined
    if (userOverrides[userId]) {
      const firstRole = roleCodes[0] ?? 'VIEWER';
      const fallback: RoleRlsPolicy = {
        dataScope: 'ASSIGNED_ONLY',
        canViewPii: false,
        canViewSalary: false,
        canDownloadDocs: false,
        canApprove: false,
      };
      const base: RoleRlsPolicy =
        roles[firstRole] ?? DEFAULT_ROLE_POLICIES[firstRole] ?? DEFAULT_ROLE_POLICIES.VIEWER ?? fallback;
      return { ...base, ...userOverrides[userId] } as RoleRlsPolicy;
    }

    // 2. Highest privilege role policy
    let effective: RoleRlsPolicy = {
      dataScope: 'ASSIGNED_ONLY',
      canViewPii: false,
      canViewSalary: false,
      canDownloadDocs: false,
      canApprove: false,
    };

    for (const code of roleCodes) {
      const p = roles[code];
      if (p) {
        if (p.dataScope === 'ALL') effective.dataScope = 'ALL';
        else if (p.dataScope === 'BRANCH' && effective.dataScope !== 'ALL') effective.dataScope = 'BRANCH';
        else if (p.dataScope === 'DEPARTMENT' && effective.dataScope === 'ASSIGNED_ONLY') effective.dataScope = 'DEPARTMENT';

        if (p.canViewPii) effective.canViewPii = true;
        if (p.canViewSalary) effective.canViewSalary = true;
        if (p.canDownloadDocs) effective.canDownloadDocs = true;
        if (p.canApprove) effective.canApprove = true;
      }
    }

    return effective;
  }

  async getAuditSimulation(organizationId: string, roleCode: string) {
    const { roles } = await this.getRlsPolicies(organizationId);
    const policy: RoleRlsPolicy =
      roles[roleCode] ?? DEFAULT_ROLE_POLICIES[roleCode] ?? DEFAULT_ROLE_POLICIES.VIEWER ?? {
        dataScope: 'ASSIGNED_ONLY',
        canViewPii: false,
        canViewSalary: false,
        canDownloadDocs: false,
        canApprove: false,
      };

    let sampleWhereClause: Record<string, unknown> = { organizationId };
    if (policy.dataScope === 'ASSIGNED_ONLY') {
      sampleWhereClause = {
        organizationId,
        OR: [
          { primaryRecruiterId: '<caller-user-id>' },
          { taskOwnerId: '<caller-user-id>' },
          { assignments: { some: { userId: '<caller-user-id>' } } },
        ],
      };
    } else if (policy.dataScope === 'BRANCH') {
      sampleWhereClause = {
        organizationId,
        branchId: '<caller-assigned-branch-id>',
      };
    } else if (policy.dataScope === 'DEPARTMENT') {
      sampleWhereClause = {
        organizationId,
        department: '<caller-department-name>',
      };
    }

    return {
      roleCode,
      policy,
      sampleWhereClause,
    };
  }

  async getUserResponsibilities(organizationId: string): Promise<UserResponsibilitiesResponse> {
    const [users, branches, roles, integrationRecord] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.branch.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true, city: true },
      }),
      this.prisma.role.findMany({
        where: {
          OR: [{ organizationId: null }, { organizationId }],
        },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.integration.findFirst({
        where: { organizationId, name: 'RLS_ACCESS_POLICY' },
      }),
    ]);

    const savedConfig = (integrationRecord?.configJson as {
      roles?: Record<string, RoleRlsPolicy>;
      userOverrides?: Record<string, Partial<RoleRlsPolicy>>;
      userResponsibilities?: Record<string, Partial<UserResponsibilityConfig>>;
    } | null) || {};

    const respMap = savedConfig.userResponsibilities || {};
    const overridesMap = savedConfig.userOverrides || {};

    const userConfigs: UserResponsibilityConfig[] = users.map((u) => {
      const resp = respMap[u.id] || {};
      const override = overridesMap[u.id] || {};
      const roleCodes = (u.userRoles || []).map((ur) => ur.role.code);
      const isAdmin = roleCodes.includes('ADMINISTRATOR');

      return {
        userId: u.id,
        displayName: u.displayName,
        email: u.email,
        status: u.status,
        roles: (u.userRoles || []).map((ur) => ({
          id: ur.role.id,
          code: ur.role.code,
          name: ur.role.name,
        })),
        branches: resp.branches && resp.branches.length > 0 ? resp.branches : ['ALL'],
        departments: resp.departments && resp.departments.length > 0 ? resp.departments : ['All Departments'],
        workflowResponsibilities:
          resp.workflowResponsibilities && resp.workflowResponsibilities.length > 0
            ? resp.workflowResponsibilities
            : isAdmin
            ? STANDARD_RESPONSIBILITIES.map((r) => r.id)
            : ['SOURCING', 'SCREENING', 'INTERVIEWS'],
        customScope: override.dataScope || resp.customScope || (isAdmin ? 'ALL' : undefined),
        canViewPii: override.canViewPii !== undefined ? override.canViewPii : resp.canViewPii,
        canViewSalary: override.canViewSalary !== undefined ? override.canViewSalary : resp.canViewSalary,
        canDownloadDocs: override.canDownloadDocs !== undefined ? override.canDownloadDocs : resp.canDownloadDocs,
        canApprove: override.canApprove !== undefined ? override.canApprove : resp.canApprove,
        notes: resp.notes,
        updatedAt: resp.updatedAt,
      };
    });

    return {
      organizationId,
      users: userConfigs,
      branches,
      departments: STANDARD_DEPARTMENTS,
      availableResponsibilities: STANDARD_RESPONSIBILITIES,
      availableRoles: roles,
      availableScopes: DEFAULT_SCOPES,
    };
  }

  async updateUserResponsibility(
    organizationId: string,
    userId: string,
    dto: UpdateUserResponsibilityDto,
  ): Promise<UserResponsibilityConfig> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    // 1. Sync roles if provided
    if (dto.roles && Array.isArray(dto.roles)) {
      const matchingRoles = await this.prisma.role.findMany({
        where: {
          code: { in: dto.roles },
          OR: [{ organizationId: null }, { organizationId }],
        },
      });

      // Clear existing roles
      await this.prisma.userRole.deleteMany({ where: { userId } });

      // Insert new roles
      for (const r of matchingRoles) {
        await this.prisma.userRole.create({
          data: { userId, roleId: r.id },
        });
      }
    }

    // 2. Load and update stored config
    const existing = await this.prisma.integration.findFirst({
      where: { organizationId, name: 'RLS_ACCESS_POLICY' },
    });

    const savedConfig = (existing?.configJson as {
      roles?: Record<string, RoleRlsPolicy>;
      userOverrides?: Record<string, Partial<RoleRlsPolicy>>;
      userResponsibilities?: Record<string, Partial<UserResponsibilityConfig>>;
    } | null) || { roles: {}, userOverrides: {}, userResponsibilities: {} };

    const userResponsibilities = savedConfig.userResponsibilities || {};
    const userOverrides = savedConfig.userOverrides || {};

    const updatedResp: Partial<UserResponsibilityConfig> = {
      ...(userResponsibilities[userId] || {}),
      branches: dto.branches ?? userResponsibilities[userId]?.branches ?? ['ALL'],
      departments: dto.departments ?? userResponsibilities[userId]?.departments ?? ['All Departments'],
      workflowResponsibilities:
        dto.workflowResponsibilities ??
        userResponsibilities[userId]?.workflowResponsibilities ?? ['SOURCING', 'SCREENING'],
      customScope: dto.customScope ?? userResponsibilities[userId]?.customScope,
      canViewPii: dto.canViewPii ?? userResponsibilities[userId]?.canViewPii,
      canViewSalary: dto.canViewSalary ?? userResponsibilities[userId]?.canViewSalary,
      canDownloadDocs: dto.canDownloadDocs ?? userResponsibilities[userId]?.canDownloadDocs,
      canApprove: dto.canApprove ?? userResponsibilities[userId]?.canApprove,
      notes: dto.notes ?? userResponsibilities[userId]?.notes,
      updatedAt: new Date().toISOString(),
    };

    userResponsibilities[userId] = updatedResp;

    // Also sync into userOverrides for immediate RLS query interception
    userOverrides[userId] = {
      ...(userOverrides[userId] || {}),
      ...(dto.customScope ? { dataScope: dto.customScope } : {}),
      ...(dto.canViewPii !== undefined ? { canViewPii: dto.canViewPii } : {}),
      ...(dto.canViewSalary !== undefined ? { canViewSalary: dto.canViewSalary } : {}),
      ...(dto.canDownloadDocs !== undefined ? { canDownloadDocs: dto.canDownloadDocs } : {}),
      ...(dto.canApprove !== undefined ? { canApprove: dto.canApprove } : {}),
    };

    const newPayload = {
      roles: savedConfig.roles || {},
      userOverrides,
      userResponsibilities,
    };

    if (existing) {
      await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          configJson: newPayload as unknown as Prisma.InputJsonValue,
          lastSyncAt: new Date(),
        },
      });
    } else {
      await this.prisma.integration.create({
        data: {
          organizationId,
          name: 'RLS_ACCESS_POLICY',
          provider: 'INTERNAL_RLS',
          category: 'SECURITY',
          status: 'Active',
          configJson: newPayload as unknown as Prisma.InputJsonValue,
          lastSyncAt: new Date(),
        },
      });
    }

    const reloaded = await this.getUserResponsibilities(organizationId);
    const found = reloaded.users.find((u) => u.userId === userId);
    return found!;
  }

  private async syncRolePermissionsFromPolicy(
    organizationId: string,
    policies: Record<string, RoleRlsPolicy>,
  ) {
    try {
      const permissions = await this.prisma.permission.findMany();
      const permMap = new Map(permissions.map((p) => [p.code, p.id]));

      const piiPermId = permMap.get('VIEW_CANDIDATE_PII');
      const salaryPermId = permMap.get('VIEW_CURRENT_SALARY');
      const docsPermId = permMap.get('DOWNLOAD_DOCUMENTS');

      for (const [roleCode, policy] of Object.entries(policies)) {
        if (roleCode === 'ADMINISTRATOR') continue; // Never strip admin

        const role = await this.prisma.role.findFirst({
          where: {
            code: roleCode,
            OR: [{ organizationId: null }, { organizationId }],
          },
        });

        if (!role) continue;

        // PII Permission
        if (piiPermId) {
          if (policy.canViewPii) {
            await this.prisma.rolePermission.upsert({
              where: { roleId_permissionId: { roleId: role.id, permissionId: piiPermId } },
              create: { roleId: role.id, permissionId: piiPermId },
              update: {},
            });
          } else {
            await this.prisma.rolePermission.deleteMany({
              where: { roleId: role.id, permissionId: piiPermId },
            });
          }
        }

        // Salary Permission
        if (salaryPermId) {
          if (policy.canViewSalary) {
            await this.prisma.rolePermission.upsert({
              where: { roleId_permissionId: { roleId: role.id, permissionId: salaryPermId } },
              create: { roleId: role.id, permissionId: salaryPermId },
              update: {},
            });
          } else {
            await this.prisma.rolePermission.deleteMany({
              where: { roleId: role.id, permissionId: salaryPermId },
            });
          }
        }

        // Documents Permission
        if (docsPermId) {
          if (policy.canDownloadDocs) {
            await this.prisma.rolePermission.upsert({
              where: { roleId_permissionId: { roleId: role.id, permissionId: docsPermId } },
              create: { roleId: role.id, permissionId: docsPermId },
              update: {},
            });
          } else {
            await this.prisma.rolePermission.deleteMany({
              where: { roleId: role.id, permissionId: docsPermId },
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to sync role permissions: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
