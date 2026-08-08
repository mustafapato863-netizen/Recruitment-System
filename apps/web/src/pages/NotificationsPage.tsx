import { useState, useEffect, useCallback } from 'react';
import { getApi, postApi, patchApi } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { StatusBadge } from '../components/StatusBadge';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (unreadOnly) params.set('unreadOnly', 'true');
      const result = await getApi<PaginatedResult<NotificationRecord>>(`/notifications?${params}`);
      setNotifications(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    try {
      const updated = await patchApi<NotificationRecord>(`/notifications/${id}/read`);
      setNotifications((previous) => previous.map((notification) => notification.id === id ? updated : notification));
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to mark the notification as read.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await postApi('/notifications/read-all');
      await load();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <PageFrame
      title="Notifications"
      description={loading ? 'Loading your workspace updates...' : `${total} notification${total !== 1 ? 's' : ''}${unreadCount > 0 ? ` - ${unreadCount} unread` : ''}`}
      actions={<>
        <label className="ui-filter-bar__check">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} />
          Unread only
        </label>
        {unreadCount > 0 && <Button variant="secondary" size="sm" loading={markingAll} loadingLabel="Marking notifications as read" onClick={() => void handleMarkAllRead()}>Mark all as read</Button>}
      </>}
    >
      <div className="ui-metric-grid ui-metric-grid--compact">
        <MetricCard label="Total notifications" value={total} detail="Current result set" tone="action" icon="•" />
        <MetricCard label="Unread" value={unreadCount} detail={unreadOnly ? 'Unread filter enabled' : 'Needs your review'} tone={unreadCount > 0 ? 'warning' : 'success'} icon="!" />
        <MetricCard label="Page" value={page} detail={`of ${Math.max(totalPages, 1)}`} tone="info" icon="≡" />
      </div>

      {error && <Alert className="ui-page-alert" tone="danger" title="Notifications could not be updated">
        {error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void load()}>Retry</Button>
      </Alert>}

      {loading && <PageState kind="loading" title="Loading notifications" description="Checking your latest workspace updates." />}

      {!loading && !error && notifications.length === 0 && <PageState
        kind="empty"
        title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
        description={unreadOnly ? 'Everything is up to date.' : 'New workflow activity will appear here.'}
      />}

      {!loading && notifications.length > 0 && <div className="ui-notification-list">
        {notifications.map((notification) => (
          <article key={notification.id} className={['ui-notification-card', notification.readAt ? 'is-read' : 'is-unread'].join(' ')}>
            <span className="ui-notification-card__dot" aria-hidden="true" />
            <div className="ui-notification-card__body">
              <div className="ui-notification-card__title">{notification.title}</div>
              <p>{notification.message}</p>
              <div className="ui-notification-card__meta">
                <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                <StatusBadge status={notification.type} />
              </div>
            </div>
            {!notification.readAt && <Button variant="secondary" size="sm" loading={markingId === notification.id} loadingLabel="Marking notification as read" onClick={() => void handleMarkRead(notification.id)}>Mark read</Button>}
          </article>
        ))}
      </div>}

      {totalPages > 1 && <div className="ui-pagination">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
        <span>Page {page} of {totalPages}</span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
      </div>}
    </PageFrame>
  );
}

