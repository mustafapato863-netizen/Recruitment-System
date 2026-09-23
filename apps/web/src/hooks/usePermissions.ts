import { useCallback, useMemo } from 'react';
import {
  formatPermissionRequirement,
  getPermissionLabel,
} from '@recruitflow/contracts';
import { useAuth } from '../auth/AuthContext';

export function usePermissions() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const isAdministrator = useMemo(
    () => user?.roles?.some((role) => role.code === 'ADMINISTRATOR') ?? false,
    [user?.roles],
  );

  const hasPermission = useCallback(
    (code?: string | null) => {
      if (!code || isAdministrator) return true;
      return permissions.has(code);
    },
    [isAdministrator, permissions],
  );

  const hasAnyPermission = useCallback(
    (codes?: readonly string[] | null) => {
      if (!codes?.length || isAdministrator) return true;
      return codes.some((code) => permissions.has(code));
    },
    [isAdministrator, permissions],
  );

  const hasAllPermissions = useCallback(
    (codes?: readonly string[] | null) => {
      if (!codes?.length || isAdministrator) return true;
      return codes.every((code) => permissions.has(code));
    },
    [isAdministrator, permissions],
  );

  const canAccess = useCallback(
    (options: {
      requiredPermission?: string | null;
      requiredAnyPermissions?: readonly string[] | null;
    }) => {
      if (options.requiredPermission) return hasPermission(options.requiredPermission);
      return hasAnyPermission(options.requiredAnyPermissions);
    },
    [hasAnyPermission, hasPermission],
  );

  const describeRequirement = useCallback(
    (options: {
      requiredPermission?: string | null;
      requiredAnyPermissions?: readonly string[] | null;
    }) => formatPermissionRequirement(options),
    [],
  );

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess,
    describeRequirement,
    getPermissionLabel,
  };
}
