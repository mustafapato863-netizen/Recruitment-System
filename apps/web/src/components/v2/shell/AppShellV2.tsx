import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, BriefcaseBusiness, CircleCheck, ClipboardList, Columns3, Database, FileText, History,
  ListChecks, LogOut, Plug, Search, Shield, Target, User, UserRound, Users,
} from 'lucide-react';
import type { UserProfile } from '@recruitflow/contracts';
import { getApi } from '../../../api/client';
import { BreadcrumbProvider, useBreadcrumb } from '../../../context/BreadcrumbContext';
import { QuickGuideProvider } from '../../../quickguide';
import { SEAT_LABEL, type Seat } from '../../../v2/seat';
import { NavItem } from '../NavItem';
import { SEAT_NAV, activeNavKey, permittedNavItems, type NavIconName } from './navConfig';
import '../v2-primitives.css';
import './v2-shell.css';

const ICONS: Record<NavIconName, ReactNode> = {
  'my-work': <ListChecks />, jobs: <BriefcaseBusiness />, candidates: <Users />,
  team: <Users />, requisitions: <ClipboardList />, approvals: <CircleCheck />, result: <Target />,
  users: <UserRound />, roles: <Shield />, pipeline: <Columns3 />, 'master-data': <Database />,
  templates: <FileText />, reports: <BarChart3 />, audit: <History />, integrations: <Plug />,
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
    return () => { alive = false; window.removeEventListener('focus', load); };
  }, [enabled]);
  return count;
}

function UserMenu({ user, seat, onSignOut }: { user: UserProfile; seat: Seat; onSignOut: () => void }) {
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
        </div>
      )}
    </div>
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
  const { customLabels } = useBreadcrumb();
  const isAdministrator = (user.roles ?? []).some((r) => r.code === 'ADMINISTRATOR');
  const items = permittedNavItems(seat, user.permissions, isAdministrator);
  const activeKey = activeNavKey(items, location.pathname, location.hash);
  const canSeeNotifications = isAdministrator || (user.permissions ?? []).includes('NOTIFICATION_VIEW');
  const unread = useUnreadCount(true);
  const config = SEAT_NAV[seat];
  const title = items.find((i) => i.key === activeKey)?.label ?? customLabels[location.pathname] ?? humanize(location.pathname);
  const headingId = useId();

  return (
    <div className="rf2-shell" data-seat={seat}>
      <a className="rf2-skip-link" href="#rf2-main">Skip to main content</a>
      <aside className="rf2-shell__sidebar">
        <div className="rf2-brand">
          <span className="rf2-brand__mark" aria-hidden="true">R</span>
          <span className="rf2-brand__text">
            <span className="rf2-brand__name">RecruitFlow</span>
            <span className="rf2-brand__sub">Recruiting Operations</span>
          </span>
        </div>
        <p className="rf2-shell__heading" id={headingId}>{config.heading}</p>
        <nav aria-labelledby={headingId} className="rf2-shell__nav">
          <ul className="rf2-nav-list">
            {items.map((item) => (
              <li key={item.key}>
                <NavItem asChild label={item.label} icon={ICONS[item.icon]} active={item.key === activeKey}>
                  {/* Link, not NavLink: aria-current is decided once by activeNavKey (hash-aware). */}
                  <Link to={item.to} />
                </NavItem>
              </li>
            ))}
          </ul>
        </nav>
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
          <button type="button" className="rf2-search-entry" aria-label={`${config.searchPlaceholder} (coming soon)`} aria-disabled="true" title="Search arrives in a later release">
            <Search aria-hidden="true" />
            <span>{config.searchPlaceholder}</span>
          </button>
          {canSeeNotifications ? (
            <NavLink
              to="/notifications"
              className="rf2-icon-button"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <Bell aria-hidden="true" />
              {unread > 0 && <span className="rf2-icon-button__badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
          ) : null}
          <UserMenu user={user} seat={seat} onSignOut={onSignOut} />
        </header>
        <main id="rf2-main" className="rf2-shell__content" tabIndex={-1}>
          {children ?? <Outlet />}
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
        <ShellFrame {...props} />
      </BreadcrumbProvider>
    </QuickGuideProvider>
  );
}
