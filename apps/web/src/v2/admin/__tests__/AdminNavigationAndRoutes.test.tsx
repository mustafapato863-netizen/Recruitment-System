import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_GROUP_ORDER,
  ADMIN_GROUP_ROUTES,
  SEAT_NAV,
  permittedAdminGroupItems,
  permittedNavItems,
} from '../../../components/v2/shell/navConfig';
import {
  authorizedLanding,
  canOpenRoute,
  routeActor,
  v2Redirect,
} from '../../destinations';
import { allowedReturn, returnFromLocation } from '../../returnTarget';
import { AuthProvider } from '../../../auth/AuthContext';
import { AdminWorkspaceHeader } from '../AdminWorkspaceHeader';

describe('ADM-03: Grouped Admin IA & R3 boundary (no premature route registration)', () => {
  it('defines the seven canonical Admin groups and places Audit first under Settings', () => {
    expect(ADMIN_GROUP_ORDER).toEqual([
      'Overview',
      'Users & Access',
      'Organization',
      'Recruitment Setup',
      'Reports',
      'Data',
      'Settings',
    ]);
    const settingsSupported = permittedAdminGroupItems('Settings', [], true);
    expect(settingsSupported.map((item) => item.key)).toEqual(['audit', 'integrations']);
    expect(settingsSupported[0]?.to).toBe('/audit-log');
  });

  it('omits planned future routes from actionable sidebar and group sub-navigation until their owning phases land (R3)', () => {
    const plannedPaths = ADMIN_GROUP_ROUTES.filter((r) => r.status === 'planned').map((r) => r.to);
    expect(plannedPaths).toEqual(
      expect.arrayContaining([
        '/admin/overview',
        '/settings/sessions',
        '/recruitment-setup/evaluations',
        '/data/duplicates',
        '/data/quality',
        '/settings/branding',
      ]),
    );
    const activeSidebarPaths = SEAT_NAV.admin.items.map((item) => item.to);
    for (const planned of plannedPaths) {
      expect(activeSidebarPaths).not.toContain(planned);
    }
    for (const group of ADMIN_GROUP_ORDER) {
      const visible = permittedAdminGroupItems(group, [], true).map((i) => i.to);
      for (const planned of plannedPaths) {
        expect(visible).not.toContain(planned);
      }
    }
  });
});

describe('ADM-03 & R2: Authoritative server read-prerequisite alignment', () => {
  it('gates /roles on ROLES_VIEW rather than USERS_VIEW across nav, canOpenRoute, and v2Redirect', () => {
    // User with USERS_VIEW only: can open /users, cannot open /roles
    expect(canOpenRoute('/users', ['USERS_VIEW'], false)).toBe(true);
    expect(canOpenRoute('/roles', ['USERS_VIEW'], false)).toBe(false);
    expect(permittedNavItems('admin', ['USERS_VIEW'], false).map((i) => i.key)).toEqual(['users-access']);
    expect(v2Redirect('admin', '/roles', { permissions: ['USERS_VIEW'], isAdministrator: false })).toBe('/users');

    // User with ROLES_VIEW only: can open /roles, cannot open /users, lands on /roles instead of looping on /users
    expect(canOpenRoute('/roles', ['ROLES_VIEW'], false)).toBe(true);
    expect(canOpenRoute('/users', ['ROLES_VIEW'], false)).toBe(false);
    expect(permittedNavItems('admin', ['ROLES_VIEW'], false).map((i) => i.key)).toEqual(['users-access']);
    expect(v2Redirect('admin', '/roles', { permissions: ['ROLES_VIEW'], isAdministrator: false })).toBeNull();
    expect(v2Redirect('admin', '/', { permissions: ['ROLES_VIEW'], isAdministrator: false })).toBe('/roles');
    expect(v2Redirect('admin', '/users', { permissions: ['ROLES_VIEW'], isAdministrator: false })).toBe('/roles');
    expect(
      authorizedLanding(
        routeActor('admin', {
          roles: [{ code: 'ACCESS_AUDITOR' }],
          permissions: ['ROLES_VIEW'],
        }),
      ),
    ).toBe('/roles');
  });

  it('gates /pipeline-settings on MASTER_DATA_VIEW rather than OVERRIDE_WORKFLOW across nav, canOpenRoute, and v2Redirect', () => {
    expect(canOpenRoute('/pipeline-settings', ['MASTER_DATA_VIEW'], false)).toBe(true);
    expect(canOpenRoute('/pipeline-settings', ['OVERRIDE_WORKFLOW'], false)).toBe(false);
    expect(permittedNavItems('admin', ['MASTER_DATA_VIEW'], false).map((i) => i.key)).toEqual([
      'pipeline',
      'master-data',
      'templates',
      'integrations',
    ]);
    expect(v2Redirect('admin', '/pipeline-settings', { permissions: ['MASTER_DATA_VIEW'], isAdministrator: false })).toBeNull();
    expect(v2Redirect('admin', '/pipeline-settings', { permissions: ['OVERRIDE_WORKFLOW'], isAdministrator: false })).toBe('/users');
  });

  it('falls back to /audit-log when an audit-only Admin user visits / or an unpermitted Admin route', () => {
    expect(v2Redirect('admin', '/', { permissions: ['AUDIT_VIEW'], isAdministrator: false })).toBe('/audit-log');
    expect(v2Redirect('admin', '/users', { permissions: ['AUDIT_VIEW'], isAdministrator: false })).toBe('/audit-log');
    expect(v2Redirect('admin', '/audit-log', { permissions: ['AUDIT_VIEW'], isAdministrator: false })).toBeNull();
  });
});

