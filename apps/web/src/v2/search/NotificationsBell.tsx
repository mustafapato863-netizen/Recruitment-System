import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, Info } from 'lucide-react';
import { SkeletonV2 } from '../../components/v2';
import { fetchNotifications, markAllRead, markRead, notificationHref, safeText, type NotificationRecord } from '../api/searchNotify';

export const NOTIFICATIONS_CHANGED = 'rf2:notifications-changed';
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  return h < 48 ? 'Yesterday' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' }).format(new Date(iso));
};

/** E06 bell + panel: GET /notifications, PATCH /:id/read on open, POST /read-all. */
export function NotificationsBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; items: NotificationRecord[] } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  useEffect(() => {
    if (!open) return undefined;
    setState({ kind: 'loading' });
    fetchNotifications(10).then((r) => setState({ kind: 'ready', items: r.data }))
      .catch((e: { statusCode?: number }) => setState({ kind: 'error', message: e?.statusCode === 403 ? 'Your role does not include notifications.' : 'Could not load notifications.' }));
    const onDoc = (e: MouseEvent) => { if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const openItem = async (n: NotificationRecord) => {
    if (!n.readAt) { try { await markRead(n.id); changed(); } catch { /* still navigate */ } }
    const href = notificationHref(n);
    setOpen(false);
    if (href) navigate(href);
  };
  const all = async () => {
    try { await markAllRead(); changed(); setState((s) => (s.kind === 'ready' ? { kind: 'ready', items: s.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) } : s)); }
    catch { setState({ kind: 'error', message: 'Could not mark all as read.' }); }
  };
  const hasUnread = state.kind === 'ready' && state.items.some((n) => !n.readAt);
  return (
    <div className="rf2-bell">
      <button ref={btn} type="button" className="rf2-icon-button" aria-expanded={open} aria-haspopup="dialog" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setOpen((o) => !o)}>
        <Bell aria-hidden="true" />
        {unread > 0 && <span className="rf2-icon-button__badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open ? (
        <div ref={pop} className="rf2-popover rf2-bell__pop" role="dialog" aria-label="Notifications">
          <div className="rf2-bell__head"><h2>Notifications</h2>{hasUnread ? <button type="button" className="rf2-link-btn" onClick={() => void all()}><Check aria-hidden="true" /> Mark all read</button> : null}</div>
          {state.kind === 'loading' ? <SkeletonV2 lines={3} label="Loading notifications…" /> : null}
          {state.kind === 'error' ? <p className="rf2-hsearch__empty" role="alert">{state.message}</p> : null}
          {state.kind === 'ready' && state.items.length === 0 ? <p className="rf2-hsearch__empty">You're all caught up.</p> : null}
          {state.kind === 'ready' && state.items.length ? (
            <ul className="rf2-bell__list">
              {state.items.map((n) => {
                const href = notificationHref(n);
                return (
                  <li key={n.id} data-unread={!n.readAt || undefined}>
                    <button type="button" className="rf2-bell__item" onClick={() => void openItem(n)} aria-describedby={href ? undefined : `nh-${n.id}`}>
                      <span className="rf2-bell__txt">
                        <span className="rf2-jtable__name">{safeText(n.title)}</span>
                        {n.message ? <span className="rf2-bell__msg">{safeText(n.message)}</span> : null}
                        <span className="rf2-jtable__sub">{ago(n.createdAt)}</span>
                      </span>
                      {!n.readAt ? <span className="rf2-bell__new"><Info aria-hidden="true" /> New</span> : null}
                    </button>
                    {href ? null : <span id={`nh-${n.id}`} className="rf2-sr-only">Marks as read; there is no page to open.</span>}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <Link className="rf2-hsearch__all" to="/notifications" onClick={() => setOpen(false)}>See all notifications</Link>
        </div>
      ) : null}
    </div>
  );
}
