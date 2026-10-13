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
import { ThemeProvider } from '../../../../theme/ThemeContext';
import { activeNavKey, permittedNavItems, SEAT_NAV, CLASSIC_NAV, permittedClassicItems } from '../navConfig';
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
    <ThemeProvider><MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShellV2 user={u} seat={seat} onSignOut={onSignOut} />}>
          <Route path="*" element={<p>page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter></ThemeProvider>,
  );
}

beforeEach(() => { getApi.mockReset(); getApi.mockResolvedValue({ unreadCount: 0 }); openGuide.mockReset(); window.localStorage.clear(); });
afterEach(() => { document.documentElement.removeAttribute('data-ui'); });

describe('nav per seat', () => {
  it('#21 B2-3: a Recruiter-only user never sees Requisitions, and its route goes home', () => {
    renderShell('manager', user(ALL, ['RECRUITER']), '/vacancy-requests');
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.manager.heading });
    expect(within(nav).queryByRole('link', { name: 'Requisitions' })).toBeNull();
  });

  it.each([
    ['employee', ['My Work', 'Open jobs', 'Candidates']],
    ['manager', ['Team work', 'Requisitions', 'Team result']],
    ['admin', ['Users', 'Roles', 'Pipeline template', 'Master data', 'Templates', 'Reports', 'Audit', 'Integrations']],
  ] as const)('%s shows only daily destinations in the main menu', (seat, labels) => {
    renderShell(seat, user(ALL, [seat === 'manager' ? 'HIRING_MANAGER' : seat === 'admin' ? 'ADMINISTRATOR' : 'RECRUITER']));
    const nav = screen.getByRole('navigation', { name: SEAT_NAV[seat].heading });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(labels);
  });

  it('hides unavailable items and lists permitted classic work outside the daily menu', () => {
    renderShell('employee', user(['VACANCY_VIEW']));
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.employee.heading });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['My Work', 'Open jobs']);
    expect(within(nav).queryByRole('link', { name: 'All interviews' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    const retained = screen.getByRole('navigation', { name: 'Retained work' });
    expect(within(retained).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/interviews', '/interviews/calendar', '/classic/vacancies']);
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
  });

  it('retained classic links are keyboard links and the More menu is absent', async () => {
    const u = userEvent.setup();
    renderShell('employee', user(['APPLICATION_VIEW']));
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Find a tool' })).not.toBeInTheDocument();
    const retained = screen.getByRole('navigation', { name: 'Retained work' });
    const hiring = within(retained).getByRole('link', { name: 'Hiring cases' });
    hiring.focus();
    await u.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hiring cases');
  });

  it('keeps admin destinations in the menu and classic pages reachable without a More menu', async () => {
    renderShell('admin', user([], ['ADMINISTRATOR']), '/hires');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hiring cases');
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.admin.heading });
    expect(within(nav).getByRole('link', { name: 'Roles' })).toHaveAttribute('href', '/roles');
    expect(within(nav).getByRole('link', { name: 'Templates' })).toHaveAttribute('href', '/email-templates');
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    const retained = screen.getByRole('navigation', { name: 'Retained work' });
    expect(within(retained).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(within(retained).queryByRole('link', { name: 'Templates' })).not.toBeInTheDocument();
    expect(within(retained).getByRole('link', { name: 'Hiring cases' })).toHaveAttribute('href', '/hires');
    expect(within(retained).getByRole('link', { name: 'Joinings' })).toHaveAttribute('href', '/joinings');
    expect(await runAxe(retained)).toEqual([]);
  });

  it('an old classic URL still titles the authorized page', () => {
    renderShell('admin', user([], ['ADMINISTRATOR']), '/joinings');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Joinings');
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Joinings' })).toHaveAttribute('href', '/joinings');
  });

  it.each([
    ['LICENSE_SPECIALIST', 'LICENSE_CHECK', 'Licences', '/licenses'],
    ['FINAL_HIRING_APPROVER', 'FINAL_HIRING_APPROVAL', 'Final approvals', '/hires/approvals/inbox'],
  ])('pins the essential queue for %s without unrelated tools', (role, permission, label, path) => {
    renderShell('employee', user([permission], [role]), path);
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.employee.heading });
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
  });

  it('interviewer-only users never see jobs or hiring tools that redirect away from their work', () => {
    renderShell('employee', user(['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE'], ['INTERVIEWER']), '/my-interviews');
    expect(screen.getByRole('link', { name: 'My interviews' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Open jobs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
  });

  it('does not offer an admin tool when its route requires a stronger permission', () => {
    renderShell('admin', user(['APPLICATION_VIEW'], ['CUSTOM_ADMIN']), '/reports');
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    const retained = screen.getByRole('navigation', { name: 'Retained work' });
    expect(within(retained).queryByRole('link', { name: 'Templates' })).not.toBeInTheDocument();
    expect(within(retained).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(within(retained).getByRole('link', { name: 'Hiring cases' })).toHaveAttribute('href', '/hires');
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
  });

  it('manager has no Approvals item (v2: not a destination)', () => {
    expect(permittedNavItems('manager', ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW', 'APPROVE_OFFERS', 'VACANCY_REQUEST_APPROVE']).map((i) => i.key)).toEqual(['team-work', 'requisitions', 'team-result']);
    expect(SEAT_NAV.manager.items.some((i) => /approval/i.test(i.label))).toBe(false);
  });

  it('retained classic items mirror each v1 PermissionGate; admins see all; interviewer-only users none', () => {
    const keys = (perms: string[], admin = false, io = false) => permittedClassicItems(perms, admin, io).map((i) => i.to);
    expect(keys(['FINAL_HIRING_APPROVAL'])).toEqual(['/hires/approvals/inbox']);
    expect(keys(['APPLICATION_VIEW'])).toEqual(['/hires', '/licenses', '/joinings', '/offers']);
    expect(keys(['CANDIDATE_VIEW'])).toEqual(['/classic/candidates', '/cv-bank', '/sourcing-match']);
    expect(keys(['MASTER_DATA_MANAGE'])).toEqual(['/import']);
    expect(keys(['MASTER_DATA_VIEW'])).toEqual(['/settings/targets', '/classic/master-data', '/settings']);
    expect(keys(['USERS_VIEW'])).toEqual(['/access-control', '/settings']);
    expect(keys(['OVERRIDE_WORKFLOW'])).toEqual(['/settings', '/classic/pipeline-settings']);
    expect(keys([])).toEqual([]);
    expect(keys([], true)).toHaveLength(CLASSIC_NAV.length);
    expect(keys(['VACANCY_VIEW', 'APPLICATION_VIEW'], false, true)).toEqual([]);
    expect(CLASSIC_NAV.map((i) => i.to)).not.toContain('/portal');
    expect(CLASSIC_NAV.map((i) => i.to)).not.toContain('/approval-inbox');
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

  it('distinguishes Users and Roles (A2: Roles is its own /roles page)', () => {
    const items = SEAT_NAV.admin.items;
    expect(activeNavKey(items, '/users', '')).toBe('users');
    expect(activeNavKey(items, '/roles', '')).toBe('roles');
  });
});

describe('header', () => {
  it('shows the unread count from /notifications/unread-count', async () => {
    getApi.mockResolvedValue({ unreadCount: 7 });
    renderShell('employee');
    expect(await screen.findByRole('button', { name: 'Notifications, 7 unread' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(getApi).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('caps the badge and survives a failed count', async () => {
    getApi.mockRejectedValueOnce(new Error('x'));
    renderShell('employee');
    await waitFor(() => expect(getApi).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('hides the bell without NOTIFICATION_VIEW', () => {
    renderShell('employee', user(['VACANCY_VIEW']));
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  });

  it('search is a live combobox (E07)', () => {
    renderShell('admin');
    expect(screen.getByRole('combobox', { name: 'Search users and settings' })).toHaveAttribute('aria-expanded', 'false');
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

  it('switches and persists the theme from the account menu without leaving the workflow', async () => {
    document.documentElement.dataset.theme = 'light';
    const u = userEvent.setup();
    renderShell('employee');
    const trigger = screen.getByRole('button', { name: /Mariam Farag/ });
    await u.click(trigger);
    await u.click(screen.getByRole('menuitem', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('recruitflow.theme')).toBe('dark');
    expect(trigger).toHaveFocus();
    expect(screen.getByText('page content')).toBeInTheDocument();
    await u.click(trigger);
    await u.click(screen.getByRole('menuitem', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('recruitflow.theme')).toBe('light');
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
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
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

describe('matrix fix: narrow viewports', () => {
  const realMatchMedia = window.matchMedia;
  afterEach(() => { window.matchMedia = realMatchMedia; });
  it('below 1024px the sidebar is the icon rail (no toggle) and the header title is rendered as the h1', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('1023px'), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    const { container } = renderShell('employee');
    expect(container.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('rf2-shell__title');
  });
});
