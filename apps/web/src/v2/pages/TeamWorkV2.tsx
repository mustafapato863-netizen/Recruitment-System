import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageReturn, withReturnTo } from '../returnTarget';
import { ArrowLeft, ArrowLeftRight, BarChart3, Briefcase, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, Copy, Eye, FileText, Folder, Info, Pause, RotateCw, Users, XCircle } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, ForbiddenStateV2, initials, InputV2, SelectV2, SkeletonV2, StatusChip, TabsV2, TextareaV2 } from '../../components/v2';
import type { StatusTone } from '../../components/v2';
import { useAuth } from '../../auth/AuthContext';
import { fetchTeamJobs, fetchTeamWork, fileHref, interviewsThisWeekCount, teamJobDetail, type ReportWork, type TeamFile, type TeamJob, type TaskTone, type TeamTask, type TeamWork, type WaitingOffer, type WaitingScorecard } from '../api/teamWork';
import { ReassignDrawer } from '../drawers/ReassignDrawer';
import { OfferDecisionDrawer } from '../drawers/OfferDecisionDrawer';
import { canSeePay } from '../api/offerDecision';
import { JobStatusDrawer } from '../drawers/JobStatusDrawer';
import { cairoToday, jobActions, type JobAction } from '../api/jobs';
import {
  approveRequisition, declineRequisition, deptOf, dueOf, fetchContext, fetchRequisitions, formatDue, mineOrTeam, ownerOf, reqError, requestRequisitionChanges, siteOf, titleOf,
  type ReqContext, type Requisition,
} from '../api/requisitions';
import './jobs.css';
import './team.css';

