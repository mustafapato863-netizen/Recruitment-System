import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon, type IconName } from '../components/Icon';
import { IconButton } from '../components/ui/IconButton';
import { Spinner } from '../components/Spinner';
import { getApi, patchApi } from '../api/client';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';

type NavigationItemProps = {
  label: string;
  icon: IconName;
  to?: string;
  end?: boolean;
};

function NavigationItem({ label, icon, to, end = false }: NavigationItemProps) {
  if (!to) {
    return (
      <span className="nav-item-disabled" aria-disabled="true" title="Available in a future phase">
        <span className="ico"><Icon name={icon} size={14} /></span>
        <span className="nav-label">{label}</span>
      </span>
    );
  }

  return (
    <NavLink className={({ isActive }) => (isActive ? 'active' : '')} end={end} to={to}>
      <span className="ico"><Icon name={icon} size={14} /></span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRecord[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = () => {
      getApi<{ unreadCount: number }>('/notifications/unread-count')
        .then(({ unreadCount: count }) => { if (!cancelled) setUnreadCount(count); })
        .catch(() => { /* Notification count is non-blocking shell data. */ });
    };
    fetchCount();
    const timer = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const loadRecentNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const result = await getApi<PaginatedResult<NotificationRecord>>('/notifications?page=1&pageSize=5');
      setRecentNotifications(result.data);
    } catch (err: unknown) {
      setNotificationsError((err as Error).message ?? 'Unable to load notifications.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationsOpen]);

  const toggleNotifications = () => {
    setIsNotificationsOpen((current) => {
      const next = !current;
      if (next) void loadRecentNotifications();
      return next;
    });
  };

  const markNotificationRead = async (id: string) => {
    setMarkingNotificationId(id);
    try {
      const updated = await patchApi<NotificationRecord>(`/notifications/${id}/read`);
      setRecentNotifications((current) => current.map((notification) => notification.id === id ? updated : notification));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err: unknown) {
      setNotificationsError((err as Error).message ?? 'Unable to update this notification.');
    } finally {
      setMarkingNotificationId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getInitials = (name: string) => name.split(' ').map((part) => part[0]).join('').substring(0, 2).toUpperCase();
  const routeLabels: Array<[string, string]> = [
    ['/', 'Dashboard'], ['/tasks', 'My Tasks'], ['/notifications', 'Notifications'],
    ['/cv-intake/', 'Import Review'], ['/cv-intake', 'CV Intake'], ['/users', 'Users & Roles'],
    ['/master-data', 'Master Data'], ['/audit-log', 'Audit Log'], ['/vacancy-requests/create', 'Create Vacancy Request'],
    ['/vacancy-requests', 'Vacancy Requests'], ['/approval-inbox', 'Approval Inbox'], ['/vacancies/', 'Vacancy Overview'],
    ['/vacancies', 'Vacant List'], ['/candidates/', 'Candidate Profile'], ['/candidates', 'Candidates Directory'],
    ['/applications/', 'Application Detail'], ['/applications', 'Applications Pipeline'], ['/interviews/', 'Interview Evaluation Scorecard'],
    ['/interviews', 'Interviews & Scheduling'], ['/hires/approvals/inbox', 'Final Hiring Approval'], ['/hires/', 'Hiring Case'],
    ['/hires', 'Hire Management'], ['/licenses', 'License Management'], ['/joinings', 'Joining Management'],
    ['/talent-pool', 'Talent Pool'], ['/import', 'Import Review'], ['/reports', 'Reports & Analytics'],
    ['/pipeline-settings', 'Pipeline Settings'], ['/integrations', 'Integrations & API'],
  ];
  const currentBreadcrumb = routeLabels.find(([path]) => path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path))?.[1] ?? 'Workspace';

  return (
    <div className={['app', isSidebarCollapsed ? 'is-sidebar-collapsed' : ''].filter(Boolean).join(' ')}>
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">R</div>
          <div className="brand-copy"><b>RecruitFlow</b><small>Talent Operations</small></div>
          <IconButton
            className="sidebar-collapse"
            label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={isSidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={15} />
          </IconButton>
        </div>

        <div className="nav">
          <div className="group">Overview</div>
          <NavigationItem end icon="dashboard" label="Dashboard" to="/" />
          <NavigationItem icon="tasks" label="My Tasks" to="/tasks" />

          <div className="group">Vacancy Management</div>
          <NavigationItem icon="vacancy" label="Vacancy Requests" to="/vacancy-requests" />
          <NavigationItem icon="inbox" label="Approval Inbox" to="/approval-inbox" />
          <NavigationItem icon="list" label="Vacant List" to="/vacancies" />

          <div className="group">Talent</div>
          <NavigationItem icon="users" label="Candidates" to="/candidates" />
          <NavigationItem icon="database" label="Talent Pool" to="/talent-pool" />
          <NavigationItem icon="upload" label="Import / Export" to="/cv-intake" />

          <div className="group">Recruitment</div>
          <NavigationItem icon="pipeline" label="Pipeline" to="/applications" />
          <NavigationItem icon="calendar" label="Interviews" to="/interviews" />
          <NavigationItem icon="offer" label="Offers" to="/offers" />
          <NavigationItem icon="hire" label="Hire Management" to="/hires" />

          <div className="group">Analytics</div>
          <NavigationItem icon="report" label="Reports" to="/reports" />

          <div className="group">Administration</div>
          <NavigationItem icon="users" label="Users & Roles" to="/users" />
          <NavigationItem icon="database" label="Master Data" to="/master-data" />
          <NavigationItem icon="settings" label="Pipeline Settings" to="/pipeline-settings" />
          <NavigationItem icon="integrations" label="Integrations" to="/integrations" />
          <NavigationItem icon="audit" label="Audit Log" to="/audit-log" />
        </div>

        <div className="user">
          <div className="avatar">{user ? getInitials(user.displayName) : 'U'}</div>
          <div className="account-copy">
            <b>{user?.displayName || 'User'}</b>
            <small className="account-meta">
              <span>{user?.roles?.[0]?.name || 'User'}</span>
              <button type="button" onClick={() => void logout()}>Sign out</button>
            </small>
          </div>
          <button className="account-more" type="button" aria-label="Account options" title="Account options">•••</button>
        </div>
      </aside>

      <header className="header">
        <div className="crumb"><span>RecruitFlow</span><span aria-hidden="true">/</span><b>{currentBreadcrumb}</b></div>
        <div className="search">
          <Icon name="search" size={15} />
          <input ref={searchInputRef} aria-label="Search workspace" placeholder="Search candidates, vacancies, applications..." />
          <kbd>⌘ K</kbd>
        </div>
        <div className="actions">
          <Link className="ui-button ui-button--primary ui-button--md" to="/candidates">+ Quick add</Link>
          <div className="notification-menu" ref={notificationMenuRef}>
            <IconButton
              className="notification-button"
              label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-haspopup="dialog"
              aria-expanded={isNotificationsOpen}
              aria-controls="notification-popover"
              onClick={toggleNotifications}
              title="Notifications"
            >
              <Icon name="bell" size={17} />
              {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </IconButton>

            {isNotificationsOpen && <section id="notification-popover" className="notification-popover" role="dialog" aria-labelledby="notification-popover-title">
              <div className="notification-popover__header">
                <div><b id="notification-popover-title">Notifications</b><small>{unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}</small></div>
                <Link to="/notifications" className="notification-popover__view-all" onClick={() => setIsNotificationsOpen(false)}>View all</Link>
              </div>
              <div className="notification-popover__body">
                {notificationsLoading && <div className="notification-popover__state" role="status"><Spinner size={22} aria-label="Loading notifications" /><span>Checking updates...</span></div>}
                {!notificationsLoading && notificationsError && <div className="notification-popover__state is-error" role="alert"><span>{notificationsError}</span><button type="button" onClick={() => void loadRecentNotifications()}>Retry</button></div>}
                {!notificationsLoading && !notificationsError && recentNotifications.length === 0 && <div className="notification-popover__state"><Icon name="bell" size={22} /><span>No notifications yet.</span></div>}
                {!notificationsLoading && !notificationsError && recentNotifications.length > 0 && <div className="notification-popover__list">
                  {recentNotifications.map((notification) => <article key={notification.id} className={`notification-popover__item ${notification.readAt ? 'is-read' : 'is-unread'}`}>
                    <span className="notification-popover__dot" aria-hidden="true" />
                    <div className="notification-popover__content"><b>{notification.title}</b><p>{notification.message}</p><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>
                    {!notification.readAt && <button className="notification-popover__mark" type="button" disabled={markingNotificationId === notification.id} onClick={() => void markNotificationRead(notification.id)}>{markingNotificationId === notification.id ? 'Saving...' : 'Mark read'}</button>}
                  </article>)}
                </div>}
              </div>
            </section>}
          </div>
          <div className="avatar">{user ? getInitials(user.displayName) : 'U'}</div>
        </div>
      </header>

      <main className="main"><Outlet /></main>
    </div>
  );
}
