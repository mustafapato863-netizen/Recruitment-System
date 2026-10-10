import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Info, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { cairoMonth, fetchMyResult, monthLabel, MIN_SAMPLE, tooFew, type MyResult, type ResultTile } from '../api/myResult';
import { formatDay } from './OpenJobsV2';
import './jobs.css';

function Tile({ title, tile, headline, sub, foot }: { title: string; tile: ResultTile; headline: string; sub?: string | null; foot?: string | null }) {
  const few = tooFew(tile);
  return (
    <section className="rf2-panel rf2-kpi" aria-label={title}>
      <h2 className="rf2-kpi__title">{title}</h2>
      <p className="rf2-kpi__value" data-few={few || undefined}>{few ? 'Too few to judge' : headline}</p>
      <p className="rf2-kpi__sub">{few ? `${headline} so far` : sub}</p>
      <p className="rf2-kpi__foot">{tile.detail ? <>{tile.detail}<br /></> : null}<span className="rf2-kpi__n">Based on {tile.sampleSize} {tile.sampleSize === 1 ? 'record' : 'records'}{few ? ` · needs ${MIN_SAMPLE}` : ''}</span>{foot ? <><br />{foot}</> : null}</p>
    </section>
  );
}

/** E04 My result (Employee, v2 only). Four numbers, sample counts, "Too few to judge" under 5. Not a score. */
export function MyResultV2() {
  const shell = useV2Shell();
  const [params] = useSearchParams();
  const job = params.get('job');
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : cairoMonth();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: MyResult } | { kind: 'unavailable' } | { kind: 'forbidden' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  useEffect(() => {
    if (shell?.seat !== 'employee') return;
    let live = true;
    setState({ kind: 'loading' });
    fetchMyResult(month, job).then((r) => live && setState(r)).catch((e: { statusCode?: number; message?: string }) => live && setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' }));
    return () => { live = false; };
  }, [shell?.seat, month, job, attempt]);
  if (shell?.seat !== 'employee') return <Navigate to="/my-work" replace />;

  const back = <Link className="rf2-file__back" to="/my-work"><ArrowLeft aria-hidden="true" /> Back to My Work</Link>;
  const scope = state.kind === 'ready' && state.data.vacancy ? `${state.data.vacancy.title} only` : 'All my jobs';
  return (
    <div className="rf2-jobs">
      {back}
      <div><h1 className="rf2-jobs__title">My result</h1><p className="rf2-jobs__sub">{monthLabel(month)} · monthly · {scope}.</p></div>
      {state.kind === 'loading' ? <SkeletonV2 lines={4} label="Loading my result…" /> : null}
      {state.kind === 'unavailable' ? <EmptyStateV2 title="My result is not available yet" body="The result numbers are still being built. Your work is all on My Work in the meantime." /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include results." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load my result" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {state.kind === 'ready' ? (() => {
        const d = state.data;
        return (
          <div className="rf2-kpis">
            <Tile title="Seats" tile={d.seats} headline={`${d.seats.value} of ${d.seats.of ?? 0} filled`} sub={d.seats.dueDate ? `Due ${formatDay(d.seats.dueDate)}` : 'No due date'} foot={d.seats.of != null ? `Open seats: ${Math.max(0, d.seats.of - d.seats.value)}` : null} />
            <Tile title="Overdue follow-ups" tile={d.overdueFollowUps} headline={String(d.overdueFollowUps.value)} sub={d.overdueFollowUps.value ? 'past their follow-up date' : 'none overdue'} foot="Follow-up dates are set on each file" />
            <Tile title="Screens with a note" tile={d.screensReachedInterview} headline={String(d.screensReachedInterview.of ?? 0)} sub={`${d.screensReachedInterview.value} reached interview`} />
            <Tile title="Offers accepted against sent" tile={d.offersAccepted} headline={`${d.offersAccepted.value} of ${d.offersAccepted.of ?? 0}`} sub={d.offersAccepted.of ? 'accepted of sent' : 'none sent yet'} />
          </div>
        );
      })() : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Activity is not a score. These numbers show where work stands, not how well you are doing. Nothing here is ranked or compared with colleagues.</p>
    </div>
  );
}
