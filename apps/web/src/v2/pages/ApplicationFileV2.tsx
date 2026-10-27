import type React from 'react';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleCheck, Clock, Download, FileText, RotateCw, Send, Star, XCircle } from 'lucide-react';
import { ApiError, getApi } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { InputV2, TextareaV2 } from '../../components/v2/Field';
import '../../components/v2/v2-primitives.css';
import './application-file.css';
import { addNote, downloadDocument, isClosedStage, isCvDoc, candidateName, gateState, loadApplicationFile, setFollowUp, updateInterview, type ApplicationFile, type InterviewItem } from '../api/applicationFile';
import { DocumentHistory, MessagesCard } from './FileHistory';
import { DRAWERS, DRAWER_KEYS, errorText, sentBack, type DrawerKey } from '../drawers/FileDrawers';
import { OfferDecisionDrawer } from '../drawers/OfferDecisionDrawer';
import { canSeePay, money } from '../api/offerDecision';
import { useAuth } from '../../auth/AuthContext';
import { useSetBreadcrumbTitle } from '../../context/BreadcrumbContext';

type Load = { kind: 'loading' } | { kind: 'ready'; file: ApplicationFile } | { kind: 'forbidden'; message: string } | { kind: 'missing' } | { kind: 'error'; message: string };

const STAGE_LABEL: Record<string, string> = { 'Pre-Hire': 'Pre-hire' };
const label = (s: string) => STAGE_LABEL[s] ?? s;
const fmt = (iso: string, withTime = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d);
};

/** Drawers that move or close a file: never open on a closed file (#21 FILE_CLOSED). */
const MOVING_DRAWERS: DrawerKey[] = ['screen', 'schedule', 'offer', 'send', 'answer', 'prehire', 'reject', 'waiting'];

/** The one primary action per stage (v2 §7/§8) and the drawer it opens. */
export function primaryFor(file: ApplicationFile): { key: DrawerKey; label: string; icon: React.ReactElement } | null {
  const { stage } = file.workspace.application;
  const g = gateState(file);
  switch (stage) {
    case 'Applied':
    case 'Screening':
      return g.screenNote ? { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> } : { key: 'screen', label: 'Log screen', icon: <Check /> };
    case 'Interview': {
      const live = file.interviews.filter((i) => i.status !== 'Cancelled');
      if (live.length === 0) return { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> };
      const waitingScore = live.some((i) => i.status === 'Completed' || i.status === 'Scheduled' || i.status === 'Rescheduled');
      if (!g.scorecard && !waitingScore) return { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> };
      return g.scorecard ? { key: 'offer', label: 'Draft offer', icon: <Send /> } : { key: 'scorecard', label: 'Open scorecard', icon: <Star /> };
    }
    case 'Offer': {
      const st = file.offer?.status;
      if (!file.offer) return { key: 'offer', label: 'Draft offer', icon: <Send /> };
      if (sentBack(file.offer)) return { key: 'offer', label: 'Revise and resubmit', icon: <Send /> };
      if (st === 'Draft') return { key: 'waiting', label: 'Submit for approval', icon: <Send /> };
      if (st === 'Pending Approval') return { key: 'waiting', label: 'View approval', icon: <Clock /> };
      if (st === 'Approved') return { key: 'send', label: 'Send offer', icon: <Send /> };
      if (st === 'Sent') return { key: 'answer', label: 'Record answer', icon: <Check /> };
      if (st === 'Accepted') return { key: 'prehire', label: 'Move to Pre-hire', icon: <ArrowRight /> };
      if (st === 'Expired') return { key: 'offer', label: 'New offer version', icon: <Send /> };
      return { key: 'offer', label: 'Draft offer', icon: <Send /> };
    }
    case 'Pre-Hire':
      return { key: 'prehire', label: 'Pre-hire checklist', icon: <CircleCheck /> };
    default:
      return null;
  }
}

function gateRows(file: ApplicationFile): Array<{ to: string; label: string; ok: boolean }> {
  const g = gateState(file);
  const stage = file.workspace.application.stage;
  if (stage === 'Applied' || stage === 'Screening') return [{ to: 'Interview', label: 'Screen note saved', ok: g.screenNote }];
  if (stage === 'Interview') return [{ to: 'Offer', label: 'Scorecard submitted', ok: g.scorecard }];
  if (stage === 'Offer') return [{ to: 'Pre-hire', label: 'Offer accepted', ok: g.offerAccepted }];
  if (stage === 'Pre-Hire') {
    if (g.joining.length === 0) return [{ to: 'Joined', label: 'Required checks', ok: false }];
    return g.joining.map((j) => ({ to: 'Joined', label: `${j.label} checked`, ok: j.done }));
  }
  return [];
}

type HubTab = 'overview' | 'activity' | 'documents';
type FileMode = 'owner' | 'manager' | 'approver' | 'licence';
const hubTab = (raw: string | null): HubTab => (raw === 'activity' || raw === 'documents' ? raw : 'overview');

type ReturnDest = { href: string; kind: 'candidates' | 'my-work' | 'vacancy'; vacancyId?: string };

