import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon, type IconName } from '../components/Icon';
import { IconButton } from '../components/ui/IconButton';
import { CommandPalette } from '../components/ui/CommandPalette';
import { NotificationAlertDialog } from '../components/ui/notification-alert-dialog';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { UserProfileDropdown } from '../components/ui/UserProfileDropdown';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';

type NavigationItemProps = {
  label: string;
  icon: IconName;
  to?: string;
  end?: boolean;
  allowedRoles?: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[];
  isCollapsed?: boolean;
  onNavigate?: () => void;
};

function NavigationItem({
  label,
  icon,
  to,
  end = false,
  allowedRoles,
  isCollapsed = false,
  onNavigate,
}: NavigationItemProps) {
  const { user } = useAuth();
  
  const userRoleCodes = user?.roles?.map(r => r.code) || [];
  const isAdmin = userRoleCodes.some(c => ['ADMIN', 'SYSADMIN'].includes(c));
  const isManager = userRoleCodes.some(c => ['HIRING_MANAGER', 'RECRUITER', 'MANAGER'].includes(c));
  const effectiveRole = isAdmin ? 'ADMIN' : (isManager ? 'MANAGER' : 'EMPLOYEE');

  const hasAccess = allowedRoles ? allowedRoles.includes(effectiveRole) : true;

  if (!hasAccess) return null;

  if (!to) {
    return (
      <span className="nav-item-disabled relative nav-item" aria-disabled="true">
        <span className="ico"><Icon name={icon} size={18} /></span>
        {!isCollapsed ? (
          <span className="nav-label">{label}</span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
      </span>
    );
  }

  return (
    <NavLink
      className={({ isActive }) => (isActive ? 'active relative nav-item' : 'relative nav-item')}
      end={end}
      to={to}
      aria-label={label}
      onClick={onNavigate}
    >
      <span className="ico"><Icon name={icon} size={18} /></span>
      {!isCollapsed && <span className="nav-label">{label}</span>}
      {isCollapsed && (
        <span
          role="tooltip"
          className="nav-tooltip absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-rf-ink text-white text-xs font-bold whitespace-nowrap opacity-0 pointer-events-none transition-opacity z-50 shadow-md border border-rf-border-strong/20"
        >
          {label}
        </span>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen(false);
    mobileMenuTriggerRef.current?.focus();
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // Body scroll lock when mobile drawer is open
  useEffect(() => {
    if (!isMobileDrawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileDrawerOpen]);

  // Handle escape key for mobile drawer
  useEffect(() => {
    if (!isMobileDrawerOpen) return undefined;
    const focusableSelector = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusFirst = () => mobileSidebarRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const focusFrame = window.requestAnimationFrame(focusFirst);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMobileDrawer();
        return;
      }
      if (event.key !== 'Tab' || !mobileSidebarRef.current) return;
      const focusable = [...mobileSidebarRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileDrawerOpen, closeMobileDrawer]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  type RouteLabelEntry = {
    path: string;
    label: string;
    parent?: string;
  };

  const routeLabels: RouteLabelEntry[] = [
    { path: '/', label: 'Dashboard' },
    { path: '/tasks', label: 'My Tasks', parent: 'My Work' },
    { path: '/profile', label: 'Profile & Settings' },
    { path: '/notifications', label: 'Notifications' },
    { path: '/cv-intake/', label: 'Import Review', parent: 'CV Intake & Parser' },
    { path: '/cv-intake', label: 'CV Intake & Parser', parent: 'Talent & Sourcing' },
    { path: '/cv-bank', label: 'CV Bank', parent: 'Talent & Sourcing' },
    { path: '/import/', label: 'Bulk Import Review', parent: 'Bulk Import Center' },
    { path: '/import', label: 'Bulk Import Center', parent: 'Talent & Sourcing' },
    { path: '/users', label: 'Users & Roles', parent: 'Settings & Governance' },
    { path: '/master-data', label: 'Master Data', parent: 'Settings & Governance' },
    { path: '/audit-log', label: 'Audit Log', parent: 'Settings & Governance' },
    { path: '/settings/targets', label: 'Position Targets', parent: 'Settings & Governance' },
    { path: '/vacancy-requests/create', label: 'Create Vacancy Request', parent: 'Vacancy Requests' },
    { path: '/vacancy-requests/', label: 'Vacancy Request Detail', parent: 'Vacancy Requests' },
    { path: '/vacancy-requests', label: 'Vacancy Requests', parent: 'My Work' },
    { path: '/approval-inbox', label: 'Approval Inbox', parent: 'My Work' },
    { path: '/vacancies/', label: 'Vacancy Overview', parent: 'Openings & Job Cards' },
    { path: '/vacancies', label: 'Openings & Job Cards', parent: 'Jobs & Pipeline' },
    { path: '/candidates/', label: 'Candidate Profile', parent: 'Candidates Directory' },
    { path: '/candidates', label: 'Candidates Directory', parent: 'Jobs & Pipeline' },
    { path: '/applications/', label: 'Application Detail', parent: 'Applications Pipeline' },
    { path: '/applications', label: 'Applications Pipeline', parent: 'Jobs & Pipeline' },
    { path: '/offers/create', label: 'Create Offer', parent: 'Offers & Pre-Hire' },
    { path: '/offers/approvals/inbox', label: 'Offer Approval Inbox', parent: 'Offers & Pre-Hire' },
    { path: '/offers/', label: 'Offer Detail', parent: 'Offers & Pre-Hire' },
    { path: '/offers', label: 'Offers & Pre-Hire', parent: 'Jobs & Pipeline' },
    { path: '/joinings/', label: 'Joining Detail', parent: 'Joinings Management' },
    { path: '/joinings', label: 'Joinings Management', parent: 'Jobs & Pipeline' },
    { path: '/interviews/calendar', label: 'Interview Calendar', parent: 'Jobs & Pipeline' },
    { path: '/interviews/', label: 'Interview Evaluation', parent: 'Interviews & Scheduling' },
    { path: '/interviews', label: 'Interviews & Scheduling', parent: 'Jobs & Pipeline' },
    { path: '/hires/approvals/inbox', label: 'Final Hiring Approval', parent: 'Pre-Hire & Hires' },
    { path: '/hires/', label: 'Hiring Case', parent: 'Pre-Hire & Hires' },
    { path: '/hires', label: 'Pre-Hire & Hires', parent: 'Jobs & Pipeline' },
    { path: '/talent-pool/', label: 'Talent Pool Detail', parent: 'Talent Pool' },
    { path: '/talent-pool', label: 'Talent Pool', parent: 'Talent & Sourcing' },
    { path: '/reports', label: 'Reports & Analytics', parent: 'Insights & Performance' },
    { path: '/pipeline-settings', label: 'Pipeline Settings', parent: 'Settings & Governance' },
    { path: '/integrations', label: 'Integrations & API', parent: 'Settings & Governance' },
    { path: '/settings', label: 'Settings & Governance' },
  ];

  const matchedRoute = routeLabels.find(({ path }) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(path),
  );

  const breadcrumbs = matchedRoute
    ? [
        ...(matchedRoute.parent ? [{ label: matchedRoute.parent }] : []),
        { label: matchedRoute.label },
      ]
    : [{ label: 'Workspace' }];

  return (
    <div
      className={[
        'app',
        isSidebarCollapsed ? 'is-sidebar-collapsed' : '',
        isMobileDrawerOpen ? 'is-mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AtmosphericBackground variant="dashboard" />
      {/* Mobile Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={closeMobileDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        ref={mobileSidebarRef}
        className={`sidebar ${isMobileDrawerOpen ? 'mobile-active' : ''}`}
        aria-label="Main Navigation"
        aria-modal={isMobileDrawerOpen ? 'true' : undefined}
        role={isMobileDrawerOpen ? 'dialog' : undefined}
        aria-hidden={isMobileViewport && !isMobileDrawerOpen ? 'true' : undefined}
      >
        <div className="brand px-4 py-3 flex items-center justify-between border-b border-rf-border-subtle">
          <Link className="brand-home flex items-center gap-2.5 no-underline" to="/" aria-label="RecruitFlow" onClick={closeMobileDrawer}>
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <SghHeartSvg size={30} glow={false} />
            </div>
            {!isSidebarCollapsed && (
              <div className="brand-copy flex flex-col">
                <span className="text-rf-ink font-extrabold text-[15px] tracking-tight leading-none">RecruitFlow</span>
                <span className="text-[9px] text-rf-action font-extrabold uppercase tracking-[0.12em] mt-1 leading-none">SAUDI GERMAN HEALTH</span>
              </div>
            )}
          </Link>
          <IconButton
            className="sidebar-collapse hidden lg:flex"
            label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={isSidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={15} />
          </IconButton>
          <IconButton
            className="sidebar-collapse lg:hidden"
            label="Close navigation"
            onClick={closeMobileDrawer}
            title="Close navigation"
          >
            <Icon name="close" size={15} />
          </IconButton>
        </div>

        {/* Workspace Switcher in Sidebar (Dynamic from Auth Session) */}
        {!isSidebarCollapsed && (
          <button
            type="button"
            className="w-[calc(100%-1.5rem)] mx-3 my-2.5 p-2.5 bg-rf-surface-subtle hover:bg-rf-surface border border-rf-border-subtle hover:border-rf-border rounded-xl flex items-center justify-between transition text-left focus:outline-none focus:ring-2 focus:ring-rf-action"
            aria-label={`Current organization: ${user?.organizationName || 'Current Organization'}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rf-success shadow-[0_0_0_2px_rgba(16,185,129,0.2)] shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <span className="block text-sm font-bold text-rf-ink truncate">
                  {user?.organizationName || 'Recruitment Workspace'}
                </span>
                <span className="block text-xs text-rf-ink-muted font-medium truncate">
                  {user?.roles?.[0]?.name || 'Workspace Member'}
                </span>
              </div>
            </div>
            <Icon name="chevron-down" size={14} className="text-rf-ink-muted shrink-0 ml-1" />
          </button>
        )}

        <div className="nav rf-scrollbar">
          <NavigationItem end icon="dashboard" label="Home" to="/" allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="briefcase" label="Jobs" to="/vacancies" allowedRoles={['ADMIN', 'MANAGER']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="users" label="Candidates" to="/candidates" allowedRoles={['ADMIN', 'MANAGER']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="calendar-clock" label="Interviews" to="/interviews" allowedRoles={['ADMIN', 'MANAGER']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="offer" label="Offers & Joining" to="/offers" allowedRoles={['ADMIN', 'MANAGER']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="report" label="Reports" to="/reports" allowedRoles={['ADMIN', 'MANAGER']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="settings" label="Settings" to="/settings" allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
        </div>

        {/* User Account / Footer Section */}
        <div className="user" aria-label="Account">
          <Link
            className="user-profile-link"
            to="/profile"
            aria-label="Open Profile & Settings"
            title={isSidebarCollapsed ? `${user?.displayName || user?.email || 'User'} (${user?.roles?.[0]?.name || 'Workspace Member'})` : undefined}
            onClick={closeMobileDrawer}
          >
            <div className="avatar">{user ? getInitials(user.displayName || user.email || 'User') : 'U'}</div>
            {!isSidebarCollapsed && (
              <div className="account-copy">
                <b>{user?.displayName || user?.email || 'User'}</b>
                <small>{user?.roles?.[0]?.name || 'Workspace Member'}</small>
              </div>
            )}
          </Link>
          <div className="flex items-center gap-1 account-actions">
            <ThemeToggle className="theme-toggle-sm" />
            {!isSidebarCollapsed && (
              <button className="account-more" type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out">
                <Icon name="logout" size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <header className="header">
        {/* Left Zone: Mobile toggle + Breadcrumb navigation */}
        <div className="header-left flex items-center gap-3 min-w-0">
          <IconButton
            ref={mobileMenuTriggerRef as unknown as React.Ref<HTMLButtonElement>}
            className="lg:hidden shrink-0"
            label="Open navigation menu"
            onClick={() => setIsMobileDrawerOpen(true)}
          >
            <Icon name="menu" size={18} />
          </IconButton>
          <nav className="crumb" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 list-none m-0 p-0 text-sm">
              <li>
                <Link to="/" className="text-rf-ink-muted hover:text-rf-action transition-colors font-medium">RecruitFlow</Link>
              </li>
              {breadcrumbs.map((crumb, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-rf-ink-muted/50 text-xs">/</span>
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="font-bold text-rf-ink truncate max-w-[220px]" title={crumb.label}>
                      {crumb.label}
                    </span>
                  ) : (
                    <span className="text-rf-ink-muted truncate max-w-[160px]" title={crumb.label}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Center Zone: Quick Command Search */}
        <div className="header-center flex-1 max-w-[440px] mx-4 hidden md:flex items-center justify-center">
          <button
            ref={searchTriggerRef}
            type="button"
            className="search w-full cursor-text text-left flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rf-surface-subtle hover:bg-rf-surface border border-rf-border hover:border-rf-action/50 transition shadow-2xs text-sm"
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isCommandPaletteOpen}
            aria-label="Search candidates, vacancies, applications and tasks"
          >
            <Icon name="search" size={16} className="text-rf-ink-muted shrink-0" />
            <span className="text-rf-ink-muted text-sm truncate flex-1">Search candidates, vacancies, pipeline...</span>
            <kbd className="px-1.5 py-0.5 text-xs font-bold bg-rf-surface border border-rf-border-subtle rounded text-rf-ink-muted shadow-2xs">⌘ K</kbd>
          </button>
        </div>

        {/* Right Zone: Notification Bell + Theme Toggle + User Profile */}
        <div className="header-right flex items-center gap-3 shrink-0">
          <NotificationAlertDialog triggerVariant="icon" />
          <ThemeToggle />
          <div className="h-6 w-px bg-rf-border-subtle mx-0.5 hidden sm:block" aria-hidden="true" />
          <UserProfileDropdown />
        </div>
      </header>

      <main className="main" aria-hidden={isMobileDrawerOpen ? 'true' : undefined}><Outlet /></main>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
}

export default AppShell;
