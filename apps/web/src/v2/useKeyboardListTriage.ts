import { useEffect, type RefObject } from 'react';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  if (target.closest('[role="dialog"], [role="menu"], [role="listbox"]')) return true;
  return false;
}

/**
 * Keyboard-first J/K list triage for V2 workspaces.
 * Pressing `j` moves focus to the next actionable item; `k` moves focus to the previous item.
 * Ignored whenever an input, select, textarea, combobox, menu, or modal dialog is active.
 */
export function useKeyboardListTriage(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== 'j' && event.key !== 'k') return;
      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) return;
      const root = containerRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && !el.closest('[hidden]'),
      );
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex =
        event.key === 'j'
          ? currentIndex < 0
            ? 0
            : (currentIndex + 1) % items.length
          : currentIndex <= 0
            ? items.length - 1
            : currentIndex - 1;
      items[nextIndex]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [containerRef, selector]);
}
