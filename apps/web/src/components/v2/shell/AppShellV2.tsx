import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, BriefcaseBusiness, CalendarCheck, CalendarClock, CheckCircle2, ClipboardList, Columns3, Database, FileText, History,
  KeyRound, ListChecks, LogOut, Menu, Moon, Sun, PanelLeftClose, PanelLeftOpen, Plug, Shield, Target, User, UserCheck, UserRound, Users, X,
  Archive } from 'lucide-react';
import type { UserProfile } from '@recruitflow/contracts';
import { getApi } from '../../../api/client';
import { BreadcrumbProvider, useBreadcrumb } from '../../../context/BreadcrumbContext';
import { QuickGuideModal, QuickGuideProvider } from '../../../quickguide';
import { SEAT_LABEL, type Seat, availableWorkspaceSeats } from '../../../v2/seat';
import { canUseRequisitions, isInterviewerOnly, specialHome, isRecruiterOnly, SEAT_HOME, v2Redirect } from '../../../v2/destinations';
import { NavItem } from '../NavItem';
import { canUseMyInterviews } from '../../../auth/interviewer';
import { ADMIN_GROUP_ROUTES, SEAT_NAV, activeNavKey, permittedNavItems, type NavIconName } from './navConfig';
import { useTheme } from '../../../theme/ThemeContext';
import { useMediaQuery } from '../../ui/useMediaQuery';
import { GlobalSelectEnhancer } from '../../ui/GlobalSelectEnhancer';
import { SghHeartIcon } from '../../../design-system/brand/sgh-logo';
import '../v2-primitives.css';
import './v2-shell.css';
import { HeaderSearch } from '../../../v2/search/HeaderSearch';
import { NotificationsBell, NOTIFICATIONS_CHANGED } from '../../../v2/search/NotificationsBell';
import '../../../v2/search/search.css';
import { formatPersonName, getInitials } from '../../../v2/userIdentity';
import { preloadRouteChunk, scheduleIdleRoutePreload } from '../../../v2/routePreload';

const ICONS: Record<NavIconName, ReactNode> = {
  'my-work': <ListChecks />, interviews: <CalendarCheck />, 'my-interviews': <CalendarClock />, jobs: <BriefcaseBusiness />, candidates: <Users />,
  team: <Users />, requisitions: <ClipboardList />, approvals: <CheckCircle2 />, joinings: <UserCheck />, result: <Target />,
  users: <UserRound />, roles: <Shield />, licenses: <KeyRound />, pipeline: <Columns3 />, 'master-data': <Database />,
  templates: <FileText />, reports: <BarChart3 />, audit: <History />, integrations: <Plug />, classic: <Archive />,
};

export const initials = getInitials;

function humanize(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return 'Home';
  return seg.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** GET /notifications/unread-count → { unreadCount }. Refreshes on focus. */
export function useUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => {
      void getApi<{ unreadCount?: number }>('/notifications/unread-count')
        .then((res) => { if (alive) setCount(Number.isFinite(res?.unreadCount) ? Number(res.unreadCount) : 0); })
        .catch(() => { /* bell just shows no badge */ });
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => { alive = false; window.removeEventListener('focus', load); window.removeEventListener(NOTIFICATIONS_CHANGED, load); };
  }, [enabled]);
  return count;
}

