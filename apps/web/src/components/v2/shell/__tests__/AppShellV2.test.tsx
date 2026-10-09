import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { axeViolations as runAxe, axeViolations } from '../../__tests__/axe';

const getApi = vi.fn();
vi.mock('../../../../api/client', () => ({ getApi: (p: string) => getApi(p) }));
const openGuide = vi.fn();
vi.mock('../../../../quickguide', () => ({
  QuickGuideProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  QuickGuideModal: () => null,
  useQuickGuide: () => ({ openGuide }),
}));

import { AppShellV2 } from '../AppShellV2';
import { activeNavKey, permittedNavItems, SEAT_NAV } from '../navConfig';
import type { Seat } from '../../../../v2/seat';

const ALL = ['VACANCY_VIEW', 'CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_APPROVE', 'APPLICATION_VIEW', 'USERS_VIEW',
  'OVERRIDE_WORKFLOW', 'MASTER_DATA_VIEW', 'AUDIT_VIEW', 'NOTIFICATION_VIEW'];
const user = (permissions = ALL, codes = ['RECRUITER']): UserProfile => ({
  id: 'u1', email: 'mariam@x.test', displayName: 'Mariam Farag', organizationId: 'o', organizationName: 'O',
  roles: codes.map((code) => ({ id: code, code, name: code })), permissions, lastLoginAt: null,
});

function renderShell(seat: Seat, u = user(), path = '/my-work', onSignOut = vi.fn()) {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShellV2 user={u} seat={seat} onSignOut={onSignOut} />}>
          <Route path="*" element={<p>page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { getApi.mockReset(); getApi.mockResolvedValue({ unreadCount: 0 }); openGuide.mockReset(); window.localStorage.clear(); });
afterEach(() => { document.documentElement.removeAttribute('data-ui'); });

describe('nav per seat', () => {
  it.each([
    ['employee', ['My Work', 'Open jobs', 'Candidates']],
    ['manager', ['Team work', 'Requisitions', 'Team result']],
    ['admin', ['Users', 'Roles', 'Pipeline template', 'Master data', 'Templates', 'Reports', 'Audit', 'Integrations']],
  ] as const)('%s shows the Figma items', (seat, labels) => {
    renderShell(seat);
    const nav = screen.getByRole('navigation', { name: SEAT_NAV[seat].heading });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(labels);
  });

  it('hides items the user cannot open (no locked rows)', () => {
    renderShell('employee', user(['VACANCY_VIEW']));
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['My Work', 'Open jobs']);
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
  });

  it('manager has no Approvals item (v2: not a destination)', () => {
    expect(permittedNavItems('manager', ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW', 'APPROVE_OFFERS', 'VACANCY_REQUEST_APPROVE']).map((i) => i.key)).toEqual(['team-work', 'requisitions', 'team-result']);
    expect(SEAT_NAV.manager.items.some((i) => /approval/i.test(i.label))).toBe(false);
  });

  it('administrators pass every gate like PermissionGate', () => {
    expect(permittedNavItems('admin', [], true)).toHaveLength(8);
  });

  it('marks the active item and titles the header', () => {
    renderShell('employee', user(), '/candidates/abc');
    expect(screen.getByRole('link', { name: 'Candidates' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Candidates');
  });

  it('only one item is current on /users (Roles is hash-scoped)', () => {
    renderShell('admin', user(), '/users');
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Users']);
  });

  it('distinguishes Users and Roles by hash', () => {
    const items = SEAT_NAV.admin.items;
    expect(activeNavKey(items, '/users', '')).toBe('users');
    expect(activeNavKey(items, '/users', '#roles')).toBe('roles');
  });
});

describe('header', () => {
  it('shows the unread count from /notifications/unread-count', async () => {
    getApi.mockResolvedValue({ unreadCount: 7 });
    renderShell('employee');
    expect(await screen.findByRole('link', { name: 'Notifications, 7 unread' })).toHaveAttribute('href', '/notifications');
    expect(getApi).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('caps the badge and survives a failed count', async () => {
    getApi.mockRejectedValueOnce(new Error('x'));
    renderShell('employee');
    await waitFor(() => expect(getApi).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('hides the bell without NOTIFICATION_VIEW', () => {
    renderShell('employee', user(['VACANCY_VIEW']));
    expect(screen.queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
  });

  it('search is an entry point only (S2)', () => {
    renderShell('admin');
    expect(screen.getByRole('button', { name: /Search users and settings/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('user menu shows name and seat, navigates with keys and signs out', async () => {
    const onSignOut = vi.fn();
    const u = userEvent.setup();
    renderShell('manager', user(ALL, ['HIRING_MANAGER']), '/my-work', onSignOut);
    const trigger = screen.getByRole('button', { name: /Mariam Farag/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await u.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(within(menu).getByText('Manager · mariam@x.test')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
    await u.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await u.click(trigger);
    await u.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('never renders pay data', () => {
    const { container } = renderShell('employee');
    expect(container.textContent).not.toMatch(/salary|pay|AED|EGP|SAR/i);
  });
});

describe('a11y', () => {
  it('has nav, banner, main landmarks and a skip link; no axe violations', async () => {
    const { container } = renderShell('employee');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'rf2-main');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#rf2-main');
    await waitFor(() => expect(getApi).toHaveBeenCalled());
    expect(await runAxe(container)).toEqual([]);
  });
});

describe('F4 follow-ups', () => {
  it('Help opens the existing quick guide', async () => {
    const u = userEvent.setup();
    renderShell('employee');
    await u.click(screen.getByRole('button', { name: /Help/ }));
    expect(openGuide).toHaveBeenCalledTimes(1);
  });

  it('sidebar collapses to an icon rail, keeps accessible names, and persists', async () => {
    const u = userEvent.setup();
    const { unmount } = renderShell('employee');
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    toggle.focus();
    await u.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    const link = screen.getByRole('link', { name: 'Open jobs' });
    expect(link).toHaveAttribute('title', 'Open jobs');
    expect(window.localStorage.getItem('recruitflow.ui.v2.sidebar')).toBe('collapsed');
    unmount();
    renderShell('employee');
    expect(document.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it('shows a static workspace label for the real /auth/me shape (one org)', () => {
    renderShell('employee', { ...user(), organizationName: 'IT Recruiting' });
    expect(screen.getByTestId('workspace-label')).toHaveTextContent('IT Recruiting');
    expect(screen.queryByRole('button', { name: /Change workspace/ })).not.toBeInTheDocument();
  });

  it('shows the switcher only when /auth/me lists more than one org', async () => {
    const u = userEvent.setup();
    const me = { ...user(), organizationId: 'o1', organizationName: 'IT Recruiting',
      organizations: [{ id: 'o1', name: 'IT Recruiting' }, { id: 'o2', name: 'Nursing' }] } as never;
    renderShell('employee', me);
    await u.click(screen.getByRole('button', { name: 'Workspace: IT Recruiting. Change workspace' }));
    const list = screen.getByRole('listbox', { name: 'Workspaces' });
    expect(within(list).getByRole('option', { name: 'IT Recruiting' })).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByRole('option', { name: 'Nursing' })).toHaveAttribute('aria-disabled', 'true');
  });
});
