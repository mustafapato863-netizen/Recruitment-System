import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Download, Info, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, initials, SkeletonV2, StatusChip } from '../../components/v2';
import { cairoMonth, MIN_SAMPLE, monthLabel, tooFew, type ResultTile, type TileKey } from '../api/myResult';
import { fetchTeamResult, rowTooFew, sampleText, type TeamResult, type TeamResultLoad } from '../api/teamResult';
import './jobs.css';
import './team.css';

const COLS: Array<{ key: TileKey; label: string }> = [
  { key: 'seats', label: 'Seats' }, { key: 'overdueFollowUps', label: 'Overdue follow-ups' },
  { key: 'screensReachedInterview', label: 'Screen → interview' }, { key: 'offersAccepted', label: 'Offers accepted' },
];
const shift = (m: string, n: number) => { const d = new Date(`${m}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const shownMeasure = (k: TileKey, t: ResultTile) => {
  const value = k === 'overdueFollowUps' ? String(t.value) : `${t.value} of ${t.of}`;
  return t.detail ? `${value} ${t.detail}` : value;
};
const csvCell = (value: string) => {
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) || text !== value ? `"${text.replace(/"/g, '""')}"` : text;
};
/** CSV of the table already on screen for this month. No extra request, and no field the table does not show. */
function teamResultCsv(data: TeamResult): string {
  const head = ['Recruiter', ...COLS.map((c) => c.label), 'Sample'];
  const lines = data.rows.map((row) => {
    const names = data.people.map((p) => p.name).join(', ');
    const recruiter = row.person?.name ?? (names ? `Your team: ${names}` : 'Your team');
    const sample = `${sampleText(row.tiles)}${rowTooFew(row.tiles) ? ' Too few to judge' : ''}`;
    return [recruiter, ...COLS.map((c) => shownMeasure(c.key, row.tiles[c.key])), sample].map(csvCell).join(',');
  });
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}
function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Cell({ k, t }: { k: TileKey; t: ResultTile }) {
  const few = tooFew(k, t);
  return (
    <td className="rf2-num" data-too-few={few || undefined}>
      <span className="rf2-tres__v">{k === 'overdueFollowUps' ? t.value : `${t.value} of ${t.of}`}</span>
      {t.detail ? <span className="rf2-jtable__sub">{t.detail}</span> : null}
    </td>
  );
}

/** M4 Team result (Manager, v2): the four monthly measures for my direct reports (B8 /results/team). Not ranked. */
export function TeamResultV2() {
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : cairoMonth();
  const [state, setState] = useState<{ kind: 'loading' } | TeamResultLoad | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    fetchTeamResult(month).then((r) => live && setState(r)).catch((e: { message?: string }) => live && setState({ kind: 'error', message: e?.message || 'Something went wrong.' }));
    return () => { live = false; };
  }, [month, attempt]);
  const setMonth = (m: string) => { const n = new URLSearchParams(params); n.set('month', m); setParams(n); };
  const data = state.kind === 'ready' ? state.data : null;
  const isCurrent = month >= cairoMonth();
  const canExport = !!data && data.rows.length > 0;

  return (
    <div className="rf2-jobs rf2-tres">
      <div className="rf2-row-between">
        <div>
          <h1 className="rf2-jobs__title">Team result</h1>
        </div>
        <div className="rf2-row-between">
          {canExport && data ? <ButtonV2 kind="secondary" size="sm" icon={<Download />} onClick={() => downloadCsv(`team-result-${month}.csv`, teamResultCsv(data))}>Export</ButtonV2> : null}
          <div className="rf2-segmented" role="group" aria-label="Month">
            <ButtonV2 kind="secondary" size="sm" icon={<ChevronLeft />} onClick={() => setMonth(shift(month, -1))} aria-label="Previous month" />
            <span className="rf2-tres__month" aria-live="polite">{monthLabel(month)}</span>
            <ButtonV2 kind="secondary" size="sm" icon={<ChevronRight />} onClick={() => setMonth(shift(month, 1))} disabled={isCurrent} aria-label="Next month" />
          </div>
        </div>
      </div>
      {state.kind === 'loading' ? <SkeletonV2 lines={5} label="Loading team result…" /> : null}
      {state.kind === 'no-reports' ? <ForbiddenStateV2 body="Team result is for managers with direct reports. Nobody reports to you yet." /> : null}
      {state.kind === 'unavailable' ? <EmptyStateV2 title="Team result is not available yet" body="This server does not have monthly results (/results/team) yet." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load team result" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <>
          <p className="rf2-inline-note">Your {data.people.length} direct {data.people.length === 1 ? 'report' : 'reports'}, alphabetical, not ranked.</p>
          <p className="rf2-inline-note">Team result counts direct reports, while Team work lists the reporting line.</p>
          <section className="rf2-panel" aria-labelledby="tres-h">
            <h2 id="tres-h" className="rf2-sr-only">Team result for {monthLabel(month)}</h2>
            <table className="rf2-jtable rf2-tres__table">
              <thead><tr><th scope="col">Recruiter</th>{COLS.map((c) => <th key={c.key} scope="col">{c.label}</th>)}<th scope="col">Sample</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.person?.id ?? 'team'}>
                    <th scope="row">
                      <div className="rf2-tres__who">
                        <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{r.person ? initials(r.person.name) : data.people.length}</span>
                        <div><p className="rf2-jtable__name">{r.person?.name ?? 'Your team'}</p><p className="rf2-jtable__sub">{r.person ? '' : data.people.map((p) => p.name).join(', ') || 'No direct reports'}</p></div>
                      </div>
                    </th>
                    {COLS.map((c) => <Cell key={c.key} k={c.key} t={r.tiles[c.key]} />)}
                    <td><span className="rf2-jtable__sub">{sampleText(r.tiles)}</span>{rowTooFew(r.tiles) ? <StatusChip tone="neutral" icon={<Clock />} label="Too few to judge" /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {!data.perPerson && data.people.length > 1 ? <p className="rf2-inline-note"><Info aria-hidden="true" /> One row for the whole team: the results API returns team totals, not a row per recruiter. Each recruiter sees their own numbers in My result.</p> : null}
          <p className="rf2-inline-note"><Info aria-hidden="true" /> Sample size: a measure with fewer than {MIN_SAMPLE} cases shows “Too few to judge” and raw counts only (Seats are never judged on sample). No call, message or CV-view counts are collected. Activity is not a score.</p>
          <p className="rf2-inline-note"><Clock aria-hidden="true" /> {monthLabel(month)} only — no previous-period comparison.</p>
        </>
      ) : null}
    </div>
  );
}
