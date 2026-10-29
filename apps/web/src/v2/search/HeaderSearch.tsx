import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { scopedSearch, type ScopedResult, type ScopedSearch } from '../api/searchNotify';
import { usePageReturn } from '../returnTarget';

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** E07 header search (ARIA combobox). Debounced GET /search, scoped client-side (see searchNotify.ts). Enter on no option → /search?q=. */
export function HeaderSearch({ placeholder, meId }: { placeholder: string; meId: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; data: ScopedSearch } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const [active, setActive] = useState(-1);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const pageReturn = usePageReturn();
  const flat: ScopedResult[] = res.kind === 'ready' ? res.data.groups.flatMap((g) => g.items) : [];

  useEffect(() => {
    if (q.trim().length < 2) { setRes({ kind: 'idle' }); return undefined; }
    const sig = { aborted: false };
    setRes({ kind: 'loading' });
    const t = window.setTimeout(() => {
      scopedSearch(q, sig, pageReturn).then((data) => { if (!sig.aborted) { setRes({ kind: 'ready', data }); setActive(-1); } })
        .catch((e: { statusCode?: number; message?: string }) => { if (!sig.aborted) setRes({ kind: 'error', message: e?.statusCode === 403 ? 'Your role does not include search.' : 'Search failed. Try again.' }); });
    }, 250);
    return () => { sig.aborted = true; window.clearTimeout(t); };
  }, [q, meId, pageReturn]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const go = (r: ScopedResult) => { if (!r.href) return; setOpen(false); setQ(''); navigate(r.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); setOpen(false); } else setQ(''); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active]);
      else if (q.trim().length >= 2) { setOpen(false); navigate(`/search?q=${encodeURIComponent(q.trim())}`); }
    }
  };
  const show = open && q.trim().length >= 2;
  let idx = -1;
  return (
    <div className="rf2-hsearch" ref={wrap}>
      <div className="rf2-search-entry rf2-hsearch__box">
        <Search aria-hidden="true" />
        <input role="combobox" aria-label={placeholder} placeholder={placeholder} aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${id}-o${active}` : undefined}
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
      </div>
      {show ? (
        <div className="rf2-popover rf2-hsearch__pop">
          <p className="rf2-hsearch__head" aria-live="polite">
            <span>Results for “{q.trim()}”</span>
            <span>{res.kind === 'ready' ? `${res.data.shown} result${res.data.shown === 1 ? '' : 's'}${res.data.hidden ? ' · items outside your scope are not shown' : ''}` : res.kind === 'loading' ? 'Searching…' : ''}</span>
          </p>
          {res.kind === 'error' ? <p className="rf2-hsearch__empty" role="alert">{res.message}</p> : null}
          {res.kind === 'ready' && res.data.shown === 0 ? <p className="rf2-hsearch__empty">No matches in your work.</p> : null}
          <div id={`${id}-list`} role="listbox" aria-label="Search results">
            {res.kind === 'ready' ? res.data.groups.map((g) => (
              <div role="group" aria-label={g.label} key={g.label}>
                <p className="rf2-hsearch__group" aria-hidden="true">{g.label}</p>
                {g.items.map((r) => { idx++; const i = idx; return (
                  <div key={r.key} id={`${id}-o${i}`} role="option" aria-selected={i === active} className="rf2-hsearch__opt" data-active={i === active || undefined}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => go(r)} onMouseEnter={() => setActive(i)}>
                    <span className="rf2-kcard__avatar" aria-hidden="true">{initials(r.title)}</span>
                    <span className="rf2-hsearch__txt"><span className="rf2-jtable__name">{r.title}</span><span className="rf2-jtable__sub">{[r.meta, r.note].filter(Boolean).join(' · ')}</span></span>
                    {i === active ? <kbd className="rf2-hsearch__kbd" aria-hidden="true">Enter</kbd> : null}
                  </div>
                ); })}
              </div>
            )) : null}
          </div>
          {res.kind === 'ready' && res.data.shown ? <button type="button" className="rf2-hsearch__all" onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}>See all results</button> : null}
        </div>
      ) : null}
    </div>
  );
}
