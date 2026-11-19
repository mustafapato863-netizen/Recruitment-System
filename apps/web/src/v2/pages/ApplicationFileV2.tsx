import type React from 'react';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Briefcase, CalendarDays, Check, CircleCheck, Clock, Download, FileText, RotateCw, Send, Star, XCircle } from 'lucide-react';
import { AtsMatchCard } from '../components/AtsMatchCard';
import { SuggestJobsDrawer } from '../drawers/SuggestJobsDrawer';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { InputV2, TextareaV2 } from '../../components/v2/Field';
import '../../components/v2/v2-primitives.css';
import './application-file.css';
import { addNote, blockingSection, candidateName, downloadDocument, gateState, isClosedStage, isCvDoc, loadApplicationFile, loadMessageSection, reloadFileSection, setFollowUp, updateInterview, type ApplicationFile, type FileMessages, type FileSectionKey, type InterviewItem, type SectionState } from '../api/applicationFile';
import { canRetrySection, isSectionKnown, SECTION_LABEL, sectionProblem } from '../api/sectionState';
import { DocumentHistory, MessagesCard } from './FileHistory';
import { DRAWERS, DRAWER_KEYS, errorText, sentBack, type DrawerKey } from '../drawers/FileDrawers';
import { OfferDecisionDrawer } from '../drawers/OfferDecisionDrawer';
import { canSeePay, money } from '../api/offerDecision';
import { useAuth } from '../../auth/AuthContext';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { useSetBreadcrumbTitle } from '../../context/BreadcrumbContext';
import { authorizedLanding, routeActor, type RoutePolicy } from '../destinations';
import { readPipelineSourceSet } from '../api/jobs';
import { allowedReturnDest, fileReturnTo, withReturnTo } from '../returnTarget';
import { CandidateActivityPanel } from '../../components/candidate/CandidateActivityPanel';

export { fileReturnTo };

type Load =
  | { kind: 'loading'; id: string }
  | { kind: 'ready'; id: string; file: ApplicationFile }
  | { kind: 'forbidden'; id: string; message: string }
  | { kind: 'missing'; id: string }
  | { kind: 'error'; id: string; message: string };

const STAGE_LABEL: Record<string, string> = { 'Pre-Hire': 'Pre-hire' };
const label = (s: string) => STAGE_LABEL[s] ?? s;
function fileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '•';
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : (parts[0]?.charAt(1) ?? '');
  return `${first}${second}`.toUpperCase();
}
const fmt = (iso: string, withTime = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d);
};

/** Drawers that move or close a file: never open on a closed file (#21 FILE_CLOSED). */
const MOVING_DRAWERS: DrawerKey[] = ['screen', 'schedule', 'offer', 'send', 'answer', 'prehire', 'reject', 'waiting'];

const ACTIVE_OFFER = new Set(['Pending Approval', 'Approved', 'Sent', 'Accepted', 'Changes Requested', 'Expired', 'Withdrawn']);

/** An offer already in flight leads the file, even while the stage is still Screening or Interview. */
function offerLeadsFile(file: ApplicationFile): boolean {
  const offer = file.offer;
  return Boolean(offer && (sentBack(offer) || ACTIVE_OFFER.has(offer.status)));
}

function offerPrimary(file: ApplicationFile): { key: DrawerKey; label: string; icon: React.ReactElement } | null {
  const st = file.offer?.status;
  if (!file.offer) return { key: 'offer', label: 'Draft offer', icon: <Send /> };
  if (sentBack(file.offer)) return { key: 'offer', label: 'Revise and resubmit', icon: <Send /> };
  if (st === 'Draft') return { key: 'waiting', label: 'Submit for approval', icon: <Send /> };
  if (st === 'Pending Approval') return { key: 'waiting', label: 'View approval', icon: <Clock /> };
  if (st === 'Approved') return { key: 'send', label: 'Send offer', icon: <Send /> };
  if (st === 'Sent') return { key: 'answer', label: 'Record answer', icon: <Check /> };
  if (st === 'Withdrawn' && !isClosedStage(file.workspace.application.stage)) return { key: 'answer', label: 'Finish withdrawal', icon: <Check /> };
  if (st === 'Accepted') return { key: 'prehire', label: 'Move to Pre-hire', icon: <ArrowRight /> };
  if (st === 'Expired') return { key: 'offer', label: 'New offer version', icon: <Send /> };
  return null;

}

/** Drawer for the offer that exists now. A missing, expired, or sent-back offer opens the draft form. */
export function offerDrawerFor(file: ApplicationFile): DrawerKey {
  const offer = file.offer;
  const status = offer?.status;
  if (!offer || sentBack(offer) || status === 'Expired') return 'offer';
  if (status === 'Draft' || status === 'Pending Approval') return 'waiting';
  if (status === 'Approved') return 'send';
  if (status === 'Sent' || (status === 'Withdrawn' && !isClosedStage(file.workspace.application.stage))) return 'answer';
  if (status === 'Accepted') return 'prehire';
  return 'offer';
}

/** The one primary action per stage (v2 §7/§8) and the drawer it opens. Unknown required reads do not invent one. */
export function primaryFor(file: ApplicationFile): { key: DrawerKey; label: string; icon: React.ReactElement } | null {
  if (blockingSection(file)) return null;
  const { stage } = file.workspace.application;
  const g = gateState(file);
  if ((stage === 'Screening' || stage === 'Interview') && offerLeadsFile(file)) return offerPrimary(file);
  switch (stage) {
    case 'Applied':
    case 'Screening':
      return g.screenNote ? { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> } : { key: 'screen', label: 'Log screen', icon: <Check /> };
    case 'Interview': {
      const live = file.interviews.filter((i) => i.status !== 'Cancelled' && i.status !== 'No-show');
      if (live.length === 0) return { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> };
      const waitingScore = live.some(
        (i) =>
          i.status === 'Completed' ||
          ((i.status === 'Scheduled' || i.status === 'Rescheduled') &&
            new Date(i.scheduledStart).getTime() <= Date.now()),
      );
      if (!g.scorecard && !waitingScore) return { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> };
      return g.scorecard ? { key: 'offer', label: 'Draft offer', icon: <Send /> } : { key: 'scorecard', label: 'Open scorecard', icon: <Star /> };
    }
    case 'Offer':
      return offerPrimary(file);
    case 'Pre-Hire':
      return { key: 'prehire', label: 'Pre-hire checklist', icon: <CircleCheck /> };
    default:
      return null;
  }
}

function gateRows(file: ApplicationFile): Array<{ to: string; label: string; ok: boolean; unknown?: boolean }> {
  const g = gateState(file);
  const stage = file.workspace.application.stage;
  if (stage === 'Applied' || stage === 'Screening') return [{ to: 'Interview', label: 'Screen note saved', ok: g.screenNote, unknown: g.unknown.screening }];
  if (stage === 'Interview') return [{ to: 'Offer', label: 'Scorecard submitted', ok: g.scorecard, unknown: g.unknown.interviews || g.unknown.scorecards }];
  if (stage === 'Offer') return [{ to: 'Pre-hire', label: 'Offer accepted', ok: g.offerAccepted, unknown: g.unknown.offer }];
  if (stage === 'Pre-Hire') {
    if (g.unknown.joining) return [{ to: 'Joined', label: 'Required checks', ok: false, unknown: true }];
    if (g.joining.length === 0) return [{ to: 'Joined', label: 'Required checks', ok: false }];
    return g.joining.map((j) => ({ to: 'Joined', label: `${j.label} checked`, ok: j.done }));
  }
  return [];
}

