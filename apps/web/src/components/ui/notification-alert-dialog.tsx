import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../../api/client';
import { Button } from './Button';
import { Badge } from './Badge';
import { Icon } from '../Icon';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';

export interface NotificationAlertDialogProps {
  triggerVariant?: 'button' | 'icon';
  className?: string;
}

export function NotificationAlertDialog({
  triggerVariant = 'button',
  className = '',
}: NotificationAlertDialogProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Allow all logged in users to view notifications
  const canViewNotifications = Boolean(user);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!canViewNotifications) return;
    try {
      const res = await getApi<{ unreadCount: number }>('/notifications/unread-count');
      if (typeof res?.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      setUnreadCount(0);
    }
  }, [canViewNotifications]);

  const fetchNotifications = useCallback(async () => {
    if (!canViewNotifications) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '10' });
      if (filterTab === 'unread') params.set('unreadOnly', 'true');
      const res = await getApi<PaginatedResult<NotificationRecord>>(`/notifications?${params}`);
      setNotifications(res?.data || []);
    } catch (err: unknown) {
      setNotifications([]);
      setError((err as Error).message ?? 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [canViewNotifications, filterTab]);

  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      void fetchNotifications();
      void fetchUnreadCount();
      requestAnimationFrame(() => {
        popoverRef.current?.focus();
      });
    }
  }, [isOpen, fetchNotifications, fetchUnreadCount]);

  const markAsRead = async (id: string) => {
    if (mutatingIds.has(id)) return;
    setMutatingIds((prev) => new Set(prev).add(id));
    setMutationError(null);
    try {
      await patchApi<NotificationRecord>(`/notifications/${id}/read`);
      setNotifications((curr) =>
        curr.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      setMutationError((err as Error).message ?? 'Failed to mark notification as read');
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setMutationError(null);
    try {
      await postApi('/notifications/read-all');
      setNotifications((curr) => curr.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err: unknown) {
      setMutationError((err as Error).message ?? 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  if (!canViewNotifications) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === 'unread') return !n.readAt;
    return true;
  });

  const getNotificationIcon = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('interview')) {
      return { name: 'calendar' as const, bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' };
    }
    if (t.includes('offer')) {
      return { name: 'offer' as const, bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' };
    }
    if (t.includes('alert') || t.includes('warning') || t.includes('sla')) {
      return { name: 'alert-triangle' as const, bg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' };
    }
    return { name: 'bell' as const, bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' };
  };

  const getRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleNotificationClick = (notification: NotificationRecord) => {
    if (!notification.readAt) void markAsRead(notification.id);
    closeDropdown();

    const t = (notification.type || '').toLowerCase();
    const title = (notification.title || '').toLowerCase();
    if (t.includes('interview') || title.includes('interview')) {
      navigate('/interviews');
    } else if (t.includes('offer') || title.includes('offer')) {
      navigate('/offers');
    } else if (t.includes('application') || title.includes('application') || title.includes('candidate')) {
      navigate('/applications');
    } else {
      navigate('/tasks');
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      {triggerVariant === 'icon' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-xs',
            isOpen
              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800',
            className,
          )}
          title="Notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Icon name="bell" size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9.5px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <Button
          ref={triggerRef as unknown as React.Ref<HTMLButtonElement>}
          variant="primary"
          onClick={() => setIsOpen((prev) => !prev)}
          className={className}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Icon name="bell" size={16} />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="danger" className="ml-1.5 text-xs py-0 px-1.5">
              {unreadCount}
            </Badge>
          )}
        </Button>
      )}

      {/* Popover Flyout */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          tabIndex={-1}
          aria-label="Notifications Dropdown"
          className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] sm:w-[410px] max-w-[420px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[100] overflow-hidden flex flex-col outline-none animate-in fade-in-0 zoom-in-95 duration-150 origin-top-right"
        >
          {/* Popover Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white m-0">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void markAllAsRead()}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
              >
                <span>{markingAll ? 'Marking all...' : 'Mark all as read'}</span>
              </button>
            )}
          </div>

          {/* Mutation failure feedback */}
          {mutationError && (
            <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between">
              <span>{mutationError}</span>
              <button
                type="button"
                onClick={() => setMutationError(null)}
                className="text-xs text-rose-700 font-bold hover:underline border-0 bg-transparent cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Filter Tabs (All / Unread) */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5" role="group" aria-label="Notification filter">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                aria-pressed={filterTab === 'all'}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border',
                  filterTab === 'all'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 border-slate-200 dark:border-slate-700',
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                aria-pressed={filterTab === 'unread'}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border',
                  filterTab === 'unread'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 border-slate-200 dark:border-slate-700',
                )}
              >
                Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
              </button>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Activity stream</span>
          </div>

          {/* Notification Items List */}
          <div
            className="max-h-[360px] overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800"
            role="status"
            aria-live="polite"
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-slate-400">
                <Icon name="refresh-cw" size={15} className="animate-spin mr-2 text-blue-600" />
                Loading notifications...
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                <span className="text-xs text-rose-600">{error}</span>
                <Button variant="secondary" size="sm" onClick={() => void fetchNotifications()}>
                  <Icon name="refresh-cw" size={12} />
                  Retry
                </Button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                  <Icon name="bell" size={20} />
                </div>
                <strong className="text-xs font-bold text-slate-700 dark:text-slate-200">No notifications found</strong>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {filterTab === 'unread' ? 'You are all caught up.' : 'No notifications in your workspace.'}
                </span>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const iconMeta = getNotificationIcon(notification.type);
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    aria-label={`${notification.title}, ${notification.readAt ? 'read' : 'unread'}`}
                    className={cn(
                      'group flex items-start gap-3 p-3.5 w-full text-left border-0 transition-colors cursor-pointer outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800',
                      notification.readAt
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        : 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30',
                    )}
                  >
                    {/* Icon Badge */}
                    <div className="relative shrink-0 mt-0.5" aria-hidden="true">
                      <div className={`w-8 h-8 rounded-xl ${iconMeta.bg} flex items-center justify-center shadow-xs shrink-0`}>
                        <Icon name={iconMeta.name} size={15} />
                      </div>
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {notification.title}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {getRelativeTime(notification.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline inline-flex items-center gap-0.5">
                          <span>View details</span>
                          <Icon name="chevron-right" size={10} />
                        </span>
                        <span className="text-[10px] text-slate-300 dark:text-slate-700">&bull;</span>
                        <span className="text-[10px] text-slate-400 font-medium">{notification.type || 'System'}</span>
                      </div>
                    </div>

                    {/* Unread Dot Indicator */}
                    {!notification.readAt && (
                      <div className="shrink-0 mt-2" aria-hidden="true">
                        <span className="w-2 h-2 rounded-full bg-blue-600 block shadow-xs" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center">
            <Link
              to="/tasks"
              onClick={closeDropdown}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 px-2"
            >
              <span>View all in Task Queue</span>
              <Icon name="chevron-right" size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export const Component = NotificationAlertDialog;
export default NotificationAlertDialog;
