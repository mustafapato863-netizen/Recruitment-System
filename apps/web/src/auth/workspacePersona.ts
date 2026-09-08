import type { UserProfile } from '@recruitflow/contracts';

const EMPLOYEE_ROLE_CODES = new Set(['EMPLOYEE', 'VIEWER']);
const EMPLOYEE_ROLE_NAME = /\b(employee|requester|viewer)\b/i;
const FULL_WORKSPACE_ROLE_CODES = new Set([
  'ADMINISTRATOR',
  'SYSADMINISTRATOR',
  'RECRUITER',
  'TALENT_MANAGER',
  'HIRING_MANAGER',
  'INTERVIEWER',
  'HR_MANAGER',
  'HR_OPERATIONS',
  'LICENSE_SPECIALIST',
  'OFFER_APPROVER',
  'FINAL_HIRING_APPROVER',
]);
const MANAGER_PERMISSIONS = new Set([
  'APPLICATION_VIEW',
  'VACANCY_VIEW',
  'VACANCY_MANAGE',
  'VACANCY_REQUEST_APPROVE',
  'APPROVE_OFFERS',
  'FINAL_HIRING_APPROVAL',
  'USERS_VIEW',
  'USERS_MANAGE',
  'CANDIDATE_CREATE',
  'HIRING_CASE_APPROVE',
  'MASTER_DATA_MANAGE',
]);

/**
 * Employee/requester work is intentionally centered on My Work. Role names
 * remain configurable, so known role codes are preferred and a conservative
 * permission fallback handles custom read-only roles.
 */
export function isEmployeeWorkspaceUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  // Compact mode is a presentation choice and must not hide an operational
  // role when a user also has an Employee/Viewer role.
  if (roles.some((role) => FULL_WORKSPACE_ROLE_CODES.has(role.code.trim().toUpperCase()))) {
    return false;
  }

  if (roles.some((role) => {
    const code = role.code.trim().toUpperCase();
    return EMPLOYEE_ROLE_CODES.has(code) || EMPLOYEE_ROLE_NAME.test(role.name);
  })) {
    return true;
  }

  return !permissions.some((permission) => MANAGER_PERMISSIONS.has(permission));
}
