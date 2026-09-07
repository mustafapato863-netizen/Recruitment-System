export type DataVisibilityScope = 'ALL' | 'ASSIGNED_ONLY' | 'BRANCH' | 'DEPARTMENT';

export interface RoleRlsPolicy {
  dataScope: DataVisibilityScope;
  canViewPii: boolean;
  canViewSalary: boolean;
  canDownloadDocs: boolean;
  canApprove: boolean;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  city: string | null;
}

export interface RoleOption {
  id: string;
  code: string;
  name: string;
}

export interface ScopeOption {
  id: DataVisibilityScope;
  name: string;
  description: string;
}

export interface ResponsibilityItem {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
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
  customScope?: DataVisibilityScope;
  canViewPii?: boolean;
  canViewSalary?: boolean;
  canDownloadDocs?: boolean;
  canApprove?: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface UserResponsibilitiesResponse {
  organizationId: string;
  users: UserResponsibilityConfig[];
  branches: BranchOption[];
  departments: string[];
  availableResponsibilities: ResponsibilityItem[];
  availableRoles: RoleOption[];
  availableScopes: ScopeOption[];
}
