import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../api/client';
import { Icon, type IconName } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ClickSpark } from '../components/ui/ClickSpark';
import type { StatusTone } from '../components/StatusBadge';

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
  if (!notification.entityId) return null;

  const routes: Record<string, string> = {
    VacancyRequest: `/vacancy-requests/${notification.entityId}`,
    Vacancy: `/vacancies/${notification.entityId}`,
    Candidate: `/candidates/${notification.entityId}`,
    Application: `/applications/${notification.entityId}`,
    Interview: `/interviews/${notification.entityId}`,
    Offer: `/offers/${notification.entityId}`,
    HiringCase: `/hires/${notification.entityId}`,
  };

  return notification.entityType ? routes[notification.entityType] ?? null : null;
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

  return (
    <ClickSpark
      className="w-full"
      sparkColor="var(--color-action)"
      sparkRadius={20}
      sparkCount={8}
      duration={400}
    >
      <div className="relative min-h-[calc(100vh-var(--header))] w-full px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto flex flex-col gap-6">
        {/* Subtle atmospheric dot grid background layer */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(rgba(148,163,184,0.3)_1px,transparent_1px)] [background-size:24px_24px]"
          aria-hidden="true"
        />


        {/* Page Hero Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-2xs shrink-0">
              <Icon name="bell" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[19px] font-black tracking-tight text-rf-ink font-rf-heading">
                  Notification Center
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60 shadow-2xs">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-rf-ink-muted mt-0.5">
                Stay updated with cross-system alerts, approvals, and workflow events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl shadow-2xs font-semibold border-rf-border-subtle bg-rf-surface hover:bg-rf-surface-subtle"
                loading={markingAll}
                loadingLabel="Marking all"
                onClick={() => void handleMarkAllRead()}
              >
                <Icon name="check" size={14} />
                Mark all as read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => void load()}
              title="Refresh notifications"
            >
              <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </header>

        {/* Error Notice */}
        {error && (
          <Alert
            tone="danger"
            title="Notifications could not be updated"
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                <Icon name="refresh-cw" size={13} />
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Filter Pills Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Notification filters">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            onClick={() => {
              setActiveCategory('all');
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeCategory === 'all'
                ? 'bg-rf-action text-rf-on-action shadow-2xs'
                : 'text-rf-ink-muted hover:text-rf-ink font-semibold hover:bg-rf-surface-subtle/80'
            }`}
          >
            All Notifications
            <span className={`text-[11px] font-bold ${activeCategory === 'all' ? 'text-rf-on-action/90' : 'text-rf-ink-muted'}`}>
              {total}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'unread'}
            onClick={() => {
              setActiveCategory('unread');
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeCategory === 'unread'
                ? 'bg-rf-action text-rf-on-action shadow-2xs'
                : 'text-rf-ink-muted hover:text-rf-ink font-semibold hover:bg-rf-surface-subtle/80'
            }`}
          >
            Unread Only
            {unreadCount > 0 && (
              <span className={`text-[11px] font-bold ${activeCategory === 'unread' ? 'text-rf-on-action/90' : 'text-rf-ink-muted'}`}>
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'alerts'}
            onClick={() => {
              setActiveCategory('alerts');
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeCategory === 'alerts'
                ? 'bg-rf-action text-rf-on-action shadow-2xs'
                : 'text-rf-ink-muted hover:text-rf-ink font-semibold hover:bg-rf-surface-subtle/80'
            }`}
          >
            System Alerts
            {systemAlertsCount > 0 && (
              <span className={`text-[11px] font-bold ${activeCategory === 'alerts' ? 'text-rf-on-action/90' : 'text-rf-ink-muted'}`}>
                {systemAlertsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'approvals'}
            onClick={() => {
              setActiveCategory('approvals');
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeCategory === 'approvals'
                ? 'bg-rf-action text-rf-on-action shadow-2xs'
                : 'text-rf-ink-muted hover:text-rf-ink font-semibold hover:bg-rf-surface-subtle/80'
            }`}
          >
            Pending Approvals
            {pendingApprovalsCount > 0 && (
              <span className={`text-[11px] font-bold ${activeCategory === 'approvals' ? 'text-rf-on-action/90' : 'text-rf-ink-muted'}`}>
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </div>

        {/* Loading State */}
        {loading && <ListSkeleton count={4} />}

        {/* Empty State */}
        {!loading && !error && filteredNotifications.length === 0 && (
          <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-12 text-center shadow-xs flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-rf-surface-subtle text-rf-ink-muted flex items-center justify-center mb-3">
              <Icon name={activeCategory === 'unread' ? 'check-circle' : 'bell'} size={26} />
            </div>
            <h2 className="text-base font-bold text-rf-ink">
              {activeCategory === 'unread' ? 'You’re all caught up!' : 'No notifications in this view'}
            </h2>
            <p className="text-xs text-rf-ink-muted max-w-sm mt-1">
              {activeCategory === 'unread'
                ? 'There are no unread updates waiting for your review.'
                : 'New approvals, system alerts, and workflow events will appear here.'}
            </p>
            {activeCategory !== 'all' && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => {
                  setActiveCategory('all');
                  setPage(1);
                }}
              >
                Show all notifications
              </Button>
            )}
          </div>
        )}

        {/* Notification Cards List */}
        {!loading && filteredNotifications.length > 0 && (
          <div className="flex flex-col gap-3" aria-live="polite">
            {filteredNotifications.map((notification) => {
              const presentation = getNotificationPresentation(notification);
              const href = getNotificationHref(notification);
              const isUnread = !notification.readAt;

              // Tone styling for card left icon
              const iconToneClasses: Record<StatusTone, string> = {
                danger: 'bg-rose-50 text-rose-500 border border-rose-100/80 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400',
                warning: 'bg-amber-50 text-amber-500 border border-amber-100/80 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400',
                purple: 'bg-purple-50 text-purple-500 border border-purple-100/80 dark:bg-purple-950/40 dark:border-purple-900/60 dark:text-purple-400',
                success: 'bg-emerald-50 text-emerald-500 border border-emerald-100/80 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400',
                info: 'bg-sky-50 text-sky-500 border border-sky-100/80 dark:bg-sky-950/40 dark:border-sky-900/60 dark:text-sky-400',
                cyan: 'bg-cyan-50 text-cyan-600 border border-cyan-100/80 dark:bg-cyan-950/40 dark:border-cyan-900/60 dark:text-cyan-400',
                neutral: 'bg-rf-surface-subtle text-rf-ink-muted border border-rf-border-subtle',
              };

              return (
                <article
                  key={notification.id}
                  className={`group relative rounded-2xl border bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-rf-border flex items-start gap-4 ${
                    isUnread
                      ? 'border-rf-border-subtle before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1.5 before:bg-rf-action before:rounded-r-full'
                      : 'border-rf-border-subtle/70 opacity-90'
                  }`}
                >
                  {/* Category / Tone Icon */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                      iconToneClasses[presentation.tone] ?? iconToneClasses.info
                    }`}
                    aria-hidden="true"
                  >
                    <Icon name={presentation.icon} size={20} />
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row: Title + Unread Dot + Category Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-rf-ink group-hover:text-rf-action transition-colors">
                          {notification.title}
                        </h2>
                        {isUnread && (
                          <>
                            <span
                              className="w-2 h-2 rounded-full bg-sky-400 dark:bg-sky-300 shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                              aria-hidden="true"
                            />
                            <span className="sr-only">Unread notification</span>
                          </>
                        )}
                      </div>

                      <span className="rounded-full px-3 py-0.5 text-[11px] font-semibold border border-rf-border-subtle bg-rf-surface-subtle text-rf-ink-muted shrink-0">
                        {presentation.category}
                      </span>
                    </div>

                    {/* Message Body */}
                    <p className="text-xs text-rf-ink-muted leading-relaxed mt-1">
                      {notification.message}
                    </p>

                    {/* Bottom Metadata & Action Row */}
                    <div className="flex items-center justify-between gap-3 mt-3 pt-1 border-t border-rf-border-subtle/40">
                      <div className="flex items-center gap-1.5 text-xs text-rf-ink-muted font-medium">
                        <Icon name="clock" size={13} className="text-rf-ink-muted/80" />
                        <time dateTime={notification.createdAt}>
                          {formatRelativeTime(notification.createdAt)}
                        </time>
                      </div>

                      <div className="flex items-center gap-3">
                        {href && (
                          <Link
                            to={href}
                            className="text-xs font-bold text-rf-ink hover:text-rf-action transition-colors flex items-center gap-1"
                          >
                            Open details <Icon name="chevron-right" size={13} />
                          </Link>
                        )}

                        {isUnread && (
                          <button
                            type="button"
                            disabled={markingId === notification.id}
                            onClick={() => void handleMarkRead(notification.id)}
                            className="text-xs font-bold text-rf-action hover:underline hover:text-rf-action-strong transition-colors cursor-pointer"
                          >
                            {markingId === notification.id ? 'Marking...' : 'Mark as read'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pt-2">
            <Pagination
              ariaLabel="Notification pages"
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={loading}
              summary={`${total} notifications`}
            />
          </div>
        )}
      </div>
    </ClickSpark>
  );
}
