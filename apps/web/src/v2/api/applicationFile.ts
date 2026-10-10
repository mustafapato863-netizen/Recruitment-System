/**
 * E2 application file adapters. Types mirror the API DTOs on backend B5 (#11,
 * feat/b5-application-file @7f0c7c2). Every read goes through stripPay(): the
 * Employee seat never holds pay in state. Writes never carry pay (offer drafts
 * send components: []; screening never sends salary fields).
 */
import { getApi, patchApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { JOINING_CHECKS } from './gates';

export const FILE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'] as const;
export type FileStage = (typeof FILE_STAGES)[number] | 'Rejected' | 'Withdrawn';

/** Application (contracts) without pay — only what E13 shows. */
export interface FileApplication {
  id: string;
  applicationCode: string;
  vacancyId: string;
  vacancyLocation?: string | null;
  vacancyBranchName?: string | null;
  candidateId: string;
  stage: FileStage;
  allowedTransitions: FileStage[];
  version: number;
  source?: string | null;
  primaryRecruiterId?: string | null;
  primaryRecruiterName?: string | null;
  candidate?: { id: string; firstName?: string; lastName?: string; fullName?: string; email?: string | null; phone?: string | null };
  vacancyCode?: string;
  positionTitle?: string;
  rejectionReason?: string | null;
  nextFollowUpAt?: string | null;
  appliedAt: string;
  updatedAt: string;
}
export interface StageRequirement { id: string; code: string; label: string; kind: string; required: boolean; complete: boolean; blocking: boolean; reason?: string | null }
export interface Workspace {
  application: FileApplication;
  stages: Array<{ id: string; name: string; isCurrent: boolean; isCompleted: boolean; isNext: boolean; requirements: StageRequirement[] }>;
  nextStage?: string | null;
  nextStageRequirements: StageRequirement[];
  canAdvance: boolean;
}
export interface HistoryItem { id: string; fromStage?: string | null; toStage: string; changedByName?: string; reason?: string | null; createdAt: string }
export interface NoteItem { id: string; authorName?: string; content: string; createdAt: string }
export interface ScreeningItem { id: string; screenerName?: string; outcome: 'Passed' | 'Failed' | 'On Hold'; notes?: string | null; noticePeriodDays?: number | null; screenedAt: string }
export interface InterviewItem {
  id: string; interviewCode: string; applicationId: string; title: string; interviewType: string;
  scheduledStart: string; scheduledEnd: string; timezone: string; locationUrl?: string | null; roomName?: string | null;
  interviewerName?: string | null; status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
  attendees?: Array<{ userId?: string | null; displayName?: string | null; name?: string | null }>;
}
export interface ScorecardItem {
  id: string; interviewId: string; interviewerId: string; interviewerName?: string; overallRating: number;
  recommendation: Recommendation; strengths?: string | null; concerns?: string | null; notes?: string | null;
  status?: 'Draft' | 'Submitted'; revision?: number; revisionReason?: string | null; isLocked: boolean; submittedAt: string;
}
export type Recommendation = 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';
export const RECOMMENDATIONS: Recommendation[] = ['Strong Hire', 'Hire', 'Neutral', 'No Hire', 'Strong No Hire'];
export type OfferStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
/** OfferVersionItem minus pay (monthlyPackage, annualFixed, components). #11 adds status. */
export interface OfferVersion {
  id: string; versionNumber: number; status?: OfferStatus | 'Changes Requested'; approvalStatus: string; isLocked: boolean;
  contractType?: string | null; probationPeriod?: string | null; offerExpiry?: string | null; proposedJoiningDate?: string | null;
  workLocation?: string | null; workingSchedule?: string | null; createdAt: string;
  approvals?: Array<{ id: string; status: string; approverName?: string | null; roleCode?: string; decidedAt?: string | null; comment?: string | null }>;
}
export interface OfferItem { id: string; applicationId: string; offerCode: string; status: OfferStatus; currentVersion?: OfferVersion | null; versions?: OfferVersion[]; createdAt: string; updatedAt: string }
export interface ComplianceItem { id: string; type: string; name: string; status: 'Pending' | 'Submitted' | 'Verified' | 'Rejected' | 'Not Required'; isRequired: boolean; verifiedAt?: string | null }
export interface HiringItem { id: string; applicationId: string; offerId: string; status: string; complianceRequirements?: ComplianceItem[] }

export interface ApplicationFile {
  workspace: Workspace;
  history: HistoryItem[];
  notes: NoteItem[];
  screening: ScreeningItem[];
  interviews: InterviewItem[];
  scorecards: Record<string, ScorecardItem[]>;
  offer: OfferItem | null;
  hiring: HiringItem | null;
}

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : Array.isArray((v as { data?: unknown })?.data) ? ((v as { data: T[] }).data) : []);
const safe = <T,>(p: Promise<unknown>, fallback: T): Promise<T> => p.then((v) => stripPay(v) as T).catch(() => fallback);
const enc = encodeURIComponent;

