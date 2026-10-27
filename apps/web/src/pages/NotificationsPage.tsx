import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../api/client';
import { notificationHref } from '../v2/api/searchNotify';
import type { IconName } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Pagination } from '../components/ui/Pagination';
import { ButtonV2 } from '../components/v2/Button';
import { EmptyStateV2, SkeletonV2 } from '../components/v2/PageStates';
import { TabsV2, type TabV2Item } from '../components/v2/Tabs';
import { useSetBreadcrumbTitle } from '../context/BreadcrumbContext';
import type { StatusTone } from '../components/StatusBadge';
import './notifications.css';

type FilterCategory = 'all' | 'unread' | 'alerts' | 'approvals';

type NotificationPresentation = {
  category: string;
  tone: StatusTone;
  icon: IconName;
};

function getNotificationPresentation(notification: NotificationRecord): NotificationPresentation {
  const signal = `${notification.type} ${notification.title} ${notification.message} ${notification.entityType ?? ''}`.toLowerCase();

  if (/financial|finance|salary|compensation|budget/.test(signal)) {
    return { category: 'Finance', tone: 'danger', icon: 'alert-triangle' };
  }
  if (/approval|approve|pending|review|decision|sign-off/.test(signal)) {
    return { category: 'Approval', tone: 'warning', icon: 'inbox' };
  }
  if (/compliance|security|system|alert|integration|warning/.test(signal)) {
    return { category: 'System', tone: 'danger', icon: 'alert-triangle' };
  }
  if (/interview|calendar|schedule|slot/.test(signal)) {
    return { category: 'Interview', tone: 'purple', icon: 'calendar-clock' };
  }
  if (/candidate|talent|application|hiring/.test(signal)) {
    return { category: 'Recruitment', tone: 'success', icon: 'users' };
  }
  return { category: notification.entityType ?? 'Workspace', tone: 'info', icon: 'bell' };
}

function getNotificationHref(notification: NotificationRecord): string | null {
  return notificationHref(notification);
}

function formatRelativeTime(value: string): string {
  const delta = new Date(value).getTime() - Date.now();
  const absoluteDelta = Math.abs(delta);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ];

  if (absoluteDelta < 60 * 1000) return 'Just now';
  const [unit, milliseconds] = units.find(([, threshold]) => absoluteDelta >= threshold) ?? ['minute', 60 * 1000];
  const valueInUnit = Math.round(delta / milliseconds);
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(valueInUnit, unit);
}

