import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, BriefcaseBusiness, Building2, ChevronsUpDown, CircleHelp, ClipboardList, Columns3, Database, FileText, History,
  ListChecks, LogOut, Moon, Sun, PanelLeftClose, PanelLeftOpen, Plug, Shield, Target, User, UserRound, Users,
  CalendarCheck, Archive } from 'lucide-react';
import type { UserProfile } from '@recruitflow/contracts';
import { getApi } from '../../../api/client';
import { BreadcrumbProvider, useBreadcrumb } from '../../../context/BreadcrumbContext';
import { QuickGuideModal, QuickGuideProvider, useQuickGuide } from '../../../quickguide';
import { SEAT_LABEL, type Seat } from '../../../v2/seat';
import { canUseRequisitions, isInterviewerOnly, specialHome, isRecruiterOnly, v2Redirect } from '../../../v2/destinations';
import { NavItem } from '../NavItem';
import { canUseMyInterviews } from '../../../auth/interviewer';
import { SEAT_NAV, activeNavKey, permittedClassicItems, permittedNavItems, type NavIconName } from './navConfig';
import { workspaceOptions, type WorkspaceOption } from './workspace';
import { useTheme } from '../../../theme/ThemeContext';
import { SghHeartIcon } from '../../../design-system/brand/sgh-logo';
import '../v2-primitives.css';
import './v2-shell.css';
import { HeaderSearch } from '../../../v2/search/HeaderSearch';
import { NotificationsBell, NOTIFICATIONS_CHANGED } from '../../../v2/search/NotificationsBell';
import '../../../v2/search/search.css';

const ICONS: Record<NavIconName, ReactNode> = {
  'my-work': <ListChecks />, interviews: <CalendarCheck />, jobs: <BriefcaseBusiness />, candidates: <Users />,
  team: <Users />, requisitions: <ClipboardList />, result: <Target />,
  users: <UserRound />, roles: <Shield />, pipeline: <Columns3 />, 'master-data': <Database />,
  templates: <FileText />, reports: <BarChart3 />, audit: <History />, integrations: <Plug />, classic: <Archive />,
};

export function initials(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

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

function UserMenu({ user, seat, onSignOut }: { user: UserProfile; seat: Seat; onSignOut: () => void }) {
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
          <span className="rf2-user-menu__name">{user.displayName}</span>
          <span className="rf2-user-menu__seat">{SEAT_LABEL[seat]}</span>
        </span>
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label="Account" className="rf2-user-menu__menu" onKeyDown={onMenuKey}>
          <div className="rf2-user-menu__head" role="presentation">
            <span className="rf2-user-menu__name">{user.displayName}</span>
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
        </div>
      )}
    </div>
  );
}


/** Which seat the v2 shell is rendering for (null outside the v2 shell). */
const V2ShellContext = createContext<{ seat: Seat } | null>(null);
export function useV2Shell() { return useContext(V2ShellContext); }

/** Below 1024px the sidebar is always the icon rail, so the page keeps its width and the header title stays visible. */
export const NARROW_QUERY = '(max-width: 1023px)';
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

