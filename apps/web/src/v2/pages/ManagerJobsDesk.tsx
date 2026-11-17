import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, RotateCw, XCircle } from 'lucide-react';
import { ButtonV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { fetchManagedJobs, teamJobDetail, type TeamJob } from '../api/teamWork';
import { JobStatusDrawer } from '../drawers/JobStatusDrawer';
import { jobActions, type JobAction } from '../api/jobs';
import type { Person } from '../api/requisitions';

/** Open or closed jobs owned inside the manager's reporting line. Filled seats are confirmed joinings. */
export function ManagerJobsDesk({ people, mode }: { people: Person[] | null; mode: 'jobs' | 'closed' }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; rows: TeamJob[] } | { kind: 'error'; message: string } | { kind: 'unavailable' }>({ kind: 'loading' });
  const [action, setAction] = useState<{ job: TeamJob; action: JobAction } | null>(null);
  const ids = people?.map((person) => person.id).join(',') ?? '';

  useEffect(() => {
    if (!ids) { setState({ kind: 'unavailable' }); return undefined; }
    let live = true;
    setState({ kind: 'loading' });
    fetchManagedJobs(new Set(ids.split(',')))
      .then((rows) => live && setState({ kind: 'ready', rows }))
      .catch((error: { statusCode?: number; message?: string }) => {
        if (!live) return;
        const status = error?.statusCode;
        setState(status === 404 || status === 501 ? { kind: 'unavailable' } : { kind: 'error', message: error?.message || 'Could not load jobs.' });
      });
    return () => { live = false; };
  }, [ids, attempt]);

  const rows = state.kind === 'ready'
    ? state.rows.filter((job) => (mode === 'closed' ? job.status === 'Filled' || job.status === 'Closed' : job.status === 'Open' || job.status === 'Partially Filled' || job.status === 'On Hold'))
    : [];

  return (
    <section aria-label={mode === 'closed' ? 'Closed jobs' : 'Open jobs'}>
      {state.kind === 'loading' ? <SkeletonV2 lines={4} label="Loading jobs…" /> : null}
      {state.kind === 'unavailable' ? <EmptyStateV2 title="Job list is not available" body="The work queue did not return your team’s jobs. This is not zero jobs." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load jobs" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {state.kind === 'ready' && rows.length === 0 ? <EmptyStateV2 title={mode === 'closed' ? 'No closed jobs' : 'No open jobs'} body="Jobs owned by your reporting line show here." /> : null}
      {state.kind === 'ready' && rows.length > 0 ? (
        <div className="rf2-jscroll">
          <table className="rf2-jtable">
            <thead><tr><th scope="col">Job</th><th scope="col">Owner</th><th scope="col">Site</th><th scope="col">Joinings</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
            <tbody>
              {rows.map((job) => {
                const actions = jobActions(job.status);
                return (
                  <tr key={job.id}>
                    <td><Link className="rf2-link" to={`/vacancies/${encodeURIComponent(job.id)}`}>{job.title}</Link><p className="rf2-jtable__sub">{job.code}</p></td>
                    <td>{job.ownerName ?? '—'}</td>
                    <td>{job.site ?? '—'}</td>
                    <td>{job.filled} of {job.target}</td>
                    <td><StatusChip tone={job.status === 'On Hold' ? 'warning' : 'neutral'} label={job.status} /></td>
                    <td>
                      {actions.includes('hold') ? <ButtonV2 kind="tertiary" size="sm" icon={<Pause />} aria-label={`Hold ${job.title}`} onClick={() => setAction({ job, action: 'hold' })}>Hold</ButtonV2> : null}
                      {actions.includes('close') ? <ButtonV2 kind="tertiary" size="sm" icon={<XCircle />} aria-label={`Close ${job.title}`} onClick={() => setAction({ job, action: 'close' })}>Close</ButtonV2> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="rf2-inline-note">Confirmed joinings fill a seat. Approving a requisition does not. Hold and close record a reason. Reassigning open files stays on Team work and does not change this job owner.</p>
      {action ? (
        <JobStatusDrawer job={teamJobDetail(action.job)} initial={action.action} onClose={() => setAction(null)} onDone={() => { setAction(null); setAttempt((n) => n + 1); }} />
      ) : null}
    </section>
  );
}
