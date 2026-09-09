import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UsersRolesPage } from './UsersRolesPage';

vi.mock('../components/ui/PageFrame', () => ({ PageFrame: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock('../components/access/AccessPolicyManager', () => ({ AccessPolicyManager: () => null }));
vi.mock('../components/UserResponsibilityModal', () => ({ UserResponsibilityModal: () => null }));
vi.mock('../api/client', () => ({ fetchApi: async (path: string) => {
  if (path === '/roles/permissions') return [
    { id: 'p1', code: 'USERS_VIEW', name: 'View users' },
    { id: 'p2', code: 'USERS_MANAGE', name: 'Manage users' },
    { id: 'p3', code: 'VACANCY_ASSIGN', name: 'Assign vacancy team' },
    { id: 'p4', code: 'VACANCY_REASSIGN', name: 'Reassign vacancy team' },
  ];
  if (path === '/access-control/navigation') return [{ key: 'users', label: 'Users', route: '/users', group: 'Admin', visible: false }, { key: 'roles', label: 'Roles', route: '/roles', group: 'Admin', visible: false }];
  return [];
} }));

describe('role selection', () => {
  it('can deselect and reselect individual permissions and pages after select all', async () => {
    const user = userEvent.setup();
    render(<StrictMode><UsersRolesPage /></StrictMode>);
    await user.click(await screen.findByRole('button', { name: /create role/i }));
    const dialog = within(screen.getByRole('dialog', { name: 'Create role and access' }));
    const permission = await dialog.findByRole('checkbox', { name: /View users/ });
    for (const label of ['Step 2 · Permissions', 'Step 3 · Sidebar pages']) {
      const section = dialog.getByRole('heading', { name: label }).closest('section')!;
      await user.click(within(section).getByRole('button', { name: 'Select all' }));
      const checkbox = within(section).getAllByRole('checkbox')[0];
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      expect(within(section).getAllByRole('checkbox')[1]).toBeChecked();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    }
    expect(permission).toBeChecked();
    expect(dialog.getByRole('button', { name: 'Create role' })).toBeVisible();
  });

  it('hides vacancy assignment permissions when the role is named Recruiter', async () => {
    const user = userEvent.setup();
    render(<UsersRolesPage />);
    await user.click(await screen.findByRole('button', { name: /create role/i }));
    const dialog = within(screen.getByRole('dialog', { name: 'Create role and access' }));

    expect(dialog.getByRole('checkbox', { name: /Assign vacancy team/ })).toBeVisible();
    await user.type(dialog.getByRole('textbox', { name: /Role Name/ }), 'Recruiter');

    expect(dialog.queryByRole('checkbox', { name: /Assign vacancy team/ })).not.toBeInTheDocument();
    expect(dialog.queryByRole('checkbox', { name: /Reassign vacancy team/ })).not.toBeInTheDocument();
    expect(dialog.getByText(/assignment and reassignment are hidden/i)).toBeVisible();
  });
});
