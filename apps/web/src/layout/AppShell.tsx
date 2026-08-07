import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Icon, type IconName } from '../components/Icon';
import { MobileBottomNav } from './MobileBottomNav';

type NavigationItemProps = {
  label: string;
  icon: IconName;
  to?: string;
  end?: boolean;
};

function NavigationItem({ label, icon, to, end = false }: NavigationItemProps) {
  if (!to) {
    return (
      <span aria-disabled="true" className="nav-item nav-item-disabled" title="Available in a future phase">
        <span className="nav-icon"><Icon name={icon} size={15} /></span>
        <span>{label}</span>
        <small>Later</small>
      </span>
    );
  }

  return (
    <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end={end} to={to}>
      <span className="nav-icon"><Icon name={icon} size={15} /></span>
      <span>{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getInitials = (name: string) => name.split(' ').map((part) => part[0]).join('').substring(0, 2).toUpperCase();
  const routeLabels: Array<[string, string]> = [
    ['/', 'Dashboard'],
    ['/users', 'Users & Roles'],
    ['/master-data', 'Master Data'],
    ['/audit-log', 'Audit Log'],
    ['/vacancy-requests/create', 'Create Vacancy Request'],
    ['/vacancy-requests', 'Vacancy Requests'],
    ['/approval-inbox', 'Approval Inbox'],
    ['/vacancies/', 'Vacancy Overview'],
    ['/vacancies', 'Vacant List'],
    ['/candidates/', 'Candidate Profile'],
    ['/candidates', 'Candidates Directory'],
    ['/applications/', 'Application Detail'],
    ['/applications', 'Applications Pipeline'],
    ['/interviews/', 'Interview Evaluation Scorecard'],
    ['/interviews', 'Interviews & Scheduling'],
    ['/hires/approvals/inbox', 'Final Hiring Approval'],
    ['/hires/', 'Hiring Case'],
    ['/hires', 'Hire Management'],
    ['/licenses', 'License Management'],
    ['/joinings', 'Joining Management'],
    ['/talent-pool', 'Talent Pool'],
    ['/import', 'Import Preview'],
    ['/reports', 'Reports & Analytics'],
    ['/pipeline-settings', 'Pipeline Settings'],
    ['/integrations', 'Integrations & API'],
    ['/design-system', 'Design System'],
    ['/states-feedback', 'Application States & Feedback Patterns'],
  ];
  const currentBreadcrumb = routeLabels.find(([path]) => path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path))?.[1] ?? 'Workspace';

  return (
    <div className="app-shell">
      <a href="#main-content" className="sr-only">Skip to main content</a>
      <aside className={`sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <span aria-hidden="true" className="brand-mark">R</span>
          <span><strong>RecruitFlow</strong><small>Recruitment operations</small></span>
        </div>

        <nav className="navigation" aria-label="Main navigation" onClick={() => setIsMobileNavOpen(false)}>
          <p className="nav-label">Overview</p>
          <NavigationItem end icon="dashboard" label="Dashboard" to="/" />
          <NavigationItem icon="tasks" label="My Tasks" />
          <NavigationItem icon="bell" label="Notifications" />

          <p className="nav-label">Vacancy Management</p>
          <NavigationItem icon="vacancy" label="Vacancy Requests" to="/vacancy-requests" />
          <NavigationItem icon="inbox" label="Approval Inbox" to="/approval-inbox" />
          <NavigationItem icon="list" label="Vacant List" to="/vacancies" />

          <p className="nav-label">Talent</p>
          <NavigationItem icon="users" label="Candidates" to="/candidates" />
          <NavigationItem icon="users" label="Talent Pool" to="/talent-pool" />
          <NavigationItem icon="database" label="Import / Export" to="/import" />

          <p className="nav-label">Recruitment</p>
          <NavigationItem icon="pipeline" label="Pipeline" to="/applications" />
          <NavigationItem icon="calendar" label="Interviews" to="/interviews" />
          <NavigationItem icon="offer" label="Offers" to="/offers" />
          <NavigationItem icon="offer" label="Offer Approvals Inbox" to="/offers/approvals/inbox" />
          <NavigationItem icon="hire" label="Hire Management" to="/hires" />
          <NavigationItem icon="hire" label="Final Approval Inbox" to="/hires/approvals/inbox" />
          <NavigationItem icon="document" label="License Management" to="/licenses" />
          <NavigationItem icon="user-check" label="Joining Management" to="/joinings" />

          <p className="nav-label">Analytics</p>
          <NavigationItem icon="report" label="Reports" to="/reports" />

          <p className="nav-label">Administration</p>
          <NavigationItem icon="users" label="Users & Roles" to="/users" />
          <NavigationItem icon="database" label="Master Data" to="/master-data" />
          <NavigationItem icon="settings" label="Pipeline Settings" to="/pipeline-settings" />
          <NavigationItem icon="integrations" label="Integrations" to="/integrations" />
          <NavigationItem icon="audit" label="Audit Log" to="/audit-log" />

          <p className="nav-label">System</p>
          <NavigationItem icon="dashboard" label="Design System" to="/design-system" />
          <NavigationItem icon="list" label="UI Patterns" to="/states-feedback" />
        </nav>

        <div className="user-card">
          <span className="avatar">{user ? getInitials(user.displayName) : 'U'}</span>
          <span>
            <strong>{user?.displayName || 'User'}</strong>
            <button className="user-signout" type="button" onClick={() => void logout()}>
              <Icon name="logout" size={12} /> Sign out
            </button>
          </span>
          <span aria-hidden="true" className="user-more"><Icon name="more" size={16} /></span>
        </div>
      </aside>

      {isMobileNavOpen && <button aria-label="Close navigation" className="sidebar-backdrop" type="button" onClick={() => setIsMobileNavOpen(false)} />}

      <main className="main-content" id="main-content">
        <header className="topbar">
          <button aria-label="Open navigation" className="mobile-nav-toggle" type="button" onClick={() => setIsMobileNavOpen((open) => !open)}>
            <Icon name={isMobileNavOpen ? 'close' : 'menu'} size={19} />
          </button>
          <span className="breadcrumb">Workspace / <strong>{currentBreadcrumb}</strong></span>
          <label className="global-search">
            <Icon name="search" size={15} />
            <input ref={searchInputRef} aria-label="Global search" placeholder="Search candidates, vacancies, applications..." />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="topbar-actions">
            <button
              className="icon-button"
              title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} theme`}
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
              {effectiveTheme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="icon-button" disabled title="Notifications are not enabled yet" type="button" aria-label="Notifications">
              <Icon name="bell" size={16} />
            </button>
            <button className="scope-button" disabled title="Branch filters are not enabled yet" type="button">
              All branches <Icon name="chevron-down" size={14} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>

      <MobileBottomNav onToggleDrawer={() => setIsMobileNavOpen((open) => !open)} />
    </div>
  );
}
