import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { ButtonV2 } from './Button';

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DiscardChangesDialogProps {
  open: boolean;
  title?: string;
  body?: string;
  keepLabel?: string;
  discardLabel?: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/**
 * Ticket 06: Reusable in-app confirmation modal replacing window.confirm() for unsaved changes.
 * Initial focus lands on the safe action ("Keep editing"). Escape dismisses and returns focus
 * to the control that had focus before the dialog opened.
 */
export function DiscardChangesDialog({
  open,
  title = 'Discard unsaved changes?',
  body = 'You have unsaved changes. If you leave now, your edits will be lost.',
  keepLabel = 'Keep editing',
  discardLabel = 'Discard changes',
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const keepRef = React.useRef<HTMLButtonElement>(null);
  const prevFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return undefined;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    keepRef.current?.focus();
    return () => {
      const back = prevFocusRef.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onKeepEditing();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="rf2-confirm-root" onKeyDown={onKeyDown}>
      <div
        className="rf2-confirm__scrim"
        aria-hidden="true"
        onMouseDown={(e) => {
          e.stopPropagation();
          onKeepEditing();
        }}
      />
      <div
        ref={dialogRef}
        className="rf2-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="rf2-confirm__head">
          <span className="rf2-confirm__icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div className="rf2-confirm__copy">
            <h2 id={titleId} className="rf2-confirm__title">{title}</h2>
            <p id={descId} className="rf2-confirm__body">{body}</p>
          </div>
        </div>
        <div className="rf2-confirm__actions">
          <ButtonV2 ref={keepRef} kind="secondary" onClick={onKeepEditing}>
            {keepLabel}
          </ButtonV2>
          <ButtonV2 kind="danger" onClick={onDiscard}>
            {discardLabel}
          </ButtonV2>
        </div>
      </div>
    </div>,
    document.body,
  );
}
