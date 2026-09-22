import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { NavigationItemRecord } from '@recruitflow/contracts';
import { getNavigationCatalogItem } from '@recruitflow/contracts';
import { useAuth } from '../auth/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { isEmployeeWorkspaceUser } from '../auth/workspacePersona';
import { Icon, type IconName } from '../components/Icon';
import { IconButton } from '../components/ui/IconButton';
import { CommandPalette } from '../components/ui/CommandPalette';
import { NotificationAlertDialog } from '../components/ui/notification-alert-dialog';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';
import { UserProfileDropdown } from '../components/ui/UserProfileDropdown';
import { BreadcrumbsBar } from '../components/ui/BreadcrumbsBar';
import { BreadcrumbProvider } from '../context/BreadcrumbContext';
import { QuickGuideProvider, QuickGuideModal, GuidedTourOverlay, useQuickGuide } from '../quickguide';

import { getApi } from '../api/client';

type NavigationItemProps = {
  label: string;
  labelWhenEmployee?: string;
  icon: IconName;
  to?: string;
  end?: boolean;
  navigationKey?: string;
  requiredPermission?: string;
  requiredAnyPermissions?: readonly string[];
  allowedRoles?: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[];
  isCollapsed?: boolean;
  onNavigate?: () => void;
  badge?: number | string;
  badgeTone?: 'blue' | 'amber' | 'emerald' | 'red';
  /** When the user lacks permission: hide the item, or show it disabled with a tooltip. */
  unavailableMode?: 'hide' | 'disable';
};

const NavigationSettingsContext = createContext<Record<string, NavigationItemRecord>>({});

