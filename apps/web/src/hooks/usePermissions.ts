import { useCallback, useMemo } from 'react';
import {
  formatPermissionRequirement,
  getPermissionLabel,
} from '@recruitflow/contracts';
import { useAuth } from '../auth/AuthContext';

export function usePermissions() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  const hasPermission = useCallback(
    (code?: string | null) => {
      if (!code) return true;
      return permissions.has(code);
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (codes?: readonly string[] | null) => {
      if (!codes?.length) return true;
      return codes.some((code) => permissions.has(code));
    },
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (codes?: readonly string[] | null) => {
      if (!codes?.length) return true;
      return codes.every((code) => permissions.has(code));
    },
    [permissions],
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