describe('ADM-AC01: Route compatibility and query/return context preservation', () => {
  it('preserves focus parameter when redirecting /reporting-tree to /users?drawer=tree', () => {
    expect(v2Redirect('admin', '/reporting-tree')).toBe('/users');
    expect(v2Redirect('admin', '/reporting-tree?focus=u-hala')).toBe('/users?drawer=tree&focus=u-hala');
  });

  it('preserves sanitized Admin query parameters in returnFromLocation and allowedReturn', () => {
    const adminActor = routeActor('admin', {
      roles: [{ code: 'ADMINISTRATOR' }],
      permissions: [],
    });
    const usersOnlyAdmin = routeActor('admin', {
      roles: [{ code: 'USER_ADMIN' }],
      permissions: ['USERS_VIEW'],
    });
    const employeeActor = routeActor('employee', {
      roles: [{ code: 'RECRUITER' }],
      permissions: ['CANDIDATE_VIEW', 'VACANCY_VIEW', 'APPLICATION_VIEW'],
    });

    expect(returnFromLocation('/users', '?user=u-mariam&drawer=tree&focus=u-hala&junk=1&returnTo=%2Froles')).toBe(
      '/users?user=u-mariam&drawer=tree&focus=u-hala',
    );
    expect(returnFromLocation('/audit-log', '?period=30&who=u-omar&area=Override&page=2&extra=drop')).toBe(
      '/audit-log?period=30&who=u-omar&area=Override&page=2',
    );
    expect(returnFromLocation('/reports', '?month=2026-10&site=Offshore+Cairo&override=v1&junk=1')).toBe(
      '/reports?month=2026-10&site=Offshore+Cairo&override=v1',
    );

    expect(allowedReturn('/users?drawer=tree&focus=u-hala', adminActor)).toBe('/users?drawer=tree&focus=u-hala');
    expect(allowedReturn('/users?drawer=tree', usersOnlyAdmin)).toBe('/users?drawer=tree');
    // Users-only admin cannot return to /roles (requires ROLES_VIEW)
    expect(allowedReturn('/roles', usersOnlyAdmin)).toBeNull();
    // Employee seat cannot use Admin return targets
    expect(allowedReturn('/users?drawer=tree', employeeActor)).toBeNull();
    expect(allowedReturn('/audit-log', employeeActor)).toBeNull();
  });

  it('renders contextual group sub-navigation links and marks the active route with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/roles']}>
        <Routes>
          <Route
            path="/roles"
            element={
              <AuthProvider>
                <AdminWorkspaceHeader
                  group="Users & Access"
                  title="Roles"
                  subtitle="Review role capabilities."
                  backHref="/users?drawer=tree"
                  backLabel="Back to Users"
                />
              </AuthProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const subnav = screen.getByRole('navigation', { name: 'Users & Access pages' });
    expect(within(subnav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    expect(within(subnav).getByRole('link', { name: 'Users' })).not.toHaveAttribute('aria-current');
    expect(within(subnav).getByRole('link', { name: 'Roles' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Back to Users' })).toHaveAttribute('href', '/users?drawer=tree');
  });
});

