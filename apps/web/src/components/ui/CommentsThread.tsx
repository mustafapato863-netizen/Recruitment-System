import { useState } from 'react';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Textarea } from './Textarea';

export interface CommentItem {
  id: string;
  authorName: string;
  authorInitials: string;
  authorRole?: string;
  timeAgo: string;
  content: string;
  replies?: CommentItem[];
}

interface CommentsThreadProps {
  comments: CommentItem[];
  onPostComment?: (text: string) => void;
}

export function CommentsThread({ comments, onPostComment }: CommentsThreadProps) {
  const [newComment, setNewComment] = useState('');

  const handlePost = () => {
    if (!newComment.trim()) return;
    onPostComment?.(newComment);
    setNewComment('');
  };

  return (
    <div className="comments-thread">
      <ol className="comment-list" aria-label="Candidate comments">
        {comments.map((comment) => (
          <li key={comment.id} className="comment-item">
            <Avatar initials={comment.authorInitials} size="sm" />
            <div>
              <div className="comment-meta">
                <b>{comment.authorName}</b>
                <span>
                  {comment.timeAgo} {comment.authorRole ? `· ${comment.authorRole}` : ''}
                </span>
              </div>
              <p>{comment.content}</p>
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
                        <p>{reply.content}</p>
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
        <p className="comment-composer__hint" id="comment-composer-help">Add a clear plain-text note for collaborators. Rich formatting and attachments are not available in this field.</p>
        <Textarea
          className="comment-editor-input"
          aria-describedby="comment-composer-help"
          placeholder="Write a note and mention @someone…"
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <div className="comment-composer-footer">
          <label className="comment-attachment" hidden>
            <span>Attach file</span>
            <input className="sr-only" type="file" aria-label="Attach a comment file" />
          </label>
          <Button variant="primary" size="sm" type="button" onClick={handlePost} disabled={!newComment.trim()}>
            Post comment
          </Button>
        </div>
      </div>
    </div>
  );
}