const hasControl = (value: string) => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
};

/** Same-origin relative return targets only: /candidates, /my-work, or /vacancies/:id, plus the original query. */
export function fileReturnTo(raw: string | null): ReturnDest | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 2000 || !value.startsWith('/') || value.startsWith('//')) return null;
  if (hasControl(value) || value.includes('\\') || value.includes('#') || value.includes('://')) return null;
  const qIndex = value.indexOf('?');
  const rawPath = qIndex === -1 ? value : value.slice(0, qIndex);
  const rawQuery = qIndex === -1 ? '' : value.slice(qIndex);
  if (rawQuery.slice(1).includes('?')) return null;
  let path: string;
  try { path = decodeURIComponent(rawPath); } catch { return null; }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('://')) return null;
  const segments = path.split('/');
  if (segments[0] !== '' || segments.slice(1).some((seg) => seg === '' || seg === '.' || seg === '..')) return null;
  if (path === '/candidates') return { href: `/candidates${rawQuery}`, kind: 'candidates' };
  if (path === '/my-work') return { href: `/my-work${rawQuery}`, kind: 'my-work' };
  if (segments.length === 3 && segments[1] === 'vacancies' && /^[A-Za-z0-9_-]+$/.test(segments[2] ?? '')) {
    return { href: `/vacancies/${segments[2]}${rawQuery}`, kind: 'vacancy', vacancyId: segments[2] };
  }
  return null;
}

function destination(file: ApplicationFile, mode: FileMode, raw: string | null): { href: string; label: string; crumb: string } {
  const app = file.workspace.application;
  const title = app.positionTitle ?? 'Job';
  const pipeline = `/vacancies/${encodeURIComponent(app.vacancyId)}`;
  if (mode === 'approver') return { href: '/hires/approvals/inbox', label: 'Final approvals', crumb: 'Final approvals' };
  if (mode === 'licence') return { href: '/licenses', label: 'Licences', crumb: 'Licences' };
  if (mode === 'manager') return { href: '/my-work', label: 'Team work', crumb: 'Team work' };
  const dest = fileReturnTo(raw);
  if (dest?.kind === 'candidates') return { href: dest.href, label: 'Back to Candidates', crumb: 'Candidates' };
  if (dest?.kind === 'my-work') return { href: dest.href, label: 'Back to My Work', crumb: 'My Work' };
  if (dest?.kind === 'vacancy') {
    const same = dest.vacancyId === app.vacancyId;
    return { href: dest.href, label: same ? `${title} pipeline` : 'Job pipeline', crumb: same ? title : 'Job' };
  }
  return { href: pipeline, label: `${title} pipeline`, crumb: title };
}

function crumbTrail(back: { href: string; crumb: string }, jobLabel: string, jobHref: string | null, name: string): Array<{ label: string; to?: string }> {
  const here = { label: name };
  if (back.crumb === jobLabel) return [{ label: jobLabel, to: back.href }, here];
  return [{ label: back.crumb, to: back.href }, jobHref ? { label: jobLabel, to: jobHref } : { label: jobLabel }, here];
}

const personLine = (name: string | null | undefined, role: string) => (name ? `${name} · ${role}` : `${role} not named on this file`);

const JOINING_LIMIT = 'Verified checks are recorded on the file. They are not joining. Hiring policy and final approval still have to be reviewed before a hire is recorded.';