type HubTab = 'overview' | 'activity' | 'documents';
type FileMode = 'owner' | 'manager' | 'approver' | 'licence';
const hubTab = (raw: string | null): HubTab => (raw === 'activity' || raw === 'documents' ? raw : 'overview');

function fallbackBack(actor: RoutePolicy): { href: string; label: string; crumb: string } {
  const landing = authorizedLanding(actor);
  if (landing === '/hires/approvals/inbox') return { href: landing, label: 'Final approvals', crumb: 'Final approvals' };
  if (landing === '/licenses') return { href: landing, label: 'Licences', crumb: 'Licences' };
  if (landing === '/users') return { href: landing, label: 'Back to Users', crumb: 'Users' };
  if (landing === '/my-interviews') return { href: landing, label: 'Back to My interviews', crumb: 'My interviews' };
  return actor.seat === 'manager'
    ? { href: '/my-work', label: 'Team work', crumb: 'Team work' }
    : { href: '/my-work', label: 'Back to My Work', crumb: 'My Work' };
}

function destination(file: ApplicationFile, mode: FileMode, raw: string | null, actor: RoutePolicy): { href: string; label: string; crumb: string } {
  const app = file.workspace.application;
  const title = app.positionTitle ?? 'Job';
  const pipeline = `/vacancies/${encodeURIComponent(app.vacancyId)}`;
  const dest = allowedReturnDest(raw, actor);
  if (mode === 'approver') {
    if (dest?.kind === 'notifications') return { href: dest.href, label: 'Back to Notifications', crumb: 'Notifications' };
    if (dest?.kind === 'search') return { href: dest.href, label: 'Back to Search', crumb: 'Search' };
    return { href: '/hires/approvals/inbox', label: 'Final approvals', crumb: 'Final approvals' };
  }
  if (mode === 'licence') {
    if (dest?.kind === 'notifications') return { href: dest.href, label: 'Back to Notifications', crumb: 'Notifications' };
    if (dest?.kind === 'search') return { href: dest.href, label: 'Back to Search', crumb: 'Search' };
    return { href: '/licenses', label: 'Licences', crumb: 'Licences' };
  }
  if (mode === 'manager') {
    if (dest?.kind === 'my-work') return { href: dest.href, label: 'Team work', crumb: 'Team work' };
    if (dest?.kind === 'reports') return { href: dest.href, label: 'Back to Reports', crumb: 'Reports' };
    if (dest?.kind === 'notifications') return { href: dest.href, label: 'Back to Notifications', crumb: 'Notifications' };
    if (dest?.kind === 'search') return { href: dest.href, label: 'Back to Search', crumb: 'Search' };
    return { href: '/my-work', label: 'Team work', crumb: 'Team work' };
  }
  if (dest?.kind === 'candidates') return { href: dest.href, label: 'Back to Candidates', crumb: 'Candidates' };
  if (dest?.kind === 'cv-bank') return { href: dest.href, label: 'Back to CV Bank', crumb: 'CV Bank' };
  if (dest?.kind === 'compare') return { href: dest.href, label: 'Back to Compare', crumb: 'Compare' };
  if (dest?.kind === 'my-work') return { href: dest.href, label: 'Back to My Work', crumb: 'My Work' };
  if (dest?.kind === 'reports') return { href: dest.href, label: 'Back to Reports', crumb: 'Reports' };
  if (dest?.kind === 'my-result') return { href: dest.href, label: 'Back to My result', crumb: 'My result' };
  if (dest?.kind === 'notifications') return { href: dest.href, label: 'Back to Notifications', crumb: 'Notifications' };
  if (dest?.kind === 'search') return { href: dest.href, label: 'Back to Search', crumb: 'Search' };
  if (dest?.kind === 'vacancy') {
    const same = dest.vacancyId === app.vacancyId;
    return { href: dest.href, label: same ? `${title} pipeline` : 'Job pipeline', crumb: same ? title : 'Job' };
  }
  if (allowedReturnDest(pipeline, actor)) {
    return { href: pipeline, label: `${title} pipeline`, crumb: title };
  }
  return fallbackBack(actor);
}

function crumbTrail(back: { href: string; crumb: string }, jobLabel: string, jobHref: string | null, name: string): Array<{ label: string; to?: string }> {
  const here = { label: name };
  if (back.crumb === jobLabel) return [{ label: jobLabel, to: back.href }, here];
  return [{ label: back.crumb, to: back.href }, jobHref ? { label: jobLabel, to: jobHref } : { label: jobLabel }, here];
}

const personLine = (name: string | null | undefined, role: string) => (name ? `${name} · ${role}` : `${role} not named on this file`);

const JOINING_LIMIT = 'Verified checks are recorded on the file. They are not joining. Hiring policy and final approval still have to be reviewed before a hire is recorded.';

function nextCopy(file: ApplicationFile, mode: FileMode = 'owner'): { title: string; detail: string; who: string; status: string } {
  const app = file.workspace.application;
  const blocked = blockingSection(file);
  const skipped = Boolean(blocked && (mode === 'licence' || mode === 'approver') && file.sections?.[blocked]?.status === 'unavailable');
  const primary = skipped && mode === 'licence' && app.stage === 'Pre-Hire' ? { key: 'prehire' as const } : primaryFor(file);
  const g = gateState(file);
  const owner = personLine(app.primaryRecruiterName, 'Recruiter');
  if (isClosedStage(app.stage)) {
    const detail = app.stage === 'Rejected'
      ? `Closed as Rejected${app.rejectionReason ? ` — ${app.rejectionReason}` : ''}.`
      : `${app.stage}: this file is closed and does not move.`;
    return { title: 'This file is closed', detail, who: owner, status: 'Closed' };
  }
  if (blocked && !skipped) {
    const problem = sectionProblem(SECTION_LABEL[blocked], file.sections?.[blocked]);
    return {
      title: 'Next action unavailable',
      detail: problem?.message ?? `${SECTION_LABEL[blocked]} could not be checked.`,
      who: owner,
      status: 'Action unavailable',
    };
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
      if (file.offer?.status === 'Withdrawn') {
        return { title: 'Finish closing withdrawn offer', detail: 'The offer is recorded as Withdrawn, but this file is still open. Finish closing the file.', who: owner, status: 'Withdrawal to finish' };
      }
      return { title: 'Waiting for the candidate to accept', detail: 'The offer is sent and this file stays on Offer. Record Accepted to open pre-hire, or Declined to close the file. Opening WhatsApp does not record the answer.', who: owner, status: 'Acceptance not recorded' };
    case 'prehire': {
      if (app.stage === 'Offer') {
        return { title: 'Move to pre-hire', detail: 'The candidate accepted the offer. Moving to pre-hire opens the checklist. It does not record joining, and the file stays on Offer until you confirm the move.', who: owner, status: 'Accepted — pre-hire not started' };
      }
      const pending = g.joining.filter((j) => !j.done);
      if (g.unknown.joining) {
        const problem = sectionProblem(SECTION_LABEL.joiningChecks, file.sections?.joiningChecks);
        return { title: 'Next action unavailable', detail: problem?.message ?? 'Joining checks could not be checked.', who: owner, status: 'Action unavailable' };
      }
      if (g.joining.length === 0) return { title: 'Review the joining checklist', detail: `No required checks are on the file yet. ${JOINING_LIMIT}`, who: owner, status: 'Checklist to review' };
      if (pending.length) return { title: 'Joining checklist still open', detail: `Still to review: ${pending.map((j) => j.label).join(', ')}. ${JOINING_LIMIT}`, who: owner, status: 'Checklist to review' };
      return { title: 'Checklist recorded', detail: `Every check on this file is verified. ${JOINING_LIMIT}`, who: owner, status: 'Checklist recorded' };
    }
    default:
      return { title: 'Review this file', detail: 'No stage action is available on this view.', who: owner, status: label(app.stage) };
  }
}

