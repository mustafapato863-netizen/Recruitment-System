import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { isEmployeeWorkspaceUser, isTeamLeaderOrAdmin } from './workspacePersona';

function makeUser(code: string, name: string, permissions: string[]): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Workspace User',
    organizationId: 'org-1',
    organizationName: 'Saudi German Health',
    roles: [{ id: 'role-1', code, name }],
    permissions,
    lastLoginAt: null,
  };
}

describe('isEmployeeWorkspaceUser', () => {
  it('keeps employee and viewer roles in My Work even when they can read positions', () => {
    expect(isEmployeeWorkspaceUser(makeUser('EMPLOYEE', 'Employee / Requester', ['VACANCY_VIEW']))).toBe(true);
    expect(isEmployeeWorkspaceUser(makeUser('VIEWER', 'Viewer', ['VACANCY_VIEW']))).toBe(true);
  });

  it('keeps operational recruitment roles in the full workspace', () => {
    expect(isEmployeeWorkspaceUser(makeUser('RECRUITER', 'Recruiter', ['VACANCY_VIEW', 'APPLICATION_VIEW']))).toBe(false);
    expect(isEmployeeWorkspaceUser(makeUser('TEAM_LEADER', 'Recruitment Team Leader', ['VACANCY_VIEW', 'VACANCY_ASSIGN']))).toBe(false);
  });

  it('does not let an added employee role hide administrator navigation', () => {
    const user = makeUser('ADMINISTRATOR', 'Administrator', ['USERS_MANAGE']);
    user.roles.push({ id: 'role-2', code: 'EMPLOYEE', name: 'Employee' });
    expect(isEmployeeWorkspaceUser(user)).toBe(false);
  });

  it('supports custom task-only roles without granting manager navigation', () => {
    expect(isEmployeeWorkspaceUser(makeUser('CUSTOM_STAFF', 'Staff Member', ['TASK_VIEW']))).toBe(true);
  });

  it('uses strong permissions for custom administrator roles', () => {
    expect(isEmployeeWorkspaceUser(makeUser('CUSTOM_ADMIN', 'Operations Admin', ['USERS_MANAGE']))).toBe(false);
  });
});

describe('isTeamLeaderOrAdmin', () => {
  it('returns false for operational recruiters even if they have VACANCY_ASSIGN', () => {
    expect(isTeamLeaderOrAdmin(makeUser('RECRUITER', 'Recruiter', ['VACANCY_VIEW', 'VACANCY_ASSIGN']))).toBe(false);
    expect(isTeamLeaderOrAdmin(makeUser('RECRUITER-OFFSHORE', 'Recruiter Offshore', ['VACANCY_VIEW', 'VACANCY_ASSIGN']))).toBe(false);
  });

  it('returns true for leadership roles', () => {
    expect(isTeamLeaderOrAdmin(makeUser('TEAM_LEADER', 'Recruitment Team Leader', ['VACANCY_VIEW', 'VACANCY_ASSIGN']))).toBe(true);
    expect(isTeamLeaderOrAdmin(makeUser('TEAM_LEAD', 'Team Lead', ['VACANCY_VIEW']))).toBe(true);
    expect(isTeamLeaderOrAdmin(makeUser('LEAD_RECRUITER', 'Lead Recruiter', ['VACANCY_VIEW']))).toBe(true);
    expect(isTeamLeaderOrAdmin(makeUser('TALENT_MANAGER', 'Talent Manager', ['VACANCY_MANAGE']))).toBe(true);
    expect(isTeamLeaderOrAdmin(makeUser('HR_MANAGER', 'HR Manager', ['VACANCY_MANAGE']))).toBe(true);
    expect(isTeamLeaderOrAdmin(makeUser('ADMINISTRATOR', 'Administrator', ['USERS_MANAGE']))).toBe(true);
  });

  it('returns true for users with VACANCY_MANAGE or USERS_MANAGE permission', () => {
    expect(isTeamLeaderOrAdmin(makeUser('STAFF', 'Staff Supervisor', ['VACANCY_MANAGE']))).toBe(true);
    expect(isTeamLeaderOrAdmin(makeUser('STAFF', 'Staff Supervisor', ['USERS_MANAGE']))).toBe(true);
  });

  it('returns false for null or undefined user', () => {
    expect(isTeamLeaderOrAdmin(null)).toBe(false);
    expect(isTeamLeaderOrAdmin(undefined)).toBe(false);
  });
});

