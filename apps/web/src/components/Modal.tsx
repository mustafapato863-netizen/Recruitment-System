import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { IconButton } from './ui/IconButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidthClass?: string;
}

const FOCUSABLE_SELECTOR = 'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, maxWidthClass = 'max-w-xl' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const elements = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4 backdrop-blur-[2px] animate-in fade-in duration-150 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[18px] border border-rf-border-subtle bg-rf-surface shadow-[var(--shadow-float)] animate-in zoom-in-95 duration-150',
          maxWidthClass,
        ].join(' ')}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-rf-border-subtle bg-rf-surface-subtle/65 px-5 py-4 sm:px-6">
          <h2 className="m-0 font-rf-heading text-[13px] font-extrabold tracking-[-0.015em] text-rf-ink" id={titleId}>{title}</h2>
          <IconButton label="Close dialog" tone="ghost" size="sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
        </div>
        <div className="rf-scrollbar overflow-y-auto p-5 text-rf-ink sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
