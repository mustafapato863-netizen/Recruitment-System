import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageReturn, withReturnTo } from '../returnTarget';
import { ArrowLeftRight, Briefcase, Pause, XCircle, Star, CalendarClock, CircleAlert, CircleCheck, Clock, Eye, Info, RotateCw, TriangleAlert, Users } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, initials, SkeletonV2, StatusChip } from '../../components/v2';
import { useAuth } from '../../auth/AuthContext';
import { fetchTeamJobs, fetchTeamWork, fileHref, teamJobDetail, type ReportWork, type TeamJob, type TaskTone, type TeamTask, type TeamWork, type WaitingOffer } from '../api/teamWork';
import { ReassignDrawer } from '../drawers/ReassignDrawer';
import { OfferDecisionDrawer } from '../drawers/OfferDecisionDrawer';
import { canSeePay } from '../api/offerDecision';
import { JobStatusDrawer } from '../drawers/JobStatusDrawer';
import { jobActions, type JobAction } from '../api/jobs';
import './jobs.css';
import './team.css';

const CHIP: Record<Exclude<TaskTone, null>, { tone: 'danger' | 'info' | 'neutral'; label: string }> = {
  overdue: { tone: 'danger', label: 'Overdue' }, today: { tone: 'info', label: 'Today' }, week: { tone: 'info', label: 'This week' }, waiting: { tone: 'neutral', label: 'Waiting' },
};
const ICON: Record<TeamTask['kind'], React.ReactNode> = {
  'followup-overdue': <Clock aria-hidden="true" />, gate: <TriangleAlert aria-hidden="true" />, offer: <Clock aria-hidden="true" />,
  followup: <Clock aria-hidden="true" />, interview: <CalendarClock aria-hidden="true" />, next: <CircleCheck aria-hidden="true" />,
};
const MAX_TASKS = 5;
const ago = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? 'Waiting today' : `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
};
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '');
const REASSIGN_NOTE = 'Reassign moves files to a new primary recruiter — one file, a person’s files on one job, or all their open files. Jobs keep their owner; as their manager you can hold or close a report’s job.';

/** True when no shown person has a managerId other than the signed-in user. Absent managerId stays on the direct-report wording. */
function sameDirectReports(reports: ReportWork[], meId: string | undefined): boolean {
  return !reports.some((r) => {
    const managerId = r.person.managerId;
    return managerId != null && managerId !== '' && managerId !== meId;
  });
}
/** M2 Team work (Manager, v2): what is waiting on me, and open work for the loaded roster, with Reassign (B7). */
export function TeamWorkV2() {
  const { user } = useAuth();
  const pageReturn = usePageReturn();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: TeamWork } | { kind: 'forbidden' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [jobs, setJobs] = useState<TeamJob[] | null>(null);
  const [jobAction, setJobAction] = useState<{ job: TeamJob; action: JobAction } | null>(null);

  useEffect(() => {
    let live = true;
    fetchTeamWork()
      .then((data) => live && setState({ kind: 'ready', data }))
      .catch((e: { statusCode?: number; message?: string }) => live && setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' }));
    return () => { live = false; };
  }, [attempt]);

  const go = useCallback((next: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v) n.set(k, v); else n.delete(k); }
    setParams(n);
  }, [params, setParams]);
  const done = (m: string) => { setToast(m); go({ reassign: null, file: null, offer: null }); setAttempt((n) => n + 1); };

  const data = state.kind === 'ready' ? state.data : null;
  const reports = data?.reports ?? null;
  const reportKey = reports?.map((r) => r.person.id).join(',') ?? '';
  useEffect(() => {
    if (!reportKey) { setJobs(null); return; }
    let live = true;
    fetchTeamJobs(new Set(reportKey.split(','))).then((j) => live && setJobs(j)).catch(() => live && setJobs(null));
    return () => { live = false; };
  }, [reportKey, attempt]);
  const from = reports?.find((r) => r.person.id === params.get('reassign')) ?? null;
  const waiting = data?.waiting ?? [];
  const deciding: WaitingOffer | null = waiting.find((w) => w.offerId === params.get('offer')) ?? null;
  const showPay = canSeePay('manager', user?.permissions);
  const cards = data?.scorecards ?? [];
  const reportingLine = !!reports && !sameDirectReports(reports, user?.id);

  return (
    <div className="rf2-jobs rf2-team">
      {toast ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {toast}</p> : null}
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading team work…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include your team’s files." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load team work" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <>
          <section className="rf2-panel rf2-team__waiting" aria-labelledby="tw-wait-h">
            <div className="rf2-row-between"><h2 id="tw-wait-h" className="rf2-team__h">Waiting on you</h2><span className="rf2-task-section__count" aria-label={`${waiting.length + cards.length} waiting`}>{waiting.length + cards.length}</span></div>
            {waiting.length + cards.length === 0 ? <p className="rf2-jtable__sub">Nothing is waiting on your decision.</p> : (
              <ul className="rf2-team__list">
                {waiting.map((w) => (
                  <li key={w.offerId} className="rf2-team__wrow">
                    <CircleCheck aria-hidden="true" className="rf2-team__wicon" />
                    <div className="rf2-team__wtext">
                      <p className="rf2-jtable__name">Offer approval — {w.candidate}, {w.job}</p>
                      <p className="rf2-jtable__sub">Offer v{w.versionNumber} submitted{w.ownerName ? ` by ${w.ownerName}` : ''}{w.submittedAt ? ` · ${when(w.submittedAt)}` : ''}</p>
                    </div>
                    {ago(w.submittedAt) ? <StatusChip tone="neutral" label={ago(w.submittedAt)!} /> : null}
                    <ButtonV2 size="sm" icon={<Eye />} onClick={() => (w.applicationId ? navigate(withReturnTo(`/applications/${encodeURIComponent(w.applicationId)}?decide=${encodeURIComponent(w.offerId)}`, pageReturn)) : go({ offer: w.offerId }))} aria-label={`Review offer: ${w.candidate}`}>Review offer</ButtonV2>
                  </li>
                ))}
                {cards.map((c) => (
                  <li key={c.interviewId} className="rf2-team__wrow">
                    <Star aria-hidden="true" className="rf2-team__wicon" data-tone="warning" />
                    <div className="rf2-team__wtext">
                      <p className="rf2-jtable__name">Your scorecard — {c.candidate}{c.job ? `, ${c.job}` : ''}</p>
                      <p className="rf2-jtable__sub">You interviewed them as interviewer · the gate blocks Offer until it is submitted</p>
                    </div>
                    {c.overdue ? <StatusChip tone="danger" label="Late" /> : c.dueAt ? <StatusChip tone="info" label="Due today" /> : null}
                    <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={c.applicationId ? withReturnTo(`/applications/${encodeURIComponent(c.applicationId)}?drawer=scorecard&interview=${encodeURIComponent(c.interviewId)}`, pageReturn) : `/my-interviews?interview=${encodeURIComponent(c.interviewId)}&scorecard=1`} aria-label={`Submit scorecard: ${c.candidate}`}>Submit scorecard</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {!reports ? (
            <EmptyStateV2 title="Your reports list is not available" body="Team work needs the list of people who report to you (users/assignable). Ask an admin to check your role." />
          ) : reports.length === 0 ? (
            <EmptyStateV2 title="No direct reports" body="People whose manager is you appear here with their open files." />
          ) : (
            <div className="rf2-team__surface">
              <div className="rf2-team__grid">
                {reports.map((r) => <ReportCard key={r.person.id} r={r} jobs={jobs?.filter((j) => j.ownerId === r.person.id) ?? []} returnTo={pageReturn} onJob={(job, action) => setJobAction({ job, action })} onReassign={() => go({ reassign: r.person.id, file: null })} canReassign={reports.length > 1} />)}
              </div>
            </div>
          )}
          {deciding ? <OfferDecisionDrawer offerId={deciding.offerId} ownerName={deciding.ownerName} showPay={showPay} onClose={() => go({ offer: null })} onDone={done} /> : null}
          <p className="rf2-inline-note"><Users aria-hidden="true" /> {reportingLine ? 'Your reporting line appears here, including people who report through someone else.' : 'Only your direct reports appear here.'} {REASSIGN_NOTE}</p>
          {jobAction ? (
            <JobStatusDrawer job={teamJobDetail(jobAction.job)} initial={jobAction.action} onClose={() => setJobAction(null)}
              onDone={() => { const t = jobAction.job.title; setJobAction(null); setToast(`${t}: status changed.`); setAttempt((n) => n + 1); }} />
          ) : null}
          {from && reports ? <ReassignDrawer from={from} reports={reports} fileId={params.get('file')} managerName={user?.displayName ?? 'you'} onClose={() => go({ reassign: null, file: null })} onDone={done} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ReportCard({ r, jobs: owned, returnTo, onJob, onReassign, canReassign }: { r: ReportWork; jobs: TeamJob[]; returnTo: string | null; onJob: (j: TeamJob, a: JobAction) => void; onReassign: () => void; canReassign: boolean }) {
  const jobs = [...new Set(r.files.map((f) => f.job))];
  const shown = r.tasks.slice(0, MAX_TASKS);
  return (
    <section className="rf2-panel rf2-team__card" aria-labelledby={`tw-${r.person.id}`}>
      <div className="rf2-team__head">
        <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(r.person.name)}</span>
        <div className="rf2-team__who">
          <h2 id={`tw-${r.person.id}`} className="rf2-jtable__name">{r.person.name}</h2>
          <p className="rf2-jtable__sub">{[r.person.detail, jobs.length ? jobs.slice(0, 2).join(', ') + (jobs.length > 2 ? ` +${jobs.length - 2}` : '') : null].filter(Boolean).join(' · ')}</p>
        </div>
        {canReassign ? <ButtonV2 kind="tertiary" size="sm" icon={<ArrowLeftRight />} onClick={onReassign} aria-label={`Reassign ${r.person.name}’s files`}>Reassign</ButtonV2> : null}
      </div>
      <p className="rf2-team__counts">{r.open} open · <span data-tone={r.overdue ? 'danger' : undefined}>{r.overdue} overdue</span></p>
      {shown.length === 0 ? <p className="rf2-jtable__sub">No open files.</p> : (
        <ul className="rf2-team__list">
          {shown.map((t) => (
            <li key={t.fileId} className="rf2-team__task" data-kind={t.kind}>
              <span className="rf2-team__ticon" data-tone={t.tone ?? undefined}>{t.tone === 'overdue' && t.kind === 'gate' ? <CircleAlert aria-hidden="true" /> : ICON[t.kind]}</span>
              <div className="rf2-team__ttext"><Link className="rf2-link rf2-jtable__name" to={withReturnTo(fileHref(t.fileId), returnTo)}>{t.title}</Link><p className="rf2-jtable__sub">{t.meta}</p></div>
              {t.tone ? <StatusChip tone={CHIP[t.tone].tone} label={CHIP[t.tone].label} /> : null}
            </li>
          ))}
        </ul>
      )}
      {owned.length ? (
        <ul className="rf2-team__list" aria-label={`${r.person.name}’s jobs`}>
          {owned.map((j) => (
            <li key={j.id} className="rf2-team__task" data-kind="job">
              <span className="rf2-team__ticon"><Briefcase aria-hidden="true" /></span>
              <div className="rf2-team__ttext"><p className="rf2-jtable__name">{j.title}</p><p className="rf2-jtable__sub">{[j.code, j.site, `${j.filled} of ${j.target} seats`].filter(Boolean).join(' · ')}</p></div>
              {j.status === 'On Hold' ? <StatusChip tone="warning" label="On hold" /> : null}
              {jobActions(j.status).includes('hold') ? <ButtonV2 kind="tertiary" size="sm" icon={<Pause />} onClick={() => onJob(j, 'hold')} aria-label={`Hold ${j.title}`}>Hold</ButtonV2> : null}
              {jobActions(j.status).includes('close') ? <ButtonV2 kind="tertiary" size="sm" icon={<XCircle />} onClick={() => onJob(j, 'close')} aria-label={`Close ${j.title}`}>Close</ButtonV2> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {r.tasks.length > MAX_TASKS ? <p className="rf2-jtable__sub"><Info aria-hidden="true" /> {r.tasks.length - MAX_TASKS} more in {r.person.name.split(' ')[0]}’s Open jobs.</p> : null}
    </section>
  );
}
