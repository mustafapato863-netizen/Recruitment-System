import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { isEmployeeWorkspaceUser } from './workspacePersona';

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
