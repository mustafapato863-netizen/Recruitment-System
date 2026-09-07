import { IsObject, IsOptional } from 'class-validator';

export type DataVisibilityScope = 'ALL' | 'ASSIGNED_ONLY' | 'BRANCH' | 'DEPARTMENT';

export interface RoleRlsPolicy {
  dataScope: DataVisibilityScope;
  canViewPii: boolean;
  canViewSalary: boolean;
  canDownloadDocs: boolean;
  canApprove: boolean;
}

export class UpdateRlsPoliciesDto {
  @IsObject()
  roles!: Record<string, RoleRlsPolicy>;

  @IsOptional()
  @IsObject()
  userOverrides?: Record<string, Partial<RoleRlsPolicy>>;
}

export interface RlsGovernanceResponse {
  organizationId: string;
  roles: Record<string, RoleRlsPolicy>;
  userOverrides: Record<string, Partial<RoleRlsPolicy>>;
  availableScopes: Array<{
    id: DataVisibilityScope;
    name: string;
    description: string;
  }>;
  availableRoles: Array<{
    code: string;
    name: string;
  }>;
}
