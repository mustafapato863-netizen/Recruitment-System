/**
 * E2 application file adapters. Types mirror the API DTOs on backend B5 (#11,
 * feat/b5-application-file @e2f1296) and B7 (#15 @d65e0b0) for offers. Every read goes through stripPay(): the
 * Employee seat never holds pay in state. Writes never carry pay (offer drafts
 * send components: []; screening never sends salary fields).
 */
import { downloadFileApi, getApi, patchApi, postApi, putApi } from '../../api/client';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { stripPay } from './paySafety';
import { JOINING_CHECK_TYPES, type JoiningCheckType } from './gates';

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
  /** B5: the owner's follow-up date (YYYY-MM-DD, Cairo day) on list + detail. */
  followUpDate?: string | null;
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
export interface ScreeningItem {
  id: string; screenerName?: string; outcome: 'Passed' | 'Failed' | 'On Hold'; notes?: string | null; noticePeriodDays?: number | null; screenedAt: string;
  /** Pay: only kept for the Manager seat with OFFER_PAY_VIEW (B2-23 / Figma 09); stripped for everyone else. */
  currentSalary?: number | string | null; expectedSalary?: number | string | null; salaryCurrency?: string | null;
}
export interface InterviewItem {
  id: string; interviewCode: string; applicationId: string; title: string; interviewType: string;
  scheduledStart: string; scheduledEnd: string; timezone: string; locationUrl?: string | null; roomName?: string | null;
  interviewerName?: string | null; status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
  attendees?: Array<{ userId?: string | null; displayName?: string | null; name?: string | null }>;
}
export interface ScorecardItem {
  id: string; interviewId: string; interviewerId: string; interviewerName?: string; overallRating: number;
  recommendation: Recommendation; strengths?: string | null; concerns?: string | null; notes?: string | null;
  status?: 'Draft' | 'Submitted'; revision?: number; revisionReason?: string | null; submittedAt: string;
}
export type Recommendation = 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';
export const RECOMMENDATIONS: Recommendation[] = ['Strong Hire', 'Hire', 'Neutral', 'No Hire', 'Strong No Hire'];
export type OfferStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
/** OfferVersionItem minus pay (monthlyPackage, annualFixed, components). #11 adds status. */
export interface OfferVersion {
  id: string; versionNumber: number; status?: OfferStatus | 'Changes Requested'; approvalStatus: string;
  contractType?: string | null; probationPeriod?: string | null; offerExpiry?: string | null; proposedJoiningDate?: string | null;
  workLocation?: string | null; workingSchedule?: string | null; createdAt: string;
  approvals?: Array<{ id: string; status: string; approverName?: string | null; roleCode?: string; decidedAt?: string | null; comment?: string | null }>;
}
export interface OfferItem { id: string; applicationId: string; offerCode: string; status: OfferStatus; currentVersion?: OfferVersion | null; versions?: OfferVersion[]; createdAt: string; updatedAt: string }
/** GET /applications/:id/joining-checks (B5). */
export interface JoiningCheck { type: JoiningCheckType; label: string; verified: boolean; verifiedBy: { id: string; name: string } | null; verifiedAt: string | null; documentId: string | null }
/** GET /applications/:id/documents (B5): metadata only. */
export interface FileDocument { id: string; type: string; name: string; uploadedAt: string; uploadedBy: { id: string; name: string } | null }
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
  joiningChecks: JoiningCheck[];
  documents: FileDocument[];
}

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : Array.isArray((v as { data?: unknown })?.data) ? ((v as { data: T[] }).data) : []);
const safe = <T,>(p: Promise<unknown>, fallback: T, keep = false): Promise<T> => p.then((v) => (keep ? v : stripPay(v)) as T).catch(() => fallback);
const enc = encodeURIComponent;

