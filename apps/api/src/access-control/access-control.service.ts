import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  DataVisibilityScope,
  RoleRlsPolicy,
  UpdateRlsPoliciesDto,
  RlsGovernanceResponse,
} from './access-control.dto';

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
