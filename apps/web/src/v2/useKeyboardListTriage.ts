import { useEffect, type RefObject } from 'react';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  if (
    target.closest(
      '[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"], [role="grid"], [role="tree"], [aria-modal="true"]',
    )
  ) {
    return true;
  }
  return false;
}

function isFocusableItemVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.tabIndex === -1) return false;
  if (el.closest('[hidden], [aria-hidden="true"], details:not([open])')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
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
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const root = containerRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(isFocusableItemVisible);
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex =
        key === 'j'
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
