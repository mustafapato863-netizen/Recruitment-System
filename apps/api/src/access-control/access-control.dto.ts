import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

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

export interface UserResponsibilityConfig {
  userId: string;
  displayName: string;
  email: string;
  status: string;
  roles: Array<{ id: string; code: string; name: string }>;
  branches: string[];
  departments: string[];
  workflowResponsibilities: string[];
  customScope?: DataVisibilityScope | undefined;
  canViewPii?: boolean | undefined;
  canViewSalary?: boolean | undefined;
  canDownloadDocs?: boolean | undefined;
  canApprove?: boolean | undefined;
  notes?: string | undefined;
  updatedAt?: string | undefined;
}

export class UpdateUserResponsibilityDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workflowResponsibilities?: string[];

  @IsOptional()
  @IsEnum(['ALL', 'ASSIGNED_ONLY', 'BRANCH', 'DEPARTMENT'])
  customScope?: DataVisibilityScope;

  @IsOptional()
  @IsBoolean()
  canViewPii?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewSalary?: boolean;

  @IsOptional()
  @IsBoolean()
  canDownloadDocs?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export interface ResponsibilityItem {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
}

export interface UserResponsibilitiesResponse {
  organizationId: string;
  users: UserResponsibilityConfig[];
  branches: Array<{ id: string; code: string; name: string; city: string | null }>;
  departments: string[];
  availableResponsibilities: ResponsibilityItem[];
  availableRoles: Array<{ id: string; code: string; name: string }>;
  availableScopes: Array<{ id: DataVisibilityScope; name: string; description: string }>;
}