function nextCopy(file: ApplicationFile): { title: string; detail: string; who: string; status: string } {
  const app = file.workspace.application;
  const primary = primaryFor(file);
  const g = gateState(file);
  const owner = personLine(app.primaryRecruiterName, 'Recruiter');
  if (isClosedStage(app.stage)) {
    const detail = app.stage === 'Rejected'
      ? `Closed as Rejected${app.rejectionReason ? ` — ${app.rejectionReason}` : ''}.`
      : `${app.stage}: this file is closed and does not move.`;
    return { title: 'This file is closed', detail, who: owner, status: 'Closed' };
  }
  const live = file.interviews.filter((i) => i.status !== 'Cancelled' && i.status !== 'No-show');
  const unscored = live.find((i) => !(file.scorecards[i.id] ?? []).some(isScorecardSubmitted));
  switch (primary?.key) {
    case 'screen':
      return { title: 'Screening note still needed', detail: 'Interview stays locked until a screen note is saved.', who: owner, status: 'Screen note required' };
    case 'schedule':
      return {
        title: 'Schedule the interview',
        detail: g.screenNote ? 'The screen note is saved. An interview is the next step.' : 'A screen note is still required before the interview.',
        who: owner,
        status: 'Interview to schedule',
      };
    case 'scorecard':
      return {
        title: unscored?.interviewerName ? `Waiting on ${unscored.interviewerName}'s scorecard` : 'Scorecard still required',
        detail: 'The offer stage stays locked until a submitted scorecard is on the file.',
        who: unscored?.interviewerName ? `${unscored.interviewerName} · Interviewer` : owner,
        status: 'Scorecard required',
      };
    case 'offer': {
      if (file.offer && sentBack(file.offer)) {
        const comment = file.offer.currentVersion?.approvals?.find((a) => a.status === 'Rejected')?.comment;
        return {
          title: 'Offer sent back',
          detail: comment ? `The manager sent the offer back: ${comment}` : 'The manager sent the offer back. Revise the terms and resubmit.',
          who: owner,
          status: 'Sent back',
        };
      }
      if (file.offer?.status === 'Expired') return { title: 'Offer expired', detail: 'A new offer version is required before the file can move.', who: owner, status: 'Offer expired' };
      return {
        title: file.offer ? 'Offer needs a new draft' : 'Draft the offer',
        detail: g.scorecard ? 'A submitted scorecard is on the file. Drafting the offer is the next step.' : 'The offer is the next step from this stage.',
        who: owner,
        status: 'Offer to draft',
      };
    }
    case 'waiting': {
      if (file.offer?.status === 'Pending Approval') {
        const approver = file.offer.currentVersion?.approvals?.find((a) => a.status === 'Pending')?.approverName
          ?? file.offer.currentVersion?.approvals?.[0]?.approverName;
        return {
          title: approver ? `Waiting on ${approver}'s approval` : 'Waiting on approval',
          detail: 'The offer stays with the approver until they decide.',
          who: approver ? `${approver} · Approver` : owner,
          status: 'Waiting on approval',
        };
      }
      return { title: 'Offer is still a draft', detail: 'Submit it for approval when the terms are ready.', who: owner, status: 'Offer in draft' };
    }
    case 'send':
      return { title: 'Send the approved offer', detail: 'The offer is approved. Sending it is the next step.', who: owner, status: 'Ready to send' };
    case 'answer':
      return { title: "Record the candidate's answer", detail: 'The offer has been sent. The file stays here until the answer is recorded.', who: owner, status: 'Answer to record' };
    case 'prehire': {
      if (app.stage === 'Offer') {
        return { title: 'Move to pre-hire', detail: 'The offer is accepted. Moving to pre-hire opens the checklist. It does not record joining.', who: owner, status: 'Offer accepted' };
      }
      const pending = g.joining.filter((j) => !j.done);
      if (g.joining.length === 0) return { title: 'Review the joining checklist', detail: `No required checks are on the file yet. ${JOINING_LIMIT}`, who: owner, status: 'Checklist to review' };
      if (pending.length) return { title: 'Joining checklist still open', detail: `Still to review: ${pending.map((j) => j.label).join(', ')}. ${JOINING_LIMIT}`, who: owner, status: 'Checklist to review' };
      return { title: 'Checklist recorded', detail: `Every check on this file is verified. ${JOINING_LIMIT}`, who: owner, status: 'Checklist recorded' };
    }
    default:
      return { title: 'Review this file', detail: 'No stage action is available on this view.', who: owner, status: label(app.stage) };
  }
}

type ActivityRow = { at: string; title: string; sub?: string };
type MessageAttempt = { at: string; templateName: string; state: string };

const HIRING_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'] as const;

/** Drawer a stage-rail click may open. A later stage whose gate is still open uses the current next action and does not move the file. */
export function drawerForStage(file: ApplicationFile, target: string): DrawerKey | null {
  const order = HIRING_STAGES as readonly string[];
  const current = file.workspace.application.stage;
  const cur = order.indexOf(current);
  const tgt = order.indexOf(target);
  if (tgt < 0) return null;
  const blocked = gateRows(file).some((gate) => !gate.ok);
  if (cur >= 0 && tgt > cur && blocked) return primaryFor(file)?.key ?? null;
  const gates = gateState(file);
  if (target === 'Applied' || target === 'Screening') return gates.screenNote ? 'schedule' : 'screen';
  if (target === 'Interview') {
    const live = file.interviews.filter((interview) => interview.status !== 'Cancelled');
    return live.length === 0 ? 'schedule' : 'scorecard';
  }
  if (target === 'Offer') return 'offer';
  if (target === 'Pre-Hire' || target === 'Joined') return 'prehire';
  return null;
}

