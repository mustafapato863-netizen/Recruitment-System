import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RotateCw, Search } from 'lucide-react';
import { ButtonV2, EmptyStateV2, InputV2, SkeletonV2, StatusChip, type StatusTone } from '../../components/v2';
import { getApi } from '../../api/client';
import './jobs.css';
import './team.css';

type HiringCaseRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  plannedJoiningDate?: string | null;
  status: string;
  /** Meeting notes 2026-11-25 (item 6): reporting cycle recorded at Joined. */
  reportingCycle?: string | null;
  /** Meeting notes 2026-11-25 (item 6): the NewJoinerTargets task status. */
  newJoinerTargetsStatus?: 'Pending' | 'Done' | null;
  ownerUserId?: string | null;
  approvedHeadcount?: number | null;
  joinedHeadcount?: number | null;
};

type LoadState = { kind: 'loading' } | { kind: 'ready'; records: HiringCaseRow[] } | { kind: 'error'; message: string };

const filters = ['', 'Pending Compliance', 'Pending Final Approval', 'Awaiting Joining', 'Joined', 'Postponed', 'No-show', 'Withdrawn'] as const;
const tone: Record<string, StatusTone> = {
  'Pending Compliance': 'warning',
  'Pending Final Approval': 'warning',
  'Awaiting Joining': 'info',
  Joined: 'success',
  Postponed: 'warning',
  'No-show': 'danger',
  Withdrawn: 'neutral',
};
function nextStep(status: string): string {
  if (status === 'Pending Compliance') return 'Complete checks';
  if (status === 'Pending Final Approval') return 'Review approval';
  if (status === 'Awaiting Joining') return 'Confirm joining';
  return 'View case';
}
function caseHref(id: string, status: string): string {
  const path = `/hires/${encodeURIComponent(id)}`;
  return status === 'Awaiting Joining' ? `${path}#checklist` : path;
}
function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
}

/** Native V2 hiring-case index; detail actions stay in the authorized hiring-case API. */
export function HiresV2() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const search = params.get('q') ?? '';

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    getApi<HiringCaseRow[]>('/hiring')
      .then((rows) => {
        if (!active) return;
        if (!Array.isArray(rows)) throw new Error('The hiring-case response was invalid.');
        setState({ kind: 'ready', records: rows });
      })
      .catch((reason: unknown) => {
        if (active) setState({ kind: 'error', message: reason instanceof Error ? reason.message : 'Unable to load hiring cases.' });
      });
    return () => { active = false; };
  }, [attempt]);

  const rows = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const query = search.trim().toLocaleLowerCase();
    return state.records.filter((item) => (!status || item.status === status)
      && (!query || [item.candidateName, item.positionTitle, item.branchName].some((field) => field.toLocaleLowerCase().includes(query))));
  }, [state, status, search]);

  const change = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <main className="rf2-jobs rf2-team">
      <header className="rf2-team__bar">
        <div>
          <h1 className="rf2-team__title">Hiring cases</h1>
          <p className="rf2-team__intro">Track compliance, final authorization and actual joining as separate controlled steps.</p>
        </div>
        <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Refresh</ButtonV2>
      </header>

      <div className="rf2-team__toolbar">
        <div className="rf2-row-between" style={{ flexWrap: 'wrap', width: '100%', gap: '1rem' }}>
          <div className="rf2-tabs" role="group" aria-label="Hiring-case status">
            {filters.map((value) => (
              <button key={value} type="button" className="rf2-tab" aria-pressed={status === value}
                onClick={() => change({ status: value || null })}>
                {value || 'All cases'}
                {state.kind === 'ready' ? <span className="rf2-tab__count" aria-hidden="true">{value ? state.records.filter((x) => x.status === value).length : state.records.length}</span> : null}
              </button>
            ))}
          </div>
          <div style={{ width: 285, maxWidth: '100%' }}>
            <InputV2 label="Search hiring cases" fieldClassName="rf2-jobs__search rf2-sr-label" leadingIcon={<Search />}
              placeholder="Candidate, position or site" value={search} onChange={(e) => change({ q: e.target.value || null })} />
          </div>
        </div>
      </div>
      <section className="rf2-panel">
        {state.kind === 'loading' ? <SkeletonV2 lines={5} label="Loading hiring cases…" /> : null}
        {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Unable to load hiring cases" body={state.message}
          action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
        {state.kind === 'ready' && rows.length === 0 ? (
          <EmptyStateV2 title="No hiring cases found" body={state.records.length ? 'No records match the selected filters.' : 'When an offer is accepted, its hiring case will appear here.'} />
        ) : null}
        {state.kind === 'ready' && rows.length > 0 ? (
          <div className="rf2-jscroll">
            <table className="rf2-jtable" aria-label="Hiring cases">
              <thead><tr><th scope="col">Candidate</th><th scope="col">Position / Site</th><th scope="col">Planned start</th><th scope="col">Status</th><th scope="col">Reporting cycle</th><th scope="col">Next step</th></tr></thead>
              <tbody>{rows.map((item) => (
                <tr key={item.id}>
                  <td><strong className="rf2-jtable__name">{item.candidateName}</strong></td>
                  <td><strong>{item.positionTitle}</strong><p className="rf2-jtable__sub">{item.branchName}</p></td>
                  <td>{dateLabel(item.plannedJoiningDate)}</td>
                  <td><StatusChip tone={tone[item.status] ?? 'neutral'} label={item.status} /></td>
                  <td>{item.reportingCycle ? `${item.reportingCycle === 'weekly' ? 'Weekly' : 'Monthly'}${item.newJoinerTargetsStatus ? ` · Targets ${item.newJoinerTargetsStatus === 'Done' ? 'set' : 'pending'}` : ''}` : '—'}</td>
                  <td><Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={caseHref(item.id, item.status)}>{nextStep(item.status)}</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </section>
      <p className="rf2-jtable__sub">Final approval does not automatically mark the candidate as Joined. The responsible recruiter records the actual start separately.</p>
    </main>
  );
}
