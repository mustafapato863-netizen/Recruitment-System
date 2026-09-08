import { useAuth } from '../auth/AuthContext';
import { isEmployeeWorkspaceUser } from '../auth/workspacePersona';
import { EmployeeDashboard } from './EmployeeDashboard';
import { TasksPage } from './TasksPage';

/**
 * My Work is the version-one operational entry point. Employees keep their
 * permission-appropriate request view; recruiters use the persisted task
 * queue that already resolves linked records and unlinked work items.
 */
export function MyWorkPage() {
  const { user } = useAuth();
  return isEmployeeWorkspaceUser(user) ? <EmployeeDashboard /> : <TasksPage />;
}

