import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../Icon';
import { PageState } from '../ui/PageState';
import { CommentsThread } from '../ui/CommentsThread';

export type FeedEntry =
  | { type: 'note'; id: string; authorName: string; authorInitials: string; authorRole?: string; content: string; createdAt: string }
  | { type: 'stage_change'; id: string; label: string; byUser: string; createdAt: string }
  | { type: 'interview'; id: string; label: string; createdAt: string }
  | { type: 'offer'; id: string; label: string; createdAt: string }
  | { type: 'system'; id: string; label: string; createdAt: string };

export interface ActivityFeedProps {
  entityType: 'application' | 'hiringCase';
  entityId: string;
  entries: FeedEntry[];
  onRefresh: () => void;
  className?: string;
}

/**
 * Formats an ISO date string into a relative time description (e.g. "2 hours ago")
 * using plain JavaScript Date calculations.
 */
export function formatTimeAgo(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Highlights @mentions within note content consistently with CommentsThread.
 */
function renderContentWithMentions(content: string): ReactNode[] {
  if (!content) return [];
  const mentionRegex = /(@\w+)/g;
  const parts = content.split(mentionRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <mark key={idx} className="mention-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * ActivityFeed — merged notes and events timeline.
 * Renders notes and system events in a unified, newest-first chronological thread
 * with a "Post a note" composer at the bottom.
 */
export function ActivityFeed({
  entityType,
  entityId,
  entries,
  onRefresh,
  className,
}: ActivityFeedProps) {
  // Defensive newest-first re-sort by createdAt
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      const valA = isNaN(timeA) ? 0 : timeA;
      const valB = isNaN(timeB) ? 0 : timeB;
      return valB - valA;
    });
  }, [entries]);

  const renderEntry = (entry: FeedEntry) => {
    switch (entry.type) {
      case 'note':
        return (
          <li
            key={entry.id}
            className="comment-item rounded-lg border border-rf-border-subtle bg-rf-surface p-3 shadow-xs"
          >
            <Avatar initials={entry.authorInitials || 'UN'} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="comment-meta flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <b className="text-xs font-semibold text-rf-ink">{entry.authorName}</b>
                  {entry.authorRole && (
                    <span className="text-[11px] text-rf-ink-muted">· {entry.authorRole}</span>
                  )}
                </div>
                <time className="text-[11px] text-rf-ink-muted shrink-0" dateTime={entry.createdAt}>
                  {formatTimeAgo(entry.createdAt)}
                </time>
              </div>
              <p className="mt-1 text-xs text-rf-ink leading-relaxed break-words whitespace-pre-wrap">
                {renderContentWithMentions(entry.content)}
              </p>
            </div>
          </li>
        );

      case 'stage_change':
        return (
          <li
            key={entry.id}
            className="activity-feed__item rounded-lg border border-rf-border-subtle border-l-4 border-l-teal-500 bg-rf-surface p-3 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  <Icon name="arrow-right" size={13} />
                </span>
                <div className="min-w-0">
                  <strong className="text-xs font-semibold text-rf-ink block leading-snug">
                    {entry.label}
                  </strong>
                  {entry.byUser && (
                    <span className="mt-0.5 text-[11px] text-rf-ink-muted block">
                      by {entry.byUser}
                    </span>
                  )}
                </div>
              </div>
              <time className="text-[11px] text-rf-ink-muted shrink-0" dateTime={entry.createdAt}>
                {formatTimeAgo(entry.createdAt)}
              </time>
            </div>
          </li>
        );

      case 'interview':
        return (
          <li
            key={entry.id}
            className="activity-feed__item rounded-lg border border-rf-border-subtle border-l-4 border-l-blue-500 bg-rf-surface p-3 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Icon name="calendar" size={13} />
                </span>
                <div className="min-w-0">
                  <strong className="text-xs font-semibold text-rf-ink block leading-snug">
                    {entry.label}
                  </strong>
                </div>
              </div>
              <time className="text-[11px] text-rf-ink-muted shrink-0" dateTime={entry.createdAt}>
                {formatTimeAgo(entry.createdAt)}
              </time>
            </div>
          </li>
        );

      case 'offer':
        return (
          <li
            key={entry.id}
            className="activity-feed__item rounded-lg border border-rf-border-subtle border-l-4 border-l-purple-500 bg-rf-surface p-3 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  <Icon name="file-text" size={13} />
                </span>
                <div className="min-w-0">
                  <strong className="text-xs font-semibold text-rf-ink block leading-snug">
                    {entry.label}
                  </strong>
                </div>
              </div>
              <time className="text-[11px] text-rf-ink-muted shrink-0" dateTime={entry.createdAt}>
                {formatTimeAgo(entry.createdAt)}
              </time>
            </div>
          </li>
        );

      case 'system':
        return (
          <li
            key={entry.id}
            className="activity-feed__item rounded-lg border border-rf-border-subtle border-l-4 border-l-slate-400 bg-rf-surface p-3 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Icon name="info" size={13} />
                </span>
                <div className="min-w-0">
                  <strong className="text-xs font-semibold text-rf-ink block leading-snug">
                    {entry.label}
                  </strong>
                </div>
              </div>
              <time className="text-[11px] text-rf-ink-muted shrink-0" dateTime={entry.createdAt}>
                {formatTimeAgo(entry.createdAt)}
              </time>
            </div>
          </li>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn('activity-feed space-y-4', className)}>
      <style>{`
        .mention-highlight {
          background-color: var(--color-rf-action-soft, rgba(37, 99, 235, 0.12));
          color: var(--color-rf-action, #2563eb);
          font-weight: 600;
          border-radius: 4px;
          padding: 0 3px;
        }
        .activity-feed__composer .comment-list,
        .activity-feed__composer .comments-thread > .flex,
        .activity-feed__composer .comment-item {
          display: none !important;
        }
      `}</style>

      {sortedEntries.length === 0 ? (
        <PageState
          kind="empty"
          title="No activity yet"
          description="Notes, status changes, and interview events will appear here."
        />
      ) : (
        <ol className="activity-feed__list space-y-3" aria-label="Activity timeline">
          {sortedEntries.map((entry) => renderEntry(entry))}
        </ol>
      )}

      <div className="activity-feed__composer pt-2">
        <CommentsThread
          entityType={entityType}
          entityId={entityId}
          comments={[]}
          onPostComment={() => {
            onRefresh();
          }}
        />
      </div>
    </div>
  );
}
