import * as React from 'react';
import { ChevronDown, LoaderCircle, X } from 'lucide-react';
import type { UserRecord } from '@recruitflow/contracts';
import { getApi } from '@/api/client';
import { cn } from '@/lib/utils';

/** What the picker shows. Deliberately no pay or salary fields. */
export interface UserOption {
  id: string;
  name: string;
  /** Role / team line, e.g. "Recruiter-offshore". */
  detail?: string;
  disabledReason?: string;
}

export interface UserPickerAdapter {
  search: (query: string, signal: AbortSignal) => Promise<UserOption[]>;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Maps the API UserRecord to a picker option. Only id, name, role/job title. */
export function toUserOption(u: Pick<UserRecord, 'id' | 'displayName' | 'email' | 'jobTitle' | 'roles'>): UserOption {
  const detail = u.jobTitle?.trim() || u.roles?.[0]?.name || undefined;
  return { id: u.id, name: u.displayName?.trim() || u.email, detail };
}

/**
 * Adapter over an existing endpoint. GET /users/assignable and GET
 * /users/interviewers both return UserRecord[] (active users in the org; no
 * query param), so the list is fetched once and filtered client-side.
 */
export function createUsersAdapter(
  path: '/users/assignable' | '/users/interviewers',
  fetcher: (p: string) => Promise<unknown> = getApi,
): UserPickerAdapter {
  let cache: Promise<UserOption[]> | null = null;
  const load = () => {
    cache ??= fetcher(path).then((res) => {
      const rows = Array.isArray(res) ? res : ((res as { data?: unknown[] })?.data ?? []);
      return (rows as UserRecord[]).map(toUserOption);
    }).catch((err) => { cache = null; throw err; });
    return cache;
  };
  return {
    async search(query, signal) {
      const all = await load();
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const q = query.trim().toLowerCase();
      return q ? all.filter((o) => o.name.toLowerCase().includes(q) || (o.detail ?? '').toLowerCase().includes(q)) : all;
    },
  };
}

export const assignableUsersAdapter = () => createUsersAdapter('/users/assignable');
export const interviewersAdapter = () => createUsersAdapter('/users/interviewers');

type Base = {
  label: string;
  adapter: UserPickerAdapter;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  debounceMs?: number;
  id?: string;
  /** Selected options are needed to render chips/names without refetching. */
};
type Single = Base & { multiple?: false; value: UserOption | null; onChange: (v: UserOption | null) => void };
type Multi = Base & { multiple: true; value: UserOption[]; onChange: (v: UserOption[]) => void };
export type UserPickerProps = Single | Multi;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** ARIA 1.2 combobox with a listbox popup. Single or multi select. */
export function UserPicker(props: UserPickerProps) {
  const { label, adapter, placeholder = 'Search people', hint, error, disabled, required, debounceMs = 250, id } = props;
  const autoId = React.useId();
  const inputId = id ?? `rf2-up-${autoId}`;
  const listId = `${inputId}-list`;
  const msgId = `${inputId}-msg`;
  const statusId = `${inputId}-status`;
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<UserOption[]>([]);
  const [state, setState] = React.useState<LoadState>('idle');
  const [active, setActive] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selectedIds = new Set(props.multiple ? props.value.map((v) => v.id) : props.value ? [props.value.id] : []);

  // Debounced async search while open.
  React.useEffect(() => {
    if (!open) return undefined;
    const ctrl = new AbortController();
    setState('loading');
    const t = window.setTimeout(() => {
      adapter.search(query, ctrl.signal).then((res) => {
        if (ctrl.signal.aborted) return;
        setOptions(res);
        setState('ready');
        setActive(res.findIndex((o) => !o.disabledReason));
      }).catch((err: unknown) => {
        if (ctrl.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
        setState('error');
      });
    }, debounceMs);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [open, query, adapter, debounceMs]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (opt: UserOption) => {
    if (opt.disabledReason) return;
    if (props.multiple) {
      const exists = props.value.some((v) => v.id === opt.id);
      props.onChange(exists ? props.value.filter((v) => v.id !== opt.id) : [...props.value, opt]);
      setQuery('');
    } else {
      props.onChange(opt);
      setQuery('');
      setOpen(false);
    }
  };

  const move = (from: number, step: 1 | -1) => {
    if (options.length === 0) return -1;
    let i = from;
    for (let n = 0; n < options.length; n += 1) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabledReason) return i;
    }
    return from;
  };
  const firstEnabled = () => options.findIndex((o) => !o.disabledReason);
  const lastEnabled = () => { for (let i = options.length - 1; i >= 0; i -= 1) if (!options[i].disabledReason) return i; return -1; };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true); else setActive((a) => move(a, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true); else setActive((a) => move(a < 0 ? 0 : a, -1));
        break;
      case 'Home':
        if (open) { e.preventDefault(); setActive(firstEnabled()); }
        break;
      case 'End':
        if (open) { e.preventDefault(); setActive(lastEnabled()); }
        break;
      case 'Enter':
        if (open && active >= 0 && options[active]) { e.preventDefault(); choose(options[active]); }
        break;
      case 'Escape':
        if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        else if (query) setQuery('');
        break;
      case 'Backspace':
        if (props.multiple && query === '' && props.value.length > 0) props.onChange(props.value.slice(0, -1));
        break;
      default:
    }
  };