function UserMenu({ user, seat, availableSeats, onSignOut, onWorkspaceChange }: {
  user: UserProfile;
  seat: Seat;
  availableSeats: Seat[];
  onSignOut: () => void;
  onWorkspaceChange: (seat: Seat) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = (focusButton = true) => { setOpen(false); if (focusButton) buttonRef.current?.focus(); };
  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="rf2-user-menu">
      <button
        ref={buttonRef}
        type="button"
        className="rf2-user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rf2-avatar" aria-hidden="true">{initials(user.displayName)}</span>
        <span className="rf2-user-menu__text">
          <span className="rf2-user-menu__name">{formatPersonName(user.displayName)}</span>
          <span className="rf2-user-menu__seat">{SEAT_LABEL[seat]}</span>
        </span>
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label="Account" className="rf2-user-menu__menu" onKeyDown={onMenuKey}>
          <div className="rf2-user-menu__head" role="presentation">
            <span className="rf2-user-menu__name">{formatPersonName(user.displayName)}</span>
            <span className="rf2-user-menu__seat">{SEAT_LABEL[seat]} · {user.email}</span>
          </div>
          <button type="button" role="menuitem" className="rf2-user-menu__item" onClick={() => { close(false); navigate('/profile'); }}>
            <User aria-hidden="true" /> Profile
          </button>
          <button type="button" role="menuitem" className="rf2-user-menu__item" onClick={() => { close(false); onSignOut(); }}>
            <LogOut aria-hidden="true" /> Sign out
          </button>
          <button type="button" role="menuitem" className="rf2-user-menu__item" onClick={() => { toggleTheme(); close(); }}>
            {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />} Switch to {theme === 'light' ? 'dark' : 'light'} mode
          </button>
          {availableSeats.length > 1 ? (
            <div className="rf2-user-menu__workspaces" role="group" aria-label="Workspace switcher">
              <span className="rf2-user-menu__section">Switch workspace</span>
              {availableSeats.map((option) => (
                <button key={option} type="button" role="menuitem" className="rf2-user-menu__item"
                  aria-current={option === seat ? 'page' : undefined}
                  onClick={() => { close(); if (option !== seat) { onWorkspaceChange(option); navigate(SEAT_HOME[option]); } }}>
                  {SEAT_LABEL[option]} workspace{option === seat ? ' · Current' : ''}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}


/** Which seat the v2 shell is rendering for (null outside the v2 shell). */
type V2ShellContextValue = { seat: Seat; setApprovalsCount: (count: number | null) => void };
const V2ShellContext = createContext<V2ShellContextValue | null>(null);
export function useV2Shell() { return useContext(V2ShellContext); }

/** Below 1024px the sidebar is always the icon rail, so the page keeps its width and the header title stays visible. */
export const NARROW_QUERY = '(max-width: 1023px)';
/** Below 1280px a daily seat replaces the header links with a menu. Desktop keeps the bar. */
export const TOPNAV_MENU_QUERY = '(max-width: 1279px)';
export function useNarrowViewport(): boolean {
  const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null);
  const [narrow, setNarrow] = useState<boolean>(() => query()?.matches ?? false);
  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

export const SIDEBAR_STORAGE_KEY = 'recruitflow.ui.v2.sidebar';

/** Collapsed icon rail, persisted in localStorage. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed'; } catch { return false; }
  });
  const toggle = () => setCollapsed((prev) => {
    const next = !prev;
    try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded'); } catch { /* storage unavailable */ }
    return next;
  });
  return [collapsed, toggle];
}

export interface AppShellV2Props {
  user: UserProfile;
  seat: Seat;
  onSignOut: () => void;
  children?: ReactNode;
}

const ACTIVE_WORKSPACE_STORAGE_KEY = 'recruitflow.ui.v2.activeWorkspace';

function storedWorkspaceSeat(userId: string, fallback: Seat, availableSeats: readonly Seat[]): Seat {
  try {
    const stored = window.localStorage.getItem(`${ACTIVE_WORKSPACE_STORAGE_KEY}.${userId}`);
    return availableSeats.includes(stored as Seat) ? stored as Seat : fallback;
  } catch {
    return fallback;
  }
}

type ShellFrameProps = AppShellV2Props & {
  availableSeats: Seat[];
  approvalCount: number | null;
  onWorkspaceChange: (seat: Seat) => void;
};

function ShellFrame({ user, seat, onSignOut, children, availableSeats, approvalCount, onWorkspaceChange }: ShellFrameProps) {
  const location = useLocation();
  // B2-17/18: "/" goes to the seat's home; v1 pages the seat can't use redirect to their v2 equivalent.
  const redirectTo = v2Redirect(seat, `${location.pathname}${location.search}`, { requisitions: canUseRequisitions(user), interviews: canUseMyInterviews(user), interviewerOnly: isInterviewerOnly(user, canUseMyInterviews(user)), home: specialHome(user), permissions: user.permissions ?? [], isAdministrator: (user.roles ?? []).some((r) => r.code === 'ADMINISTRATOR') });
  // A same-path target (adding ?drawer=) must not replace the outlet. Navigate would run again on the next pathname check and the page would never mount.
  const redirectPath = redirectTo?.split('?')[0];
  const leavesPage = Boolean(redirectTo) && redirectPath !== location.pathname;
  const { customLabels } = useBreadcrumb();
  const isAdministrator = (user.roles ?? []).some((r) => r.code === 'ADMINISTRATOR');
  const interviewerOnly = isInterviewerOnly(user, canUseMyInterviews(user));
  const allItems = permittedNavItems(seat, user.permissions, isAdministrator, isRecruiterOnly(user.roles), canUseMyInterviews(user));
  const sidebarItems = interviewerOnly ? allItems.filter((item) => item.key === 'my-work' || item.key === 'my-interviews') : allItems;
  const allNavigation = sidebarItems;
  const activeKey = activeNavKey(allNavigation, location.pathname, location.hash);
  const activeItem = allNavigation.find((item) => item.key === activeKey);
  const canSeeNotifications = isAdministrator || (user.permissions ?? []).includes('NOTIFICATION_VIEW');
  const unread = useUnreadCount(true);
  const config = SEAT_NAV[seat];
  const title = allNavigation.find((i) => i.key === activeKey)?.label ?? customLabels[location.pathname] ?? humanize(location.pathname);
  const adminGroup = seat === 'admin'
    ? ADMIN_GROUP_ROUTES.find((entry) => location.pathname === entry.to || location.pathname.startsWith(`${entry.to}/`))?.group
    : undefined;
  const breadcrumbTitle = activeItem?.group ?? adminGroup ?? title;
  const headingId = useId();
  const sidebarId = useId();
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storedCollapsed, toggleCollapsed] = useSidebarCollapsed();
  const narrow = useNarrowViewport();
  const menuViewport = useMediaQuery(TOPNAV_MENU_QUERY);
  const topNav = false;
  const compactNav = topNav && menuViewport;
  const collapsed = !topNav && (storedCollapsed || narrow);
  const { theme, toggleTheme } = useTheme();
  const homeTo = sidebarItems[0]?.to ?? '/my-work';
  const pageTitle = (
    <nav className="rf2-shell__breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>{SEAT_LABEL[seat]} Workspace</li>
        <li aria-current="page">{breadcrumbTitle}</li>
      </ol>
    </nav>
  );

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.hash]);
  const sidebarPathsKey = sidebarItems.map((item) => item.to).join('|');
  useEffect(() => {
    if (!sidebarPathsKey) return undefined;
    return scheduleIdleRoutePreload(sidebarPathsKey.split('|'));
  }, [sidebarPathsKey]);
  useEffect(() => { if (!compactNav) setMenuOpen(false); }, [compactNav]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuButtonRef.current?.contains(target) || menuPanelRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const headerTools = (
    <>
      <HeaderSearch placeholder={config.searchPlaceholder} meId={user.id} />
      <div className="rf2-shell__actions">
        <button type="button" className="rf2-icon-button" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Dark mode' : 'Light mode'} onClick={toggleTheme}>
          {theme === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        {canSeeNotifications ? <NotificationsBell unread={unread} /> : null}
        <UserMenu user={user} seat={seat} availableSeats={availableSeats} onSignOut={onSignOut} onWorkspaceChange={onWorkspaceChange} />
      </div>
    </>
  );
  const navLinks = (
    <ul className={topNav ? 'rf2-shell__links' : 'rf2-nav-list'}>
      {sidebarItems.map((item) => (
        <li key={item.key}>
          <NavItem asChild label={item.label} icon={ICONS[item.icon]} active={item.key === activeKey} title={collapsed ? item.label : undefined}
            badge={item.key === 'approvals' ? approvalCount ?? undefined : undefined} badgeLabel={item.key === 'approvals' ? `${approvalCount ?? 0} waiting on you` : undefined}>
            {/* Link, not NavLink: aria-current is decided once by activeNavKey (hash-aware). */}
            <Link to={item.to} onMouseEnter={() => preloadRouteChunk(item.to)} onFocus={() => preloadRouteChunk(item.to)} />
          </NavItem>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`rf2-shell${collapsed ? ' rf2-shell--collapsed' : ''}${topNav ? ' rf2-shell--topnav' : ''}${compactNav ? ' rf2-shell--menu' : ''}`} data-seat={seat}>
      <a className="rf2-skip-link" href="#rf2-main">Skip to main content</a>
      {topNav ? null : (
      <aside className="rf2-shell__sidebar" id={sidebarId}>
        <div className="rf2-brand">
          <Link to={homeTo} className="rf2-brand__home" aria-label={`RecruitFlow, ${user.organizationName || 'Saudi German Health'}`}>
            <span className="rf2-brand__mark" aria-hidden="true"><SghHeartIcon size={30} /></span>
            <span className="rf2-brand__text">
              <span className="rf2-brand__name">RecruitFlow</span>
              <span className="rf2-brand__sub">{user.organizationName || 'Saudi German Health'}</span>
            </span>
          </Link>
          <button type="button" className="rf2-collapse" hidden={narrow} aria-controls={sidebarId} aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleCollapsed}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        </div>
        <p className="rf2-shell__heading" id={headingId}>{config.heading}</p>
        <nav aria-labelledby={headingId} className="rf2-shell__nav">
          {navLinks}
        </nav>
      </aside>
      )}
      <div className="rf2-shell__main">
        <header className="rf2-shell__header">
          {topNav ? (
            <>
              <div className="rf2-shell__lead">
                <Link to={homeTo} className="rf2-brand rf2-brand--bar" aria-label={`RecruitFlow, ${user.organizationName || 'Saudi German Health'}`}>
                  <span className="rf2-brand__mark" aria-hidden="true"><SghHeartIcon size={28} /></span>
                  <span className="rf2-brand__text">
                    <span className="rf2-brand__name">RecruitFlow</span>
                    <span className="rf2-brand__sub">{user.organizationName || 'Saudi German Health'}</span>
                  </span>
                </Link>
                {compactNav ? (
                  <button
                    ref={menuButtonRef}
                    type="button"
                    className="rf2-icon-button rf2-shell__menu-button"
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? menuId : undefined}
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                  </button>
                ) : null}
              </div>
              {compactNav ? (menuOpen ? (
                <nav
                  ref={menuPanelRef}
                  id={menuId}
                  aria-label={config.heading}
                  className="rf2-shell__nav rf2-shell__nav--sheet"
                  onClick={(event) => { if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false); }}
                >
                  {navLinks}
                </nav>
              ) : null) : (
                <nav aria-label={config.heading} className="rf2-shell__nav rf2-shell__nav--bar">
                  {navLinks}
                </nav>
              )}
              <div className="rf2-shell__end">
                {pageTitle}
                {headerTools}
              </div>
            </>
          ) : (
            <>
              {pageTitle}
              {headerTools}
            </>
          )}
        </header>
        <main id="rf2-main" className="rf2-shell__content" tabIndex={-1}>
          {children ?? (leavesPage && redirectTo ? <Navigate to={redirectTo} replace /> : <Outlet />)}
        </main>
      </div>
    </div>
  );
}

