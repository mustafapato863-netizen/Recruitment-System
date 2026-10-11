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
  'TEAM_LEADER',
  'TEAM_LEAD',
  'RECRUITMENT_LEAD',
  'LEAD_RECRUITER',
]);
const MANAGER_PERMISSIONS = new Set([
  'APPLICATION_VIEW',
  'VACANCY_VIEW',
  'VACANCY_MANAGE',
  'VACANCY_ASSIGN',
  'VACANCY_REASSIGN',
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

const TEAM_LEADER_ROLE_CODES = new Set([
  'ADMINISTRATOR',
  'SYSADMINISTRATOR',
  'HR_MANAGER',
  'TALENT_MANAGER',
  'TEAM_LEADER',
  'TEAM_LEAD',
  'RECRUITMENT_LEAD',
  'LEAD_RECRUITER',
]);
const TEAM_LEADER_ROLE_REGEX = /\b(team[_\s-]?lead|leader|manager|director|supervisor|admin)\b/i;

const OPERATIONAL_RECRUITER_REGEX = /\brecruiter\b/i;
const LEADERSHIP_KEYWORD_REGEX = /\b(team[_\s-]?lead|lead|leader|manager|director|supervisor|head|admin)\b/i;

/**
 * Determine if a user has leadership / management authority (Team Leader, HR Manager, Admin).
 * Standard Recruiters (including RECRUITER, RECRUITER-OFFSHORE) are operational team members
 * and cannot assign targets or vacancies to other recruiters.
 */
export function isTeamLeaderOrAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  // 1. Check known team leader / management role codes
  if (roles.some((r) => TEAM_LEADER_ROLE_CODES.has(r.code.trim().toUpperCase()))) {
    return true;
  }

  // 2. Check role code or name pattern (e.g. "Recruitment Team Leader", "Operations Supervisor")
  if (roles.some((r) => TEAM_LEADER_ROLE_REGEX.test(r.code) || TEAM_LEADER_ROLE_REGEX.test(r.name))) {
    return true;
  }

  // 3. Operational recruiters (e.g. "RECRUITER", "RECRUITER-OFFSHORE") are never team leaders
  const isPureRecruiter = roles.length > 0 && roles.every((r) =>
    OPERATIONAL_RECRUITER_REGEX.test(r.code) && !LEADERSHIP_KEYWORD_REGEX.test(r.code) && !LEADERSHIP_KEYWORD_REGEX.test(r.name)
  );
  if (isPureRecruiter) {
    return false;
  }

  // 4. Check management permissions (VACANCY_MANAGE or USERS_MANAGE — strictly NOT VACANCY_ASSIGN)
  return permissions.includes('VACANCY_MANAGE') || permissions.includes('USERS_MANAGE');
}