  const activeId = open && active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined;
  const single = !props.multiple ? props.value : null;
  const describedBy = [error || hint ? msgId : null, statusId].filter(Boolean).join(' ');
  const statusText = !open ? '' : state === 'loading' ? 'Loading people…' : state === 'error' ? 'Could not load people.' : state === 'ready' ? (options.length === 0 ? 'No people match.' : `${options.length} result${options.length === 1 ? '' : 's'}.`) : '';

  return (
    <div ref={rootRef} className="rf2-field rf2-picker" data-state={error ? 'error' : 'default'} data-disabled={disabled || undefined}>
      <label className="rf2-field__label" htmlFor={inputId}>
        {label}{required ? <span className="rf2-field__req" aria-hidden="true">*</span> : null}
      </label>
      <div className="rf2-field__box rf2-picker__box" onMouseDown={(e) => { if (e.target !== inputRef.current && !disabled) { e.preventDefault(); inputRef.current?.focus(); setOpen(true); } }}>
        {props.multiple ? (
          <ul className="rf2-picker__chips" aria-label={`Selected for ${label}`}>
            {props.value.map((v) => (
              <li key={v.id} className="rf2-picker__chip">
                <span className="rf2-avatar rf2-avatar--xs" aria-hidden="true">{initials(v.name)}</span>
                <span>{v.name}</span>
                <button type="button" className="rf2-picker__chip-x" aria-label={`Remove ${v.name}`} disabled={disabled}
                  onClick={() => (props as Multi).onChange((props as Multi).value.filter((x) => x.id !== v.id))}>
                  <X aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : single && !open ? (
          <span className="rf2-avatar" aria-hidden="true">{initials(single.name)}</span>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          className="rf2-field__control"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          placeholder={single && !open ? '' : placeholder}
          value={!props.multiple && single && !open ? single.name : query}
          onFocus={() => undefined}
          onClick={() => !disabled && setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {!props.multiple && single && !open ? <span className="rf2-picker__detail">{single.detail}</span> : null}
        {state === 'loading' && open ? <LoaderCircle className="rf2-spin" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </div>
      <ul id={listId} role="listbox" aria-label={label} aria-multiselectable={props.multiple || undefined} className="rf2-picker__list" hidden={!open}>
        {open && state === 'ready' ? options.map((o, i) => {
          const selected = selectedIds.has(o.id);
          return (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={selected}
              aria-disabled={o.disabledReason ? true : undefined}
              data-active={i === active || undefined}
              className={cn('rf2-picker__option')}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => !o.disabledReason && setActive(i)}
              onClick={() => choose(o)}
            >
              <span className="rf2-avatar" aria-hidden="true">{initials(o.name)}</span>
              <span className="rf2-picker__text">
                <span className="rf2-picker__name">{o.name}</span>
                {o.detail ? <span className="rf2-picker__meta">{o.detail}</span> : null}
                {o.disabledReason ? <span className="rf2-picker__reason">{o.disabledReason}</span> : null}
              </span>
              {selected ? <span className="rf2-picker__check" aria-hidden="true">✓</span> : null}
            </li>
          );
        }) : null}
      </ul>
      {open && state !== 'ready' || (open && state === 'ready' && options.length === 0) ? (
        <div className="rf2-picker__list rf2-picker__state" data-picker-state={state === 'ready' ? 'empty' : state}>
          {state === 'loading' ? 'Loading people…' : state === 'error' ? (
            <span className="rf2-field__msg rf2-field__msg--error">Could not load people. <button type="button" className="rf2-btn rf2-btn--tertiary rf2-btn--sm" onClick={() => { setOpen(false); window.setTimeout(() => setOpen(true)); }}>Retry</button></span>
          ) : query ? `No people match “${query}”.` : 'No people available.'}
        </div>
      ) : null}
      <span id={statusId} className="rf2-sr-only" role="status" aria-live="polite">{statusText}</span>
      {error || hint ? <p id={msgId} className={cn('rf2-field__msg', error && 'rf2-field__msg--error')}>{error ?? hint}</p> : null}
    </div>
  );
}
