import { useAuth } from '../auth/AuthContext';
import { EmployeeDashboard } from './EmployeeDashboard';
import { ManagerDashboard } from './ManagerDashboard';

export function DashboardPage() {
  const { user } = useAuth();

  // Role resolution: Check if user is Manager or Admin, else Employee
  const userRoleCodes = user?.roles?.map((r) => r.code) || [];
  const isManagerOrAdmin =
    userRoleCodes.some((code) =>
      [
        'ADMIN',
        'SYSADMIN',
        'ADMINISTRATOR',
        'HIRING_MANAGER',
        'RECRUITER',
        'TALENT_MANAGER',
        'HR_MANAGER',
        'HR_OPERATIONS',
      ].includes(code)
    ) ||
    Boolean(user?.permissions.includes('VACANCY_VIEW')) ||
    Boolean(user?.permissions.includes('APPLICATION_VIEW'));

  if (!isManagerOrAdmin) {
    return <EmployeeDashboard />;
  }

  return <ManagerDashboard />;
}