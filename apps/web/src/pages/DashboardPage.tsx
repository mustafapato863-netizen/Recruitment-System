import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EmployeeDashboard } from './EmployeeDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { RecruitmentCommandCenter } from './RecruitmentCommandCenter';
import { isEmployeeWorkspaceUser } from '../auth/workspacePersona';

export function DashboardPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'command_center' | 'analytics'>('command_center');

  // Keep employee/requester and read-only roles in their focused My Work view.
  // Operational permissions still route recruiters and managers to the full workspace.
  const isManagerOrAdmin = !isEmployeeWorkspaceUser(user) && (
    Boolean(user?.permissions.includes('VACANCY_VIEW')) ||
    Boolean(user?.permissions.includes('APPLICATION_VIEW'))
  );

  if (!isManagerOrAdmin) {
    return <EmployeeDashboard />;
  }

  if (viewMode === 'command_center') {
    return <RecruitmentCommandCenter onToggleAnalytics={() => setViewMode('analytics')} />;
  }

  return (
    <div className="relative">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 pt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setViewMode('command_center')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-100 transition cursor-pointer shadow-xs"
        >
          <span>&larr; Back to Command Center</span>
        </button>
      </div>
      <ManagerDashboard />
    </div>
  );
}
