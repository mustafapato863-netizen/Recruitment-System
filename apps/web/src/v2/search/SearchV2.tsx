import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { useAuth } from '../../auth/AuthContext';
import { scopedSearch, type ScopedSearch } from '../api/searchNotify';
import '../pages/jobs.css';

/** E07 full results page (/search?q=), v2 shell only. */
export function SearchV2() {
  const shell = useV2Shell();
  const meId = useAuth().user?.id;
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: ScopedSearch } | { kind: 'forbidden' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  useEffect(() => {
    if (!shell || q.length < 2 || !meId) return undefined;
    const sig = { aborted: false };
    setState({ kind: 'loading' });
    scopedSearch(q, meId, sig).then((data) => !sig.aborted && setState({ kind: 'ready', data }))
      .catch((e: { statusCode?: number; message?: string }) => !sig.aborted && setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Search failed.' }));
    return () => { sig.aborted = true; };
  }, [shell, q, meId]);
  if (!shell) return <Navigate to="/" replace />;
  return (
    <div className="rf2-jobs">
      <div><h1 className="rf2-jobs__title">Search results</h1><p className="rf2-jobs__sub">{q.length < 2 ? 'Type at least 2 characters in the search box.' : `Results for “${q}”`}</p></div>
      {q.length < 2 ? null : state.kind === 'loading' ? <SkeletonV2 lines={5} label="Searching…" />
        : state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include search." />
        : state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Search failed" body={state.message} /></div>
        : state.data.shown === 0 ? <EmptyStateV2 title="No matches in your work" body={state.data.hidden ? 'Some matches are outside your scope and are not shown.' : 'Try a name, job title or code.'} />
        : state.data.groups.map((g) => (
          <section key={g.label} className="rf2-panel" aria-labelledby={`sg-${g.label}`}>
            <h2 id={`sg-${g.label}`} className="rf2-jobs__section">{g.label} <span className="rf2-jtable__sub">{g.items.length}</span></h2>
            <ul className="rf2-sresults">{g.items.map((r) => (
              <li key={r.key}>{r.href ? <Link to={r.href} className="rf2-kcard__name">{r.title}</Link> : <span className="rf2-jtable__name">{r.title}</span>}<span className="rf2-jtable__sub">{[r.meta, r.note].filter(Boolean).join(' · ')}</span></li>
            ))}</ul>
          </section>
        ))}
      {state.kind === 'ready' && state.data.hidden ? <p className="rf2-inline-note"><Info aria-hidden="true" /> {state.data.hidden} match{state.data.hidden === 1 ? ' is' : 'es are'} outside your scope and not shown. Other recruiters' jobs show title, site and seats only.</p> : null}
    </div>
  );
}
