import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SkeletonV2, ForbiddenStateV2 } from './PageStates';

const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

export type DrawerStatus = 'ready' | 'loading' | 'error' | 'forbidden';

export interface DrawerV2Props {
  open: boolean;
  /** Called for Escape, backdrop click and the close button (after the guard). */
  onClose: () => void;
  kicker?: string;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  /** The ONE primary action (a ButtonV2 kind="primary"). */
  primaryAction?: React.ReactNode;
  /** Optional secondary / tertiary actions rendered before the primary. */
  secondaryAction?: React.ReactNode;
  status?: DrawerStatus;
  errorMessage?: string;
  onRetry?: () => void;
  /**
   * Unsaved-changes guard. Return true to allow closing. Applies to Escape,
   * backdrop and the close button.
   */
  confirmClose?: () => boolean;
  /** Element to focus first; defaults to the first focusable in the body, then the close button. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeLabel?: string;
}

/**
 * v2 Drawer: right side, 560px opaque panel, modal dialog. Focus trap, initial focus,
 * focus return, Escape/backdrop close with optional guard, body scroll lock.
 * No dependency: the repo only has Radix alert-dialog, not Dialog.
 */
export function DrawerV2({
  open, onClose, kicker, title, subtitle, children, primaryAction, secondaryAction,
  status = 'ready', errorMessage, onRetry, confirmClose, initialFocusRef, closeLabel = 'Close',
}: DrawerV2Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  const requestClose = React.useCallback(() => {
    if (confirmClose && !confirmClose()) return;
    onClose();
  }, [confirmClose, onClose]);

  // Remember the trigger, lock body scroll, set initial focus; restore on close.
  React.useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    body.setAttribute('data-rf2-scroll-locked', '');
    const target = initialFocusRef?.current
      ?? panelRef.current?.querySelector('.rf2-drawer__body')?.querySelector<HTMLElement>(FOCUSABLE)
      ?? closeRef.current;
    target?.focus();
    return () => {
      body.style.overflow = prevOverflow;
      body.removeAttribute('data-rf2-scroll-locked');
      const back = returnFocusRef.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open, initialFocusRef]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('inert'));
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panelRef.current.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) { e.preventDefault(); first.focus(); }
  };

  if (!open) return null;

  let body: React.ReactNode = children;
  if (status === 'loading') body = <SkeletonV2 lines={6} label={`Loading ${title}`} />;
  else if (status === 'forbidden') body = <ForbiddenStateV2 headingLevel={3} />;
  else if (status === 'error') {
    body = (
      <div className="rf2-state" role="alert">
        <h3 className="rf2-state__title">Something went wrong</h3>
        <p className="rf2-state__body">{errorMessage ?? 'This could not be loaded. Try again.'}</p>
        {onRetry ? <div className="rf2-state__action"><button type="button" className="rf2-btn rf2-btn--secondary rf2-btn--md" onClick={onRetry}>Try again</button></div> : null}
      </div>
    );
  }
  const showActions = status === 'ready';

  return createPortal(
    <div className="rf2-drawer-root">
      <div className="rf2-drawer__scrim" data-testid="rf2-drawer-scrim" aria-hidden="true" onMouseDown={requestClose} />
      <div
        ref={panelRef}
        className="rf2-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        aria-busy={status === 'loading' || undefined}
        onKeyDown={onKeyDown}
      >
        <header className="rf2-drawer__header" role="presentation">
          <div className="rf2-drawer__heading">
            {kicker ? <p className="rf2-drawer__kicker">{kicker}</p> : null}
            <h2 id={titleId} className="rf2-drawer__title">{title}</h2>
            {subtitle ? <p id={descId} className="rf2-drawer__subtitle">{subtitle}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="rf2-drawer__close" aria-label={closeLabel} onClick={requestClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="rf2-drawer__body">{body}</div>
        {showActions && (primaryAction || secondaryAction) ? (
          <footer className="rf2-drawer__footer">
            {secondaryAction}
            {primaryAction}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