type ActivityRow = { at: string; title: string; sub?: string; system?: boolean };
type MessageAttempt = { at: string; templateName: string; state: string; reason?: string | null };

/** Automation, a blank or system author, and stale or SLA alert text are not candidate evidence. */
export function isSystemNote(note: { authorId?: string | null; authorName?: string | null; content?: string | null }): boolean {
  const authorName = note.authorName?.trim() ?? '';
  const content = note.content?.trim() ?? '';
  if (!note.authorId && (!authorName || /^system$/i.test(authorName))) return true;
  if (/^(?:system|automation)$/i.test(authorName)) return true;
  if (/^\[(?:automation|system)\]/i.test(content)) return true;
  if (/\b(?:stale applicant alert|stale alert|sla breach|automated alert|stage email queued)\b/i.test(content)) return true;
  return false;
}

const HIRING_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'] as const;

/** Drawer a stage-rail click may open. A later stage whose gate is still open uses the current next action and does not move the file. */
export function drawerForStage(file: ApplicationFile, target: string): DrawerKey | null {
  if (blockingSection(file)) return null;
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
    const live = file.interviews.filter((interview) => interview.status !== 'Cancelled' && interview.status !== 'No-show');
    return live.length === 0 ? 'schedule' : 'scorecard';
  }
  if (target === 'Offer') return offerDrawerFor(file);
  if (target === 'Pre-Hire' || target === 'Joined') return 'prehire';
  return null;
}

function collectTimeline(file: ApplicationFile, messages: MessageAttempt[] = []): ActivityRow[] {
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
  for (const note of file.notes) {
    if (!note.createdAt) continue;
    const author = note.authorName?.trim();
    const text = note.content?.trim() ?? '';
    if (isSystemNote(note)) {
      rows.push({
        at: note.createdAt,
        title: /stale/i.test(text) ? 'System activity — automated stale alert' : 'System activity',
        sub: text || undefined,
        system: true,
      });
      continue;
    }
    rows.push({ at: note.createdAt, title: author ? `Note by ${author}` : 'Note', sub: text || undefined, system: false });
  }
  for (const message of messages) {
    if (!message.at || !message.templateName) continue;
    rows.push({
      at: message.at,
      title: `Message ${message.state}: ${message.templateName}`,
      sub: message.reason || undefined,
      system: false,
    });
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.at}|${row.title}|${row.sub ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Same events as Chatter, newest first. Ties break by title, then detail. */
function recordedRows(file: ApplicationFile, messages: MessageAttempt[] = []): ActivityRow[] {
  return collectTimeline(file, messages).sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title) || (a.sub ?? '').localeCompare(b.sub ?? ''));
}

/** Same events as the activity timeline, oldest first. Ties break by title, then detail. */
export function chatterRows(file: ApplicationFile, messages: MessageAttempt[] = []): ActivityRow[] {
  return collectTimeline(file, messages).sort((a, b) => a.at.localeCompare(b.at) || a.title.localeCompare(b.title) || (a.sub ?? '').localeCompare(b.sub ?? ''));
}

