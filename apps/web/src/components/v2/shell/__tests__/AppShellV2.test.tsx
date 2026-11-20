import { useEffect } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { axeViolations as runAxe, axeViolations } from '../../__tests__/axe';

const getApi = vi.fn();
vi.mock('../../../../api/client', () => ({ getApi: (p: string) => getApi(p) }));
vi.mock('../../../../quickguide', () => ({
  QuickGuideProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  QuickGuideModal: () => null,
}));

import { AppShellV2, TOPNAV_MENU_QUERY, useV2Shell } from '../AppShellV2';
import { useSetBreadcrumbTitle } from '../../../../context/BreadcrumbContext';
import { ThemeProvider } from '../../../../theme/ThemeContext';
import { activeNavKey, permittedNavItems, SEAT_NAV, CLASSIC_NAV, permittedClassicItems } from '../navConfig';
import type { Seat } from '../../../../v2/seat';

const ALL = ['VACANCY_VIEW', 'CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_APPROVE', 'APPLICATION_VIEW', 'USERS_VIEW',
  'OVERRIDE_WORKFLOW', 'MASTER_DATA_VIEW', 'AUDIT_VIEW', 'NOTIFICATION_VIEW'];
const user = (permissions = ALL, codes = ['RECRUITER']): UserProfile => ({
  id: 'u1', email: 'mariam@x.test', displayName: 'Mariam Farag', organizationId: 'o', organizationName: 'O',
  roles: codes.map((code) => ({ id: code, code, name: code })), permissions, lastLoginAt: null,
});

function visibleNavLabels(seat: Seat, profile: UserProfile): string[] {
  const administrator = profile.roles.some((role) => role.code === 'ADMINISTRATOR');
  const interviewer = profile.roles.some((role) => role.code === 'INTERVIEWER') || profile.permissions.includes('INTERVIEW_PARTICIPATE');
  const interviewerOnly = interviewer && !profile.permissions.includes('APPLICATION_VIEW');
  const recruiterOnly = profile.roles.length > 0 && profile.roles.every((role) => role.code === 'RECRUITER');
  const daily = permittedNavItems(seat, profile.permissions, administrator, recruiterOnly, interviewer);
  const shown = interviewerOnly ? daily.filter((item) => item.key === 'my-work' || item.key === 'my-interviews') : daily;
  const classic = permittedClassicItems(profile.permissions, administrator, interviewerOnly);
  const dailyPaths = new Set(shown.map((item) => item.to));
  return [...shown, ...classic.filter((item) => !dailyPaths.has(item.to))].map((item) => item.label);
}

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

function ApprovalBadgeProbe() {
  const setApprovalsCount = useV2Shell()?.setApprovalsCount;
  useEffect(() => setApprovalsCount?.(3), [setApprovalsCount]);
  return <p>page content</p>;
}

beforeEach(() => { getApi.mockReset(); getApi.mockResolvedValue({ unreadCount: 0 }); window.localStorage.clear(); });
afterEach(() => { document.documentElement.removeAttribute('data-ui'); });