/** keepScreeningPay: the Manager seat with OFFER_PAY_VIEW sees current/expected salary on the file (B2-23). Everything else stays pay-stripped. */
export async function loadApplicationFile(id: string, opts: { keepScreeningPay?: boolean } = {}): Promise<ApplicationFile> {
  // The workspace call decides access: 403 (FILE_NOT_OWNED) / 404 propagate to the page.
  const workspace = stripPay(await getApi<Workspace>(`/applications/${enc(id)}/workspace`));
  const [history, notes, screening, interviews, offers, hiring, joiningChecks, documents] = await Promise.all([
    safe<HistoryItem[]>(getApi(`/applications/${enc(id)}/history`).then(list), []),
    safe<NoteItem[]>(getApi(`/applications/${enc(id)}/notes`).then(list), []),
    safe<ScreeningItem[]>(getApi(`/screening/application/${enc(id)}`).then(list), [], !!opts.keepScreeningPay),
    safe<InterviewItem[]>(getApi(`/interviews?applicationId=${enc(id)}`).then(list), []),
    // B5: ?applicationId= is ANDed with the access scope server-side; no client filtering.
    safe<OfferItem[]>(getApi(`/offers?applicationId=${enc(id)}`).then(list), []),
    safe<HiringItem[]>(getApi(`/hiring?applicationId=${enc(id)}`).then(list), []),
    safe<JoiningCheck[]>(getApi(`/applications/${enc(id)}/joining-checks`).then(list), []),
    safe<FileDocument[]>(getApi(`/applications/${enc(id)}/documents`).then(list), []),
  ]);
  const scorecardLists = await Promise.all(interviews.filter((i) => i.status !== 'Cancelled').map((i) =>
    safe<ScorecardItem[]>(getApi(`/interviews/${enc(i.id)}/scorecard`).then(list), []).then((s) => [i.id, s] as const)));
  const offerSummary = [...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const offer = offerSummary ? await safe<OfferItem>(getApi(`/offers/${enc(offerSummary.id)}`), offerSummary) : null;
  return {
    workspace, history, notes, screening, interviews,
    scorecards: Object.fromEntries(scorecardLists),
    offer,
    hiring: hiring[0] ?? null,
    joiningChecks, documents,
  };
}

/**
 * #34: a final-hire approver (FINAL_HIRING_APPROVAL, no APPLICATION_VIEW) reads the file read-only while their
 * approval is pending: GET /applications/:id and the candidate's documents (GET /documents/candidate/:id). Every
 * other file call needs APPLICATION_VIEW, so it is skipped rather than sent to fail.
 */
export async function loadApproverFile(id: string): Promise<ApplicationFile> {
  const application = stripPay(await getApi<FileApplication>(`/applications/${enc(id)}`));
  type RawDoc = { id: string; documentType?: string; type?: string; fileName?: string; name?: string; createdAt?: string; uploadedAt?: string };
  const docs = application.candidateId
    ? await safe<RawDoc[]>(getApi(`/documents/candidate/${enc(application.candidateId)}`).then(list), [])
    : [];
  return {
    workspace: { application, stages: [], nextStage: null, nextStageRequirements: [], canAdvance: false },
    history: [], notes: [], screening: [], interviews: [], scorecards: {}, offer: null, hiring: null, joiningChecks: [],
    documents: docs.map((d) => ({ id: d.id, type: d.documentType ?? d.type ?? '', name: d.fileName ?? d.name ?? 'Document', uploadedAt: d.uploadedAt ?? d.createdAt ?? '', uploadedBy: null })),
  };
}
export const isCvDoc = (d: Pick<FileDocument, 'type'>) => /^(cv|resume)$/i.test(d.type);
/** GET /documents/:id/download (approvers may download the CV/Resume). */
export async function downloadDocument(d: Pick<FileDocument, 'id' | 'name'>): Promise<void> {
  const { blob, filename } = await downloadFileApi(`/documents/${enc(d.id)}/download`, d.name);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── writes ────────────────────────────────────────────────────────────────
/** Backend #21 (B2-4): Joined, Rejected and Withdrawn are closed; nothing moves them (409 FILE_CLOSED). */
export const CLOSED_STAGES: readonly string[] = ['Joined', 'Rejected', 'Withdrawn'];
export const isClosedStage = (stage: string | null | undefined) => !!stage && CLOSED_STAGES.includes(stage);
/** The rejection reason that needs a note (400 REASON_REQUIRED, field "note", under 3 characters). */
export const OTHER_REASON = 'Other';
export const OTHER_NOTE_MIN = 3;
export const needsReasonNote = (reason: string | null | undefined) => (reason ?? '').trim().toLowerCase() === 'other';
/** = UpdateApplicationStageDto (#21: + note, required with the "Other" rejection reason; stored as "Other: <note>"). */
export function moveStage(app: Pick<FileApplication, 'id' | 'stage' | 'version'>, stage: FileStage, reason?: string, note?: string) {
  return patchApi<FileApplication>(`/applications/${enc(app.id)}/stage`, { stage, expectedStage: app.stage, expectedVersion: app.version, ...(reason ? { reason } : {}), ...(note?.trim() ? { note: note.trim() } : {}) });
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
/** Non-pay offer terms (CreateOfferDto minus components). CreateOfferDto has no grade / approver note field. */
export interface OfferTerms { contractType?: string; probationPeriod?: string; offerExpiry?: string; proposedJoiningDate?: string; workLocation?: string; workingSchedule?: string }
/** = CreateOfferDto with components: [] → the offer id. Offers start as Draft; the Manager adds pay at M3. */
/** PRE-1: <input type=date> gives YYYY-MM-DD; the API (Prisma DateTime) needs a full ISO timestamp (UTC midnight). */
export const isoDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : d);
const wireTerms = (t: OfferTerms): OfferTerms => ({ ...t, proposedJoiningDate: isoDate(t.proposedJoiningDate), offerExpiry: isoDate(t.offerExpiry) });
export const createOfferDraft = (applicationId: string, terms: OfferTerms) => postApi<string>('/offers', { applicationId, ...wireTerms(terms), components: [] });
/** = CreateOfferRevisionDto with components: [] → the version id. Allowed from Draft / Changes Requested / Expired (OFFER_CLOSED otherwise). */
export const createOfferRevision = (offerId: string, terms: OfferTerms) => postApi<string>(`/offers/${enc(offerId)}/revisions`, { ...wireTerms(terms), components: [] });
/** POST /offers/:id/submit: Draft or Changes Requested → Pending Approval (409 OFFER_NOT_DRAFT otherwise). */
export const submitOffer = (offerId: string) => postApi<{ id: string; status: 'Pending Approval'; versionId: string }>(`/offers/${enc(offerId)}/submit`, {});
export type SendChannel = 'email' | 'whatsapp';
/** = SendOfferDto. Response: email → { queued }, whatsapp → { message, waLink } (manual send; already recorded as Sent). */
export interface SendOfferResult { id: string; status: 'Sent'; channel: SendChannel; templateId: string; queued?: boolean; message?: string; waLink?: string }
export const sendOffer = (offerId: string, body: { channel: SendChannel; templateId: string }) => postApi<SendOfferResult>(`/offers/${enc(offerId)}/send`, body);
/** Active templates per channel: GET /email-templates (EmailTemplateItem) and GET /whatsapp-templates/for-send (WhatsAppTemplateItem). Bodies are not shown. */
export interface OfferTemplate { id: string; name: string; category: string; isDefault: boolean }
export async function offerTemplates(channel: SendChannel): Promise<OfferTemplate[]> {
  const rows = list<{ id: string; name: string; category: string; isDefault?: boolean; status: string }>(
    await getApi(channel === 'email' ? '/email-templates' : '/whatsapp-templates/for-send'));
  return rows.filter((t) => t.status === 'Active')
    .map((t) => ({ id: t.id, name: t.name, category: t.category, isDefault: Boolean(t.isDefault) }))
    .sort((a, b) => Number(/offer/i.test(b.category)) - Number(/offer/i.test(a.category)) || Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}
/** = UpdateOfferStatusDto. 'Sent' is no longer set here (send only via /send). Declined also rejects the file ("Declined offer"); Expired keeps it in Offer. */
export const setOfferStatus = (offerId: string, status: 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired') => patchApi(`/offers/${enc(offerId)}/status`, { status });
/** PATCH /applications/:id/follow-up (owner only; 403 FOLLOW_UP_NOT_OWNER). YYYY-MM-DD or null. */
export const setFollowUp = (id: string, followUpDate: string | null) => patchApi<{ id: string; followUpDate: string | null }>(`/applications/${enc(id)}/follow-up`, { followUpDate });
/** PUT /applications/:id/joining-checks/:type → the full list. */
export const setJoiningCheck = (id: string, type: JoiningCheckType, verified: boolean) => putApi<JoiningCheck[]>(`/applications/${enc(id)}/joining-checks/${type}`, { verified });
/** = CreateHiringCaseDto (kept: the hiring case still opens at Pre-hire for the downstream steps). */
export const createHiringCase = (offerId: string) => postApi<HiringItem>('/hiring', { offerId });
export const rejectionReasons = () => getApi<Array<{ name: string; status?: string }>>('/master-data/catalog/rejection-reasons')
  .then((rows) => list<{ name: string; status?: string }>(rows).filter((r) => r.name?.trim() && r.status !== 'Inactive' && r.status !== 'Archived').map((r) => r.name.trim()));

// ── client pre-checks (mirror #11's gates; the API stays the authority) ──
export interface GateState { screenNote: boolean; scorecard: boolean; offerAccepted: boolean; joining: { type: JoiningCheckType; label: string; done: boolean }[] }
export function gateState(f: ApplicationFile): GateState {
  const screenNote = f.screening.some((s) => Boolean(s.notes?.trim()));
  const live = new Set(f.interviews.filter((i) => i.status !== 'Cancelled').map((i) => i.id));
  const scorecard = Object.entries(f.scorecards).some(([iid, list]) => live.has(iid) && list.some(isScorecardSubmitted));
  const offerAccepted = f.offer?.status === 'Accepted' || Boolean(f.offer?.versions?.some((v) => v.status === 'Accepted'));
  const joining = JOINING_CHECK_TYPES.map((c) => ({ type: c.type, label: c.label, done: Boolean(f.joiningChecks.find((j) => j.type === c.type)?.verified) }));
  return { screenNote, scorecard, offerAccepted, joining };
}

export function candidateName(app: FileApplication): string {
  const c = app.candidate;
  return c?.fullName || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || app.applicationCode;
}
