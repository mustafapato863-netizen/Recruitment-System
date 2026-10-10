import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CircleCheck, CircleMinus, CircleX, FileText, Info } from 'lucide-react';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { getApi } from '../../api/client';
import { fetchCompare, matchErrorFromError, sourceLabel, type CompareResponse } from '../api/matching';
import { jobTitle, type JobDetail } from '../api/jobs';
import { formatDay } from './OpenJobsV2';
import './jobs.css';

type App = { id: string; candidateId: string; stage: string; source?: string | null };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** E24 Compare on skills (B6 #13): each cell is written evidence or a written gap. No scores or percentages. */
export function CompareV2() {
  const [params] = useSearchParams();
  const job = params.get('job') ?? '';
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: CompareResponse; title: string; apps: App[] } | { kind: 'error'; message: string; forbidden?: boolean }>({ kind: 'loading' });
  useEffect(() => {
    if (!job || ids.length < 2 || ids.length > 4) { setState({ kind: 'error', message: 'Compare 2 to 4 candidates on one job.' }); return; }
    let live = true;
    Promise.all([
      fetchCompare(job, ids),
      getApi<JobDetail>(`/vacancies/${encodeURIComponent(job)}`).then(jobTitle).catch(() => 'this job'),
      getApi<{ data: App[] } | App[]>(`/applications?vacancyId=${encodeURIComponent(job)}&pageSize=100`).then((r) => (Array.isArray(r) ? r : r?.data ?? [])).catch(() => [] as App[]),
    ]).then(([data, title, apps]) => live && setState({ kind: 'ready', data, title, apps }))
      .catch((e: { statusCode?: number; message?: string }) => live && setState({ kind: 'error', forbidden: e?.statusCode === 403, message: matchErrorFromError(e)?.message || e?.message || 'Could not compare.' }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, params.get('ids')]);

  const back = <Link className="rf2-file__back" to="/candidates"><ArrowLeft aria-hidden="true" /> Back to Candidates</Link>;
  if (state.kind === 'loading') return <div className="rf2-jobs">{back}<SkeletonV2 lines={6} label="Comparing…" /></div>;
  if (state.kind === 'error') return <div className="rf2-jobs">{back}{state.forbidden ? <ForbiddenStateV2 body={state.message} /> : <div role="alert"><EmptyStateV2 title="Could not compare" body={state.message} /></div>}</div>;
  const { data, title, apps } = state;
  return (
    <div className="rf2-jobs">
      {back}
      <div><h1 className="rf2-jobs__title">Compare on skills — {title}</h1><p className="rf2-jobs__sub">Required skills: {data.rows.map((r) => r.skill.name).join(', ') || 'none'}. Each cell is written evidence or a written gap. No scores or percentages.</p></div>
      <section className="rf2-panel">
        <table className="rf2-cmp">
          <thead><tr><th scope="col">Skill</th>{data.candidates.map((c) => {
            const app = apps.find((a) => a.candidateId === c.id);
            return (
              <th scope="col" key={c.id}>
                <div className="rf2-kcard__top"><span className="rf2-kcard__avatar" aria-hidden="true">{initials(c.name)}</span><span className="rf2-jtable__name">{c.name}</span></div>
                <p className="rf2-jtable__sub">{app ? <><StatusChip tone="info" label={app.stage} /> {app.source ? `Source: ${app.source}` : ''}</> : 'In the bank · not on this job'}</p>
                {app ? (
                  <div className="rf2-cmp__acts">
                    <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/applications/${encodeURIComponent(app.id)}`}><FileText aria-hidden="true" /> Open file</Link>
                    {!['Joined', 'Rejected', 'Withdrawn'].includes(app.stage) ? <Link className="rf2-btn rf2-btn--danger-outline rf2-btn--sm" to={`/applications/${encodeURIComponent(app.id)}?drawer=reject`}><CircleX aria-hidden="true" /> Reject for {title}</Link> : null}
                  </div>
                ) : null}
              </th>
            );
          })}</tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.skill.id ?? r.skill.name}>
              <th scope="row"><p className="rf2-jtable__name">{r.skill.name}</p><p className="rf2-jtable__sub">Required</p></th>
              {r.cells.map((cell) => (
                <td key={cell.candidateId}>
                  {cell.status === 'evidence' ? cell.evidence.map((e) => (
                    <div key={e.id} className="rf2-cmp__cell" data-status="evidence"><CircleCheck aria-label="Evidence" /><div><p>{e.snippet ?? `${r.skill.name} evidenced`}</p><p className="rf2-jtable__sub">{sourceLabel(e.sourceType)}{e.sourceRef ? ` · ${e.sourceRef}` : ''} · {formatDay(e.addedAt)}{e.addedBy ? ` · ${e.addedBy.name}` : ''}</p></div></div>
                  )) : (
                    <div className="rf2-cmp__cell" data-status={cell.status}><CircleMinus aria-hidden="true" /><p>{cell.status === 'no-evidence' ? `Has ${r.skill.name} on the profile — no evidence yet.` : `No ${r.skill.name} on the profile.`}</p></div>
                  )}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </section>
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Reject for {title} closes only that application. People stay in the Candidates bank for other jobs.</p>
    </div>
  );
}