/** E01 workspace block: a switcher only when /auth/me lists more than one org/department; otherwise a static label. */
function WorkspaceBlock({ options, collapsed }: { options: WorkspaceOption[]; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current = options.find((o) => o.current) ?? options[0];
  if (!current) return null;
  if (options.length <= 1) {
    return (
      <div className="rf2-workspace" data-testid="workspace-label" title={collapsed ? current.label : undefined}>
        <Building2 aria-hidden="true" />
        <span className="rf2-workspace__text">
          <span className="rf2-workspace__name">{current.label}</span>
          {current.detail ? <span className="rf2-workspace__detail">{current.detail}</span> : null}
        </span>
      </div>
    );
  }
  return (
    <div className="rf2-workspace-switcher">
      <button type="button" className="rf2-workspace rf2-workspace--button" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-label={`Workspace: ${current.label}. Change workspace`} onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        <Building2 aria-hidden="true" />
        <span className="rf2-workspace__text">
          <span className="rf2-workspace__name">{current.label}</span>
          {current.detail ? <span className="rf2-workspace__detail">{current.detail}</span> : null}
        </span>
        <ChevronsUpDown aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label="Workspaces" className="rf2-workspace__list">
          {options.map((o) => (
            <li key={o.id} role="option" aria-selected={Boolean(o.current)} aria-disabled={!o.current}
              title={o.current ? undefined : 'Switching workspace needs the backend; not available yet'}
              className="rf2-workspace__option">{o.label}{o.detail ? ` · ${o.detail}` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HelpButton() {
  const { openGuide } = useQuickGuide();
  return (
    <button type="button" className="rf2-icon-button" aria-label="Help: open the quick guide for this page" title="Help" onClick={openGuide}>
      <CircleHelp aria-hidden="true" />
    </button>
  );
}

export interface AppShellV2Props {
  user: UserProfile;
  seat: Seat;
  onSignOut: () => void;
  children?: ReactNode;
}

function ShellFrame({ user, seat, onSignOut, children }: AppShellV2Props) {
  const location = useLocation();
  // B2-17/18: "/" goes to the seat's home; v1 pages the seat can't use redirect to their v2 equivalent.
  const redirectTo = v2Redirect(seat, location.pathname, { requisitions: canUseRequisitions(user), interviews: canUseMyInterviews(user), interviewerOnly: isInterviewerOnly(user, canUseMyInterviews(user)), home: specialHome(user), permissions: user.permissions ?? [], isAdministrator: (user.roles ?? []).some((r) => r.code === 'ADMINISTRATOR') });
  const { customLabels } = useBreadcrumb();
  const isAdministrator = (user.roles ?? []).some((r) => r.code === 'ADMINISTRATOR');
  const items = permittedNavItems(seat, user.permissions, isAdministrator, isRecruiterOnly(user.roles), canUseMyInterviews(user));
  const classic = permittedClassicItems(user.permissions, isAdministrator, isInterviewerOnly(user, canUseMyInterviews(user)));
  const activeKey = activeNavKey(items, location.pathname, location.hash);
  const classicKey = activeKey ? undefined : activeNavKey(classic, location.pathname, location.hash);
  const canSeeNotifications = isAdministrator || (user.permissions ?? []).includes('NOTIFICATION_VIEW');
  const unread = useUnreadCount(true);
  const config = SEAT_NAV[seat];
  const title = items.find((i) => i.key === activeKey)?.label ?? customLabels[location.pathname] ?? humanize(location.pathname);
  const headingId = useId();
  const sidebarId = useId();
  const [storedCollapsed, toggleCollapsed] = useSidebarCollapsed();
  const narrow = useNarrowViewport();
  const collapsed = storedCollapsed || narrow;
  const workspaces = workspaceOptions(user);

  return (
    <div className={`rf2-shell${collapsed ? ' rf2-shell--collapsed' : ''}`} data-seat={seat}>
      <a className="rf2-skip-link" href="#rf2-main">Skip to main content</a>
      <aside className="rf2-shell__sidebar" id={sidebarId}>
        <div className="rf2-brand">
          <span className="rf2-brand__mark" aria-hidden="true"><SghHeartIcon size={30} /></span>
          <span className="rf2-brand__text">
            <span className="rf2-brand__name">RecruitFlow</span>
            <span className="rf2-brand__sub">Saudi German Health</span>
          </span>
          <button type="button" className="rf2-collapse" hidden={narrow} aria-controls={sidebarId} aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleCollapsed}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        </div>
        <WorkspaceBlock options={workspaces} collapsed={collapsed} />
        <p className="rf2-shell__heading" id={headingId}>{config.heading}</p>
        <nav aria-labelledby={headingId} className="rf2-shell__nav">
          <ul className="rf2-nav-list">
            {items.map((item) => (
              <li key={item.key}>
                <NavItem asChild label={item.label} icon={ICONS[item.icon]} active={item.key === activeKey} title={collapsed ? item.label : undefined}>
                  {/* Link, not NavLink: aria-current is decided once by activeNavKey (hash-aware). */}
                  <Link to={item.to} />
                </NavItem>
              </li>
            ))}
          </ul>
        </nav>
        {classic.length ? (
          <nav aria-labelledby={`${headingId}-classic`} className="rf2-shell__nav">
            <p className="rf2-shell__heading" id={`${headingId}-classic`}>More (classic)</p>
            <ul className="rf2-nav-list">
              {classic.map((item) => (
                <li key={item.key}>
                  <NavItem asChild label={item.label} icon={ICONS.classic} active={item.key === classicKey} title={collapsed ? item.label : undefined}>
                    <Link to={item.to} />
                  </NavItem>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="rf2-shell__account" aria-label="Signed in as">
          <span className="rf2-avatar rf2-avatar--sm" aria-hidden="true">{initials(user.displayName)}</span>
          <span className="rf2-shell__account-text">
            <span className="rf2-shell__account-name">{user.displayName}</span>
            <span className="rf2-shell__account-seat">{SEAT_LABEL[seat]}</span>
          </span>
        </div>
      </aside>
      <div className="rf2-shell__main">
        <header className="rf2-shell__header">
          <h1 className="rf2-shell__title">{title}</h1>
          <HeaderSearch placeholder={config.searchPlaceholder} meId={user.id} />
          <HelpButton />
          {canSeeNotifications ? (
            <NotificationsBell unread={unread} />
          ) : null}
          <UserMenu user={user} seat={seat} onSignOut={onSignOut} />
        </header>
        <main id="rf2-main" className="rf2-shell__content" tabIndex={-1}>
          {children ?? (redirectTo ? <Navigate to={redirectTo} replace /> : <Outlet />)}
        </main>
      </div>
    </div>
  );
}

/** v2 shell (F4). Wraps the existing pages unchanged. */
export function AppShellV2(props: AppShellV2Props) {
  return (
    <QuickGuideProvider>
      <BreadcrumbProvider>
        <V2ShellContext.Provider value={{ seat: props.seat }}>
          <ShellFrame {...props} />
        </V2ShellContext.Provider>
        <QuickGuideModal />
      </BreadcrumbProvider>
    </QuickGuideProvider>
  );
}
