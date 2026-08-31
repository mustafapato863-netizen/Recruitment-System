import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon, type IconName } from '../components/Icon';
import { IconButton } from '../components/ui/IconButton';
import { CommandPalette } from '../components/ui/CommandPalette';
import { NotificationAlertDialog } from '../components/ui/notification-alert-dialog';
import { QuickCreateMenu } from '../components/ui/QuickCreateMenu';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';
import { UserProfileDropdown } from '../components/ui/UserProfileDropdown';

type NavigationItemProps = {
  label: string;
  icon: IconName;
  to?: string;
  end?: boolean;
  permission?: string;
  anyPermissions?: string[];
  isCollapsed?: boolean;
  onNavigate?: () => void;
};

function NavigationItem({
  label,
  icon,
  to,
  end = false,
  permission,
  anyPermissions,
  isCollapsed = false,
  onNavigate,
}: NavigationItemProps) {
  const { user } = useAuth();
  const hasPermission = permission ? Boolean(user?.permissions.includes(permission)) : true;
  const hasAnyPermission = anyPermissions ? anyPermissions.some((item) => user?.permissions.includes(item)) : true;

  if (!hasPermission || !hasAnyPermission) return null;

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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
    { path: '/vacancies/', label: 'Vacancy Overview', parent: 'Openings & Vacancies' },
    { path: '/vacancies', label: 'Openings & Vacancies', parent: 'Jobs & Pipeline' },
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
        aria-hidden={!isMobileDrawerOpen && typeof window !== 'undefined' && window.innerWidth < 1024 ? 'true' : undefined}
      >
        <div className="brand">
          <Link className="brand-home" to="/" aria-label="Saudi German Health — RecruitFlow" onClick={closeMobileDrawer}>
            <div className="mark" style={{ background: 'transparent', boxShadow: 'none', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SghHeartSvg size={32} glow />
            </div>
            <div className="brand-copy">
              <b className="sgh-gradient-text">RecruitFlow</b>
              <small>Saudi German Health</small>
            </div>
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

        <div className="nav rf-scrollbar">
          {/* Main Navigation - 10 Core App Design Pages */}
          <NavigationItem end icon="dashboard" label="Dashboard" to="/" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="list" label="Jobs" to="/vacancies" permission="VACANCY_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="pipeline" label="Applicants" to="/applications" permission="APPLICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="calendar-clock" label="Interviews" to="/interviews/calendar" permission="VACANCY_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="offer" label="Offers & Approvals" to="/offers" anyPermissions={['APPLICATION_VIEW', 'APPROVE_OFFERS']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="database" label="CV Bank" to="/cv-bank" permission="CANDIDATE_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="report" label="Reports" to="/reports" permission="APPLICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="folder-kanban" label="Talent Pipeline" to="/talent-pool" permission="CANDIDATE_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="mail" label="Notifications" to="/notifications" permission="NOTIFICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
          <NavigationItem icon="settings" label="Settings" to="/settings" anyPermissions={['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
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
        <div className="flex items-center gap-2">
          <IconButton
            ref={mobileMenuTriggerRef as unknown as React.Ref<HTMLButtonElement>}
            className="lg:hidden"
            label="Open navigation menu"
            onClick={() => setIsMobileDrawerOpen(true)}
          >
            <Icon name="menu" size={18} />
          </IconButton>
          <nav className="crumb" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1 list-none m-0 p-0">
              <li>
                <Link to="/" className="text-rf-ink-muted hover:text-rf-action transition-colors">RecruitFlow</Link>
              </li>
              {breadcrumbs.map((crumb, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  <span aria-hidden="true" className="text-rf-ink-muted/50">/</span>
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="font-bold text-rf-ink truncate max-w-[200px]" title={crumb.label}>
                      {crumb.label}
                    </span>
                  ) : (
                    <span className="text-rf-ink-muted truncate max-w-[140px]" title={crumb.label}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <button
          ref={searchTriggerRef}
          type="button"
          className="search cursor-text text-left"
          onClick={() => setIsCommandPaletteOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isCommandPaletteOpen}
          aria-label="Search candidates, vacancies, applications and tasks"
        >
          <Icon name="search" size={15} />
          <span className="text-rf-ink-muted">Search candidates, vacancies, applications...</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="actions flex items-center gap-2.5">
          <QuickCreateMenu />
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
