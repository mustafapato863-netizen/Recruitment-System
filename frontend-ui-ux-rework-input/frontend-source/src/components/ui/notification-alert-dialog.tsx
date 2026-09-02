import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  const canViewNotifications = Boolean(user?.permissions.includes('NOTIFICATION_VIEW'));

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
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // Non-blocking for unread count
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
      setNotifications(res.data ?? []);
    } catch (err: unknown) {
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
      // Focus management: place focus inside popover on open
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
      const updated = await patchApi<NotificationRecord>(`/notifications/${id}/read`);
      setNotifications((curr) => curr.map((n) => (n.id === id ? updated : n)));
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

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      {triggerVariant === 'icon' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-2xs',
            isOpen
              ? 'bg-rf-action-soft border-rf-action/30 text-rf-action shadow-xs'
              : 'border-rf-border-subtle bg-rf-surface text-rf-ink-muted hover:text-rf-ink hover:border-rf-border hover:shadow-xs',
            className,
          )}
          title="Notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rf-danger text-rf-on-status text-[10px] font-black rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center shadow-xs ring-2 ring-rf-surface animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <Button
          ref={triggerRef as unknown as React.Ref<HTMLButtonElement>}
          variant="primary"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={cn('relative pr-7 text-xs font-bold shadow-sm min-h-[44px]', className)}
        >
          <Icon name="bell" size={16} />
          Notifications
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rf-danger text-rf-on-status text-[10px] font-black rounded-full h-5 min-w-5 px-1 flex items-center justify-center shadow-sm ring-2 ring-rf-surface animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      )}

      {/* Anchored Dropdown Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          tabIndex={-1}
          aria-label="Notifications Dropdown"
          className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] sm:w-[390px] max-w-[390px] bg-rf-surface rounded-2xl border border-rf-border-subtle shadow-2xl z-[100] overflow-hidden flex flex-col outline-none animate-in fade-in-0 zoom-in-95 duration-150 origin-top-right"
        >
          {/* Header */}
          <div className="p-4 border-b border-rf-border-subtle flex items-center justify-between bg-rf-surface">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-rf-heading font-black text-rf-ink m-0">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-rf-danger-soft text-rf-danger border border-rf-danger/20 text-[11px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void markAllAsRead()}
                className="text-xs font-bold text-rf-action hover:underline bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 min-h-[40px] inline-flex items-center px-1"
              >
                {markingAll ? 'Marking all...' : 'Mark all as read'}
              </button>
            )}
          </div>

          {/* Mutation failure feedback */}
          {mutationError && (
            <div className="px-4 py-2 bg-rf-danger-soft border-b border-rf-danger/20 text-xs text-rf-danger flex items-center justify-between">
              <span>{mutationError}</span>
              <button
                type="button"
                onClick={() => setMutationError(null)}
                className="text-xs text-rf-danger font-bold hover:underline border-0 bg-transparent cursor-pointer ml-2 min-h-[32px]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Filter Tabs (All / Unread) */}
          <div className="px-4 py-2.5 bg-rf-surface-subtle border-b border-rf-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-1.5" role="group" aria-label="Notification filter">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                aria-pressed={filterTab === 'all'}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border min-h-[40px]',
                  filterTab === 'all'
                    ? 'bg-rf-action text-rf-on-action border-rf-action shadow-2xs'
                    : 'bg-rf-surface text-rf-ink-muted hover:text-rf-ink border-rf-border-subtle',
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                aria-pressed={filterTab === 'unread'}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border min-h-[40px]',
                  filterTab === 'unread'
                    ? 'bg-rf-action text-rf-on-action border-rf-action shadow-2xs'
                    : 'bg-rf-surface text-rf-ink-muted hover:text-rf-ink border-rf-border-subtle',
                )}
              >
                Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
              </button>
            </div>
          </div>

          {/* Notification Items List */}
          <div
            className="max-h-[380px] overflow-y-auto flex flex-col divide-y divide-rf-border-subtle rf-scrollbar"
            role="status"
            aria-live="polite"
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-rf-ink-muted">
                <Icon name="refresh-cw" size={16} className="animate-spin mr-2 text-rf-action" />
                Loading notifications...
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                <span className="text-xs text-rf-danger">{error}</span>
                <Button variant="secondary" size="sm" onClick={() => void fetchNotifications()}>
                  <Icon name="refresh-cw" size={12} />
                  Retry
                </Button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-rf-ink-muted">
                <div className="w-12 h-12 rounded-2xl bg-rf-surface-subtle flex items-center justify-center text-rf-ink-muted mb-2.5">
                  <Icon name="bell" size={22} />
                </div>
                <strong className="text-xs font-bold text-rf-ink">No notifications found</strong>
                <span className="text-[11px] text-rf-ink-muted mt-0.5">
                  {filterTab === 'unread' ? 'You are all caught up.' : 'No notifications in your workspace.'}
                </span>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => {
                    if (!notification.readAt) void markAsRead(notification.id);
                  }}
                  aria-label={`${notification.title}, ${notification.readAt ? 'read' : 'unread'}`}
                  className={cn(
                    'group flex items-start gap-3.5 p-3.5 w-full text-left border-0 transition-colors cursor-pointer min-h-[44px] outline-none focus-visible:ring-2 focus-visible:ring-rf-action focus-visible:ring-inset',
                    notification.readAt
                      ? 'bg-rf-surface hover:bg-rf-surface-subtle'
                      : 'bg-rf-action-soft/30 hover:bg-rf-action-soft/50',
                  )}
                >
                  {/* Icon Badge */}
                  <div className="relative shrink-0 mt-0.5" aria-hidden="true">
                    <div className="w-9 h-9 rounded-full bg-rf-action-soft text-rf-action flex items-center justify-center font-bold text-xs shadow-xs border border-rf-action/20">
                      <Icon name="bell" size={16} />
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-rf-ink leading-snug">
                      <strong className="font-bold mr-1">{notification.title}</strong>
                      <span className="text-rf-ink-muted block mt-0.5">{notification.message}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-medium text-rf-action">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </span>
                      <Badge variant="neutral" className="text-[9.5px] py-0 px-1.5 h-4">
                        {notification.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Unread Indicator */}
                  {!notification.readAt && (
                    <div className="shrink-0 mt-2" aria-hidden="true">
                      <span className="w-2 h-2 rounded-full bg-rf-action block shadow-2xs ring-2 ring-rf-surface" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-rf-border-subtle bg-rf-surface-subtle text-center">
            <Link
              to="/notifications"
              onClick={closeDropdown}
              className="text-xs font-bold text-rf-action hover:underline inline-flex items-center gap-1 min-h-[40px] px-2"
            >
              See all in Notifications <Icon name="chevron-right" size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export const Component = NotificationAlertDialog;
export default NotificationAlertDialog;
