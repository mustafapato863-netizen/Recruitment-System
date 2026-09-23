import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface OverflowMenuProps {
  label: string;
  children: ReactNode;
  className?: string;
}

const ITEM_SELECTOR = 'button, a[href], input, select, textarea';

/** Keyboard-operable disclosure for actions that do not fit the current row. */
export function OverflowMenu({ label, children, className }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const items = () => [...(rootRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])]
      .filter((element) => element !== buttonRef.current && !element.hasAttribute('disabled'));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const focusable = items();
      if (focusable.length === 0) return;
      event.preventDefault();
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.key === 'ArrowDown'
        ? (current + 1) % focusable.length
        : (current - 1 + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus();
    };

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      <div
        id={menuId}
        role="menu"
        hidden={!open}
        className="absolute end-0 z-20 mt-1 flex min-w-40 flex-col gap-1 rounded-[10px] border border-rf-border bg-rf-surface p-1.5 shadow-[var(--shadow-float)]"
        onClick={(event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest(ITEM_SELECTOR)) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