function recordedRows(file: ApplicationFile): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const h of file.history) {
    if (!h.createdAt) continue;
    rows.push({
      at: h.createdAt,
      title: h.fromStage ? `Moved ${label(h.fromStage)} → ${label(h.toStage)}` : `Applied (${label(h.toStage)})`,
      sub: [h.changedByName && `by ${h.changedByName}`, h.reason].filter(Boolean).join(' · ') || undefined,
    });
  }
  for (const s of file.screening) {
    if (!s.screenedAt) continue;
    const screener = s.screenerName?.trim();
    const detail = [
      s.notes?.trim() || null,
      s.method?.trim() ? `Method: ${s.method.trim()}` : null,
      s.evidenceSource?.trim() ? `Evidence source: ${s.evidenceSource.trim()}` : null,
      s.nextStep?.trim() ? `Next step: ${s.nextStep.trim()}` : null,
    ].filter(Boolean).join(' · ');
    rows.push({
      at: s.screenedAt,
      title: `Screening logged${screener ? ` by ${screener}` : ''} — ${s.outcome}`,
      sub: detail || undefined,
    });
  }
  for (const i of file.interviews) {
    if (!i.createdAt) continue;
    rows.push({
      at: i.createdAt,
      title: `Interview recorded — ${i.title}`,
      sub: [`Appointment ${fmt(i.scheduledStart, true)}`, i.status !== 'Scheduled' ? i.status : null].filter(Boolean).join(' · '),
    });
  }
  for (const cards of Object.values(file.scorecards)) {
    for (const c of cards) {
      if (!isScorecardSubmitted(c) || !c.submittedAt) continue;
      rows.push({ at: c.submittedAt, title: `Scorecard submitted${c.interviewerName ? ` by ${c.interviewerName}` : ''}`, sub: c.notes ?? undefined });
    }
  }
  for (const v of file.offer?.versions ?? []) {
    if (!v.createdAt) continue;
    rows.push({
      at: v.createdAt,
      title: `Offer v${v.versionNumber} — ${v.status === 'Changes Requested' ? 'sent back by the manager (offer back in Draft)' : v.status ?? v.approvalStatus}`,
      sub: v.proposedJoiningDate ? `Start ${fmt(v.proposedJoiningDate)}` : undefined,
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/** Notes, screening, scorecards, offer versions, stage changes, and messages, oldest first. */
export function chatterRows(file: ApplicationFile, messages: MessageAttempt[] = []): ActivityRow[] {
  const rows = recordedRows(file).slice();
  for (const note of file.notes) {
    if (!note.createdAt) continue;
    const author = note.authorName?.trim();
    const text = note.content?.trim();
    rows.push({ at: note.createdAt, title: author ? `Note by ${author}` : 'Note', sub: text || undefined });
  }
  for (const message of messages) {
    if (!message.at || !message.templateName) continue;
    rows.push({ at: message.at, title: `Message ${message.state}: ${message.templateName}` });
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at) || a.title.localeCompare(b.title));
}

function evidenceOf(file: ApplicationFile): Array<{ text: string; by: string }> {
  const items: Array<{ at: string; text: string; by: string }> = [];
  for (const s of file.screening) {
    const text = s.notes?.trim();
    if (text) items.push({ at: s.screenedAt, text, by: s.screenerName ? `Screening notes · recorded by ${s.screenerName}` : 'Screening notes' });
  }
  for (const n of file.notes) {
    const text = n.content?.trim();
    if (text) items.push({ at: n.createdAt, text, by: n.authorName ? `Note · recorded by ${n.authorName}` : 'Note' });
  }
  const fit = (file.workspace.application as { fitSummary?: string | null }).fitSummary?.trim();
  if (fit) items.push({ at: file.workspace.application.updatedAt, text: fit, by: 'Fit summary on the file' });
  for (const cards of Object.values(file.scorecards)) {
    for (const c of cards) {
      const text = c.notes?.trim();
      if (isScorecardSubmitted(c) && text) items.push({ at: c.submittedAt, text, by: c.interviewerName ? `Scorecard · recorded by ${c.interviewerName}` : 'Scorecard' });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export function ApplicationFileV2({ load = loadApplicationFile, mode = 'owner' }: { load?: typeof loadApplicationFile; mode?: FileMode } = {}) {
  const { id = '' } = useParams();
  const { user } = useAuth();
  // #34: 'approver' = a final-hire approver without APPLICATION_VIEW: read-only like the Manager view (no drawers,
  // notes or follow-up), no offer decision, no pay, CV download allowed.
  const approver = mode === 'approver';
  const licence = mode === 'licence';
  const manager = mode === 'manager' || approver || licence;
  // Pay (salary, band) only for the Manager seat holding OFFER_PAY_VIEW.
  const showPay = mode === 'manager' && canSeePay('manager', user?.permissions);
  const [toast, setToast] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<MessageAttempt[]>([]);
  const drawer = params.get('drawer') as DrawerKey | null;
  const licenceDrawerSet = useRef(false);
  useEffect(() => {
    if (!licence || licenceDrawerSet.current) return;
    licenceDrawerSet.current = true;
    if (params.get('drawer') === 'prehire') return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('drawer', 'prehire');
      return next;
    }, { replace: true });
  }, [licence, params, setParams]);

  useEffect(() => {
    let alive = true;
    load(id, { keepScreeningPay: showPay })
      .then((file) => alive && setState({ kind: 'ready', file }))
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.statusCode === 403) setState({ kind: 'forbidden', message: e.message });
        else if (e instanceof ApiError && e.statusCode === 404) setState({ kind: 'missing' });
        else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load this file.' });
      });
    return () => { alive = false; };
  }, [id, load, attempt, showPay]);

  useEffect(() => {
    if (manager) return undefined;
    let live = true;
    getApi<{ attempts?: MessageAttempt[] }>(`/applications/${encodeURIComponent(id)}/messages`)
      .then((row) => { if (live) setMessages(Array.isArray(row?.attempts) ? row.attempts : []); })
      .catch(() => { if (live) setMessages([]); });
    return () => { live = false; };
  }, [id, manager, attempt]);

  const headerName = state.kind === 'ready' ? candidateName(state.file.workspace.application) : null;
  useSetBreadcrumbTitle(headerName);

  const openDrawer = useCallback((key: DrawerKey, extra?: Record<string, string>) => setParams((p) => {
    const n = new URLSearchParams(p); n.set('drawer', key);
    for (const [k, v] of Object.entries(extra ?? {})) n.set(k, v);
    return n;
  }), [setParams]);
  const closeDrawer = useCallback(() => setParams((p) => { const n = new URLSearchParams(p); n.delete('drawer'); n.delete('interview'); n.delete('decide'); return n; }), [setParams]);
  const done = useCallback(() => { closeDrawer(); setAttempt((n) => n + 1); }, [closeDrawer]);

  if (state.kind === 'loading') return <div className="rf2-file"><SkeletonV2 lines={8} label="Loading the application file…" /></div>;
  if (state.kind === 'forbidden') return <div className="rf2-file"><ForbiddenStateV2 title="This file belongs to another owner" body="Ask the owner or your manager if you need it." action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={mode === 'licence' ? '/licenses' : '/my-work'}>{mode === 'licence' ? 'Back to Licences' : 'Back to My Work'}</Link>} /></div>;
  if (state.kind === 'missing') return <div className="rf2-file"><EmptyStateV2 title="File not found" body="It may have been moved or closed." /></div>;
  if (state.kind === 'error') return <div className="rf2-file" role="alert"><EmptyStateV2 title="Could not load this file" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>;

  const { file } = state;
  const app = file.workspace.application;
  const name = candidateName(app);
  const primary = primaryFor(file);
  // #21 (B2-4): Joined/Rejected/Withdrawn files are closed (409 FILE_CLOSED): no move, no reject, and no drawer that moves the file.
  const closed = isClosedStage(app.stage);
  const Drawer = drawer && DRAWER_KEYS.includes(drawer) && (licence ? drawer === 'prehire' : !manager && !(closed && MOVING_DRAWERS.includes(drawer))) ? DRAWERS[drawer] : null;
  // Manager: the offer decision opens here, over the file (Figma 09). ?decide=<offerId> deep-links from Team work.
  const pendingOffer = file.offer && file.offer.status === 'Pending Approval' ? file.offer : null;
  const decideId = mode === 'manager' ? params.get('decide') : null;
  const latestScreen = [...file.screening].sort((a, b) => b.screenedAt.localeCompare(a.screenedAt))[0] ?? null;
  const tab = hubTab(params.get('tab'));
  const back = destination(file, mode, params.get('returnTo'));
  const copy = nextCopy(file);
  const gates = gateRows(file);
  const jobLabel = app.positionTitle ?? 'Job';
  const crumbs = crumbTrail(back, jobLabel, mode === 'owner' ? `/vacancies/${encodeURIComponent(app.vacancyId)}` : null, name);
  const noticeDays = file.screening.find((s) => s.noticePeriodDays != null)?.noticePeriodDays;
  const evidence = evidenceOf(file);
  const latest = recordedRows(file)[0];
  const showDocuments = tab === 'documents';
  const openDocuments = () => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'documents'); return n; });
  const focusNote = () => document.getElementById('file-note')?.focus();

  return (
    <div className="rf2-file">
      <Link className="rf2-file__back" to={back.href}><ArrowLeft aria-hidden="true" /> {back.label}</Link>
      <nav className="rf2-file__crumbs" aria-label="Breadcrumb">
        <ol>
          {crumbs.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.to && index < crumbs.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{item.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      {toast ? <p className="rf2-inline-note" role="status">{toast}</p> : null}
      <header className="rf2-file__intro">
        <h2 id="file-name" className="rf2-file__name">{name}</h2>
        <p className="rf2-file__meta">{[app.positionTitle, app.vacancyBranchName ?? app.vacancyLocation, app.primaryRecruiterName ? `Owner: ${app.primaryRecruiterName}` : null].filter(Boolean).join(' · ')}</p>
      </header>
      <div className="rf2-file__stage">
        <ol className="rf2-rail" aria-label="Stages">
          {HIRING_STAGES.map((stage) => {
            const currentStep = label(stage).toLowerCase() === label(app.stage).toLowerCase();
            if (manager || closed) {
              return <li key={stage}><span className="rf2-rail__step" aria-current={currentStep ? 'step' : undefined}>{label(stage)}</span></li>;
            }
            return (
              <li key={stage}>
                <button type="button" className="rf2-rail__step" aria-current={currentStep ? 'step' : undefined} onClick={() => { const key = drawerForStage(file, stage); if (key) openDrawer(key); }}>{label(stage)}</button>
              </li>
            );
          })}
        </ol>
        <p className="rf2-file__status">{copy.status}</p>
      </div>
      <section className="rf2-card" aria-labelledby="next-h">
        <h3 id="next-h" className="rf2-card__title">{copy.title}</h3>
        <p className={closed ? 'rf2-file__closed' : undefined} role={closed ? 'note' : undefined} data-testid={closed && app.stage !== 'Rejected' ? 'file-closed' : undefined}>{copy.detail}</p>
        {gates.length ? (
          <ul className="rf2-gates rf2-gates--inline" aria-label={`Gate to ${gates[0].to}`}>
            <li className="rf2-gates__title">To move to {gates[0].to}:</li>
            {gates.map((g) => (
              <li key={g.label} className="rf2-gate" data-ok={g.ok}>{g.ok ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}<span>{g.label}</span><span className="rf2-visually-hidden">{g.ok ? '(done)' : '(not done)'}</span></li>
            ))}
          </ul>
        ) : null}
        <div className="rf2-file__next-row">
          <p className="rf2-file__muted">{copy.who}</p>
          <div className="rf2-smart" role="group" aria-label="Smart actions">
            {licence ? (
              <>
                <ButtonV2 size="lg" icon={<CircleCheck />} onClick={() => openDrawer('prehire')}>Pre-hire</ButtonV2>
                <ButtonV2 kind="secondary" size="lg" icon={<FileText />} aria-pressed={showDocuments} onClick={openDocuments}>Documents</ButtonV2>
              </>
            ) : manager ? (
              <>
                <ButtonV2 kind="secondary" size="lg" icon={<FileText />} aria-pressed={showDocuments} onClick={openDocuments}>Documents</ButtonV2>
                {pendingOffer && !approver ? <ButtonV2 size="lg" icon={<CircleCheck />} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('decide', pendingOffer.id); return n; })}>Review offer</ButtonV2> : null}
              </>
            ) : (
              <>
                {primary && !closed ? <ButtonV2 size="lg" icon={primary.icon} onClick={() => openDrawer(primary.key)}>{primary.label}</ButtonV2> : null}
                <ButtonV2 kind="secondary" size="lg" icon={<FileText />} onClick={focusNote}>Note</ButtonV2>
                <ButtonV2 kind="secondary" size="lg" icon={<FileText />} aria-pressed={showDocuments} onClick={openDocuments}>Documents</ButtonV2>
                {!closed ? (
                  <>
                    <ButtonV2 kind="secondary" size="lg" icon={<CalendarDays />} onClick={() => openDrawer('schedule')}>Schedule</ButtonV2>
                    <ButtonV2 kind="secondary" size="lg" icon={<Star />} onClick={() => openDrawer('scorecard')}>Scorecard</ButtonV2>
                    <ButtonV2 kind="secondary" size="lg" icon={<Send />} onClick={() => openDrawer('offer')}>Offer</ButtonV2>
                    <ButtonV2 kind="secondary" size="lg" icon={<CircleCheck />} onClick={() => openDrawer('prehire')}>Pre-hire</ButtonV2>
                    <ButtonV2 kind="danger-outline" size="lg" icon={<XCircle />} onClick={() => openDrawer('reject')}>Reject</ButtonV2>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
      <div className="rf2-file__stack">
            <section className="rf2-card" aria-labelledby="glance-h">
              <h3 id="glance-h" className="rf2-card__title">At a glance</h3>
              <div className="rf2-file__glance">
                <div>
                  <p>{app.candidate?.email ?? 'Email not recorded'}</p>
                  {app.candidate?.phone ? <p>{app.candidate.phone}</p> : null}
                  <p>Source: {app.source ?? 'Not recorded'}</p>
                </div>
                <div>
                  <p>Notice: {noticeDays != null ? `${noticeDays} days` : 'Not recorded'}</p>
                  {manager
                    ? <p>Follow-up: {app.followUpDate ? fmt(`${app.followUpDate}T12:00:00Z`) : 'Not set'}</p>
                    : <FollowUp id={app.id} value={app.followUpDate ?? null} closed={closed} onSaved={() => setAttempt((n) => n + 1)} />}
                  <p className="rf2-file__muted">File {app.applicationCode}</p>
                </div>
              </div>
            </section>
            <section className="rf2-card" aria-labelledby="evidence-h">
              <h3 id="evidence-h" className="rf2-card__title">Evidence and fit</h3>
              {evidence.length === 0 ? <p className="rf2-file__muted">No screening note or fit evidence is recorded on this file yet.</p> : evidence.map((item) => (
                <div key={`${item.by}-${item.text}`}>
                  <p>{item.text}</p>
                  <p className="rf2-timeline__sub">{item.by}</p>
                </div>
              ))}
            </section>
            <section className="rf2-card" aria-labelledby="latest-h">
              <h3 id="latest-h" className="rf2-card__title">Latest activity</h3>
              {latest ? (
                <>
                  <p>{latest.title}</p>
                  <p className="rf2-file__muted">{[fmt(latest.at), latest.sub].filter(Boolean).join(' · ')}</p>
                </>
              ) : <p className="rf2-file__muted">Nothing recorded yet.</p>}
            </section>
            {manager ? <ScorecardFit file={file} /> : null}
            {showPay ? (
              <section className="rf2-card" aria-labelledby="salary-h">
                <h3 id="salary-h" className="rf2-card__title">Salary</h3>
                <dl className="rf2-terms">
                  <dt>Current</dt><dd>{amountOf(latestScreen?.currentSalary, latestScreen?.salaryCurrency)}</dd>
                  <dt>Expected</dt><dd>{amountOf(latestScreen?.expectedSalary, latestScreen?.salaryCurrency)}</dd>
                </dl>
                <p className="rf2-file__muted">From the latest screening. The band range shows in the offer decision.</p>
              </section>
            ) : null}
            {file.offer ? (
              <section className="rf2-card" aria-labelledby="offer-h">
                <h3 id="offer-h" className="rf2-card__title">Offer</h3>
                <p>{file.offer.offerCode} · v{(file.offer.currentVersion ?? file.offer.versions?.[0])?.versionNumber ?? 1} · <StatusChip tone={file.offer.status === 'Accepted' ? 'success' : 'neutral'} label={file.offer.status} /></p>
                <p className="rf2-file__muted">{manager ? (pendingOffer ? 'Waiting on your decision. Review offer opens the pay and the band.' : 'Pay and the band show in the offer decision.') : 'Pay is set by the approving manager and not shown here.'}</p>
              </section>
            ) : null}
            <Timeline file={file} messages={manager ? [] : messages} writable={!manager} onScorecard={manager ? undefined : (iid) => openDrawer('scorecard', { interview: iid })} onReschedule={manager ? undefined : (iid) => openDrawer('schedule', { interview: iid })} onChanged={() => setAttempt((n) => n + 1)} />
            {manager ? null : <Notes file={file} onAdded={() => setAttempt((n) => n + 1)} />}
            {manager ? null : <MessagesCard applicationId={app.id} followUpDate={app.followUpDate ?? null} omitAttempts />}
        {showDocuments ? (
          <section className="rf2-card" aria-labelledby="docs-h">
            <h3 id="docs-h" className="rf2-card__title">Documents</h3>
            {manager ? (
              file.documents.length === 0 ? <p className="rf2-file__muted">No documents yet.</p> : (
                <ul className="rf2-docs">
                  {file.documents.map((d) => (
                    <li key={d.id}><FileText aria-hidden="true" /><div><p>{d.name}</p><p className="rf2-timeline__sub">{[d.type, fmt(d.uploadedAt), d.uploadedBy ? `by ${d.uploadedBy.name}` : null].filter(Boolean).join(' · ')}</p></div>
                      {approver && isCvDoc(d) ? <ButtonV2 kind="secondary" size="sm" icon={<Download />} onClick={() => void downloadDocument(d).catch((e: unknown) => setToast(e instanceof Error ? e.message : 'Could not download the CV.'))}>Download CV</ButtonV2> : null}</li>
                  ))}
                </ul>
              )
            ) : <DocumentHistory applicationId={app.id} fallback={file.documents} onToast={setToast} />}
          </section>
        ) : null}
      </div>

      {Drawer ? <Drawer file={file} onClose={closeDrawer} onDone={done} params={params} /> : null}
      {decideId ? (
        <OfferDecisionDrawer offerId={decideId} ownerName={app.primaryRecruiterName ?? null} showPay={showPay} onClose={closeDrawer}
          onDone={(m) => { setToast(m); done(); }} />
      ) : null}
    </div>
  );
}

/** Follow-up date (B5 PATCH /applications/:id/follow-up; owner only → 403 FOLLOW_UP_NOT_OWNER). */
function FollowUp({ id, value, closed, onSaved }: { id: string; value: string | null; closed: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const save = async (v: string | null) => {
    setBusy(true); setErr(undefined);
    try { await setFollowUp(id, v); setEditing(false); onSaved(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  if (!editing) {
    return (
      <p className="rf2-file__follow"><CalendarDays aria-hidden="true" /> <strong>Follow-up date</strong> <span>{value ? fmt(`${value}T12:00:00Z`) : 'Not set'}</span>
        {!closed ? <button type="button" className="rf2-link" onClick={() => { setDate(value ?? ''); setEditing(true); }}>{value ? 'Change' : 'Set'}</button> : null}</p>
    );
  }
  return (
    <div className="rf2-follow">
      <InputV2 label="Follow-up date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={err} />
      <ButtonV2 kind="secondary" size="sm" loading={busy} disabled={!date} onClick={() => void save(date)}>Save</ButtonV2>
      {value ? <ButtonV2 kind="tertiary" size="sm" disabled={busy} onClick={() => void save(null)}>Clear</ButtonV2> : null}
      <ButtonV2 kind="tertiary" size="sm" disabled={busy} onClick={() => setEditing(false)}>Cancel</ButtonV2>
    </div>
  );
}

const amountOf = (v: number | string | null | undefined, cur?: string | null) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? money(n, cur ?? undefined) : '—';
};

/** Manager file (Figma 09): scorecards and fit at a glance. Submitted cards only. */
function ScorecardFit({ file }: { file: ApplicationFile }) {
  const cards = Object.values(file.scorecards).flat().filter(isScorecardSubmitted);
  const avg = cards.length ? Math.round((cards.reduce((t, c) => t + (Number(c.overallRating) || 0), 0) / cards.length) * 10) / 10 : null;
  const recs = cards.reduce<Record<string, number>>((m, c) => ({ ...m, [c.recommendation]: (m[c.recommendation] ?? 0) + 1 }), {});
  const fit = (file.workspace.application as { fitSummary?: string | null; matchScore?: number | null }).fitSummary ?? null;
  const score = (file.workspace.application as { matchScore?: number | null }).matchScore;
  return (
    <section className="rf2-card" aria-labelledby="fit-h">
      <h3 id="fit-h" className="rf2-card__title">Scorecards and fit</h3>
      {cards.length === 0 ? <p className="rf2-file__muted">No submitted scorecards yet.</p> : (
        <dl className="rf2-terms">
          <dt>Scorecards</dt><dd>{cards.length} submitted · average {avg} / 5</dd>
          <dt>Recommendation</dt><dd>{Object.entries(recs).map(([r, n]) => `${n} ${r}`).join(', ')}</dd>
        </dl>
      )}
      {typeof score === 'number' ? <p className="rf2-file__muted">Fit {score}%{fit ? ` · ${fit}` : ''}</p> : fit ? <p className="rf2-file__muted">{fit}</p> : null}
    </section>
  );
}

function Timeline({ file, messages = [], writable, onScorecard, onReschedule, onChanged }: { file: ApplicationFile; messages?: MessageAttempt[]; writable?: boolean; onScorecard?: (interviewId: string) => void; onReschedule?: (interviewId: string) => void; onChanged: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const markNoShow = async (interview: InterviewItem) => {
    setErr(null);
    try { await updateInterview(interview.id, { status: 'No-show' }); onChanged(); } catch (e) { setErr(errorText(e)); }
  };
  const recorded = chatterRows(file, messages);
  const interviews = [...file.interviews].sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  return (
    <section className="rf2-card rf2-file__chatter" aria-labelledby="chatter-h">
      <h3 id="chatter-h" className="rf2-card__title">Chatter</h3>
      {err ? <p className="rf2-inline-note" role="alert">{err}</p> : null}
      {recorded.length === 0 ? <p className="rf2-file__muted">Nothing recorded yet.</p> : (
        <ol className="rf2-timeline" aria-label="Chatter">
          {recorded.map((r, index) => (
            <li key={`${r.at}-${index}`} className="rf2-timeline__row">
              <time dateTime={r.at}>{fmt(r.at)}</time>
              <div><p className="rf2-timeline__title">{r.title}</p>{r.sub ? <p className="rf2-timeline__sub">{r.sub}</p> : null}</div>
            </li>
          ))}
        </ol>
      )}
      <h4 className="rf2-file__subhead">Interviews</h4>
      {interviews.length === 0 ? <p className="rf2-file__muted">No interviews on this file.</p> : (
        <ol className="rf2-timeline" aria-label="Interviews">
          {interviews.map((i) => {
            const cards = file.scorecards[i.id] ?? [];
            const submitted = cards.filter(isScorecardSubmitted).length;
            const open = i.status === 'Scheduled' || i.status === 'Rescheduled';
            const commitment = !i.createdAt && (open ? 'Scheduled commitment' : 'Appointment on the file');
            return (
              <li key={i.id} className="rf2-timeline__row">
                {i.createdAt ? <time dateTime={i.createdAt}>{fmt(i.createdAt)}</time> : <time>On file</time>}
                <div>
                  <p className="rf2-timeline__title">{`${i.title} — ${fmt(i.scheduledStart, true)}${i.status !== 'Scheduled' ? ` (${i.status})` : ''}`}</p>
                  <p className="rf2-timeline__sub">{[commitment, i.locationUrl ? 'Room link' : i.roomName, i.interviewerName, `${submitted} scorecard${submitted === 1 ? '' : 's'} submitted`].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="rf2-timeline__actions">
                  {writable && open ? <button type="button" className="rf2-link" onClick={() => void markNoShow(i)}>Mark no-show</button> : null}
                  {writable && open && onReschedule ? <button type="button" className="rf2-link" onClick={() => onReschedule(i.id)}>Reschedule</button> : null}
                  {i.status !== 'Cancelled' && i.status !== 'No-show' && onScorecard ? <button type="button" className="rf2-link" onClick={() => onScorecard(i.id)}>Scorecards</button> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Notes({ file, onAdded }: { file: ApplicationFile; onAdded: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const id = file.workspace.application.id;
  const save = async () => {
    if (!text.trim()) { setErr('Write the note first.'); return; }
    setBusy(true); setErr(undefined);
    try { await addNote(id, text.trim()); setText(''); onAdded(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rf2-card" aria-labelledby="notes-h">
      <h3 id="notes-h" className="rf2-card__title">Notes</h3>
      <TextareaV2 id="file-note" label="Add a note" rows={3} value={text} onChange={(e) => setText(e.target.value)} error={err} hint="Write with evidence. Notes can't be deleted." />
      <div className="rf2-notes__actions"><ButtonV2 kind="secondary" onClick={save} loading={busy}>Save note</ButtonV2></div>
    </section>
  );
}
