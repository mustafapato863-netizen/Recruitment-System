import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ApplicationNote } from '@recruitflow/contracts';
import { getApi, postApi, ApiError } from '../../api/client';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Textarea } from './Textarea';
import { Alert } from './Alert';
import { Spinner } from '../Spinner';

export interface CommentItem {
  id: string;
  authorName: string;
  authorInitials: string;
  authorRole?: string;
  timeAgo: string;
  content: string;
  replies?: CommentItem[];
}

export interface CommentsThreadProps {
  comments?: CommentItem[];
  onPostComment?: (text: string) => void;
  entityType?: 'application' | 'hiringCase';
  entityId?: string;
  initialComments?: CommentItem[];
}

function getInitials(name?: string): string {
  if (!name) return 'UN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatCommentDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function mapNoteToComment(note: ApplicationNote): CommentItem {
  const authorName = note.authorName?.trim() || 'Unknown';
  return {
    id: note.id,
    authorName,
    authorInitials: getInitials(authorName),
    timeAgo: formatCommentDate(note.createdAt),
    content: note.content,
  };
}

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

export function CommentsThread({
  comments,
  onPostComment,
  entityType,
  entityId,
  initialComments,
}: CommentsThreadProps) {
  const isApiMode = entityType === 'application' && Boolean(entityId);

  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Server comments for API mode
  const [serverComments, setServerComments] = useState<CommentItem[]>(
    initialComments ?? comments ?? []
  );
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Local comments for UI-only mode
  const [localComments, setLocalComments] = useState<CommentItem[]>(
    comments ?? initialComments ?? []
  );

  useEffect(() => {
    if (comments) {
      setLocalComments(comments);
    }
  }, [comments]);

  const loadNotes = useCallback(async (id: string) => {
    try {
      setIsLoadingNotes(true);
      const notes = await getApi<ApplicationNote[]>(`/applications/${id}/notes`);
      const mapped = (notes || []).map(mapNoteToComment);
      setServerComments(mapped);
      return mapped;
    } catch {
      return [];
    } finally {
      setIsLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    if (isApiMode && entityId) {
      loadNotes(entityId);
    }
  }, [isApiMode, entityId, loadNotes]);

  const activeComments = isApiMode
    ? serverComments
    : comments !== undefined
      ? comments
      : localComments;

  const handlePost = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    if (!isApiMode || !entityId) {
      const localItem: CommentItem = {
        id: `note-${Date.now()}`,
        authorName: 'Recruiter',
        authorInitials: 'RC',
        timeAgo: 'Just now',
        content: trimmed,
      };
      setLocalComments((prev) => [localItem, ...prev]);
      onPostComment?.(trimmed);
      setNewComment('');
      return;
    }

    setIsPosting(true);
    setPostError(null);
    try {
      await postApi<ApplicationNote>(`/applications/${entityId}/notes`, {
        content: trimmed,
      });
      setNewComment('');
      await loadNotes(entityId);
      onPostComment?.(trimmed);
    } catch (err: unknown) {
      let message = 'Failed to post note. Please try again.';
      if (err instanceof ApiError) {
        if (err.fields?.content && err.fields.content.length > 0) {
          message = err.fields.content.join(', ');
        } else if (err.message) {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setPostError(message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="comments-thread">
      <style>{`
        .mention-highlight {
          background-color: var(--color-rf-action-soft, rgba(37, 99, 235, 0.12));
          color: var(--color-rf-action, #2563eb);
          font-weight: 600;
          border-radius: 4px;
          padding: 0 3px;
        }
      `}</style>

      {isLoadingNotes && activeComments.length === 0 && (
        <div className="flex items-center justify-center py-4 text-xs text-rf-ink-muted">
          <Spinner size={14} className="mr-2" />
          <span>Loading notes...</span>
        </div>
      )}

      <ol className="comment-list" aria-label="Candidate comments">
        {activeComments.map((comment) => (
          <li key={comment.id} className="comment-item">
            <Avatar initials={comment.authorInitials} size="sm" />
            <div>
              <div className="comment-meta">
                <b>{comment.authorName}</b>
                <span>
                  {comment.timeAgo} {comment.authorRole ? `· ${comment.authorRole}` : ''}
                </span>
              </div>
              <p>{renderContentWithMentions(comment.content)}</p>
              <button className="comment-reply" type="button" hidden>
                Reply
              </button>

              {comment.replies && comment.replies.length > 0 && (
                <ol className="comment-replies">
                  {comment.replies.map((reply) => (
                    <li key={reply.id} className="comment-item">
                      <Avatar initials={reply.authorInitials} size="sm" />
                      <div>
                        <div className="comment-meta">
                          <b>{reply.authorName}</b>
                          <span>{reply.timeAgo}</span>
                        </div>
                        <p>{renderContentWithMentions(reply.content)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="comment-composer">
        <div className="comment-toolbar" role="toolbar" aria-label="Comment formatting" hidden>
          <button type="button" aria-label="Bold">
            B
          </button>
          <button type="button" aria-label="Bulleted list">
            ☷
          </button>
          <button type="button" aria-label="Add link">
            ↗
          </button>
        </div>
        <p className="comment-composer__hint" id="comment-composer-help">
          Add a clear plain-text note for collaborators. Rich formatting and attachments are not available in this field.
        </p>
        <Textarea
          className="comment-editor-input"
          aria-describedby="comment-composer-help"
          placeholder="Write a note and mention @someone…"
          rows={3}
          value={newComment}
          onChange={(e) => {
            setNewComment(e.target.value);
            if (postError) setPostError(null);
          }}
          disabled={isPosting}
        />
        {postError && (
          <Alert tone="danger" className="mt-2">
            {postError}
          </Alert>
        )}
        <div className="comment-composer-footer">
          <label className="comment-attachment" hidden>
            <span>Attach file</span>
            <input className="sr-only" type="file" aria-label="Attach a comment file" />
          </label>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={handlePost}
            disabled={!newComment.trim() || isPosting}
            loading={isPosting}
            loadingLabel="Posting..."
          >
            Post comment
          </Button>
        </div>
      </div>
    </div>
  );
}