const CHIP: Record<Exclude<TaskTone, null>, { tone: 'danger' | 'info' | 'neutral'; label: string }> = {
  overdue: { tone: 'danger', label: 'Overdue' }, today: { tone: 'info', label: 'Today' }, week: { tone: 'info', label: 'This week' }, waiting: { tone: 'neutral', label: 'Waiting' },
};
const FILE_PAGE = 10;
const MEMBER_PAGE = 6;
type TeamTab = 'members' | 'waiting' | 'activity';
type RTab = 'open' | 'overdue' | 'assignments' | 'activity';
type DecisionKind = 'approve' | 'changes' | 'decline';
type ReqBox = { status: 'loading' | 'ready'; pending: Requisition[]; changes: number; ctx: ReqContext | null };
const ago = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? 'Waiting today' : `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
};
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '');

function itemPill(task: TeamTask): { tone: StatusTone; label: string } {
  const label = task.kind === 'gate' ? 'Needs review' : task.tone === 'overdue' ? 'Overdue' : task.tone === 'today' ? 'Today' : 'In progress';
  if (task.tone === 'overdue') return { tone: 'danger', label };
  if (task.kind === 'gate') return { tone: 'warning', label };
  if (task.tone === 'today') return { tone: 'success', label };
  return { tone: 'info', label };
}

function itemIcon(task: TeamTask): { tone: 'danger' | 'success' | 'info'; node: ReactElement } {
  if (task.tone === 'overdue') return { tone: 'danger', node: <CircleAlert /> };
  if (task.tone === 'today' || task.kind === 'interview') return { tone: 'success', node: <CalendarDays /> };
  return { tone: 'info', node: <Clock /> };
}

/** Scheduled interviews, or files already in Interview. Null when the schedule was not returned. */
function personInterviews(files: TeamFile[]): number | null {
  const unknown = files.some((file) => file.interview === undefined);
  const known = files.filter((file) => file.interview != null || file.stage === 'Interview');
  if (known.length === 0 && unknown) return null;
  return known.length;
}

/** M2 Team work (Manager, v2): reporting-line cards, what is waiting on me, and Reassign (B7). */
export function TeamWorkV2() {
  const { user } = useAuth();
  const location = useLocation();
  const approvalsPage = location.pathname === '/approvals';
  const pageReturn = usePageReturn();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: TeamWork } | { kind: 'forbidden' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [jobs, setJobs] = useState<TeamJob[] | null>(null);
  const [jobAction, setJobAction] = useState<{ job: TeamJob; action: JobAction } | null>(null);
  const [pickId, setPickId] = useState<string | null>(null);
  const [reqBox, setReqBox] = useState<ReqBox>({ status: 'ready', pending: [], changes: 0, ctx: null });

  useEffect(() => {
    document.documentElement.setAttribute('data-team-work-surface', '');
    return () => document.documentElement.removeAttribute('data-team-work-surface');
  }, []);

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
  const done = (m: string) => { setToast(m); go({ reassign: null, reassignJob: null, file: null, offer: null, approval: null, handoff: null, workload: null }); setAttempt((n) => n + 1); };

  const data = state.kind === 'ready' ? state.data : null;
  const reports = data?.reports ?? null;
  const reportKey = reports?.map((r) => r.person.id).join(',') ?? '';
  useEffect(() => {
    if (!reportKey) { setJobs(null); return; }
    let live = true;
    fetchTeamJobs(new Set(reportKey.split(','))).then((j) => live && setJobs(j)).catch(() => live && setJobs(null));
    return () => { live = false; };
  }, [reportKey, attempt]);
  const canViewReqs = !!user?.permissions?.includes('VACANCY_REQUEST_VIEW');
  const meId = user?.id;
  useEffect(() => {
    if (!canViewReqs || !reports) {
      setReqBox((prev) => (prev.status === 'ready' && prev.pending.length === 0 && prev.changes === 0 && prev.ctx === null ? prev : { status: 'ready', pending: [], changes: 0, ctx: null }));
      return;
    }
    let live = true;
    setReqBox((prev) => ({ ...prev, status: 'loading' }));
    Promise.all([fetchRequisitions().catch(() => [] as Requisition[]), fetchContext()])
      .then(([rows, ctx]) => {
        if (!live) return;
        const scoped = mineOrTeam(rows, meId, reports.map((r) => r.person));
        setReqBox({
          status: 'ready',
          pending: scoped.filter((r) => r.status === 'Pending Approval'),
          changes: scoped.filter((r) => r.status === 'Changes Requested').length,
          ctx,
        });
      })
      .catch(() => { if (live) setReqBox({ status: 'ready', pending: [], changes: 0, ctx: null }); });
    return () => { live = false; };
  }, [canViewReqs, reports, meId, attempt]);
  const from = reports?.find((r) => r.person.id === params.get('reassign')) ?? null;
  const recruiterId = params.get('recruiter');
  const recruiter = reports?.find((r) => r.person.id === recruiterId) ?? null;
  const approvalId = params.get('approval');
  const waiting = data?.waiting ?? [];
  const deciding: WaitingOffer | null = waiting.find((w) => w.offerId === params.get('offer')) ?? null;
  const tabParam = params.get('tab');
  const tab: TeamTab = tabParam === 'waiting' || tabParam === 'activity' || tabParam === 'members'
    ? tabParam
    : tabParam === 'items'
      ? 'activity'
      : approvalsPage
        ? 'waiting'
        : 'members';
  const jobQ = params.get('job') ?? '';
  const itemStatus = params.get('status') === 'overdue' ? 'overdue' : '';
  const personQ = params.get('person') ?? '';
  const kindParam = params.get('kind');
  const kind = kindParam === 'offers' || kindParam === 'scorecards' ? kindParam : '';
  const openTotal = reports?.reduce((sum, row) => sum + row.open, 0) ?? 0;
  const overdueTotal = reports?.reduce((sum, row) => sum + row.overdue, 0) ?? 0;
  const jobNames = [...new Set((reports ?? []).flatMap((row) => row.files.map((file) => file.job)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const tasksFor = (row: ReportWork) => row.tasks.filter((task) => {
    const file = row.files.find((item) => item.id === task.fileId);
    if (jobQ && file?.job !== jobQ) return false;
    if (itemStatus === 'overdue' && task.tone !== 'overdue') return false;
    if (personQ && row.person.id !== personQ) return false;
    return true;
  });
  const visibleMembers = (reports ?? []).filter((row) => {
    if (!jobQ && itemStatus !== 'overdue') return true;
    return row.tasks.some((task) => {
      const file = row.files.find((item) => item.id === task.fileId);
      if (jobQ && file?.job !== jobQ) return false;
      if (itemStatus === 'overdue' && task.tone !== 'overdue') return false;
      return true;
    });
  });
  const showPay = canSeePay('manager', user?.permissions);
  const cards = data?.scorecards ?? [];
  const waitingCount = waiting.length + cards.length + reqBox.pending.length;
  const today = cairoToday();
  const urgentDecisions = cards.filter((c) => c.overdue).length + reqBox.pending.filter((r) => { const due = dueOf(r); return !!due && due < today; }).length;
  const people = reports?.map((r) => r.person) ?? null;
  const branchQ = params.get('branch') ?? '';
  const branches = [...new Set([
    ...(reports ?? []).flatMap((row) => row.files.map((file) => file.site).filter((site): site is string => !!site)),
    ...(jobs ?? []).map((job) => job.site).filter((site): site is string => !!site),
  ])].sort((a, b) => a.localeCompare(b));
  const onBranch = (row: ReportWork) => !branchQ || row.files.some((file) => file.site === branchQ) || (jobs ?? []).some((job) => job.ownerId === row.person.id && job.site === branchQ);
  const workloadRows = visibleMembers.filter(onBranch);
  const workloadId = params.get('workload');
  const workload = reports?.find((row) => row.person.id === workloadId) ?? null;
  const sources = (reports ?? []).filter((row) => row.files.length > 0 && onBranch(row));
  const filesFor = (row: ReportWork) => {
    const ids = new Set(tasksFor(row).map((task) => task.fileId));
    return row.files.filter((file) => ids.has(file.id) && (!branchQ || file.site === branchQ));
  };
  const itemsFor = (row: ReportWork) => tasksFor(row).filter((task) => {
    if (!branchQ) return true;
    const file = row.files.find((item) => item.id === task.fileId);
    return file?.site === branchQ;
  });
  const listFiltered = Boolean(jobQ || itemStatus || branchQ);
  const memberTotal = workloadRows.length;
  const memberPages = Math.max(1, Math.ceil(memberTotal / MEMBER_PAGE));
  const pageRaw = Number(params.get('page'));
  const memberPage = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.min(memberPages, Math.floor(pageRaw)) : 1;
  const pagedMembers = workloadRows.slice((memberPage - 1) * MEMBER_PAGE, memberPage * MEMBER_PAGE);
  const weekInterviews = reports ? interviewsThisWeekCount(reports.flatMap((row) => row.files)) : null;
  const activityRows = (reports ?? []).flatMap((row) => filesFor(row).map((file) => ({ file, owner: row.person.name })));
  activityRows.sort((a, b) => {
    if (a.file.followUpDate === b.file.followUpDate) return a.file.candidate.localeCompare(b.file.candidate);
    if (!a.file.followUpDate) return 1;
    if (!b.file.followUpDate) return -1;
    return b.file.followUpDate.localeCompare(a.file.followUpDate);
  });
  const activityTasks = new Map((reports ?? []).flatMap((row) => row.tasks.map((task) => [task.fileId, task] as const)));
  const activityOwners = new Map(activityRows.map((row) => [row.file.id, row.owner]));

  return (
    <div className="rf2-jobs rf2-team">
      {toast ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {toast}</p> : null}
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading team work…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include your team’s files." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load team work" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <>
          {approvalId && approvalId !== 'sample' ? (
            <ApprovalDecision approvalId={approvalId} reqBox={reqBox} people={people} onBack={() => go({ approval: null })} onDone={done} />
          ) : (
          <>
          {approvalId === 'sample' ? <ApprovalDecision approvalId={approvalId} reqBox={reqBox} people={people} onBack={() => go({ approval: null })} onDone={done} /> : null}
          {recruiterId ? (
            recruiter ? (
              <RecruiterDetails recruiter={recruiter} jobs={jobs} userId={user?.id} returnTo={pageReturn} params={params} go={go} onJob={(job, action) => setJobAction({ job, action })} />
            ) : (
              <section className="rf2-panel" role="alert">
                <p>This recruiter is not in your reporting line.</p>
                <ButtonV2 kind="secondary" icon={<ArrowLeft />} onClick={() => go({ recruiter: null, rtab: null, rq: null, rstage: null })}>Back to Team work</ButtonV2>
              </section>
            )
          ) : (
          <>
          <header className="rf2-team__bar">
            <div>
              <h1 className="rf2-team__title">Team work</h1>
              <p className="rf2-team__intro">Oversee your team&apos;s workload, open items, and approvals.</p>
            </div>

          </header>
          {reports ? (
            <ul className="rf2-team__summary-cards" aria-label="Team summary">
              <li>
                <span className="rf2-team__sum-icon" data-tone="info" aria-hidden="true"><Users /></span>
                <span className="rf2-team__sum-copy">
                  <span className="rf2-team__sum-value">{reports.length}</span>
                  <span className="rf2-team__sum-label">Team members</span>
                </span>
              </li>
              <li>
                <span className="rf2-team__sum-icon" data-tone="info" aria-hidden="true"><FileText /></span>
                <span className="rf2-team__sum-copy">
                  <span className="rf2-team__sum-value">{openTotal}</span>
                  <span className="rf2-team__sum-label">Open items</span>
                </span>
              </li>
              <li>
                <span className="rf2-team__sum-icon" data-tone={overdueTotal > 0 ? 'danger' : 'neutral'} aria-hidden="true"><CircleAlert /></span>
                <span className="rf2-team__sum-copy">
                  <span className="rf2-team__sum-value" data-tone={overdueTotal > 0 ? 'danger' : undefined}>{overdueTotal}</span>
                  <span className="rf2-team__sum-label">Overdue</span>
                </span>
              </li>
              <li>
                <span className="rf2-team__sum-icon" data-tone="success" aria-hidden="true"><CalendarDays /></span>
                <span className="rf2-team__sum-copy">
                  <span className="rf2-team__sum-value">{weekInterviews === null ? '—' : weekInterviews}</span>
                  <span className="rf2-team__sum-label">Interviews this week</span>
                  {weekInterviews === null ? <span className="rf2-sr-only">Interview schedule is not available yet.</span> : null}
                </span>
              </li>
            </ul>
          ) : null}
          <div className="rf2-team__toolbar">
            <TabsV2
              ariaLabel="Team work"
              activeKey={tab}
              onChange={(key) => go({ tab: key === 'members' && !approvalsPage ? null : key === 'waiting' && approvalsPage ? null : key })}
              items={[
                { key: 'members', label: 'By team member', icon: <Users />, controls: 'tw-panel' },
                { key: 'waiting', label: 'Waiting on you', icon: <Clock />, count: waitingCount, controls: 'tw-panel' },
                { key: 'activity', label: 'Team activity', icon: <BarChart3 />, controls: 'tw-panel' },
              ]}
            />
            <div className="rf2-jobs__filters" role="search">
              {tab === 'waiting' ? (
                <>
                  <SelectV2 label="Decision type" fieldClassName="rf2-sr-label" value={kind} onChange={(e) => go({ kind: e.target.value || null })}>
                    <option value="">All decisions</option>
                    <option value="offers">Offers</option>
                    <option value="scorecards">Scorecards</option>
                  </SelectV2>
                  <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Refresh</ButtonV2>
                </>
              ) : (
                <>
                  <SelectV2 label="Branch" fieldClassName="rf2-sr-label" value={branchQ} onChange={(e) => go({ branch: e.target.value || null, page: null })}>
                    <option value="">All branches</option>
                    {branches.map((name) => <option key={name} value={name}>{name}</option>)}
                  </SelectV2>
                  <SelectV2 label="Job" fieldClassName="rf2-sr-label" value={jobQ} onChange={(e) => go({ job: e.target.value || null, page: null })}>
                    <option value="">All jobs</option>
                    {jobNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </SelectV2>
                  <SelectV2 label="Item status" fieldClassName="rf2-sr-label" value={itemStatus} onChange={(e) => go({ status: e.target.value || null, page: null })}>
                    <option value="">All open items</option>
                    <option value="overdue">Overdue</option>
                  </SelectV2>
                </>
              )}
            </div>
          </div>
          <div role="tabpanel" id="tw-panel" aria-labelledby={`rf2-tab-${tab}`}>
            {tab === 'waiting' ? (
              <WaitingQueue
                waiting={kind === 'scorecards' ? [] : waiting}
                cards={kind === 'offers' ? [] : cards}
                filtered={Boolean(kind)}
                pageReturn={pageReturn}
                pendingReqs={reqBox.pending}
                showRequisitions={kind !== 'offers' && kind !== 'scorecards'}
                changesCount={reqBox.changes}
                urgentCount={urgentDecisions}
                ctx={reqBox.ctx}
                approvalOpen={Boolean(approvalId)}
                onReviewReq={(id) => go({ approval: id })}
                onPreview={() => go({ tab: approvalsPage ? null : 'waiting', approval: approvalId || 'sample' })}
                onReview={(w) => (w.applicationId ? navigate(withReturnTo(`/applications/${encodeURIComponent(w.applicationId)}?decide=${encodeURIComponent(w.offerId)}`, pageReturn)) : go({ offer: w.offerId }))}
              />
            ) : tab === 'activity' ? (
              !reports ? (
                <EmptyStateV2 title="Your reports list is not available" body="Team work needs the list of people who report to you (users/assignable). Ask an admin to check your role." />
              ) : (
                <ActivityFeed files={activityRows.map((row) => row.file)} taskById={activityTasks} owners={activityOwners} />
              )
            ) : !reports ? (
              <EmptyStateV2 title="Your reports list is not available" body="Team work needs the list of people who report to you (users/assignable). Ask an admin to check your role." />
            ) : reports.length === 0 ? (
              <EmptyStateV2 title="No team members assigned" body="People in your reporting line appear here with their open files." />
            ) : workloadRows.length === 0 ? (
              <EmptyStateV2 title="No open items" body="Change the branch, job, or status filter." />
            ) : (
              <section aria-label="By team member">
                <div className="rf2-team__grid">
                  {pagedMembers.map((row) => {
                    const tasks = itemsFor(row);
                    const files = filesFor(row);
                    const open = listFiltered ? files.length : row.open;
                    const overdue = listFiltered ? files.filter((file) => !!file.followUpDate && file.followUpDate < today).length : row.overdue;
                    return (
                      <MemberCard
                        key={row.person.id}
                        row={row}
                        tasks={tasks}
                        open={open}
                        overdue={overdue}
                        interviews={personInterviews(listFiltered ? files : row.files)}
                        returnTo={pageReturn}
                        onOpen={() => go({ recruiter: row.person.id, rtab: null, rq: null, rstage: null })}
                        onReassign={() => go({ reassign: row.person.id, file: null, handoff: null, reassignJob: null })}
                        onViewAll={() => go({ workload: row.person.id, handoff: null })}
                      />
                    );
                  })}
                </div>
                <MemberPager page={memberPage} pages={memberPages} total={memberTotal} onPage={(next) => go({ page: next <= 1 ? null : String(next) })} />
              </section>
            )}
          </div>
          <p className="rf2-team__banner" role="note">
            <Info aria-hidden="true" />
            <span>Your reporting line appears here, including people who report through someone else. You can reassign files to a new primary recruiter — one file, a person&apos;s files on one job, or all their open files.</span>
          </p>
          </>
          )}
          </>
          )}
          {params.get('handoff') === 'pick' && reports && reports.length > 1 ? (
            <DrawerV2 open onClose={() => go({ handoff: null })} title="Redistribute work" kicker="Application handoff" subtitle="Choose whose active applications you want to review."
              primaryAction={<ButtonV2 disabled={!pickId || !sources.some((row) => row.person.id === pickId)} onClick={() => go({ reassign: pickId, handoff: 'job', file: null, workload: null, reassignJob: null })}>Continue</ButtonV2>}
              secondaryAction={<ButtonV2 kind="secondary" onClick={() => go({ handoff: null })}>Cancel</ButtonV2>}>
              <SelectV2 label="Current recruiter" value={pickId ?? ''} onChange={(event) => setPickId(event.target.value)}>
                <option value="">Choose a recruiter</option>
                {sources.map((row) => <option key={row.person.id} value={row.person.id}>{row.person.name} · {row.open} active applications</option>)}
              </SelectV2>
              <p className="rf2-team__scope-note">You will choose a job, a new recruiter, and review the affected applications before confirming.</p>
            </DrawerV2>
          ) : null}
          {workloadId && !from ? (
            workload ? <WorkloadDrawer recruiter={workload} jobs={jobs} returnTo={pageReturn} onClose={() => go({ workload: null })}
              onDetails={() => go({ workload: null, recruiter: workload.person.id })}
              onMove={(jobId) => go({ workload: null, reassign: workload.person.id, reassignJob: jobId, handoff: 'job', file: null })} />
              : <DrawerV2 open title="Recruiter workload" status="forbidden" onClose={() => go({ workload: null })} />
          ) : null}
          {deciding ? <OfferDecisionDrawer offerId={deciding.offerId} ownerName={deciding.ownerName} showPay={showPay} onClose={() => go({ offer: null })} onDone={done} /> : null}
          {jobAction ? (
            <JobStatusDrawer job={teamJobDetail(jobAction.job)} initial={jobAction.action} onClose={() => setJobAction(null)}
              onDone={() => { const t = jobAction.job.title; setJobAction(null); setToast(`${t}: status changed.`); setAttempt((n) => n + 1); }} />
          ) : null}
          {from && reports ? <ReassignDrawer key={`${from.person.id}:${params.get('reassignJob') ?? ''}`} from={from} reports={reports} fileId={params.get('file')} vacancyId={params.get('reassignJob')} jobOnly={params.get('handoff') === 'job'} managerName={user?.displayName ?? 'you'} onClose={() => go({ reassign: null, reassignJob: null, file: null, handoff: null })} onDone={done} /> : null}
        </>
      ) : null}
    </div>
  );
}

function WorkloadDrawer({ recruiter, jobs, returnTo, onClose, onDetails, onMove }: {
  recruiter: ReportWork; jobs: TeamJob[] | null; returnTo: string | null;
  onClose: () => void; onDetails: () => void; onMove: (vacancyId: string) => void;
}) {
  const grouped = new Map<string, { title: string; site: string | null; files: TeamFile[] }>();
  for (const file of recruiter.files) {
    const group = grouped.get(file.vacancyId) ?? { title: file.job, site: file.site, files: [] };
    group.files.push(file);
    grouped.set(file.vacancyId, group);
  }
  const dueSoon = recruiter.tasks.filter((task) => task.tone === 'today' || task.tone === 'week').length;
  const owned = jobs?.filter((job) => job.ownerId === recruiter.person.id).length;
  return (
    <DrawerV2 open title={recruiter.person.name} kicker="Recruiter workload" onClose={onClose}
      subtitle="Review active applications and choose where to share the work."
      secondaryAction={<ButtonV2 kind="secondary" onClick={onDetails}>View full workload</ButtonV2>}>
      <div className="rf2-team__workload-drawer">
        <dl className="rf2-team__drawer-stats" aria-label="Workload summary">
          <div><dt>Applications</dt><dd>{recruiter.open}</dd></div>
          <div><dt>Due soon</dt><dd>{dueSoon}</dd></div>
          <div><dt>Overdue</dt><dd data-overdue={recruiter.overdue > 0 || undefined}>{recruiter.overdue}</dd></div>
        </dl>
        <p className="rf2-jtable__sub">{owned === undefined ? 'Owned jobs unavailable.' : `${owned} owned ${owned === 1 ? 'job' : 'jobs'}.`} Application ownership can be shared separately.</p>
        <h3 className="rf2-team__h">Applications by job</h3>
        {!grouped.size ? <p className="rf2-jtable__sub">No active applications to redistribute.</p> : (
          <ul className="rf2-team__drawer-jobs">
            {[...grouped].map(([id, group]) => (
              <li key={id}>
                <div className="rf2-team__drawer-job-head">
                  <div><strong>{group.title}</strong><span className="rf2-team__cell-sub">{group.site ? `${group.site} · ` : ''}{group.files.length} active {group.files.length === 1 ? 'application' : 'applications'}</span></div>
                  <ButtonV2 kind="secondary" size="sm" aria-label={`Move applications: ${group.title}`} onClick={() => onMove(id)}>Move applications</ButtonV2>
                </div>
                <details><summary>View applications</summary><ul>{group.files.map((file) => <li key={file.id}><Link className="rf2-link" to={withReturnTo(fileHref(file.id), returnTo)}>{file.candidate}</Link><span className="rf2-jtable__sub"> · {file.stage}</span></li>)}</ul></details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DrawerV2>
  );
}

function MemberCard({ row, tasks, open, overdue, interviews, returnTo, onOpen, onReassign, onViewAll }: {
  row: ReportWork; tasks: TeamTask[]; open: number; overdue: number; interviews: number | null; returnTo: string | null;
  onOpen: () => void; onReassign: () => void; onViewAll: () => void;
}) {
  const headingId = `tw-person-${row.person.id}`;
  const top = tasks.slice(0, 3);
  const interviewText = interviews === null ? '—' : String(interviews);
  const interviewLabel = interviews === 1 ? 'Interview' : 'Interviews';
  return (
    <article className="rf2-team__member" aria-labelledby={headingId}>
      <div className="rf2-team__head">
        <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(row.person.name)}</span>
        <div className="rf2-team__who">
          <h2 id={headingId} className="rf2-team__h">
            <button type="button" className="rf2-team__name" onClick={onOpen}>{row.person.name}</button>
          </h2>
          {row.person.detail ? <p className="rf2-jtable__sub">{row.person.detail}</p> : null}
        </div>
        <ButtonV2 kind="tertiary" size="sm" icon={<ArrowLeftRight />} aria-label={`Reassign: ${row.person.name}`} onClick={onReassign}>Reassign</ButtonV2>
      </div>
      <p className="rf2-team__metrics">
        <span><strong>{open}</strong> Open</span>
        <span className="rf2-team__metrics-gap" aria-hidden="true" />
        <span><strong data-tone={overdue > 0 ? 'danger' : undefined}>{overdue}</strong> Overdue</span>
        <span className="rf2-team__metrics-gap" aria-hidden="true" />
        <span>
          <strong>{interviewText}</strong> {interviewLabel}
          {interviews === null ? <span className="rf2-sr-only"> Interview schedule is not available yet.</span> : null}
        </span>
      </p>
      {top.length === 0 ? (
        <div className="rf2-team__empty">
          <Folder aria-hidden="true" />
          <p>No open items</p>
        </div>
      ) : (
        <ul className="rf2-team__items">
          {top.map((task) => {
            const icon = itemIcon(task);
            const pill = itemPill(task);
            return (
              <li key={task.fileId}>
                <span className="rf2-team__ticon" data-tone={icon.tone} aria-hidden="true">{icon.node}</span>
                <div className="rf2-team__ttext">
                  <Link className="rf2-link" to={withReturnTo(fileHref(task.fileId), returnTo)}>{task.title}</Link>
                  {task.meta ? <p className="rf2-jtable__sub">{task.meta}</p> : null}
                </div>
                <StatusChip tone={pill.tone} label={pill.label} icon={pill.tone === 'danger' ? <CircleAlert aria-hidden="true" /> : undefined} />
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > 3 ? <button type="button" className="rf2-team__viewall" onClick={onViewAll}>View all {tasks.length}</button> : null}
    </article>
  );
}

function MemberPager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (total <= MEMBER_PAGE) return null;
  const start = (page - 1) * MEMBER_PAGE + 1;
  const end = Math.min(total, page * MEMBER_PAGE);
  return (
    <nav className="rf2-team__pager" aria-label="Team members pages">
      <p>Showing {start}–{end} of {total} team members</p>
      <div className="rf2-team__pager-controls">
        <button type="button" className="rf2-team__page" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" /></button>
        {Array.from({ length: pages }, (_, index) => index + 1).map((n) => (
          <button key={n} type="button" className="rf2-team__page" aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
        ))}
        <button type="button" className="rf2-team__page" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight aria-hidden="true" /></button>
      </div>
    </nav>
  );
}

function WaitingQueue({ waiting, cards, filtered, pageReturn, pendingReqs, showRequisitions, changesCount, urgentCount, ctx, approvalOpen, onReviewReq, onPreview, onReview }: {
  waiting: WaitingOffer[]; cards: WaitingScorecard[]; filtered: boolean; pageReturn: string | null;
  pendingReqs: Requisition[]; showRequisitions: boolean; changesCount: number; urgentCount: number; ctx: ReqContext | null;
  approvalOpen: boolean; onReviewReq: (id: string) => void; onPreview: () => void; onReview: (w: WaitingOffer) => void;
}) {
  const reqRows = showRequisitions ? pendingReqs : [];
  const empty = waiting.length + cards.length + reqRows.length === 0;
  const showPreview = empty || approvalOpen;
  return (
    <section className="rf2-panel rf2-team__waiting" aria-labelledby="tw-wait-h">
      <p className="rf2-jtable__sub">Team work / Waiting on you</p>
      <div className="rf2-row-between"><h2 id="tw-wait-h" className="rf2-team__h">Waiting on you</h2></div>
      <ul className="rf2-chips" aria-label="Decision summary">
        <li><span className="rf2-chip rf2-chip--info">Pending approvals {pendingReqs.length}</span></li>
        <li><span className="rf2-chip rf2-chip--warning">Changes requested {changesCount}</span></li>
        <li><span className={urgentCount > 0 ? 'rf2-chip rf2-chip--danger' : 'rf2-chip rf2-chip--neutral'}>Urgent decisions {urgentCount}</span></li>
      </ul>
      {showPreview ? <ButtonV2 kind="secondary" size="sm" onClick={onPreview}>Preview approval decision screen</ButtonV2> : null}
      {empty ? <p className="rf2-jtable__sub">{filtered ? 'No decisions match this filter.' : 'Nothing is waiting on your decision.'}</p> : (
        <div className="rf2-jscroll">
          <table className="rf2-jtable">
            <thead><tr><th scope="col">Type</th><th scope="col">Requisition / person</th><th scope="col">Requested by</th><th scope="col">Submitted</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-only">Actions</span></th></tr></thead>
            <tbody>
              {waiting.map((w) => (
                <tr key={w.offerId}>
                  <td>Offer approval</td>
                  <td><p className="rf2-jtable__name">Offer approval — {w.candidate}, {w.job}</p><p className="rf2-jtable__sub">Offer v{w.versionNumber} submitted{w.ownerName ? ` by ${w.ownerName}` : ''}</p></td>
                  <td>{w.ownerName ?? '—'}</td>
                  <td>{w.submittedAt ? when(w.submittedAt) : '—'}</td>
                  <td>—</td>
                  <td>{ago(w.submittedAt) ? <StatusChip tone="neutral" label={ago(w.submittedAt)!} /> : '—'}</td>
                  <td><ButtonV2 size="sm" icon={<Eye />} onClick={() => onReview(w)} aria-label={`Review offer: ${w.candidate}`}>Review</ButtonV2></td>
                </tr>
              ))}
              {cards.map((c) => (
                <tr key={c.interviewId}>
                  <td>Scorecard</td>
                  <td><p className="rf2-jtable__name">Your scorecard — {c.candidate}{c.job ? `, ${c.job}` : ''}</p><p className="rf2-jtable__sub">You interviewed them as interviewer · the gate blocks Offer until it is submitted</p></td>
                  <td>You</td>
                  <td>—</td>
                  <td>{c.dueAt ? when(c.dueAt) : '—'}</td>
                  <td>{c.overdue ? <StatusChip tone="danger" label="Late" /> : c.dueAt ? <StatusChip tone="info" label="Due today" /> : '—'}</td>
                  <td><Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={c.applicationId ? withReturnTo(`/applications/${encodeURIComponent(c.applicationId)}?drawer=scorecard&interview=${encodeURIComponent(c.interviewId)}`, pageReturn) : `/my-interviews?interview=${encodeURIComponent(c.interviewId)}&scorecard=1`} aria-label={`Submit scorecard: ${c.candidate}`}>Submit scorecard</Link></td>
                </tr>
              ))}
              {reqRows.map((req) => (
                <tr key={req.id}>
                  <td>Requisition approval</td>
                  <td><p className="rf2-jtable__name">{titleOf(req, ctx)} ({req.requestCode}) · {siteOf(req, ctx)}</p></td>
                  <td>{req.requesterName ?? '—'}</td>
                  <td>{req.updatedAt ? when(req.updatedAt) : '—'}</td>
                  <td>{formatDue(dueOf(req))}</td>
                  <td><StatusChip tone="info" label="Pending approval" /></td>
                  <td><ButtonV2 size="sm" onClick={() => onReviewReq(req.id)}>Review</ButtonV2></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function coveredSummary(recruiter: ReportWork, owned: TeamJob[]): string {
  const fileJobs = new Set(recruiter.files.map((f) => f.vacancyId));
  const names = [...new Set([...owned.map((j) => j.title), ...recruiter.files.map((f) => f.job)])];
  const ownedLabel = owned.length ? `${owned.length} owned ${owned.length === 1 ? 'job' : 'jobs'}` : null;
  const fileLabel = fileJobs.size ? `${fileJobs.size} ${fileJobs.size === 1 ? 'job' : 'jobs'} with open files` : null;
  const listed = names.length ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : null;
  return [ownedLabel, fileLabel, listed].filter(Boolean).join(' · ') || 'No covered positions';
}

function RecruiterDetails({ recruiter, jobs, userId, returnTo, params, go, onJob }: {
  recruiter: ReportWork; jobs: TeamJob[] | null; userId: string | undefined; returnTo: string | null;
  params: URLSearchParams; go: (next: Record<string, string | null>) => void; onJob: (job: TeamJob, action: JobAction) => void;
}) {
  const rtabParam = params.get('rtab');
  const rtab: RTab = rtabParam === 'overdue' || rtabParam === 'assignments' || rtabParam === 'activity' ? rtabParam : 'open';
  const rq = params.get('rq') ?? '';
  const rstage = params.get('rstage') ?? '';
  const [showAll, setShowAll] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  useEffect(() => { setShowAll(false); }, [rq, rstage, rtab, recruiter.person.id]);
  const taskById = new Map(recruiter.tasks.map((t) => [t.fileId, t]));
  const stages = [...new Set(recruiter.files.map((f) => f.stage))].sort((a, b) => a.localeCompare(b));
  const dueToday = recruiter.tasks.filter((t) => t.tone === 'today').length;
  const waitingOnCandidate = recruiter.tasks.filter((t) => t.tone === 'waiting' || recruiter.files.find((f) => f.id === t.fileId)?.stage === 'Offer').length;
  const owned = jobs?.filter((j) => j.ownerId === recruiter.person.id) ?? [];
  const relationship = recruiter.person.managerId && recruiter.person.managerId !== userId ? 'Indirect report (reporting line)' : 'Direct report';
  const query = rq.trim().toLowerCase();
  const matches = (f: TeamFile) => {
    if (rstage && f.stage !== rstage) return false;
    if (!query) return true;
    const task = taskById.get(f.id);
    return `${f.candidate} ${f.job} ${f.stage} ${f.site ?? ''} ${task?.title ?? ''}`.toLowerCase().includes(query);
  };
  const openFiles = recruiter.files.filter(matches);
  const overdueFiles = openFiles.filter((f) => taskById.get(f.id)?.tone === 'overdue');
  const assignments = assignmentRows(recruiter, owned);
  const activity = [...recruiter.files].sort((a, b) => {
    if (a.followUpDate === b.followUpDate) return a.candidate.localeCompare(b.candidate);
    if (!a.followUpDate) return 1;
    if (!b.followUpDate) return -1;
    return b.followUpDate.localeCompare(a.followUpDate);
  });
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyNote('Link copied.');
    } catch {
      setCopyNote('Could not copy the link.');
    }
  };
  return (
    <section className="rf2-panel rf2-team__detail" aria-label={`Recruiter details: ${recruiter.person.name}`}>
      <p className="rf2-crumbs">Team work / {recruiter.person.name}</p>
      <ButtonV2 kind="secondary" size="sm" icon={<ArrowLeft />} onClick={() => go({ recruiter: null, rtab: null, rq: null, rstage: null })}>Back to Team work</ButtonV2>
      <div className="rf2-team__head">
        <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(recruiter.person.name)}</span>
        <div className="rf2-team__who">
          <h2>{recruiter.person.name}</h2>
          <p className="rf2-jtable__sub">{recruiter.person.detail ?? 'Recruiter'} · {relationship}</p>
          <p className="rf2-jtable__sub">{coveredSummary(recruiter, owned)}</p>
        </div>
        <div className="rf2-team__actions">
          <ButtonV2 kind="secondary" size="sm" icon={<Copy />} onClick={() => void copyLink()}>Copy link</ButtonV2>
          <ButtonV2 kind="secondary" size="sm" icon={<ArrowLeftRight />} onClick={() => go({ reassign: recruiter.person.id, file: null, handoff: null })}>Reassign</ButtonV2>
        </div>
      </div>
      {copyNote ? <p className="rf2-jtable__sub" role="status">{copyNote}</p> : null}
      <ul className="rf2-team__workload" aria-label="Recruiter workload KPIs">
        <li><span className="rf2-team__kpi-k">Open files</span><span className="rf2-team__kpi-v">{recruiter.open}</span></li>
        <li><span className="rf2-team__kpi-k">Overdue</span><span className="rf2-team__kpi-v" data-tone={recruiter.overdue ? 'danger' : undefined}>{recruiter.overdue}</span></li>
        <li><span className="rf2-team__kpi-k">Due today</span><span className="rf2-team__kpi-v">{dueToday}</span></li>
        <li><span className="rf2-team__kpi-k">Waiting on candidate</span><span className="rf2-team__kpi-v">{waitingOnCandidate}</span></li>
      </ul>
      <TabsV2
        ariaLabel="Recruiter workload"
        activeKey={rtab}
        onChange={(key) => go({ rtab: key === 'open' ? null : key })}
        items={[
          { key: 'open', label: 'Open files', count: recruiter.files.length, controls: 'tw-recruiter-panel' },
          { key: 'overdue', label: 'Overdue', count: recruiter.tasks.filter((t) => t.tone === 'overdue').length, controls: 'tw-recruiter-panel' },
          { key: 'assignments', label: 'Assignments', count: assignments.length, controls: 'tw-recruiter-panel' },
          { key: 'activity', label: 'Recent activity', count: activity.length, controls: 'tw-recruiter-panel' },
        ]}
      />
      <div role="tabpanel" id="tw-recruiter-panel" aria-labelledby={`rf2-tab-${rtab}`}>
        {rtab === 'assignments' ? (
          <Assignments rows={assignments} owned={owned} onJob={onJob} />
        ) : rtab === 'activity' ? (
          <ActivityFeed files={activity} taskById={taskById} />
        ) : (
          <>
            <div className="rf2-jobs__filters" role="search">
              <InputV2 label="Search files" value={rq} onChange={(e) => go({ rq: e.target.value || null })} />
              <SelectV2 label="Stage" value={rstage} onChange={(e) => go({ rstage: e.target.value || null })}>
                <option value="">All stages</option>
                {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </SelectV2>
            </div>
            <FileTable
              files={rtab === 'overdue' ? overdueFiles : openFiles}
              taskById={taskById}
              owner={recruiter.person.name}
              returnTo={returnTo}
              showAll={showAll}
              onShowAll={() => setShowAll(true)}
              onReassignFile={(id) => go({ reassign: recruiter.person.id, file: id })}
              empty={rtab === 'overdue' ? 'No overdue files.' : (query || rstage ? 'No open files match this filter.' : 'No open files.')}
            />
          </>
        )}
      </div>
    </section>
  );
}

function assignmentRows(recruiter: ReportWork, owned: TeamJob[]): Array<{ key: string; job: string; site: string; role: string; jobId: string | null }> {
  const rows: Array<{ key: string; job: string; site: string; role: string; jobId: string | null }> = [];
  const seen = new Set<string>();
  for (const job of owned) {
    seen.add(job.id);
    const hasFiles = recruiter.files.some((f) => f.vacancyId === job.id);
    rows.push({ key: job.id, job: job.title, site: job.site ?? '—', role: hasFiles ? 'Job owner · File primary recruiter' : 'Job owner', jobId: job.id });
  }
  for (const file of recruiter.files) {
    if (seen.has(file.vacancyId)) continue;
    seen.add(file.vacancyId);
    rows.push({ key: file.vacancyId, job: file.job, site: file.site ?? '—', role: 'File primary recruiter', jobId: null });
  }
  return rows.sort((a, b) => a.job.localeCompare(b.job));
}

function FileTable({ files, taskById, owner, returnTo, showAll, onShowAll, onReassignFile, empty }: {
  files: TeamFile[]; taskById: Map<string, TeamTask>; owner: string; returnTo: string | null;
  showAll: boolean; onShowAll: () => void; onReassignFile: (id: string) => void; empty: string;
}) {
  if (files.length === 0) return <p className="rf2-jtable__sub">{empty}</p>;
  const visible = showAll ? files : files.slice(0, FILE_PAGE);
  return (
    <>
      <p className="rf2-jtable__sub" aria-live="polite">{visible.length} of {files.length} {files.length === 1 ? 'file' : 'files'}</p>
      <div className="rf2-jscroll">
        <table className="rf2-jtable">
          <thead>
            <tr>
              <th scope="col">Candidate</th><th scope="col">Job</th><th scope="col">Stage</th><th scope="col">Next action</th>
              <th scope="col">Due date</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => {
              const task = taskById.get(f.id);
              return (
                <tr key={f.id}>
                  <td>{f.candidate}</td>
                  <td>{f.job}</td>
                  <td>{f.stage}</td>
                  <td>{task?.title ?? '—'}</td>
                  <td>{formatDue(f.followUpDate)}</td>
                  <td>{task?.tone ? <StatusChip tone={CHIP[task.tone].tone} label={CHIP[task.tone].label} /> : 'Open'}</td>
                  <td>{owner}</td>
                  <td>
                    <div className="rf2-team__actions">
                      <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={withReturnTo(fileHref(f.id), returnTo)} aria-label={`Open ${f.candidate}`}>Open</Link>
                      <ButtonV2 kind="tertiary" size="sm" onClick={() => onReassignFile(f.id)} aria-label={`Reassign file: ${f.candidate}`}>Reassign file</ButtonV2>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length < files.length ? <ButtonV2 kind="secondary" onClick={onShowAll}>Show all</ButtonV2> : null}
    </>
  );
}

function Assignments({ rows, owned, onJob }: { rows: Array<{ key: string; job: string; site: string; role: string; jobId: string | null }>; owned: TeamJob[]; onJob: (job: TeamJob, action: JobAction) => void }) {
  const byId = new Map(owned.map((job) => [job.id, job]));
  return (
    <>
      {rows.length === 0 ? <p className="rf2-jtable__sub">No job assignments in this view.</p> : (
        <div className="rf2-jscroll">
          <table className="rf2-jtable">
            <thead><tr><th scope="col">Job</th><th scope="col">Site</th><th scope="col">Role</th><th scope="col">Action</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const job = row.jobId ? byId.get(row.jobId) : undefined;
                const actions = job ? jobActions(job.status) : [];
                return (
                  <tr key={row.key}>
                    <td>{row.job}</td><td>{row.site}</td><td>{row.role}</td>
                    <td>
                      {actions.includes('hold') && job ? <ButtonV2 kind="tertiary" size="sm" icon={<Pause />} onClick={() => onJob(job, 'hold')} aria-label={`Hold ${row.job}`}>Hold</ButtonV2> : null}
                      {actions.includes('close') && job ? <ButtonV2 kind="tertiary" size="sm" icon={<XCircle />} onClick={() => onJob(job, 'close')} aria-label={`Close ${row.job}`}>Close</ButtonV2> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="rf2-inline-note"><Briefcase aria-hidden="true" /> Job ownership remains independent of application file reassignment.</p>
    </>
  );
}

function ActivityFeed({ files, taskById, owners }: { files: TeamFile[]; taskById: Map<string, TeamTask>; owners?: Map<string, string> }) {
  return (
    <>
      {files.length === 0 ? <p className="rf2-jtable__sub">No open files to show.</p> : (
        <ol className="rf2-team__timeline-list">
          {files.map((f) => {
            const task = taskById.get(f.id);
            return (
              <li key={f.id}>
                <span className="rf2-team__timeline-mark" aria-hidden="true" />
                <div className="rf2-team__ttext">
                  <p className="rf2-jtable__name">{task?.title ?? f.candidate}</p>
                  <p className="rf2-jtable__sub">{[owners?.get(f.id), f.stage, f.job, f.site, f.followUpDate ? formatDue(f.followUpDate) : null].filter(Boolean).join(' · ')}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="rf2-inline-note"><Clock aria-hidden="true" /> Chronological authorized activity feed; no activity-based scoring.</p>
    </>
  );
}

const DECISION_COPY: Record<DecisionKind, { title: string; body: string; confirm: string }> = {
  approve: {
    title: 'Approve this requisition?',
    body: 'Pending Approval → Approved. The requisition can be activated as a job. Seats and the primary recruiter stay as submitted.',
    confirm: 'Confirm approval',
  },
  changes: {
    title: 'Return this requisition for changes?',
    body: 'Pending Approval → Changes Requested. The requester can edit and resubmit. No job is opened.',
    confirm: 'Confirm return',
  },
  decline: {
    title: 'Decline this requisition?',
    body: 'Pending Approval → Rejected. The requisition closes. No job is opened.',
    confirm: 'Confirm decline',
  },
};

function ApprovalDecision({ approvalId, reqBox, people, onBack, onDone }: {
  approvalId: string; reqBox: ReqBox; people: ReportWork['person'][] | null; onBack: () => void; onDone: (message: string) => void;
}) {
  const match = approvalId === 'sample' ? null : reqBox.pending.find((r) => r.id === approvalId) ?? null;
  const sample = approvalId === 'sample' || (reqBox.status === 'ready' && !match);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<DecisionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    setComment('');
    setCommentError(null);
    setConfirming(null);
    setFormError(null);
  }, [approvalId]);
  const start = (kind: DecisionKind) => {
    if (sample || !match) return;
    const trimmed = comment.trim();
    if ((kind === 'changes' || kind === 'decline') && trimmed.length < 3) {
      setCommentError('A reason of at least 3 characters is required.');
      setConfirming(null);
      return;
    }
    setCommentError(null);
    setConfirming(kind);
  };
  const commit = async () => {
    if (sample || !match || !confirming || busy) return;
    const trimmed = comment.trim();
    if ((confirming === 'changes' || confirming === 'decline') && trimmed.length < 3) {
      setCommentError('A reason of at least 3 characters is required.');
      setConfirming(null);
      return;
    }
    setBusy(true);
    try {
      if (confirming === 'approve') await approveRequisition(match.id, trimmed || undefined);
      else if (confirming === 'changes') await requestRequisitionChanges(match.id, trimmed);
      else await declineRequisition(match.id, trimmed);
      const done = confirming === 'approve' ? 'approved' : confirming === 'changes' ? 'sent back for changes' : 'declined';
      onDone(`${match.requestCode} ${done}.`);
    } catch (e) {
      const err = reqError(e);
      setFormError(err.text || Object.values(err.inline ?? {})[0] || 'Something went wrong. Try again.');
    } finally { setBusy(false); }
  };
  const disabled = sample || !match || busy;
  return (
    <section className="rf2-panel rf2-team__approval" aria-label="Approval decision">
      <p className="rf2-crumbs">Team work / Waiting on you / Approval decision</p>
      <ButtonV2 kind="secondary" size="sm" icon={<ArrowLeft />} onClick={onBack}>Back to queue</ButtonV2>
      {reqBox.status === 'loading' && !sample && !match ? <SkeletonV2 lines={4} label="Loading approval…" /> : null}
      {sample ? <p className="rf2-inline-note" data-tone="warning" role="status">SAMPLE / preview mode — Nothing is currently waiting in your live approval queue</p> : null}
      {match ? (
        <div className="rf2-team__decide">
          <div>
            <h2 className="rf2-team__h">{titleOf(match, reqBox.ctx)}</h2>
            <dl className="rf2-decide__facts">
              <dt>Job title</dt><dd>{titleOf(match, reqBox.ctx)}</dd>
              <dt>Code</dt><dd>{match.requestCode}</dd>
              <dt>Site</dt><dd>{siteOf(match, reqBox.ctx)}</dd>
              <dt>Department</dt><dd>{deptOf(match, reqBox.ctx) ?? '—'}</dd>
              <dt>Requested seats</dt><dd>{match.requestedHeadcount}</dd>
              <dt>Primary recruiter</dt><dd>{ownerOf(match, people)}</dd>
              <dt>Due date</dt><dd>{formatDue(dueOf(match))}</dd>
              <dt>Justification</dt><dd>{match.justification?.trim() || '—'}</dd>
            </dl>
            <p className="rf2-jtable__sub">Draft → Submitted → Pending Approval</p>
            <ol className="rf2-team__timeline" aria-label="Status timeline">
              <li>Draft</li>
              <li>Submitted</li>
              <li aria-current="step">Pending Approval</li>
            </ol>
            <details className="rf2-tres__method">
              <summary>Audit history</summary>
              <ul className="rf2-history__list">
                <li>Created {when(match.createdAt)}</li>
                <li>Last updated {when(match.updatedAt)}</li>
                <li>Status {match.status}</li>
              </ul>
              <p className="rf2-jtable__sub">Recorded requisition events only. No activity-based scoring.</p>
            </details>
            <Link className="rf2-link" to={`/vacancy-requests?req=${encodeURIComponent(match.id)}`}>View related requisition</Link>
          </div>
          <DecisionBox
            comment={comment} commentError={commentError} confirming={confirming} busy={busy} formError={formError} disabled={disabled}
            onComment={(value) => { setComment(value); setCommentError(null); }}
            onStart={start} onCommit={() => void commit()} onCancelConfirm={() => setConfirming(null)}
          />
        </div>
      ) : sample ? (
        <DecisionBox
          comment={comment} commentError={commentError} confirming={null} busy={false} formError={null} disabled
          onComment={() => undefined} onStart={() => undefined} onCommit={() => undefined} onCancelConfirm={() => undefined}
        />
      ) : null}
    </section>
  );
}

function DecisionBox({ comment, commentError, confirming, busy, formError, disabled, onComment, onStart, onCommit, onCancelConfirm }: {
  comment: string; commentError: string | null; confirming: DecisionKind | null; busy: boolean; formError: string | null; disabled: boolean;
  onComment: (value: string) => void; onStart: (kind: DecisionKind) => void; onCommit: () => void; onCancelConfirm: () => void;
}) {
  const copy = confirming ? DECISION_COPY[confirming] : null;
  const trimmed = comment.trim();
  return (
    <div className="rf2-team__decide-side">
      <h2 className="rf2-team__h">Decision</h2>
      {formError ? <p className="rf2-form-error" role="alert">{formError}</p> : null}
      <TextareaV2 label="Reason / comment" required={confirming === 'changes' || confirming === 'decline'} rows={3} value={comment} disabled={disabled} error={commentError ?? undefined} hint="Required for return or decline (at least 3 characters). Optional for approve." onChange={(e) => onComment(e.target.value)} />
      {copy ? (
        <div role="region" aria-label="Confirm decision">
          <p className="rf2-jtable__name">{copy.title}</p>
          <p className="rf2-jtable__sub">{copy.body}</p>
          <p className="rf2-jtable__sub">{trimmed ? `Comment: ${trimmed}` : 'No comment.'}</p>
          <div className="rf2-team__decide-actions">
            <ButtonV2 loading={busy} disabled={busy} onClick={onCommit}>{copy.confirm}</ButtonV2>
            <ButtonV2 kind="secondary" disabled={busy} onClick={onCancelConfirm}>Back</ButtonV2>
          </div>
        </div>
      ) : (
        <div className="rf2-team__decide-actions">
          <ButtonV2 disabled={disabled} icon={<CircleCheck />} onClick={() => onStart('approve')}>Approve</ButtonV2>
          <ButtonV2 kind="secondary" disabled={disabled} onClick={() => onStart('changes')}>Return for changes</ButtonV2>
          <ButtonV2 kind="danger" disabled={disabled} onClick={() => onStart('decline')}>Decline</ButtonV2>
        </div>
      )}
    </div>
  );
}
