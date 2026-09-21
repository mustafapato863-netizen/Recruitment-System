import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPermissionRequirement } from '@recruitflow/contracts';
import { useAuth } from './AuthContext';
import { PageState } from '../components/ui/PageState';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionGateProps {
  requiredPermission?: string;
  requiredAnyPermission?: readonly string[];
  requiredRole?: string;
  children: ReactNode;
}

export function PermissionGate({
  requiredPermission,
  requiredAnyPermission,
  requiredRole,
  children,
}: PermissionGateProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canAccess } = usePermissions();

  if (!user) {
    return null;
  }

  const hasRole = !requiredRole || (user.roles || []).some((r) => r.code === requiredRole);
  const hasPermissionAccess = canAccess({
    requiredPermission,
    requiredAnyPermissions: requiredAnyPermission,
  });

  if (!hasRole || !hasPermissionAccess) {
    const requirement = requiredRole && !hasRole
      ? `role (${requiredRole})`
      : formatPermissionRequirement({
          requiredPermission,
          requiredAnyPermissions: requiredAnyPermission,
        });
    return (
      <div className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        <PageState
          kind="forbidden"
          title="Access Restricted"
          description={`Your active profile does not have the required ${requirement} to view this workspace surface. Contact your administrator if you need access.`}
          actionLabel="Return to Command Center"
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  return <>{children}</>;
}