/** v2 shell (F4). Wraps the existing pages unchanged. */
export function AppShellV2(props: AppShellV2Props) {
  const availableSeats = useMemo(() => availableWorkspaceSeats(props.user), [props.user]);
  const [seat, setSeat] = useState(() => storedWorkspaceSeat(props.user.id, props.seat, availableSeats));
  const [approvalCount, setApprovalCount] = useState<number | null>(null);

  useEffect(() => {
    setSeat(storedWorkspaceSeat(props.user.id, props.seat, availableWorkspaceSeats(props.user)));
  }, [props.user, props.seat, availableSeats]);

  const switchWorkspace = (next: Seat) => {
    if (!availableSeats.includes(next)) return;
    try { window.localStorage.setItem(`${ACTIVE_WORKSPACE_STORAGE_KEY}.${props.user.id}`, next); } catch { /* preference is optional */ }
    setSeat(next);
  };

  return (
    <QuickGuideProvider>
      <BreadcrumbProvider>
        <V2ShellContext.Provider value={{ seat, setApprovalsCount: setApprovalCount }}>
          <ShellFrame {...props} seat={seat} availableSeats={availableSeats} approvalCount={approvalCount} onWorkspaceChange={switchWorkspace} />
        </V2ShellContext.Provider>
        <GlobalSelectEnhancer />
        <QuickGuideModal />
      </BreadcrumbProvider>
    </QuickGuideProvider>
  );
}
