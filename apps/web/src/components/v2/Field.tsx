import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldTone = 'default' | 'error' | 'warning' | 'success';

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  warning?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  children: (a11y: { 'aria-invalid'?: true; 'aria-describedby'?: string; 'aria-required'?: true }) => React.ReactNode;
}

function FieldShell({ id, label, required, hint, error, warning, success, disabled, readOnly, className, children }: FieldShellProps) {
  const tone: FieldTone = error ? 'error' : warning ? 'warning' : success ? 'success' : 'default';
  const message = error ?? warning ?? success ?? hint;
  const msgId = message ? `${id}-msg` : undefined;
  const MsgIcon = tone === 'error' ? CircleX : tone === 'warning' ? TriangleAlert : tone === 'success' ? CircleCheck : null;
  return (
    <div className={cn('rf2-field', className)} data-state={tone} data-disabled={disabled || undefined} data-readonly={readOnly || undefined}>
      <label className="rf2-field__label" htmlFor={id}>
        {label}
        {required ? <span className="rf2-field__req" aria-hidden="true">*</span> : null}
      </label>
      {children({ 'aria-invalid': error ? true : undefined, 'aria-describedby': msgId, 'aria-required': required ? true : undefined })}
      {message ? (
        <p id={msgId} className={cn('rf2-field__msg', tone !== 'default' && `rf2-field__msg--${tone}`)} role={tone === 'error' ? 'alert' : undefined}>
          {MsgIcon ? <MsgIcon aria-hidden="true" /> : null}
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string; warning?: string; success?: string; fieldClassName?: string };

export interface InputV2Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, Common {
  leadingIcon?: React.ReactNode;
}

/** v2 Input. States: default/empty (placeholder), hover, focus-visible, disabled, read-only, error, warning, success. */
export const InputV2 = React.forwardRef<HTMLInputElement, InputV2Props>(function InputV2(
  { id, label, hint, error, warning, success, fieldClassName, leadingIcon, required, disabled, readOnly, className, ...rest },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? `rf2-in-${autoId}`;
  return (
    <FieldShell id={inputId} label={label} required={required} hint={hint} error={error} warning={warning} success={success} disabled={disabled} readOnly={readOnly} className={fieldClassName}>
      {(a11y) => (
        <div className="rf2-field__box">
          {leadingIcon ? <span aria-hidden="true" style={{ display: 'contents' }}>{leadingIcon}</span> : null}
          <input ref={ref} id={inputId} className={cn('rf2-field__control', className)} required={required} disabled={disabled} readOnly={readOnly} {...a11y} {...rest} />
        </div>
      )}
    </FieldShell>
  );
});

export interface SelectV2Props extends React.SelectHTMLAttributes<HTMLSelectElement>, Common {
  placeholder?: string;
}

type SelectOption = { value: string; label: string; disabled: boolean };
type MenuPlace = { top: number | 'auto'; bottom: number | 'auto'; left: number; width: number; maxHeight: number };

function readSelectOptions(select: HTMLSelectElement | null): SelectOption[] {
  if (!select) return [];
  return Array.from(select.options).map((option) => ({ value: option.value, label: option.label, disabled: option.disabled }));
}

function placeMenu(box: HTMLElement | null, contentWidth = 0): MenuPlace {
  const rect = box?.getBoundingClientRect();
  const gap = 6;
  if (!rect || rect.width === 0) return { top: 0, bottom: 'auto', left: 8, width: Math.max(contentWidth, 160), maxHeight: 320 };
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
 * v2 Select. The closed control stays a native select so labels, forms, and
 * existing value changes keep working. A pointer or Alt+Arrow opens a glass
 * list instead of the operating-system menu.
 */
export const SelectV2 = React.forwardRef<HTMLSelectElement, SelectV2Props>(function SelectV2(
  { id, label, hint, error, warning, success, fieldClassName, placeholder, required, disabled, className, children, onChange, onKeyDown, onMouseDown, onPointerDown, ...rest },
  ref,
) {
  const autoId = React.useId();
  const selectId = id ?? `rf2-sel-${autoId}`;
  const listId = `${selectId}-list`;
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLUListElement>(null);
  const returnFocus = React.useRef(true);
  const wasOpen = React.useRef(false);
  const typed = React.useRef({ text: '', at: 0 });
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<SelectOption[]>([]);
  const [active, setActive] = React.useState(0);
  const [place, setPlace] = React.useState<MenuPlace | null>(null);

  const setRefs = (node: HTMLSelectElement | null) => {
    selectRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const selectedValue = () => selectRef.current?.value ?? '';

  const openMenu = () => {
    if (disabled) return;
    const next = readSelectOptions(selectRef.current);
    const current = selectedValue();
    const currentIndex = next.findIndex((option) => option.value === current);
    const enabledFromCurrent = next.findIndex((option, index) => index >= Math.max(currentIndex, 0) && !option.disabled);
    setOptions(next);
    setActive(enabledFromCurrent >= 0 ? enabledFromCurrent : Math.max(currentIndex, 0));
    setPlace(placeMenu(boxRef.current));
    returnFocus.current = true;
    setOpen(true);
  };

  const commit = (value: string) => {
    const el = selectRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
  };

  React.useLayoutEffect(() => {
    if (!open) return undefined;
    setOptions(readSelectOptions(selectRef.current));
    const placeNow = () => {
      const next = measurePlace(boxRef.current, menuRef.current);
      setPlace((current) => (
        current && current.top === next.top && current.bottom === next.bottom && current.left === next.left && current.width === next.width && current.maxHeight === next.maxHeight
          ? current
          : next
      ));
    };
    placeNow();
    menuRef.current?.focus();
    window.addEventListener('resize', placeNow);
    window.addEventListener('scroll', placeNow, true);
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (boxRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      returnFocus.current = false;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('resize', placeNow);
      window.removeEventListener('scroll', placeNow, true);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (returnFocus.current && selectRef.current?.isConnected) selectRef.current.focus();
    returnFocus.current = true;
  }, [open]);

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
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Home') {
      event.preventDefault();
      const index = options.findIndex((option) => !option.disabled);
      if (index >= 0) setActive(index);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let index = options.length - 1; index >= 0; index -= 1) {
        if (!options[index]?.disabled) { setActive(index); break; }
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option && !option.disabled) commit(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      returnFocus.current = false;
      setOpen(false);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      jumpTo(event.key);
    }
  };

  const menu = open ? (
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
      {options.length === 0 ? <li className="rf2-select__empty">Nothing to choose</li> : options.map((option, index) => {
        const selected = option.value === selectedValue();
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
              onMouseEnter={() => { if (!option.disabled) setActive(index); }}
              onClick={() => { if (!option.disabled) commit(option.value); }}
            >
              <span>{option.label}</span>
              {selected ? <Check aria-hidden="true" /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <FieldShell id={selectId} label={label} required={required} hint={hint} error={error} warning={warning} success={success} disabled={disabled} className={fieldClassName}>
      {(a11y) => (
        <div ref={boxRef} className="rf2-field__box" data-open={open || undefined}>
          <select
            ref={setRefs}
            id={selectId}
            className={cn('rf2-field__control', className)}
            required={required}
            disabled={disabled}
            aria-hidden={open || undefined}
            {...a11y}
            {...rest}
            onChange={(event) => { setOpen(false); onChange?.(event); }}
            onMouseDown={(event) => {
              if (!disabled && event.button === 0) event.preventDefault();
              onMouseDown?.(event);
            }}
            onPointerDown={(event) => {
              if (!disabled && event.button === 0) {
                event.preventDefault();
                selectRef.current?.focus();
                if (open) setOpen(false);
                else openMenu();
              }
              onPointerDown?.(event);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.defaultPrevented || disabled) return;
              const opens = event.key === ' ' || event.key === 'F4' || ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.altKey);
              if (!open && opens) {
                event.preventDefault();
                openMenu();
              } else if (open) onMenuKey(event);
            }}
          >
            {placeholder !== undefined ? <option value="" disabled>{placeholder}</option> : null}
            {children}
          </select>
          <ChevronDown className="rf2-field__chevron" aria-hidden="true" />
          {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
        </div>
      )}
    </FieldShell>
  );
});

export interface TextareaV2Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, Common {}

/** v2 Textarea (E2 drawers): same field shell and states as Input. */
export const TextareaV2 = React.forwardRef<HTMLTextAreaElement, TextareaV2Props>(function TextareaV2(
  { id, label, hint, error, warning, success, fieldClassName, required, disabled, readOnly, className, rows = 4, ...rest },
  ref,
) {
  const autoId = React.useId();
  const areaId = id ?? `rf2-ta-${autoId}`;
  return (
    <FieldShell id={areaId} label={label} required={required} hint={hint} error={error} warning={warning} success={success} disabled={disabled} readOnly={readOnly} className={fieldClassName}>
      {(a11y) => (
        <div className="rf2-field__box rf2-field__box--area">
          <textarea ref={ref} id={areaId} rows={rows} className={cn('rf2-field__control rf2-field__control--area', className)} required={required} disabled={disabled} readOnly={readOnly} {...a11y} {...rest} />
        </div>
      )}
    </FieldShell>
  );
});
