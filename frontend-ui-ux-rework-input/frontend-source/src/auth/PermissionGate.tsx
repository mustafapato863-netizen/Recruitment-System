import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PageState } from '../components/ui/PageState';

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

  if (!user) {
    return null;
  }

  const hasRole = !requiredRole || (user.roles || []).some((r) => r.code === requiredRole);
  const hasPermission =
    !requiredPermission || (user.permissions || []).includes(requiredPermission);
  const hasAnyPermission = !requiredAnyPermission?.length
    || requiredAnyPermission.some((permission) => (user.permissions || []).includes(permission));

  if (!hasRole || !hasPermission || !hasAnyPermission) {
    const requirement = requiredPermission
      ? `permission (${requiredPermission})`
      : requiredAnyPermission?.length
        ? `one of these permissions (${requiredAnyPermission.join(', ')})`
        : `role (${requiredRole})`;
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
