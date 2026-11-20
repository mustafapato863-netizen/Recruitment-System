import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

type SelectOption = { value: string; label: string; disabled: boolean };
type MenuPlace = { top: number | 'auto'; bottom: number | 'auto'; left: number; width: number; maxHeight: number };

let mountedOwner: symbol | null = null;

function readSelectOptions(select: HTMLSelectElement | null): SelectOption[] {
  if (!select) return [];
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.label || option.textContent || '',
    disabled: option.disabled,
  }));
}

function resolveSelectLabel(select: HTMLSelectElement | null): string {
  if (!select) return 'Options';
  const ariaLabel = select.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;
  if (select.id && typeof document !== 'undefined') {
    try {
      const explicit = document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent?.trim();
      if (explicit) return explicit.replace(/\*$/, '').trim();
    } catch {
      // Ignore selector escape errors
    }
  }
  const wrappingLabel = select.closest('label')?.textContent?.trim();
  if (wrappingLabel) return wrappingLabel;
  return select.getAttribute('title')?.trim() || select.name || 'Options';
}

function findEnhanceableSelect(target: EventTarget | null): HTMLSelectElement | null {
  if (!(target instanceof Element)) return null;
  const select = target.closest('select');
  if (!select || !(select instanceof HTMLSelectElement)) return null;
  if (select.disabled || select.multiple || (select.size && select.size > 1)) return null;
  if (select.closest('.rf2-field__box')) return null;
  return select;
}