describe('nav per seat', () => {
  it('#21 B2-3: a Recruiter-only user never sees Requisitions, and its route goes home', () => {
    renderShell('manager', user(ALL, ['RECRUITER']), '/vacancy-requests');
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.manager.heading });
    expect(within(nav).queryByRole('link', { name: 'Requisitions' })).toBeNull();
  });

  it.each([
    ['employee', ['My Work', 'Open jobs', 'Candidates', 'Match Skills', 'Interviews', 'Reports']],
    ['manager', ['Team work', 'My Work', 'Requisitions', 'Approvals', 'Open jobs', 'Joining', 'Interviews', 'Team result']],
    ['admin', ['Users & Access', 'Pipeline template', 'Master data', 'WhatsApp templates', 'Reports', 'Audit', 'Integrations']],
  ] as const)('%s lists its seat destinations', (seat, labels) => {
    const profile = user(ALL, [seat === 'manager' ? 'HIRING_MANAGER' : seat === 'admin' ? 'ADMINISTRATOR' : 'RECRUITER']);
    renderShell(seat, profile);
    const nav = screen.getByRole('navigation', { name: SEAT_NAV[seat].heading });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual([...labels]);
    expect(names).toEqual(visibleNavLabels(seat, profile));
    for (const classic of ['Hiring cases', 'Licences', 'Joinings', 'All interviews', 'Interview calendar', 'All offers', 'Candidate data & exports', 'CV Bank', 'Talent pools', 'Job exports']) {
      expect(within(nav).queryByRole('link', { name: classic })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Other work' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Retained work' })).not.toBeInTheDocument();
  });

  it('hides unavailable items and omits retired classic pages', () => {
    renderShell('employee', user(['VACANCY_VIEW']));
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.employee.heading });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['My Work', 'Open jobs']);
    expect(within(nav).queryByRole('link', { name: 'All interviews' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Interview calendar' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Job exports' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Other work' })).not.toBeInTheDocument();
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
  });

  it('a seat nav link opens that page and titles it', async () => {
    const u = userEvent.setup();
    renderShell('employee', user(['VACANCY_VIEW']));
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Find a tool' })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.employee.heading });
    const jobs = within(nav).getByRole('link', { name: 'Open jobs' });
    expect(jobs).toHaveAttribute('href', '/vacancies');
    jobs.focus();
    await u.keyboard('{Enter}');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Open jobs')).toBeInTheDocument();
    expect(jobs).toHaveAttribute('aria-current', 'page');
  });

  it('keeps admin destinations in one menu', async () => {
    renderShell('admin', user([], ['ADMINISTRATOR']), '/users');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Users & Access')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.admin.heading });
    expect(within(nav).getByRole('link', { name: 'Users & Access' })).toHaveAttribute('href', '/users');
    expect(within(nav).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'WhatsApp templates' })).toHaveAttribute('href', '/whatsapp-templates');
    expect(within(nav).queryByRole('link', { name: 'Hiring cases' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Joinings' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Licences' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Talent pools' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Other work' })).not.toBeInTheDocument();
    expect(await runAxe(nav)).toEqual([]);
  });

  it('an old classic URL redirects to the admin home', async () => {
    renderShell('admin', user([], ['ADMINISTRATOR']), '/joinings');
    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(breadcrumb).findByText('Users & Access')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Joinings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
  });

  it.each([
    ['LICENSE_SPECIALIST', ['LICENSE_CHECK', 'VACANCY_VIEW', 'CANDIDATE_VIEW'], '/licenses'],
    ['FINAL_HIRING_APPROVER', ['FINAL_HIRING_APPROVAL', 'VACANCY_VIEW', 'CANDIDATE_VIEW'], '/hires/approvals/inbox'],
  ])('keeps %s on their queue with the seat items they can open', async (role, permissions, path) => {
    renderShell('employee', user(permissions, [role]), path);
    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'My Work' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.employee.heading });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['My Work', 'Open jobs', 'Candidates']);
    expect(within(nav).queryByRole('link', { name: 'Licences' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Final approvals' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Other work' })).not.toBeInTheDocument();
  });

  it('names a file with the candidate in the header', async () => {
    function NamedFile() {
      useSetBreadcrumbTitle('Ahmed Embaby');
      return <p>page content</p>;
    }
    document.documentElement.setAttribute('data-ui', 'v2');
    render(
      <ThemeProvider><MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route element={<AppShellV2 user={user()} seat="employee" onSignOut={vi.fn()} />}>
            <Route path="/applications/:id" element={<NamedFile />} />
          </Route>
        </Routes>
      </MemoryRouter></ThemeProvider>,
    );
    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Ahmed Embaby')).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Applications')).not.toBeInTheDocument();
  });

  it.each(['/applications/a1', '/applications/a1?drawer=prehire'])('a licence specialist mounts the application file at %s', async (path) => {
    renderShell('employee', user(['LICENSE_CHECK', 'VACANCY_VIEW'], ['LICENSE_SPECIALIST']), path);
    expect(await screen.findByText('page content')).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Applications')).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Licenses')).toBeNull();
  });

  it('interviewer-only users never see jobs or hiring tools that redirect away from their work', () => {
    renderShell('employee', user(['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE'], ['INTERVIEWER']), '/my-interviews');
    expect(screen.getByRole('link', { name: 'My interviews' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Open jobs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
  });

  it('does not offer an admin tool when its route requires a stronger permission', () => {
    renderShell('admin', user(['APPLICATION_VIEW'], ['CUSTOM_ADMIN']), '/reports');
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.admin.heading });
    expect(screen.queryByRole('button', { name: 'More (classic)' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'WhatsApp templates' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Hiring cases' })).not.toBeInTheDocument();
  });

  it('manager Approvals is a destination, and Interviews needs vacancy view', () => {
    expect(permittedNavItems('manager', ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW', 'APPROVE_OFFERS', 'VACANCY_REQUEST_APPROVE']).map((i) => i.key)).toEqual(['team-work', 'my-work', 'requisitions', 'approvals', 'joinings', 'team-result']);
    expect(SEAT_NAV.manager.items.some((i) => i.label === 'Approvals')).toBe(true);
    expect(permittedNavItems('manager', ['VACANCY_VIEW', 'VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW'], false, false, false).map((i) => i.label)).toContain('Interviews');
  });

  it('retired classic pages stay out of the sidebar', () => {
    expect(permittedClassicItems(['FINAL_HIRING_APPROVAL', 'APPLICATION_VIEW', 'CANDIDATE_VIEW'], true)).toEqual([]);
    expect(permittedClassicItems(['VACANCY_VIEW', 'APPLICATION_VIEW'], false, true)).toEqual([]);
    expect(CLASSIC_NAV.map((i) => i.to)).not.toContain('/portal');
    expect(CLASSIC_NAV.map((i) => i.to)).not.toContain('/approval-inbox');
  });

  it('administrators pass every gate like PermissionGate', () => {
    expect(permittedNavItems('admin', [], true)).toHaveLength(7);
  });

  it('seat links keep native tab order and open the chosen page', async () => {
    const u = userEvent.setup();
    renderShell('employee', user(['VACANCY_VIEW']));
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.employee.heading });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/my-work', '/vacancies']);
    links[0].focus();
    await u.tab();
    expect(links[1]).toHaveFocus();
    await u.click(within(nav).getByRole('link', { name: 'Open jobs' }));
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Open jobs')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Open jobs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Other work' })).not.toBeInTheDocument();
  });

  it('marks the active item and titles the header', () => {
    renderShell('employee', user(), '/candidates/abc');
    expect(screen.getByRole('link', { name: 'Candidates' })).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Candidates')).toBeInTheDocument();
  });

  it('keeps manager Team work and individual My Work as separate destinations', () => {
    renderShell('manager', user(ALL, ['HIRING_MANAGER']), '/team-work');
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.manager.heading });
    expect(within(nav).getByRole('link', { name: 'Team work' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'My Work' })).toHaveAttribute('href', '/my-work');
  });

  it('only one item is current on /users (Roles is hash-scoped)', () => {
    renderShell('admin', user(), '/users');
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Users & Access']);
  });

  it('keeps Users and Roles under one active sidebar group', () => {
    const items = SEAT_NAV.admin.items;
    expect(activeNavKey(items, '/users', '')).toBe('users-access');
    expect(activeNavKey(items, '/roles', '')).toBe('users-access');
  });

  it.each(['employee', 'manager', 'admin'] as const)('gives every item in %s a distinct icon', (seat) => {
    const icons = SEAT_NAV[seat].items.map((item) => item.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('header', () => {
  it('surfaces the Team work waiting count on Approvals with an accessible label', async () => {
    const profile = user(ALL, ['HIRING_MANAGER']);
    render(
      <ThemeProvider><MemoryRouter initialEntries={['/approvals']}>
        <Routes>
          <Route element={<AppShellV2 user={profile} seat="manager" onSignOut={vi.fn()} />}>
            <Route path="*" element={<ApprovalBadgeProbe />} />
          </Route>
        </Routes>
      </MemoryRouter></ThemeProvider>,
    );
    const nav = screen.getByRole('navigation', { name: SEAT_NAV.manager.heading });
    expect(await within(nav).findByLabelText('3 waiting on you')).toHaveTextContent('3');
    expect(within(nav).getByRole('link', { name: /Approvals/ })).toHaveAttribute('href', '/approvals');
  });

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

  it('hides global search on the Users directory, which has its own search toolbar', () => {
    renderShell('admin', user(ALL, ['ADMINISTRATOR']), '/users');
    expect(screen.queryByRole('combobox', { name: 'Search users and settings' })).not.toBeInTheDocument();
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
  it('keeps the quick guide out of the header', () => {
    renderShell('employee');
    expect(screen.queryByRole('button', { name: /Help/ })).not.toBeInTheDocument();
  });

  it('sidebar collapses to an icon rail, keeps accessible names, and persists', async () => {
    const u = userEvent.setup();
    const admin = user(ALL, ['ADMINISTRATOR']);
    const { unmount } = renderShell('admin', admin, '/users');
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    toggle.focus();
    await u.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    const link = screen.getByRole('link', { name: 'Users & Access' });
    expect(link).toHaveAttribute('title', 'Users & Access');
    expect(window.localStorage.getItem('recruitflow.ui.v2.sidebar')).toBe('collapsed');
    unmount();
    renderShell('admin', admin, '/users');
    expect(document.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it('shows the active organization in the brand and keeps one signed-in identity control', () => {
    renderShell('employee', { ...user(), organizationName: 'Saudi German Health' });
    expect(screen.queryByTestId('workspace-label')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change workspace/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RecruitFlow, Saudi German Health' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Mariam Farag/ })).toHaveLength(1);
  });

  it('shows role-derived workspace choices for administrators', async () => {
    const u = userEvent.setup();
    renderShell('admin', user(ALL, ['ADMINISTRATOR']), '/users');
    await u.click(screen.getByRole('button', { name: /Mariam Farag/ }));
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(within(menu).getByRole('menuitem', { name: 'Admin workspace · Current' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Manager workspace' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Employee workspace' })).toBeInTheDocument();
  });
});

describe('matrix fix: narrow viewports', () => {
  const realMatchMedia = window.matchMedia;
  afterEach(() => { window.matchMedia = realMatchMedia; });
  const match = (q: string) => q === TOPNAV_MENU_QUERY || q.includes('1023px');

  it('keeps daily links in the sidebar on a wide screen', () => {
    const { container } = renderShell('employee');
    expect(container.querySelector('.rf2-shell__sidebar')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: SEAT_NAV.employee.heading })).toBeInTheDocument();
  });

  it('keeps the employee sidebar below 1024px as the icon rail', () => {
    window.matchMedia = ((q: string) => ({ matches: match(q), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    const { container } = renderShell('employee');
    expect(container.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('keeps the admin sidebar below 1024px as the icon rail', () => {
    window.matchMedia = ((q: string) => ({ matches: match(q), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    const { container } = renderShell('admin', user(ALL, ['ADMINISTRATOR']), '/users');
    expect(container.querySelector('.rf2-shell')).toHaveClass('rf2-shell--collapsed');
    expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});