export function NotificationsPage() {
  useSetBreadcrumbTitle('Notification Center');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (activeCategory === 'unread') {
        params.set('unreadOnly', 'true');
      }
      const [result, unreadResult] = await Promise.all([
        getApi<PaginatedResult<NotificationRecord>>(`/notifications?${params}`),
        getApi<{ unreadCount: number }>('/notifications/unread-count'),
      ]);
      setNotifications(result.data);
      setTotal(result.total);
      setUnreadCount(unreadResult.unreadCount);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, activeCategory]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    try {
      const updated = await patchApi<NotificationRecord>(`/notifications/${id}/read`);
      setNotifications((previous) => previous.map((n) => (n.id === id ? updated : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
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
      setUnreadCount(0);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'unread') {
      return notifications.filter((n) => !n.readAt);
    }
    if (activeCategory === 'alerts') {
      return notifications.filter((n) => {
        const pres = getNotificationPresentation(n);
        return pres.tone === 'danger' || /alert|security|system/i.test(n.type);
      });
    }
    if (activeCategory === 'approvals') {
      return notifications.filter((n) => {
        const pres = getNotificationPresentation(n);
        return pres.tone === 'warning' || /approval|pending|offer|request/i.test(n.type);
      });
    }
    return notifications;
  }, [notifications, activeCategory]);

  const systemAlertsCount = useMemo(() => {
    return notifications.filter((n) => {
      const pres = getNotificationPresentation(n);
      return pres.tone === 'danger' || /alert|security|system/i.test(n.type);
    }).length;
  }, [notifications]);

  const pendingApprovalsCount = useMemo(() => {
    return notifications.filter((n) => {
      const pres = getNotificationPresentation(n);
      return pres.tone === 'warning' || /approval|pending|offer|request/i.test(n.type);
    }).length;
  }, [notifications]);

  const totalPages = Math.ceil(total / pageSize);
  const filters: TabV2Item[] = [
    { key: 'all', label: `All Notifications ${total}` },
    { key: 'unread', label: unreadCount > 0 ? `Unread Only ${unreadCount}` : 'Unread Only' },
    { key: 'alerts', label: systemAlertsCount > 0 ? `System Alerts ${systemAlertsCount}` : 'System Alerts' },
    { key: 'approvals', label: pendingApprovalsCount > 0 ? `Pending Approvals ${pendingApprovalsCount}` : 'Pending Approvals' },
  ];

  return (
    <div className="rf2-notify">
      <p className="rf2-notify__subtitle">Stay updated with cross-system alerts, approvals, and workflow events</p>
      <div className="rf2-notify__bar">
        <TabsV2
          items={filters}
          activeKey={activeCategory}
          ariaLabel="Notification filters"
          onChange={(key) => {
            setActiveCategory(key as FilterCategory);
            setPage(1);
          }}
        />
        <div className="rf2-notify__actions">
          {unreadCount > 0 ? (
            <ButtonV2 kind="secondary" size="sm" loading={markingAll} loadingLabel="Marking all" onClick={() => void handleMarkAllRead()}>
              Mark all as read
            </ButtonV2>
          ) : null}
          <ButtonV2 kind="secondary" size="sm" aria-label="Refresh notifications" title="Refresh notifications" icon={<RefreshCw className={loading ? 'rf2-spin' : undefined} />} onClick={() => void load()} />
        </div>
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="Notifications could not be updated"
          action={<ButtonV2 kind="secondary" size="sm" icon={<RefreshCw />} onClick={() => void load()}>Retry</ButtonV2>}
        >
          {error}
        </Alert>
      ) : null}

      {loading ? <SkeletonV2 lines={4} label="Loading notifications" /> : null}

      {!loading && !error && filteredNotifications.length === 0 ? (
        <EmptyStateV2
          title={activeCategory === 'unread' ? 'You’re all caught up!' : 'No notifications in this view'}
          body={activeCategory === 'unread'
            ? 'There are no unread updates waiting for your review.'
            : 'New approvals, system alerts, and workflow events will appear here.'}
          action={activeCategory !== 'all' ? (
            <ButtonV2
              kind="secondary"
              size="sm"
              onClick={() => {
                setActiveCategory('all');
                setPage(1);
              }}
            >
              Show all notifications
            </ButtonV2>
          ) : undefined}
        />
      ) : null}

      {!loading && filteredNotifications.length > 0 ? (
        <div className="rf2-notify__surface">
          <ul className="rf2-notify__list" aria-live="polite">
            {filteredNotifications.map((notification) => {
              const presentation = getNotificationPresentation(notification);
              const href = getNotificationHref(notification);
              const isUnread = !notification.readAt;
              return (
                <li key={notification.id}>
                  <article className="rf2-notify__item" data-unread={isUnread ? 'true' : 'false'}>
                    <h2 className="rf2-notify__title">{notification.title}</h2>
                    {isUnread ? <span className="rf2-sr-only">Unread notification</span> : null}
                    <p className="rf2-notify__message">{notification.message}</p>
                    <div className="rf2-notify__meta">
                      <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                      <span className="rf2-notify__category">{presentation.category}</span>
                      <div className="rf2-notify__controls">
                        {href ? <Link className="rf2-btn rf2-btn--tertiary rf2-btn--sm" to={href}><span>Open details</span></Link> : null}
                        {isUnread ? (
                          <ButtonV2 kind="tertiary" size="sm" disabled={markingId === notification.id} onClick={() => void handleMarkRead(notification.id)}>
                            {markingId === notification.id ? 'Marking...' : 'Mark as read'}
                          </ButtonV2>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <Pagination
          ariaLabel="Notification pages"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={loading}
          summary={`${total} notifications`}
        />
      ) : null}
    </div>
  );
}