function placeMenu(box: HTMLElement | null, contentWidth = 0): MenuPlace {
  const rect = box?.getBoundingClientRect();
  const gap = 6;
  if (!rect || rect.width === 0) return { top: 0, bottom: 'auto', left: 8, width: Math.max(contentWidth, 180), maxHeight: 320 };
  const below = window.innerHeight - rect.bottom - gap - 8;
  const above = rect.top - gap - 8;
  const upward = below < 180 && above > below;
  const maxHeight = Math.max(120, Math.min(320, upward ? above : below));
  const width = Math.min(Math.max(rect.width, contentWidth), window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  if (upward) return { top: 'auto', bottom: window.innerHeight - rect.top + gap, left, width, maxHeight };
  return { top: rect.bottom + gap, bottom: 'auto', left, width, maxHeight };
}

function measurePlace(box: HTMLElement | null, menu: HTMLElement | null): MenuPlace {
  if (!menu) return placeMenu(box);
  const previous = menu.style.width;
  menu.style.width = 'max-content';
  const contentWidth = menu.getBoundingClientRect().width;
  menu.style.width = previous;
  return placeMenu(box, contentWidth);
}

/**
 * Global enhancer that upgrades every native <select> outside SelectV2 (.rf2-field__box)
 * to open the RecruitFlow v2 custom floating listbox (.rf2-select__menu) instead of
 * the browser's default OS dropdown list.
 */
export function GlobalSelectEnhancer() {
  const ownerId = React.useRef(Symbol('GlobalSelectEnhancer'));
  const [isOwner, setIsOwner] = React.useState(false);
  const listId = React.useId();

  const activeSelectRef = React.useRef<HTMLSelectElement | null>(null);
  const menuRef = React.useRef<HTMLUListElement>(null);
  const returnFocus = React.useRef(true);
  const typed = React.useRef({ text: '', at: 0 });

  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('Options');
  const [options, setOptions] = React.useState<SelectOption[]>([]);
  const [selectedVal, setSelectedVal] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [place, setPlace] = React.useState<MenuPlace | null>(null);

  React.useEffect(() => {
    const currentOwnerId = ownerId.current;
    if (mountedOwner === null) {
      mountedOwner = currentOwnerId;
      setIsOwner(true);
    }
    return () => {
      if (mountedOwner === currentOwnerId) {
        mountedOwner = null;
      }
    };
  }, []);

  const clearOpenAttr = React.useCallback(() => {
    if (activeSelectRef.current) {
      activeSelectRef.current.removeAttribute('data-rf2-select-open');
      activeSelectRef.current.removeAttribute('aria-hidden');
    }
  }, []);

  const closeMenu = React.useCallback((shouldReturnFocus = false) => {
    clearOpenAttr();
    const target = activeSelectRef.current;
    setOpen(false);
    if (shouldReturnFocus && target && target.isConnected) {
      target.focus();
    }
  }, [clearOpenAttr]);

  const openForSelect = React.useCallback((select: HTMLSelectElement) => {
    if (activeSelectRef.current && activeSelectRef.current !== select) {
      activeSelectRef.current.removeAttribute('data-rf2-select-open');
      activeSelectRef.current.removeAttribute('aria-hidden');
    }
    activeSelectRef.current = select;
    select.setAttribute('data-rf2-select-open', 'true');
    const next = readSelectOptions(select);
    const current = select.value ?? '';
    const currentIndex = next.findIndex((option) => option.value === current);
    const enabledFromCurrent = next.findIndex((option, index) => index >= Math.max(currentIndex, 0) && !option.disabled);
    setLabel(resolveSelectLabel(select));
    setOptions(next);
    setSelectedVal(current);
    setActive(enabledFromCurrent >= 0 ? enabledFromCurrent : Math.max(currentIndex, 0));
    setPlace(placeMenu(select));
    returnFocus.current = true;
    setOpen(true);
  }, []);

  const commit = React.useCallback((value: string) => {
    const el = activeSelectRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(el, value);
    setSelectedVal(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    closeMenu(true);
  }, [closeMenu]);

  React.useEffect(() => {
    if (!isOwner || typeof document === 'undefined') return undefined;

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const select = findEnhanceableSelect(event.target);
      if (!select) return;
      event.preventDefault();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const select = findEnhanceableSelect(event.target);
      if (select) {
        event.preventDefault();
        select.focus();
        if (open && activeSelectRef.current === select) {
          closeMenu(true);
        } else {
          openForSelect(select);
        }
        return;
      }
      if (!open) return;
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      returnFocus.current = false;
      closeMenu(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const select = findEnhanceableSelect(event.target);
      if (!open && select) {
        const opens =
          event.key === ' ' ||
          event.key === 'F4' ||
          ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.altKey);
        if (opens) {
          event.preventDefault();
          openForSelect(select);
        }
      }
    };

    const onChange = (event: Event) => {
      if (open && event.target === activeSelectRef.current) {
        closeMenu(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('change', onChange, true);
    };
  }, [isOwner, open, closeMenu, openForSelect]);

  React.useLayoutEffect(() => {
    if (!open || !activeSelectRef.current) return undefined;
    const select = activeSelectRef.current;
    select.setAttribute('aria-hidden', 'true');
    setOptions(readSelectOptions(select));
    setSelectedVal(select.value ?? '');
    const placeNow = () => {
      if (!activeSelectRef.current || !activeSelectRef.current.isConnected) {
        closeMenu(false);
        return;
      }
      const next = measurePlace(activeSelectRef.current, menuRef.current);
      setPlace((current) =>
        current &&
        current.top === next.top &&
        current.bottom === next.bottom &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    };
    placeNow();
    menuRef.current?.focus();
    window.addEventListener('resize', placeNow);
    window.addEventListener('scroll', placeNow, true);
    return () => {
      window.removeEventListener('resize', placeNow);
      window.removeEventListener('scroll', placeNow, true);
    };
  }, [open, closeMenu]);

  React.useEffect(() => {
    if (!open) return;
    const node = menuRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const move = (dir: 1 | -1) => {
    if (options.length === 0) return;
    let index = active;
    for (let step = 0; step < options.length; step += 1) {
      index = (index + dir + options.length) % options.length;
      if (!options[index]?.disabled) {
        setActive(index);
        return;
      }
    }
  };

  const jumpTo = (key: string) => {
    const now = performance.now();
    const text = now - typed.current.at < 700 ? `${typed.current.text}${key}` : key;
    typed.current = { text, at: now };
    const needle = text.toLowerCase();
    for (let step = 1; step <= options.length; step += 1) {
      const index = (active + step) % options.length;
      const option = options[index];
      if (option && !option.disabled && option.label.toLowerCase().startsWith(needle)) {
        setActive(index);
        return;
      }
    }
  };

  const onMenuKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const index = options.findIndex((option) => !option.disabled);
      if (index >= 0) setActive(index);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let index = options.length - 1; index >= 0; index -= 1) {
        if (!options[index]?.disabled) {
          setActive(index);
          break;
        }
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option && !option.disabled) commit(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      returnFocus.current = false;
      closeMenu(false);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      jumpTo(event.key);
    }
  };

  if (!isOwner || !open || typeof document === 'undefined') return null;

  return createPortal(
    <ul
      ref={menuRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-activedescendant={options[active] ? `${listId}-opt-${active}` : undefined}
      className="rf2-select__menu"
      style={place ? { top: place.top, bottom: place.bottom, left: place.left, width: place.width, maxHeight: place.maxHeight } : undefined}
      onKeyDown={onMenuKey}
    >
      {options.length === 0 ? (
        <li className="rf2-select__empty">Nothing to choose</li>
      ) : (
        options.map((option, index) => {
          const selected = option.value === selectedVal;
          return (
            <li key={`${option.value}-${index}`} role="presentation">
              <div
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                data-active={index === active ? 'true' : undefined}
                className="rf2-select__option"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  if (!option.disabled) setActive(index);
                }}
                onClick={() => {
                  if (!option.disabled) commit(option.value);
                }}
              >
                <span>{option.label}</span>
                {selected ? <Check aria-hidden="true" /> : null}
              </div>
            </li>
          );
        })
      )}
    </ul>,
    document.body,
  );
}
