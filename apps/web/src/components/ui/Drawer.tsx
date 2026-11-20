import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { IconButton } from './IconButton';

export type DrawerWidth = 'narrow' | 'standard' | 'evidence';

export type DrawerPlacement = 'end' | 'bottom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: DrawerWidth;
  /** `end` is the side drawer. `bottom` is a full-width sheet. */
  placement?: DrawerPlacement;
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = 'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])';

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 'standard',
  placement = 'end',
  footer,
  children,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;
      const elements = [...drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('disabled'));
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClass = width === 'narrow' ? 'is-narrow' : width === 'evidence' ? 'is-evidence' : 'is-standard';
  const sheetClass = placement === 'bottom' ? 'is-sheet' : '';

  return (
    <div className={['drawer-scrim', sheetClass].filter(Boolean).join(' ')} onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <div
        className={['drawer-demo', 'ui-drawer', widthClass, sheetClass, 'bg-rf-surface border-l border-rf-border text-rf-ink'].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={drawerRef}
      >
        <header className="drawer-header border-b border-rf-border">
          <div>
            <b id={titleId}>{title}</b>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <IconButton label="Close drawer" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
        </header>

        <div className="drawer-body rf-scrollbar">{children}</div>

        {footer && <footer className="drawer-footer bg-rf-surface border-t border-rf-border">{footer}</footer>}
      </div>
    </div>
  );
}