export async function loadApplicationFile(id: string): Promise<ApplicationFile> {
  // The workspace call decides access: 403 (FILE_NOT_OWNED) / 404 propagate to the page.
  const workspace = stripPay(await getApi<Workspace>(`/applications/${enc(id)}/workspace`));
  const app = workspace.application;
  const [history, notes, screening, interviews, offers, hiring] = await Promise.all([
    safe<HistoryItem[]>(getApi(`/applications/${enc(id)}/history`).then(list), []),
    safe<NoteItem[]>(getApi(`/applications/${enc(id)}/notes`).then(list), []),
    safe<ScreeningItem[]>(getApi(`/screening/application/${enc(id)}`).then(list), []),
    safe<InterviewItem[]>(getApi(`/interviews?applicationId=${enc(id)}`).then(list), []),
    // GET /offers has no applicationId filter: filter by candidate, then by application.
    safe<OfferItem[]>(getApi(`/offers?candidateId=${enc(app.candidateId)}`).then(list), []),
    safe<HiringItem[]>(getApi('/hiring').then(list), []),
  ]);
  const mine = interviews.filter((i) => i.applicationId === id || !i.applicationId);
  const scorecardLists = await Promise.all(mine.filter((i) => i.status !== 'Cancelled').map((i) =>
    safe<ScorecardItem[]>(getApi(`/interviews/${enc(i.id)}/scorecard`).then(list), []).then((s) => [i.id, s] as const)));
  const offerSummary = offers.filter((o) => o.applicationId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const offer = offerSummary ? await safe<OfferItem>(getApi(`/offers/${enc(offerSummary.id)}`), offerSummary) : null;
  return {
    workspace, history, notes, screening, interviews: mine,
    scorecards: Object.fromEntries(scorecardLists),
    offer,
    hiring: hiring.find((h) => h.applicationId === id) ?? null,
  };
}

// ── writes ────────────────────────────────────────────────────────────────
/** = UpdateApplicationStageDto. */
export function moveStage(app: Pick<FileApplication, 'id' | 'stage' | 'version'>, stage: FileStage, reason?: string) {
  return patchApi<FileApplication>(`/applications/${enc(app.id)}/stage`, { stage, expectedStage: app.stage, expectedVersion: app.version, ...(reason ? { reason } : {}) });
}
/** = CreateApplicationNoteDto. */
export const addNote = (id: string, content: string) => postApi<NoteItem>(`/applications/${enc(id)}/notes`, { content });
/** = CreateScreeningLogDto WITHOUT the salary fields. */
export const logScreening = (body: { applicationId: string; outcome: ScreeningItem['outcome']; notes: string; noticePeriodDays?: number }) => postApi<ScreeningItem>('/screening', body);
/** = CreateInterviewDto (B5): room URL only from v2; interviewers are users. */
export interface ScheduleBody { applicationId: string; title: string; interviewType: string; scheduledStart: string; scheduledEnd: string; timezone: string; locationUrl: string; attendeeUserIds: string[] }
export const scheduleInterview = (body: ScheduleBody) => postApi<InterviewItem>('/interviews', body);
/** = SubmitScorecardDto (B5 adds status Draft|Submitted). */
export interface ScorecardBody { overallRating: number; recommendation: Recommendation; strengths?: string; concerns?: string; notes: string; status?: 'Draft' | 'Submitted' }
export const submitScorecard = (interviewId: string, body: ScorecardBody) => postApi<ScorecardItem>(`/interviews/${enc(interviewId)}/scorecard`, body);
/** = ReviseScorecardDto. */
export const reviseScorecard = (interviewId: string, body: Omit<ScorecardBody, 'status'> & { reason: string }) => postApi<ScorecardItem>(`/interviews/${enc(interviewId)}/scorecard/revisions`, body);
/** Non-pay offer terms (CreateOfferDto minus components). */
export interface OfferTerms { contractType?: string; probationPeriod?: string; offerExpiry?: string; proposedJoiningDate?: string; workLocation?: string; workingSchedule?: string }
/** = CreateOfferDto with components: [] — the Manager adds pay at the offer decision (M3). */
export const createOfferDraft = (applicationId: string, terms: OfferTerms) => postApi<string>('/offers', { applicationId, ...terms, components: [] });
/** = CreateOfferRevisionDto with components: [] (new version; Manager re-enters pay). */
export const createOfferRevision = (offerId: string, terms: OfferTerms) => postApi<string>(`/offers/${enc(offerId)}/revisions`, { ...terms, components: [] });
/** = UpdateOfferStatusDto. Never 'Declined' from v2: #11 auto-rejects the file on Declined. */
export const setOfferStatus = (offerId: string, status: 'Sent' | 'Accepted' | 'Withdrawn') => patchApi(`/offers/${enc(offerId)}/status`, { status });
/** = CreateHiringCaseDto. */
export const createHiringCase = (offerId: string) => postApi<HiringItem>('/hiring', { offerId });
/** = UpdateComplianceDto. */
export const checkCompliance = (hiringId: string, reqId: string) => patchApi(`/hiring/${enc(hiringId)}/compliance/${enc(reqId)}`, { status: 'Verified' });
export const rejectionReasons = () => getApi<Array<{ name: string; status?: string }>>('/master-data/catalog/rejection-reasons')
  .then((rows) => list<{ name: string; status?: string }>(rows).filter((r) => r.name?.trim() && r.status !== 'Inactive' && r.status !== 'Archived').map((r) => r.name.trim()));

// ── client pre-checks (mirror #11's gates; the API stays the authority) ──
export interface GateState { screenNote: boolean; scorecard: boolean; offerAccepted: boolean; joining: { key: string; label: string; done: boolean; reqId: string | null }[] }
export function gateState(f: ApplicationFile): GateState {
  const screenNote = f.screening.some((s) => Boolean(s.notes?.trim()));
  const live = new Set(f.interviews.filter((i) => i.status !== 'Cancelled').map((i) => i.id));
  const scorecard = Object.entries(f.scorecards).some(([iid, list]) => live.has(iid) && list.some((s) => (s.status ?? (s.isLocked ? 'Submitted' : 'Draft')) === 'Submitted'));
  const offerAccepted = f.offer?.status === 'Accepted' || Boolean(f.offer?.versions?.some((v) => v.status === 'Accepted'));
  const reqs = f.hiring?.complianceRequirements ?? [];
  const joining = JOINING_CHECKS.map((c) => {
    const req = reqs.find((r) => c.match.test(r.name));
    return { key: c.key, label: c.label, done: Boolean(req && req.status === 'Verified'), reqId: req?.id ?? null };
  });
  return { screenNote, scorecard, offerAccepted, joining };
}

export function candidateName(app: FileApplication): string {
  const c = app.candidate;
  return c?.fullName || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || app.applicationCode;
}