export function NavigationItem({
  label,
  labelWhenEmployee,
  icon,
  to,
  end = false,
  navigationKey,
  requiredPermission,
  requiredAnyPermissions,
  allowedRoles,
  isCollapsed = false,
  onNavigate,
  badge,
  badgeTone = 'blue',
  unavailableMode = 'disable',
}: NavigationItemProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canAccess, describeRequirement } = usePermissions();
  const navigationSettings = useContext(NavigationSettingsContext);
  const navigationSetting = navigationKey ? navigationSettings[navigationKey] : undefined;
  const catalogItem = navigationKey ? getNavigationCatalogItem(navigationKey) : undefined;
  const displayLabel = (isEmployeeWorkspaceUser(user) && labelWhenEmployee?.trim())
    || navigationSetting?.label?.trim()
    || label;

  // Prefer live API navigation settings, then shared catalog, then explicit props.
  // Explicit undefined props still allow catalog/settings to supply requirements;
  // pass an empty requiredAnyPermissions array only when a surface is intentionally open.
  const effectiveRequiredPermission =
    navigationSetting?.requiredPermission
    ?? catalogItem?.requiredPermission
    ?? requiredPermission;
  const effectiveRequiredAny =
    navigationSetting?.requiredAnyPermissions
    ?? catalogItem?.requiredAnyPermissions
    ?? requiredAnyPermissions;

  const hasRoleAccess = allowedRoles ? allowedRoles.length > 0 : true;
  const propsExplicitlyOpen =
    requiredPermission === undefined
    && requiredAnyPermissions !== undefined
    && requiredAnyPermissions.length === 0;
  const hasNaturalAccess = propsExplicitlyOpen
    ? true
    : canAccess({
        requiredPermission: effectiveRequiredPermission,
        requiredAnyPermissions: effectiveRequiredAny,
      });
  const isAdministrator = Boolean(
    user?.roles?.some((r) => r.code === 'ADMINISTRATOR') ||
    (user?.permissions?.includes('USERS_MANAGE') && user?.permissions?.includes('ROLES_MANAGE'))
  );
  const isSettingVisible = isAdministrator
    ? (navigationSetting?.visible ?? true)
    : navigationSetting?.visible !== false;

  if (!hasRoleAccess || !isSettingVisible) return null;

  const requirementText = describeRequirement({
    requiredPermission: effectiveRequiredPermission,
    requiredAnyPermissions: effectiveRequiredAny,
  });
  const deniedTitle = t('nav.needs', { requirement: requirementText });

  if (!hasNaturalAccess) {
    if (unavailableMode === 'hide') return null;
    return (
      <span
        className="nav-item-disabled relative nav-item opacity-60 cursor-not-allowed"
        aria-disabled="true"
        aria-label={t('nav.itemLockedAria', { label: displayLabel, needs: deniedTitle })}
        title={deniedTitle}
        tabIndex={0}
      >
        <span className="ico" aria-hidden="true"><Icon name={icon} size={18} /></span>
        {!isCollapsed ? (
          <span className="nav-label flex items-center justify-between gap-2">
            <span>{displayLabel}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rf-ink-muted ring-1 ring-rf-border">{t('nav.locked')}</span>
          </span>
        ) : (
          <span className="sr-only">{t('nav.itemLockedAria', { label: displayLabel, needs: deniedTitle })}</span>
        )}
        {isCollapsed && (
          <span
            role="tooltip"
            className="nav-tooltip absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-rf-ink text-rf-on-action text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none transition-all duration-150 z-50 shadow-xl border border-rf-border-strong/60"
          >
            {displayLabel} — {deniedTitle}
          </span>
        )}
      </span>
    );
  }

  if (!to) {
    return (
      <span className="nav-item-disabled relative nav-item" aria-disabled="true" aria-label={displayLabel} tabIndex={0}>
        <span className="ico" aria-hidden="true"><Icon name={icon} size={18} /></span>
        {!isCollapsed ? (
          <span className="nav-label">{displayLabel}</span>
        ) : (
          <span className="sr-only">{displayLabel}</span>
        )}
      </span>
    );
  }

  return (
    <NavLink
      className={({ isActive }) => (isActive ? 'active relative nav-item' : 'relative nav-item')}
      end={end}
      to={to}
      aria-label={displayLabel}
      title={isCollapsed ? displayLabel : undefined}
      onClick={onNavigate}
    >
      <span className="ico"><Icon name={icon} size={17} /></span>
      {!isCollapsed && (
        <span className="nav-label font-semibold text-[13.5px] leading-tight normal-case tracking-normal flex-1 flex items-center justify-between">
          <span>{displayLabel}</span>
          {badge !== undefined && Number(badge) > 0 && (
            <span
              className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                badgeTone === 'amber'
                  ? 'bg-rf-warning-soft text-rf-warning'
                  : badgeTone === 'red'
                  ? 'bg-rf-danger-soft text-rf-danger'
                  : badgeTone === 'emerald'
                  ? 'bg-rf-success-soft text-rf-success'
                  : 'bg-rf-info-soft text-rf-info'
              }`}
            >
              {badge}
            </span>
          )}
        </span>
      )}
      {isCollapsed && (
        <span
          role="tooltip"
          className="nav-tooltip absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-rf-ink text-rf-on-action text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none transition-all duration-150 z-50 shadow-xl border border-rf-border-strong/60"
        >
          {displayLabel}
        </span>
      )}
    </NavLink>
  );
}

export function AppShellInner() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { openGuide } = useQuickGuide();
  const location = useLocation();
  const navigate = useNavigate();
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [navigationSettings, setNavigationSettings] = useState<Record<string, NavigationItemRecord>>({});
  const isEmployeeWorkspace = isEmployeeWorkspaceUser(user);
  const canViewTasks = Boolean(user?.permissions?.includes('TASK_VIEW'));

  useEffect(() => {
    let isMounted = true;
    void getApi<NavigationItemRecord[]>('/access-control/navigation')
      .then((items) => {
        if (!isMounted || !Array.isArray(items)) return;
        setNavigationSettings(Object.fromEntries(items.map((item) => [item.key, item])));
      })
      .catch(() => {
        // Navigation metadata is an enhancement; route permissions remain authoritative.
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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



  const [inboxBadgeCount, setInboxBadgeCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchPendingCounts = async () => {
      try {
        const canApprove = Boolean(
          user?.permissions?.some((p) =>
            ['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'VACANCY_MANAGE'].includes(p)
          )
        );
        if (!canApprove) return;

        const [vrRes, offRes, hireRes] = await Promise.allSettled([
          getApi<unknown[]>('/vacancy-requests/inbox'),
          getApi<unknown[]>('/offers/approvals/inbox'),
          getApi<unknown[]>('/hiring/final-approvals'),
        ]);

        let total = 0;
        if (vrRes.status === 'fulfilled' && Array.isArray(vrRes.value)) total += vrRes.value.length;
        if (offRes.status === 'fulfilled' && Array.isArray(offRes.value)) total += offRes.value.length;
        if (hireRes.status === 'fulfilled' && Array.isArray(hireRes.value)) total += hireRes.value.length;

        if (isMounted) setInboxBadgeCount(total);
      } catch {
        // silent fallback
      }
    };
    void fetchPendingCounts();
    return () => {
      isMounted = false;
    };
  }, [user?.permissions]);

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
      {/* Skip to main content link — first focusable element for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-rf-action focus:text-white focus:text-sm focus:font-bold focus:shadow-lg"
      >
        Skip to main content
      </a>
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
          <Link className="brand-home" to="/" aria-label={t('brand.homeAriaLabel')} onClick={closeMobileDrawer}>
            <div className="mark brand-mark" aria-hidden="true">
              <SghHeartSvg size={28} glow />
            </div>
            {!isSidebarCollapsed && (
              <div className="brand-copy min-w-0 overflow-hidden">
                <b className="sgh-gradient-text truncate block">{t('brand.productName')}</b>
                <small className="truncate block">{t('brand.orgName')}</small>
              </div>
            )}
          </Link>
          <IconButton
            className="sidebar-collapse lg:hidden"
            label="Close navigation"
            onClick={closeMobileDrawer}
            title="Close navigation"
          >
            <Icon name="close" size={15} />
          </IconButton>
        </div>

        <NavigationSettingsContext.Provider value={navigationSettings}>
        <nav className="nav rf-scrollbar space-y-3" aria-label="Primary navigation">
          {/* Workspace */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted select-none">
                Workspace
              </div>
            )}
            <div className="space-y-0.5">
              {isEmployeeWorkspace ? (
                <NavigationItem end icon="dashboard" label="Command Center" labelWhenEmployee="My Work" to="/" navigationKey="dashboard" requiredAnyPermissions={[]} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              ) : (
                <NavigationItem end icon="dashboard" label="Command Center" to="/" navigationKey="dashboard" requiredAnyPermissions={['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'MASTER_DATA_VIEW']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              )}
              <NavigationItem icon="file-text" label="Requisitions" to="/vacancy-requests" navigationKey="vacancy-requests" requiredPermission="VACANCY_REQUEST_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              {!isEmployeeWorkspace && (
                <NavigationItem icon="briefcase" label="Job Positions" to="/vacancies" navigationKey="vacancies" requiredPermission="VACANCY_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              )}
            </div>
          </div>

          {/* Recruitment Pipeline */}
          {!isEmployeeWorkspace && (
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted select-none">
                Recruitment
              </div>
            )}
            <div className="space-y-0.5">
              <NavigationItem icon="users" label="Applications" to="/applications" navigationKey="applications" requiredPermission="APPLICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="check-circle" label="Approval Inboxes" to="/approval-inbox" navigationKey="approval-inbox" requiredAnyPermissions={['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL']} badge={inboxBadgeCount > 0 ? inboxBadgeCount : undefined} badgeTone="amber" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="calendar" label="Interviews" to="/interviews" navigationKey="interviews" requiredPermission="VACANCY_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="offer" label="Offers" to="/offers" navigationKey="offers" requiredPermission="APPLICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
            </div>
          </div>
          )}

          {/* Sourcing & Talent */}
          {!isEmployeeWorkspace && (
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted select-none">
                Sourcing &amp; Talent
              </div>
            )}
            <div className="space-y-0.5">
              <NavigationItem icon="database" label="Candidates" to="/candidates" navigationKey="candidates" requiredPermission="CANDIDATE_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="file-text" label="CV Bank" to="/cv-bank" navigationKey="cv-bank" requiredPermission="CANDIDATE_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="upload" label="CV Intake" to="/cv-intake" navigationKey="cv-intake" requiredPermission="CANDIDATE_CREATE" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="sparkles" label="Talent Pool & Match" to="/sourcing-match" navigationKey="sourcing-match" requiredPermission="CANDIDATE_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
            </div>
          </div>
          )}

          {/* Compliance & Onboarding */}
          {!isEmployeeWorkspace && (
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted select-none">
                Compliance &amp; Hires
              </div>
            )}
            <div className="space-y-0.5">
              <NavigationItem icon="user-check" label="Hires & Joining" to="/joinings" navigationKey="joinings" requiredPermission="APPLICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="shield-check" label="Medical Licenses" to="/licenses" navigationKey="licenses" requiredPermission="APPLICATION_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
            </div>
          </div>
          )}

          {/* Governance */}
          {!isEmployeeWorkspace && (
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted select-none">
                Governance
              </div>
            )}
            <div className="space-y-0.5">
              <NavigationItem icon="mail" label="Email Templates" to="/email-templates" navigationKey="email-templates" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="chat" label="WhatsApp Templates" to="/whatsapp-templates" navigationKey="whatsapp-templates" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="settings" label="Settings" to="/settings" navigationKey="settings" requiredAnyPermissions={['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW']} isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="user-cog" label="Users & Roles" to="/users" navigationKey="users" requiredPermission="USERS_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="pipeline" label="Reporting Tree" to="/reporting-tree" navigationKey="reporting-tree" requiredPermission="USERS_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="list" label="Master Data" to="/master-data" navigationKey="master-data" requiredPermission="MASTER_DATA_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
              <NavigationItem icon="history" label="Audit Log" to="/audit-log" navigationKey="audit-log" requiredPermission="AUDIT_VIEW" isCollapsed={isSidebarCollapsed} onNavigate={closeMobileDrawer} />
            </div>
          </div>
          )}

        </nav>
        </NavigationSettingsContext.Provider>

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
        <div className="flex items-center justify-between w-full max-w-[1720px] mx-auto gap-4 px-4 sm:px-6 lg:px-7 h-full">
          <div className="flex items-center gap-3">
            <IconButton
              ref={mobileMenuTriggerRef as unknown as React.Ref<HTMLButtonElement>}
              className="lg:hidden"
              label="Open navigation menu"
              onClick={() => setIsMobileDrawerOpen(true)}
            >
              <Icon name="menu" size={18} />
            </IconButton>

            <IconButton
              className="hidden lg:flex"
              label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon name={isSidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={16} />
            </IconButton>

            {/* Global Search Bar matching reference */}
            <button
              ref={searchTriggerRef}
              type="button"
              className="search-bar-unified flex items-center gap-2 px-3 sm:px-4 py-2 bg-rf-surface-subtle border border-rf-border rounded-xl text-xs text-rf-ink-muted hover:border-rf-border-strong transition flex-1 min-w-[120px] max-w-[460px] shadow-2xs cursor-text"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isCommandPaletteOpen}
              aria-label="Search job positions, applicants, activities, notes..."
            >
              <Icon name="search" size={14} className="text-rf-ink-muted shrink-0" />
              <span className="truncate flex-1 text-left">Search job positions, applicants, activities...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-rf-surface border border-rf-border rounded text-rf-ink-muted">
                ⌘ K
              </kbd>
            </button>
          </div>

          <div className="actions flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Help button */}
            <button
              type="button"
              onClick={openGuide}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl bg-rf-surface border border-rf-border text-rf-ink-muted hover:text-rf-ink hover:bg-rf-surface-hover transition shadow-xs text-xs font-bold cursor-pointer"
              title="Page guide"
            >
              ?
            </button>

            {/* History / Clock button */}
            <button
              type="button"
              onClick={() => navigate('/my-work')}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl bg-rf-surface border border-rf-border text-rf-ink-muted hover:text-rf-ink hover:bg-rf-surface-hover transition shadow-xs cursor-pointer"
              title={canViewTasks ? 'Recent Activity & Task Queue' : 'Open My Work'}
              aria-label={canViewTasks ? 'Recent Activity and Task Queue' : 'Open My Work'}
            >
              <Icon name="clock" size={16} />
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <NotificationAlertDialog triggerVariant="icon" />
            </div>

            <ThemeToggle className="hidden sm:flex" />

            <div className="h-6 w-px bg-rf-border mx-0.5 hidden sm:block" aria-hidden="true" />
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      <main className="main" id="main-content" aria-hidden={isMobileDrawerOpen ? 'true' : undefined}>
        <BreadcrumbProvider>
          <BreadcrumbsBar />
          <Outlet />
        </BreadcrumbProvider>
      </main>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <QuickGuideModal />
      <GuidedTourOverlay />
    </div>
  );
}

export function AppShell() {
  return (
    <QuickGuideProvider>
      <AppShellInner />
    </QuickGuideProvider>
  );
}

export default AppShell;