function evidenceOf(file: ApplicationFile): Array<{ text: string; by: string }> {
  const items: Array<{ at: string; text: string; by: string }> = [];
  for (const s of file.screening) {
    const text = s.notes?.trim();
    if (text) items.push({ at: s.screenedAt, text, by: s.screenerName ? `Screening notes · recorded by ${s.screenerName}` : 'Screening notes' });
  }
  for (const n of file.notes) {
    if (isSystemNote(n)) continue;
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
  const newest = new Map<string, { at: string; text: string; by: string }>();
  for (const item of items) {
    const key = `${item.by}|${item.text}`;
    const prev = newest.get(key);
    if (!prev || item.at.localeCompare(prev.at) > 0) newest.set(key, item);
  }
  return [...newest.values()].sort((a, b) => b.at.localeCompare(a.at) || a.by.localeCompare(b.by) || a.text.localeCompare(b.text));
}

const NOTICE_KEYS: FileSectionKey[] = ['history', 'notes', 'screening', 'interviews', 'scorecards', 'offer', 'hiring', 'joiningChecks', 'documents'];

function retryName(key: FileSectionKey): string {
  const label = SECTION_LABEL[key];
  return label === 'The offer' ? 'the offer' : label.toLowerCase();
}

function sectionKnown(file: ApplicationFile, key: FileSectionKey): boolean {
  return isSectionKnown(file.sections?.[key]);
}

function applyRetriedSection(latest: ApplicationFile, incoming: ApplicationFile, key: FileSectionKey): ApplicationFile {
  const merged: ApplicationFile = { ...latest };
  if (key === 'history') merged.history = incoming.history;
  else if (key === 'notes') merged.notes = incoming.notes;
  else if (key === 'screening') merged.screening = incoming.screening;
  else if (key === 'interviews') {
    merged.interviews = incoming.interviews;
    merged.scorecards = incoming.scorecards;
  } else if (key === 'scorecards') merged.scorecards = incoming.scorecards;
  else if (key === 'offer') merged.offer = incoming.offer;
  else if (key === 'hiring') merged.hiring = incoming.hiring;
  else if (key === 'joiningChecks') merged.joiningChecks = incoming.joiningChecks;
  else if (key === 'documents') merged.documents = incoming.documents;
  if (latest.sections && incoming.sections && key !== 'messages') {
    merged.sections = {
      ...latest.sections,
      [key]: incoming.sections[key],
      ...(key === 'interviews' ? { scorecards: incoming.sections.scorecards } : {}),
    } as ApplicationFile['sections'];
  }
  return merged;
}

function markSectionLoading(file: ApplicationFile, key: FileSectionKey): ApplicationFile {
  if (!file.sections || key === 'messages') return file;
  return {
    ...file,
    sections: {
      ...file.sections,
      [key]: { status: 'loading' },
      ...(key === 'interviews' ? { scorecards: { status: 'loading' } } : {}),
    } as NonNullable<ApplicationFile['sections']>,
  };
}

export function ApplicationFileV2({ load = loadApplicationFile, mode = 'owner' }: { load?: typeof loadApplicationFile; mode?: FileMode } = {}) {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const shellSeat = useV2Shell()?.seat;
  // #34: 'approver' = a final-hire approver without APPLICATION_VIEW: read-only like the Manager view (no drawers,
  // notes or follow-up), no offer decision, no pay, CV download allowed.
  const approver = mode === 'approver';
  const licence = mode === 'licence';
  const manager = mode === 'manager' || approver || licence;
  // Pay (salary, band) only for the Manager seat holding OFFER_PAY_VIEW.
  const showPay = mode === 'manager' && canSeePay('manager', user?.permissions);
  const [toast, setToast] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [noteSignal, setNoteSignal] = useState(0);
  const [params, setParams] = useSearchParams();
  const [contactOpen, setContactOpen] = useState(() => params.get('contact') === '1');
  const [suggestJobsOpen, setSuggestJobsOpen] = useState(false);
  const [state, setState] = useState<Load>({ kind: 'loading', id });
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<SectionState<FileMessages>>({ status: 'loading' });
  const [messageAttempt, setMessageAttempt] = useState(0);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-file-surface', 'true');
    return () => { root.removeAttribute('data-file-surface'); };
  }, []);
  useEffect(() => {
    if (params.get('tab') === 'documents') setMoreOpen(true);
  }, [id, params]);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const root = moreMenuRef.current;
      const target = event.target;
      if (target instanceof Element && root?.contains(target) && target.closest('button, a')) return;
      setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);
  const viewGen = useRef(0);
  const sectionGen = useRef<Partial<Record<FileSectionKey, number>>>({});
  const fileRef = useRef<ApplicationFile | null>(null);
  const currentState: Load = state.id === id ? state : { kind: 'loading', id };
  fileRef.current = currentState.kind === 'ready' ? currentState.file : null;
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
    const epoch = ++viewGen.current;
    const requested = id;
    let alive = true;
    load(requested, { keepScreeningPay: showPay })
      .then((file) => {
        if (!alive || epoch !== viewGen.current) return;
        if (file.requestedId && file.requestedId !== requested) return;
        setState({ kind: 'ready', id: requested, file });
      })
      .catch((e: unknown) => {
        if (!alive || epoch !== viewGen.current) return;
        if (e instanceof ApiError && e.statusCode === 403) setState({ kind: 'forbidden', id: requested, message: e.message });
        else if (e instanceof ApiError && e.statusCode === 404) setState({ kind: 'missing', id: requested });
        else setState({ kind: 'error', id: requested, message: e instanceof Error ? e.message : 'Could not load this file.' });
      });
    return () => { alive = false; };
  }, [id, load, attempt, showPay]);

  useEffect(() => {
    if (manager) return undefined;
    let live = true;
    const requested = id;
    setMessages({ status: 'loading' });
    void loadMessageSection(requested).then((next) => {
      if (live && requested === id) setMessages(next);
    });
    return () => { live = false; };
  }, [id, manager, attempt, messageAttempt]);

  const retrySection = useCallback((key: FileSectionKey) => {
    const current = fileRef.current;
    if (!current?.sections || key === 'messages') return;
    if (current.sections[key]?.status === 'loading') return;
    const requested = id;
    const epoch = viewGen.current;
    const gen = (sectionGen.current[key] ?? 0) + 1;
    sectionGen.current[key] = gen;
    const scoreGen = key === 'interviews' ? (sectionGen.current.scorecards ?? 0) + 1 : undefined;
    if (scoreGen !== undefined) sectionGen.current.scorecards = scoreGen;
    setState((prev) => {
      if (prev.kind !== 'ready' || prev.id !== requested) return prev;
      if ((prev.file.requestedId ?? prev.file.workspace.application.id) !== requested) return prev;
      return { kind: 'ready', id: requested, file: markSectionLoading(prev.file, key) };
    });
    void reloadFileSection(current, key, { keepScreeningPay: showPay, approver }).then((next) => {
      if (epoch !== viewGen.current || sectionGen.current[key] !== gen) return;
      if (scoreGen !== undefined && sectionGen.current.scorecards !== scoreGen) return;
      if ((next.requestedId ?? requested) !== requested) return;
      setState((prev) => {
        if (prev.kind !== 'ready' || prev.id !== requested) return prev;
        const shown = prev.file.requestedId ?? prev.file.workspace.application.id;
        if (shown !== requested) return prev;
        return { kind: 'ready', id: requested, file: applyRetriedSection(prev.file, next, key) };
      });
    });
  }, [approver, id, showPay]);

  const headerName = currentState.kind === 'ready' ? candidateName(currentState.file.workspace.application) : null;
  useSetBreadcrumbTitle(headerName);

  const lastDrawerTriggerRef = useRef<HTMLElement | null>(null);
  const drawerWasOpenRef = useRef(false);
  const openDrawer = useCallback((key: DrawerKey, extra?: Record<string, string>) => {
    if (document.activeElement instanceof HTMLElement) lastDrawerTriggerRef.current = document.activeElement;
    setParams((p) => {
      const n = new URLSearchParams(p); n.set('drawer', key);
      for (const [k, v] of Object.entries(extra ?? {})) n.set(k, v);
      return n;
    });
  }, [setParams]);
  const closeDrawer = useCallback(() => setParams((p) => { const n = new URLSearchParams(p); n.delete('drawer'); n.delete('interview'); n.delete('decide'); return n; }), [setParams]);
  const done = useCallback(() => { closeDrawer(); setAttempt((n) => n + 1); }, [closeDrawer]);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !drawer && !params.get('decide')) setAttempt((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [drawer, params]);
  useEffect(() => {
    const open = drawer != null && DRAWER_KEYS.includes(drawer);
    if (drawerWasOpenRef.current && !open) {
      const trigger = lastDrawerTriggerRef.current;
      lastDrawerTriggerRef.current = null;
      if (trigger?.isConnected) trigger.focus();
    }
    drawerWasOpenRef.current = open;
  }, [drawer]);

  if (currentState.kind === 'loading') return <div className="rf2-file"><SkeletonV2 lines={8} label="Loading the application file…" /></div>;
  if (currentState.kind === 'forbidden') return <div className="rf2-file"><ForbiddenStateV2 title="This file belongs to another owner" body="Ask the owner or your manager if you need it." action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={mode === 'licence' ? '/licenses' : '/my-work'}>{mode === 'licence' ? 'Back to Licences' : 'Back to My Work'}</Link>} /></div>;
  if (currentState.kind === 'missing') return <div className="rf2-file"><EmptyStateV2 title="File not found" body="It may have been moved or closed." /></div>;
  if (currentState.kind === 'error') return <div className="rf2-file" role="alert"><EmptyStateV2 title="Could not load this file" body={currentState.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>;

  const { file } = currentState;
  const app = file.workspace.application;
  const name = candidateName(app);
  const blockedKey = blockingSection(file);
  const roleSkipped = Boolean(blockedKey && (licence || approver) && file.sections?.[blockedKey]?.status === 'unavailable');
  const actionBlocked = roleSkipped ? null : blockedKey;
  const blockedProblem = actionBlocked && !isClosedStage(app.stage)
    ? sectionProblem(SECTION_LABEL[actionBlocked], file.sections?.[actionBlocked]) ?? { tone: 'danger' as const, message: `${SECTION_LABEL[actionBlocked]} could not be checked.` }
    : null;
  const primary = primaryFor(file);
  const facts = gateState(file);
  // #21 (B2-4): Joined/Rejected/Withdrawn files are closed (409 FILE_CLOSED): no move, no reject, and no drawer that moves the file.
  const closed = isClosedStage(app.stage);
  const Drawer = drawer && DRAWER_KEYS.includes(drawer) && (licence ? drawer === 'prehire' : !manager && !(closed && MOVING_DRAWERS.includes(drawer))) ? DRAWERS[drawer] : null;
  // Manager: the offer decision opens here, over the file (Figma 09). ?decide=<offerId> deep-links from Team work.
  const pendingOffer = file.offer && file.offer.status === 'Pending Approval' ? file.offer : null;
  const decideId = mode === 'manager' ? params.get('decide') : null;
  const latestScreen = [...file.screening].sort((a, b) => b.screenedAt.localeCompare(a.screenedAt))[0] ?? null;
  const tab = hubTab(params.get('tab'));
  const actor = routeActor(shellSeat ?? (mode === 'manager' ? 'manager' : 'employee'), user);
  const back = destination(file, mode, params.get('returnTo'), actor);
  const sourceSet = mode === 'owner' ? readPipelineSourceSet(back.href) : null;
  const validSet = sourceSet && sourceSet.vacancyId === app.vacancyId && sourceSet.applicationIds.includes(app.id) && sourceSet.applicationIds.length > 1 ? sourceSet : null;
  const seqIndex = validSet ? validSet.applicationIds.indexOf(app.id) : -1;
  const prevAppId = validSet && seqIndex > 0 ? validSet.applicationIds[seqIndex - 1] : null;
  const nextAppId = validSet && seqIndex >= 0 && seqIndex < validSet.applicationIds.length - 1 ? validSet.applicationIds[seqIndex + 1] : null;
  const copy = nextCopy(file, mode);
  const gates = gateRows(file);
  const jobLabel = app.positionTitle ?? 'Job';
  const defaultPipeline = `/vacancies/${encodeURIComponent(app.vacancyId)}`;
  const canOpenVacancy = mode === 'owner' && allowedReturnDest(defaultPipeline, actor) != null;
  const crumbs = crumbTrail(back, jobLabel, canOpenVacancy ? defaultPipeline : null, name);
  const stageAt = HIRING_STAGES.findIndex((stage) => label(stage).toLowerCase() === label(app.stage).toLowerCase());
  const statusTone = closed ? 'closed' : /required/i.test(copy.status) ? 'attention' : 'steady';
  const scorecardFuture = (app.stage === 'Applied' || app.stage === 'Screening') && file.interviews.length === 0;
  const offerFuture = !file.offer && !facts.scorecard && (app.stage === 'Applied' || app.stage === 'Screening' || app.stage === 'Interview');
  const prehireFuture = !facts.offerAccepted && app.stage !== 'Pre-Hire';
  const screeningKnown = sectionKnown(file, 'screening');
  const noticeDays = screeningKnown ? file.screening.find((s) => s.noticePeriodDays != null)?.noticePeriodDays : undefined;
  const evidence = evidenceOf(file);
  const evidenceKnown = (['screening', 'notes', 'scorecards'] as const).every((key) => sectionKnown(file, key));
  const activityKnown = (['history', 'screening', 'interviews', 'scorecards', 'offer'] as const).every((key) => sectionKnown(file, key));
  const chatterMessages = !manager && messages.status === 'ready' ? messages.data.attempts : [];
  const chatterKnown = activityKnown && sectionKnown(file, 'notes') && (manager || messages.status === 'ready');
  const documentsKnown = sectionKnown(file, 'documents');
  const showDocuments = tab === 'documents';
  const unavailableLabels = NOTICE_KEYS.filter((key) => file.sections?.[key]?.status === 'unavailable');
  const unavailableNote = unavailableLabels.length >= 2 ? `Not requested for this role: ${unavailableLabels.map((key) => SECTION_LABEL[key]).join(', ')}.` : null;
  const sectionRows = NOTICE_KEYS.flatMap((key) => {
    if (key === actionBlocked) return [];
    if (key === 'scorecards' && !sectionKnown(file, 'interviews')) return [];
    if (key === 'documents' && showDocuments && !manager) return [];
    const section = file.sections?.[key];
    if (!section || section.status === 'ready' || section.status === 'empty') return [];
    if (unavailableNote && section.status === 'unavailable') return [];
    const problem = sectionProblem(SECTION_LABEL[key], section);
    return problem ? [{ key, problem, retry: canRetrySection(section) }] : [];
  });
  const openDocuments = () => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'documents'); return n; });
  const focusNote = () => { setMoreOpen(true); setNoteSignal((n) => n + 1); };
  const initials = fileInitials(name);
  const nextAppointment = [...file.interviews].filter((i) => i.status === 'Scheduled' || i.status === 'Rescheduled').sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0] ?? null;
  const latestInterview = [...file.interviews].sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))[0] ?? null;
  const interviewForMessage = nextAppointment ?? latestInterview;

  return (
    <div className="rf2-file">
      <section className="rf2-file__head rf2-file__header" aria-labelledby="file-name">
        <div className="rf2-file__navline">
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
          {validSet ? (
            <nav className="rf2-file__seq" aria-label="Candidate sequence">
              {prevAppId ? (
                <Link className="rf2-link" to={withReturnTo(`/applications/${encodeURIComponent(prevAppId)}`, back.href)} aria-label="Previous candidate">
                  <ArrowLeft aria-hidden="true" /> Previous
                </Link>
              ) : (
                <span className="rf2-file__muted" aria-disabled="true">Previous</span>
              )}
              <span className="rf2-file__muted" aria-live="polite">{seqIndex + 1} of {validSet.applicationIds.length}</span>
              {nextAppId ? (
                <Link className="rf2-link" to={withReturnTo(`/applications/${encodeURIComponent(nextAppId)}`, back.href)} aria-label="Next candidate">
                  Next <ArrowRight aria-hidden="true" />
                </Link>
              ) : (
                <span className="rf2-file__muted" aria-disabled="true">Next</span>
              )}
            </nav>
          ) : null}
        </div>
        <div className="rf2-file__identity-row">
          <span className="rf2-file__avatar" aria-hidden="true">{initials}</span>
          <div className="rf2-file__intro">
            <h2 id="file-name" className="rf2-file__name">{name}</h2>
            <p className="rf2-file__meta rf2-file__sub">{[app.positionTitle, app.vacancyBranchName ?? app.vacancyLocation, app.primaryRecruiterName ? `Owner: ${app.primaryRecruiterName}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="rf2-file__identity-meta">
            <span className="rf2-file__code-pill">{app.applicationCode}</span>
            {!manager && app.candidate?.phone ? <a href="#msgs-h" className="rf2-file__wa-pill">WhatsApp candidate</a> : null}
          </div>
        </div>
        <div className="rf2-file__stage">
          <ol className="rf2-rail" aria-label="Stages">
            {HIRING_STAGES.map((stage, index) => {
              const currentStep = index === stageAt;
              const place = stageAt < 0 ? 'later' : index < stageAt ? 'done' : currentStep ? 'current' : 'later';
              if (manager || closed) {
                return <li key={stage}><span className="rf2-rail__step" data-place={place} data-done={place === 'done' ? 'true' : undefined} aria-current={currentStep ? 'step' : undefined}>{label(stage)}</span></li>;
              }
              return (
                <li key={stage}>
                  <button type="button" className="rf2-rail__step" data-place={place} data-done={place === 'done' ? 'true' : undefined} aria-current={currentStep ? 'step' : undefined} disabled={actionBlocked != null} onClick={() => { const key = drawerForStage(file, stage); if (key) openDrawer(key); }}>{label(stage)}</button>
                </li>
              );
            })}
          </ol>
          <p className="rf2-file__status" data-tone={statusTone}>{copy.status}</p>
        </div>
        <p className="rf2-file__stage-note">Current stage: {stageAt >= 0 ? label(HIRING_STAGES[stageAt]) : label(app.stage)}. A later stage opens the next required action. It does not move this file.</p>
      </section>
      {toast ? <p className="rf2-inline-note" role="status">{toast}</p> : null}
      <section className="rf2-card rf2-file__next" aria-labelledby="next-h">
        <div className="rf2-file__next-copy">
          <h3 id="next-h" className="rf2-card__title rf2-file__next-title">{copy.title}</h3>
          {blockedProblem ? (
            <div className="rf2-file__section" role={blockedProblem.tone === 'loading' ? 'status' : 'alert'} data-tone={blockedProblem.tone === 'transient' || blockedProblem.tone === 'loading' ? 'warning' : blockedProblem.tone === 'unavailable' ? 'unavailable' : 'danger'}>
              <p>{blockedProblem.message}</p>
            </div>
          ) : (
            <p className={closed ? 'rf2-file__closed' : undefined} role={closed ? 'note' : undefined} data-testid={closed && app.stage !== 'Rejected' ? 'file-closed' : undefined}>{copy.detail}</p>
          )}
          {gates.length ? (
            <ul className="rf2-gates rf2-gates--inline" aria-label={`Gate to ${gates[0].to}`}>
              <li className="rf2-gates__title">To move to {gates[0].to}:</li>
              {gates.map((g) => (
                <li key={g.label} className="rf2-gate" data-ok={g.unknown ? 'unknown' : g.ok ? 'true' : 'false'}>{g.ok && !g.unknown ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}<span>{g.label}{g.unknown ? <span className="rf2-gate__hint"> — could not be checked</span> : null}</span><span className="rf2-visually-hidden">{g.unknown ? '(unknown)' : g.ok ? '(done)' : '(not done)'}</span></li>
              ))}
            </ul>
          ) : null}
          <p className="rf2-file__muted">{copy.who}</p>
        </div>
        <div className="rf2-smart rf2-file__actions" role="group" aria-label="Smart actions">
            {licence ? (
              <>
                <ButtonV2 size="md" icon={<CircleCheck />} onClick={() => openDrawer('prehire')}>Pre-hire</ButtonV2>
                <ButtonV2 kind="secondary" size="md" icon={<FileText />} aria-pressed={showDocuments} onClick={openDocuments}>Documents</ButtonV2>
              </>
            ) : manager ? (
              <>
                {actionBlocked && !closed && !approver ? <ButtonV2 size="md" disabled>Action unavailable</ButtonV2> : null}
                {actionBlocked && canRetrySection(file.sections?.[actionBlocked]) ? <ButtonV2 kind="secondary" size="md" icon={<RotateCw />} onClick={() => retrySection(actionBlocked)}>Retry {retryName(actionBlocked)}</ButtonV2> : null}
                <ButtonV2 kind="secondary" size="md" icon={<FileText />} aria-pressed={showDocuments} onClick={openDocuments}>Documents</ButtonV2>
                {pendingOffer && !approver ? <ButtonV2 size="md" icon={<CircleCheck />} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('decide', pendingOffer.id); return n; })}>Review offer</ButtonV2> : null}
              </>
            ) : (
              <>
                {actionBlocked && !closed ? <ButtonV2 size="md" disabled>Action unavailable</ButtonV2> : primary && !closed ? <ButtonV2 size="md" icon={primary.icon} onClick={() => openDrawer(primary.key)}>{primary.label}</ButtonV2> : null}
                {actionBlocked && canRetrySection(file.sections?.[actionBlocked]) ? <ButtonV2 kind="secondary" size="md" icon={<RotateCw />} onClick={() => retrySection(actionBlocked)}>Retry {retryName(actionBlocked)}</ButtonV2> : null}
                <div className="rf2-file__menu" ref={moreMenuRef}>
                  <ButtonV2 kind="secondary" size="md" aria-expanded={moreOpen} aria-controls="file-more-actions" onClick={() => setMoreOpen((open) => !open)}>More actions</ButtonV2>
                  {moreOpen ? (
                    <div id="file-more-actions" className="rf2-file__menu-panel" role="group" aria-label="More actions">
                      <p className="rf2-file__muted" id="file-later-hint">Locked actions wait for the current step. They do not move the file.</p>
                      <ButtonV2 kind="secondary" size="md" icon={<FileText />} onClick={focusNote}>Note</ButtonV2>
                      <ButtonV2 kind="secondary" size="md" icon={<FileText />} aria-pressed={showDocuments} onClick={openDocuments}>Documents</ButtonV2>
                      <ButtonV2 kind="secondary" size="md" icon={<Briefcase />} onClick={() => { setMoreOpen(false); setSuggestJobsOpen(true); }}>Suggest roles</ButtonV2>
                      {!closed ? (
                        <>
                          <ButtonV2 kind="secondary" size="md" icon={<CalendarDays />} disabled={facts.unknown.interviews || ((app.stage === 'Applied' || app.stage === 'Screening') && facts.unknown.screening)} onClick={() => openDrawer('schedule')}>Schedule</ButtonV2>
                          <ButtonV2 kind="secondary" size="md" icon={<Star />} disabled={facts.unknown.interviews || facts.unknown.scorecards || scorecardFuture} data-future={scorecardFuture ? 'true' : undefined} aria-describedby={scorecardFuture ? 'file-later-hint' : undefined} onClick={() => openDrawer('scorecard')}>Scorecard</ButtonV2>
                          <ButtonV2 kind="secondary" size="md" icon={<Send />} disabled={facts.unknown.offer || (app.stage === 'Interview' && facts.unknown.scorecards) || offerFuture} data-future={offerFuture ? 'true' : undefined} aria-describedby={offerFuture ? 'file-later-hint' : undefined} onClick={() => openDrawer(offerDrawerFor(file))}>Offer</ButtonV2>
                          <ButtonV2 kind="secondary" size="md" icon={<CircleCheck />} disabled={facts.unknown.offer || facts.unknown.hiring || facts.unknown.joining || prehireFuture} data-future={prehireFuture ? 'true' : undefined} aria-describedby={prehireFuture ? 'file-later-hint' : undefined} onClick={() => openDrawer('prehire')}>Pre-hire</ButtonV2>
                          <ButtonV2 kind="danger" size="md" icon={<XCircle />} onClick={() => openDrawer('reject')}>Reject</ButtonV2>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
      </section>
      <div className="rf2-file__stack">
            {unavailableNote ? <p className="rf2-file__section" role="note" data-tone="unavailable">{unavailableNote}</p> : null}
            {sectionRows.map((row) => (
              <div key={row.key} className="rf2-file__section" role={row.problem.tone === 'loading' ? 'status' : 'alert'} data-tone={row.problem.tone === 'transient' || row.problem.tone === 'loading' ? 'warning' : row.problem.tone === 'unavailable' ? 'unavailable' : 'danger'}>
                <p>{row.problem.message}</p>
                {row.retry ? <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => retrySection(row.key)}>Retry {retryName(row.key)}</ButtonV2> : null}
              </div>
            ))}
            <section className="rf2-card" aria-labelledby="glance-h">
              <h3 id="glance-h" className="rf2-card__title">At a glance</h3>
              <div className="rf2-file__glance">
                <div>
                  <p>{app.candidate?.email ?? 'Email not recorded'}</p>
                  {app.candidate?.phone ? <p>{app.candidate.phone}</p> : null}
                  <p>Source: {app.source ?? 'Not recorded'}</p>
                </div>
                <div>
                  <p>Notice: {!screeningKnown ? (file.sections?.screening?.status === 'unavailable' ? 'not available for this role' : 'could not be checked') : noticeDays != null ? `${noticeDays} days` : 'Not recorded'}</p>
                  {manager
                    ? <p>Follow-up: {app.followUpDate ? fmt(`${app.followUpDate}T12:00:00Z`) : 'Not set'}</p>
                    : <FollowUp id={app.id} value={app.followUpDate ?? null} closed={closed} onSaved={() => setAttempt((n) => n + 1)} />}
                  <p className="rf2-file__muted">File {app.applicationCode}</p>
                </div>
              </div>
              <p className="rf2-file__muted">Application follow-up date applies to this job file only. Person contact & timed follow-up applies to the candidate across applications.</p>
              {!manager && app.candidateId ? (
                <div id="person-contact-follow-up">
                  <button type="button" className="rf2-link rf2-link-btn" aria-expanded={contactOpen} aria-controls="person-contact-panel" onClick={() => setContactOpen((open) => !open)}>Person contact & timed follow-up</button>
                  <div id="person-contact-panel">
                    {contactOpen ? <CandidateActivityPanel candidateId={app.candidateId} contextLabel="Person contact & timed follow-up — shared across this person's applications (distinct from application follow-up date)" /> : null}
                  </div>
                </div>
              ) : null}
            </section>
            <EvidenceCard items={evidence} known={evidenceKnown} />
            {!approver && !licence ? (
              <AtsMatchCard applicationId={app.id} onSuggestJobs={app.candidateId ? () => setSuggestJobsOpen(true) : undefined} />
            ) : null}
            {manager ? <ScorecardFit file={file} /> : null}
            {showPay && screeningKnown ? (
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
                <p>{file.offer.offerCode} · v{(file.offer.currentVersion ?? file.offer.versions?.[0])?.versionNumber ?? 1} · {sentBack(file.offer) ? <StatusChip tone="danger" label="Sent back" /> : null}{sentBack(file.offer) ? <> <StatusChip tone="neutral" label="Draft" /></> : file.offer.status === 'Approved' ? <StatusChip tone="info" label="Approved — ready to send" /> : <StatusChip tone={file.offer.status === 'Accepted' ? 'success' : 'neutral'} label={file.offer.status} />}</p>
                <p className="rf2-file__muted">{manager ? (pendingOffer ? 'Waiting on your decision. Review offer opens the pay and the band.' : 'Pay and the band show in the offer decision.') : 'Pay is set by the approving manager and not shown here.'}</p>
              </section>
            ) : null}
            <Timeline file={file} messages={chatterMessages} chatterKnown={chatterKnown} interviewsKnown={sectionKnown(file, 'interviews')} scorecardsKnown={sectionKnown(file, 'scorecards')} writable={!manager} onScorecard={manager ? undefined : (iid) => openDrawer('scorecard', { interview: iid })} onReschedule={manager ? undefined : (iid) => openDrawer('schedule', iid ? { interview: iid } : undefined)} onChanged={() => setAttempt((n) => n + 1)} />
            {manager ? null : <Notes file={file} signal={noteSignal} onAdded={() => setAttempt((n) => n + 1)} />}
            {manager ? null : (
              <MessagesCard
                applicationId={app.id}
                followUpDate={app.followUpDate ?? null}
                omitAttempts
                showDeliveryDestination
                read={messages}
                onReload={() => setMessageAttempt((n) => n + 1)}
                whatsappContext={{
                  phone: app.candidate?.phone ?? '',
                  candidateName: name,
                  positionTitle: app.positionTitle ?? '',
                  organizationName: 'Saudi German Health',
                  stageName: app.stage,
                  interviewType: interviewForMessage?.interviewType ?? 'Any',
                  interviewDate: nextAppointment ? fmt(nextAppointment.scheduledStart) : latestInterview ? fmt(latestInterview.scheduledStart) : '',
                  interviewerName: interviewForMessage?.interviewerName ?? '',
                  roomLink: interviewForMessage?.locationUrl ?? '',
                  recruiterName: app.primaryRecruiterName || user?.displayName || 'Recruiter',
                }}
              />
            )}
        {showDocuments ? (
          <section className="rf2-card" aria-labelledby="docs-h">
            <h3 id="docs-h" className="rf2-card__title">Documents</h3>
            {manager ? (
              !documentsKnown ? null : file.documents.length === 0 ? <p className="rf2-file__muted">No documents yet.</p> : (
                <ul className="rf2-docs">
                  {file.documents.map((d) => (
                    <li key={d.id}><FileText aria-hidden="true" /><div><p>{d.name}</p><p className="rf2-timeline__sub">{[d.type, fmt(d.uploadedAt), d.uploadedBy ? `by ${d.uploadedBy.name}` : null].filter(Boolean).join(' · ')}</p></div>
                      {approver && isCvDoc(d) ? <ButtonV2 kind="secondary" size="sm" icon={<Download />} onClick={() => void downloadDocument(d).catch((e: unknown) => setToast(e instanceof Error ? e.message : 'Could not download the CV.'))}>Download CV</ButtonV2> : null}</li>
                  ))}
                </ul>
              )
            ) : <DocumentHistory applicationId={app.id} fallback={file.documents} fallbackKnown={documentsKnown} section={file.sections?.documents} onRetrySection={() => retrySection('documents')} hideUnavailableAlert={Boolean(unavailableNote && file.sections?.documents?.status === 'unavailable')} onToast={setToast} />}
          </section>
        ) : null}
      </div>

      {Drawer ? <Drawer file={file} onClose={closeDrawer} onDone={done} params={params} /> : null}
      {decideId ? (
        <OfferDecisionDrawer offerId={decideId} ownerName={app.primaryRecruiterName ?? null} showPay={showPay} onClose={closeDrawer}
          onDone={(m) => { setToast(m); done(); }} />
      ) : null}
      {suggestJobsOpen && app.candidateId ? (
        <SuggestJobsDrawer
          isOpen={suggestJobsOpen}
          onClose={() => setSuggestJobsOpen(false)}
          candidateId={app.candidateId}
          candidateName={name}
        />
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
  const fit = (file.workspace.application as { fitSummary?: string | null }).fitSummary ?? null;
  return (
    <section className="rf2-card" aria-labelledby="fit-h">
      <h3 id="fit-h" className="rf2-card__title">Scorecards and fit</h3>
      {!sectionKnown(file, 'scorecards') ? null : cards.length === 0 ? <p className="rf2-file__muted">No submitted scorecards yet.</p> : (
        <dl className="rf2-terms">
          <dt>Scorecards</dt><dd>{cards.length} submitted · average {avg} / 5</dd>
          <dt>Recommendation</dt><dd>{Object.entries(recs).map(([r, n]) => `${n} ${r}`).join(', ')}</dd>
        </dl>
      )}
      {fit ? <p className="rf2-file__muted">{fit}</p> : null}
    </section>
  );
}

function EvidenceCard({ items, known }: { items: Array<{ text: string; by: string }>; known: boolean }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = items;
  return (
    <section className="rf2-card rf2-file__evidence" aria-labelledby="evidence-h">
      <h3 id="evidence-h" className="rf2-card__title">Evidence and fit</h3>
      {items.length === 0 ? (known ? <p className="rf2-file__muted">No screening note or fit evidence is recorded on this file yet.</p> : null) : first ? (
        <>
          <div>
            <p>{first.text}</p>
            <p className="rf2-timeline__sub">{first.by}</p>
          </div>
          {rest.length > 0 ? (
            <>
              <button type="button" className="rf2-link" aria-expanded={open} aria-controls="evidence-more" onClick={() => setOpen((value) => !value)}>
                {open ? 'Hide evaluation details' : `Show evaluation details (${rest.length})`}
              </button>
              {open ? (
                <div id="evidence-more">
                  {rest.map((item) => (
                    <div key={`${item.by}-${item.text}`}>
                      <p>{item.text}</p>
                      <p className="rf2-timeline__sub">{item.by}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

type TimelineEntry =
  | { kind: 'row'; row: ActivityRow; key: string }
  | { kind: 'group'; title: string; rows: ActivityRow[]; key: string; id: string };

function groupSystemAlerts(rows: ActivityRow[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index]!;
    const system = row.system === true || row.title.startsWith('System activity');
    if (system) {
      let end = index + 1;
      while (end < rows.length && rows[end]!.title === row.title && (rows[end]!.system === true || rows[end]!.title.startsWith('System activity'))) end += 1;
      const slice = rows.slice(index, end);
      if (slice.length >= 2) entries.push({ kind: 'group', title: row.title, rows: slice, key: `group-${index}`, id: `system-alerts-${index}` });
      else entries.push({ kind: 'row', row, key: `${row.at}-${index}` });
      index = end;
    } else {
      entries.push({ kind: 'row', row, key: `${row.at}-${index}` });
      index += 1;
    }
  }
  return entries;
}

function Timeline({ file, messages = [], chatterKnown = true, interviewsKnown = true, scorecardsKnown = true, writable, onScorecard, onReschedule, onChanged }: { file: ApplicationFile; messages?: MessageAttempt[]; chatterKnown?: boolean; interviewsKnown?: boolean; scorecardsKnown?: boolean; writable?: boolean; onScorecard?: (interviewId: string) => void; onReschedule?: (interviewId: string) => void; onChanged: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [chatterFilter, setChatterFilter] = useState<'all' | 'team'>('all');
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const markNoShow = async (interview: InterviewItem) => {
    setErr(null);
    try { await updateInterview(interview.id, { status: 'No-show' }); onChanged(); } catch (e) { setErr(errorText(e)); }
  };
  const recorded = recordedRows(file, messages);
  const shown = chatterFilter === 'team' ? recorded.filter((r) => !r.title.startsWith('System activity')) : recorded;
  const entries = groupSystemAlerts(shown);
  const toggleGroup = (key: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const interviews = [...file.interviews].sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  const nextAppointment = [...file.interviews].filter((i) => i.status === 'Scheduled' || i.status === 'Rescheduled').sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0] ?? null;
  return (
    <section className="rf2-card rf2-file__chatter" aria-labelledby="chatter-h">
      <div className="rf2-file__chatter-head">
        <h3 id="chatter-h" className="rf2-card__title">Chatter</h3>
        <div className="rf2-file__chatter-filter" role="group" aria-label="Chatter filter">
          <button type="button" aria-pressed={chatterFilter === 'all'} onClick={() => setChatterFilter('all')}>All</button>
          <button type="button" aria-pressed={chatterFilter === 'team'} onClick={() => setChatterFilter('team')}>Team only</button>
        </div>
      </div>
      {err ? <p className="rf2-inline-note" role="alert">{err}</p> : null}
      {entries.length === 0 ? (chatterKnown ? <p className="rf2-file__muted">{recorded.length === 0 ? 'Nothing recorded yet.' : 'No team events in this list.'}</p> : null) : (
        <ol className="rf2-timeline" aria-label="Chatter">
          {entries.map((entry) => entry.kind === 'row' ? (
            <li key={entry.key} className="rf2-timeline__row" data-system={entry.row.title.startsWith('System activity') ? 'true' : undefined}>
              <time dateTime={entry.row.at}>{fmt(entry.row.at)}</time>
              <div><p className="rf2-timeline__title">{entry.row.title}</p>{entry.row.sub ? <p className="rf2-timeline__sub">{entry.row.sub}</p> : null}</div>
            </li>
          ) : (
            <li key={entry.key} className="rf2-timeline__row" data-system="true">
              <div>
                <p className="rf2-timeline__title">{entry.title}</p>
                <p className="rf2-timeline__sub">{entry.rows.length} similar alerts, newest first</p>
                <button type="button" className="rf2-link" aria-expanded={openGroups.has(entry.key)} aria-controls={openGroups.has(entry.key) ? entry.id : undefined} onClick={() => toggleGroup(entry.key)}>
                  {openGroups.has(entry.key) ? 'Hide system alerts' : `Show full history (${entry.rows.length} system alerts)`}
                </button>
                {openGroups.has(entry.key) ? (
                  <ol id={entry.id}>
                    {entry.rows.map((row, index) => (
                      <li key={`${row.at}-${index}`}>
                        <time dateTime={row.at}>{fmt(row.at)}</time>
                        <p>{row.sub ?? row.title}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      <h4 className="rf2-file__subhead">Interviews</h4>
      {nextAppointment ? <p className="rf2-file__muted" data-testid="next-appointment">Next appointment: {nextAppointment.title} · {fmt(nextAppointment.scheduledStart, true)}</p> : null}
      {interviews.length === 0 ? (interviewsKnown ? <p className="rf2-file__muted">No interviews on this file.</p> : null) : (
        <ol className="rf2-timeline" aria-label="Interviews">
          {interviews.map((i) => {
            const cards = file.scorecards[i.id] ?? [];
            const submitted = cards.filter(isScorecardSubmitted).length;
            const open = i.status === 'Scheduled' || i.status === 'Rescheduled';
            const commitment = !i.createdAt && (open ? 'Scheduled commitment' : 'Appointment on the file');
            const outstanding = scorecardsKnown && i.attendees && i.attendees.length > submitted && i.status !== 'Cancelled' && i.status !== 'No-show'
              ? `${i.attendees.length - submitted} outstanding`
              : null;
            return (
              <li key={i.id} className="rf2-timeline__row rf2-file__appointment">
                {i.createdAt ? <time dateTime={i.createdAt}>{fmt(i.createdAt)}</time> : <time>On file</time>}
                <div>
                  <p className="rf2-timeline__title">{`${i.title} — ${fmt(i.scheduledStart, true)}${i.status !== 'Scheduled' ? ` (${i.status})` : ''}`}</p>
                  <p className="rf2-timeline__sub">{[commitment, i.locationUrl ? 'Room link' : i.roomName, i.interviewerName, scorecardsKnown ? `${submitted} scorecard${submitted === 1 ? '' : 's'} submitted` : 'Scorecard could not be checked', outstanding].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="rf2-timeline__actions">
                  {writable && open ? <button type="button" className="rf2-link" onClick={() => void markNoShow(i)}>Mark no-show</button> : null}
                  {writable && open && onReschedule ? <button type="button" className="rf2-link" onClick={() => onReschedule(i.id)}>Reschedule</button> : null}
                  {writable && i.status === 'No-show' && onReschedule ? <button type="button" className="rf2-link" onClick={() => onReschedule('')}>Schedule new interview</button> : null}
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

const noteDraftKey = (id: string) => `rf2:file-note-draft:${id}`;

function readNoteDraft(id: string): string {
  try { return sessionStorage.getItem(noteDraftKey(id)) ?? ''; } catch { return ''; }
}

function writeNoteDraft(id: string, value: string) {
  try {
    if (value) sessionStorage.setItem(noteDraftKey(id), value);
    else sessionStorage.removeItem(noteDraftKey(id));
  } catch { /* storage can be blocked; the field still keeps the typed value */ }
}

function Notes({ file, signal, onAdded }: { file: ApplicationFile; signal: number; onAdded: () => void }) {
  const id = file.workspace.application.id;
  const [text, setText] = useState(() => readNoteDraft(id));
  const [open, setOpen] = useState(() => readNoteDraft(id).length > 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const pendingFocus = useRef(false);
  useEffect(() => {
    const draft = readNoteDraft(id);
    setText(draft);
    setErr(undefined);
    setOpen(draft.length > 0);
  }, [id]);
  useEffect(() => {
    if (signal === 0) return;
    pendingFocus.current = true;
    setOpen(true);
  }, [signal]);
  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    pendingFocus.current = false;
    document.getElementById('file-note')?.focus();
  }, [open, signal]);
  const update = (value: string) => {
    setText(value);
    writeNoteDraft(id, value);
  };
  const save = async () => {
    if (!text.trim()) { setErr('Write the note first.'); return; }
    setBusy(true); setErr(undefined);
    try {
      await addNote(id, text.trim());
      writeNoteDraft(id, '');
      setText('');
      onAdded();
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rf2-card" aria-labelledby="notes-h">
      <h3 id="notes-h" className="rf2-card__title">Notes</h3>
      {open ? (
        <>
          <TextareaV2 id="file-note" label="Add a note" rows={3} value={text} onChange={(e) => update(e.target.value)} error={err} hint="Write with evidence. Notes can't be deleted." />
          <div className="rf2-notes__actions"><ButtonV2 kind="secondary" onClick={save} loading={busy}>Save note</ButtonV2></div>
        </>
      ) : (
        <p className="rf2-file__muted">Open Note when you are ready to write. A saved note stays on this file and cannot be deleted.</p>
      )}
    </section>
  );
}
