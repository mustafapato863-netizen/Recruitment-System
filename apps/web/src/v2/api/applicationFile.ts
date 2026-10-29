/**
 * E2 application file adapters. Types mirror the API DTOs on backend B5 (#11,
 * feat/b5-application-file @e2f1296) and B7 (#15 @d65e0b0) for offers. Every read goes through stripPay(): the
 * Employee seat never holds pay in state. Writes never carry pay (offer drafts
 * send components: []; screening never sends salary fields).
 */
import type { ScreeningDraft, UpsertScreeningDraftInput } from '@recruitflow/contracts';
import { ApiError, downloadFileApi, getApi, patchApi, postApi, putApi } from '../../api/client';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { stripPay } from './paySafety';
import { JOINING_CHECK_TYPES, type JoiningCheckType } from './gates';
import {
  classifyReadError,
  emptySection,
  isSectionKnown,
  readySection,
  SECTION_LABEL,
  unavailableSection,
  type FileSectionKey,
  type SectionState,
} from './sectionState';

export type { FileSectionKey, SectionState } from './sectionState';

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
  method?: string | null;
  evidenceSource?: string | null;
  nextStep?: string | null;
  /** Pay: only kept for the Manager seat with OFFER_PAY_VIEW (B2-23 / Figma 09); stripped for everyone else. */
  currentSalary?: number | string | null; expectedSalary?: number | string | null; salaryCurrency?: string | null;
}
export interface InterviewItem {
  id: string; interviewCode: string; applicationId: string; title: string; interviewType: string;
  scheduledStart: string; scheduledEnd: string; timezone: string; locationUrl?: string | null; roomName?: string | null;
  interviewerName?: string | null; status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled' | 'No-show';
  /** Already returned by the interview payload. Absent means the appointment has no recorded creation time. */
  createdAt?: string;
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
export interface JoiningCheck { type: JoiningCheckType; label: string; verified: boolean; verifiedBy: { id: string; name: string } | null; verifiedAt: string | null; documentId: string | null; expiryDate?: string | null }
/** GET /applications/:id/documents (B5): metadata only. */
export interface FileDocument { id: string; type: string; name: string; uploadedAt: string; uploadedBy: { id: string; name: string } | null }
export interface ComplianceItem { id: string; type: string; name: string; status: 'Pending' | 'Submitted' | 'Verified' | 'Rejected' | 'Not Required'; isRequired: boolean; verifiedAt?: string | null }
export interface HiringItem { id: string; applicationId: string; offerId: string; status: string; complianceRequirements?: ComplianceItem[] }

export interface FileMessageAttempt {
  id: string;
  templateId: string;
  templateName: string;
  state: 'Queued' | 'Sent' | 'Failed';
  reason: string | null;
  at: string;
  retryOf: string | null;
}
export interface FileMessageTemplate { id: string; name: string; subject?: string; body?: string }
export interface FileMessages {
  followUpDate: string | null;
  destination: string;
  templates: FileMessageTemplate[];
  attempts: FileMessageAttempt[];
}

/** One slot per auxiliary read. Omitted on fixtures that predate this contract. */
export interface FileSectionMap {
  history: SectionState<HistoryItem[]>;
  notes: SectionState<NoteItem[]>;
  screening: SectionState<ScreeningItem[]>;
  interviews: SectionState<InterviewItem[]>;
  scorecards: SectionState<Record<string, ScorecardItem[]>>;
  offer: SectionState<OfferItem>;
  hiring: SectionState<HiringItem>;
  joiningChecks: SectionState<JoiningCheck[]>;
  documents: SectionState<FileDocument[]>;
  messages?: SectionState<FileMessages>;
}

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
  /** Id this snapshot was loaded for. A response for a different id must not be applied. */
  requestedId?: string;
  sections?: FileSectionMap;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const INTERVIEW_STATUSES = new Set<string>(['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No-show']);
const OFFER_STATUSES = new Set<string>(['Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined', 'Withdrawn', 'Expired']);
const JOINING_CHECK_TYPE_SET = new Set<string>(JOINING_CHECK_TYPES.map((item) => item.type));

const isHistoryRow = (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) && nonEmptyString(row.toStage) && nonEmptyString(row.createdAt);

const isNoteRow = (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) && nonEmptyString(row.content) && nonEmptyString(row.createdAt);

const isScreeningRow = (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  (row.outcome === 'Passed' || row.outcome === 'Failed' || row.outcome === 'On Hold') &&
  nonEmptyString(row.screenedAt) &&
  (row.notes === undefined || row.notes === null || typeof row.notes === 'string');

const isInterviewRow = (applicationId: string) => (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  nonEmptyString(row.title) &&
  nonEmptyString(row.scheduledStart) &&
  nonEmptyString(row.scheduledEnd) &&
  INTERVIEW_STATUSES.has(String(row.status)) &&
  (row.applicationId === undefined || row.applicationId === applicationId);

const isScorecardRow = (interviewId: string) => (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  row.interviewId === interviewId &&
  nonEmptyString(row.interviewerId) &&
  typeof row.overallRating === 'number' &&
  Number.isFinite(row.overallRating) &&
  RECOMMENDATIONS.includes(row.recommendation as Recommendation) &&
  (row.status === 'Draft' || row.status === 'Submitted' || typeof row.isLocked === 'boolean') &&
  nonEmptyString(row.submittedAt) &&
  (row.notes === undefined || row.notes === null || typeof row.notes === 'string');

const isOfferVersionRow = (v: unknown): boolean =>
  isPlainObject(v) &&
  nonEmptyString(v.id) &&
  typeof v.versionNumber === 'number' &&
  nonEmptyString(v.approvalStatus) &&
  nonEmptyString(v.createdAt) &&
  (v.status === undefined || OFFER_STATUSES.has(String(v.status)) || v.status === 'Changes Requested') &&
  (v.approvals === undefined || (Array.isArray(v.approvals) && v.approvals.every((a) => isPlainObject(a) && nonEmptyString(a.id) && nonEmptyString(a.status))));

const isOfferRow = (applicationId?: string) => (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  nonEmptyString(row.offerCode) &&
  OFFER_STATUSES.has(String(row.status)) &&
  nonEmptyString(row.createdAt) &&
  (!applicationId || row.applicationId === undefined || row.applicationId === applicationId) &&
  (row.currentVersion === undefined || row.currentVersion === null || isOfferVersionRow(row.currentVersion)) &&
  (row.versions === undefined || (Array.isArray(row.versions) && row.versions.every(isOfferVersionRow)));

const isComplianceRow = (item: unknown): boolean =>
  isPlainObject(item) &&
  nonEmptyString(item.id) &&
  nonEmptyString(item.type) &&
  nonEmptyString(item.name) &&
  nonEmptyString(item.status) &&
  typeof item.isRequired === 'boolean';

const isHiringRow = (applicationId: string) => (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  nonEmptyString(row.status) &&
  (row.applicationId === undefined || row.applicationId === applicationId) &&
  (row.complianceRequirements === undefined || (Array.isArray(row.complianceRequirements) && row.complianceRequirements.every(isComplianceRow)));

const isJoiningCheckRow = (row: Record<string, unknown>): boolean =>
  JOINING_CHECK_TYPE_SET.has(String(row.type)) &&
  nonEmptyString(row.label) &&
  typeof row.verified === 'boolean' &&
  (row.verifiedBy === undefined || row.verifiedBy === null || (isPlainObject(row.verifiedBy) && nonEmptyString(row.verifiedBy.id) && nonEmptyString(row.verifiedBy.name))) &&
  (row.verifiedAt === undefined || row.verifiedAt === null || nonEmptyString(row.verifiedAt));

const isFileDocumentRow = (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  nonEmptyString(row.type) &&
  nonEmptyString(row.name) &&
  nonEmptyString(row.uploadedAt) &&
  (row.uploadedBy === undefined || row.uploadedBy === null || (isPlainObject(row.uploadedBy) && nonEmptyString(row.uploadedBy.id) && nonEmptyString(row.uploadedBy.name)));

const isCandidateDocumentRow = (row: Record<string, unknown>): boolean =>
  nonEmptyString(row.id) &&
  nonEmptyString(row.documentType ?? row.type) &&
  nonEmptyString(row.fileName ?? row.name) &&
  nonEmptyString(row.uploadedAt ?? row.createdAt);

function parseList<T>(v: unknown, validRow?: (item: Record<string, unknown>) => boolean): T[] | null {
  const raw = Array.isArray(v)
    ? v
    : v !== null && typeof v === 'object' && Array.isArray((v as { data?: unknown }).data)
      ? (v as { data: unknown[] }).data
      : null;
  if (!raw || raw.some((item) => !isPlainObject(item) || (validRow ? !validRow(item) : false))) return null;
  return raw as T[];
}

function malformedSection<T>(message = 'This part of the file could not be read.'): SectionState<T> {
  return { status: 'error', failure: 'domain', statusCode: null, message };
}
const enc = encodeURIComponent;

function listState<T>(rows: T[]): SectionState<T[]> {
  return rows.length === 0 ? emptySection() : readySection(rows);
}

async function readList<T>(
  path: string,
  keepPay = false,
  label = 'This part of the file',
  validRow?: (item: Record<string, unknown>) => boolean,
): Promise<{ rows: T[]; state: SectionState<T[]> }> {
  try {
    const raw = await getApi(path);
    const rows = parseList<T>(keepPay ? raw : stripPay(raw), validRow);
    if (!rows) return { rows: [], state: malformedSection(`${label} could not be read.`) };
    return { rows, state: listState(rows) };
  } catch (error) {
    return { rows: [], state: classifyReadError(error) };
  }
}

function rowsOf<T>(state: SectionState<T[]>): T[] {
  return state.status === 'ready' ? state.data : [];
}

/** Scorecards are not requested when the interview list itself is unknown. */
async function readScorecards(
  interviews: InterviewItem[],
  interviewState: SectionState<InterviewItem[]>,
): Promise<{ map: Record<string, ScorecardItem[]>; state: SectionState<Record<string, ScorecardItem[]>> }> {
  if (interviewState.status === 'unavailable') return { map: {}, state: unavailableSection() };
  if (interviewState.status === 'loading') return { map: {}, state: { status: 'loading' } };
  if (interviewState.status === 'error') {
    return {
      map: {},
      state: {
        status: 'error',
        failure: interviewState.failure,
        statusCode: interviewState.statusCode,
        message: 'Scorecards were not requested because interviews could not be loaded.',
      },
    };
  }
  const live = interviews.filter((interview) => interview.status !== 'Cancelled');
  if (live.length === 0) return { map: {}, state: emptySection() };
  if (live.some((interview) => typeof interview?.id !== 'string' || !interview.id)) {
    return { map: {}, state: malformedSection('Scorecards could not be read.') };
  }
  const reads = await Promise.all(live.map(async (interview) => {
    try {
      const rows = parseList<ScorecardItem>(stripPay(await getApi(`/interviews/${enc(interview.id)}/scorecard`)), isScorecardRow(interview.id));
      if (!rows) return { id: interview.id, rows: [] as ScorecardItem[], state: malformedSection('Scorecards could not be read.') };
      return { id: interview.id, rows, state: listState(rows) };
    } catch (error) {
      return { id: interview.id, rows: [] as ScorecardItem[], state: classifyReadError(error) };
    }
  }));
  const map: Record<string, ScorecardItem[]> = {};
  const failures = reads.filter((read) => !isSectionKnown(read.state));
  for (const read of reads) {
    if (isSectionKnown(read.state)) map[read.id] = read.rows;
  }
  if (failures.length === 0) {
    const any = Object.values(map).some((rows) => rows.length > 0);
    return { map, state: any ? readySection(map) : emptySection() };
  }
  if (failures.every((failure) => failure.state.status === 'unavailable')) return { map, state: unavailableSection() };
  const first = failures.find((failure) => failure.state.status === 'error')?.state;
  if (first && first.status === 'error') {
    return {
      map,
      state: {
        ...first,
        message: failures.length > 1 ? 'More than one scorecard could not be loaded.' : first.message,
      },
    };
  }
  return { map, state: { status: 'error', failure: 'domain', statusCode: null, message: 'Scorecards could not be loaded.' } };
}

async function readOffer(id: string, offers: OfferItem[], offerList: SectionState<OfferItem[]>): Promise<{ offer: OfferItem | null; state: SectionState<OfferItem> }> {
  if (offerList.status === 'unavailable') return { offer: null, state: unavailableSection() };
  if (offerList.status === 'loading') return { offer: null, state: { status: 'loading' } };
  if (offerList.status === 'error') return { offer: null, state: offerList };
  if (offers.some((item) => typeof item?.id !== 'string' || !item.id)) {
    return { offer: null, state: { status: 'error', failure: 'domain', statusCode: null, message: 'The offer could not be read.' } };
  }
  const summary = [...offers].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0] ?? null;
  if (!summary) return { offer: null, state: emptySection() };
  try {
    const detail = stripPay(await getApi<OfferItem & { applicationId?: string }>(`/offers/${enc(summary.id)}`));
    if (!isPlainObject(detail) || !isOfferRow()(detail)) {
      return { offer: null, state: { status: 'error', failure: 'domain', statusCode: null, message: 'The offer could not be read.' } };
    }
    if (detail.applicationId && detail.applicationId !== id) {
      return { offer: null, state: { status: 'error', failure: 'domain', statusCode: null, message: 'The offer did not match this application and was not applied.' } };
    }
    return { offer: detail, state: readySection(detail) };
  } catch (error) {
    return { offer: null, state: classifyReadError(error) };
  }
}

function firstKnown<T>(state: SectionState<T[]>, rows: T[]): T | null {
  if (state.status !== 'ready') return null;
  return rows[0] ?? null;
}

/** keepScreeningPay: the Manager seat with OFFER_PAY_VIEW sees current/expected salary on the file (B2-23). Everything else stays pay-stripped. */
export async function loadApplicationFile(id: string, opts: { keepScreeningPay?: boolean } = {}): Promise<ApplicationFile> {
  // The workspace call decides access: 403 (FILE_NOT_OWNED) / 404 propagate to the page.
  // Auxiliary reads start only after that succeeds, and a failure stays on its own section.
  const workspace = stripPay(await getApi<Workspace>(`/applications/${enc(id)}/workspace`));
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace) || !workspace.application || typeof workspace.application !== 'object' || typeof workspace.application.id !== 'string') {
    throw new Error('The application file could not be read.');
  }
  const [history, notes, screening, interviews, offers, hiring, joiningChecks, documents] = await Promise.all([
    readList<HistoryItem>(`/applications/${enc(id)}/history`, false, SECTION_LABEL.history, isHistoryRow),
    readList<NoteItem>(`/applications/${enc(id)}/notes`, false, SECTION_LABEL.notes, isNoteRow),
    readList<ScreeningItem>(`/screening/application/${enc(id)}`, !!opts.keepScreeningPay, SECTION_LABEL.screening, isScreeningRow),
    readList<InterviewItem>(`/interviews?applicationId=${enc(id)}`, false, SECTION_LABEL.interviews, isInterviewRow(id)),
    // B5: ?applicationId= is ANDed with the access scope server-side; no client filtering.
    readList<OfferItem>(`/offers?applicationId=${enc(id)}`, false, SECTION_LABEL.offer, isOfferRow(id)),
    readList<HiringItem>(`/hiring?applicationId=${enc(id)}`, false, SECTION_LABEL.hiring, isHiringRow(id)),
    readList<JoiningCheck>(`/applications/${enc(id)}/joining-checks`, false, SECTION_LABEL.joiningChecks, isJoiningCheckRow),
    readList<FileDocument>(`/applications/${enc(id)}/documents`, false, SECTION_LABEL.documents, isFileDocumentRow),
  ]);
  const [scorecards, offer] = await Promise.all([
    readScorecards(interviews.rows, interviews.state),
    readOffer(id, offers.rows, offers.state),
  ]);
  return {
    requestedId: id,
    workspace,
    history: rowsOf(history.state),
    notes: rowsOf(notes.state),
    screening: rowsOf(screening.state),
    interviews: rowsOf(interviews.state),
    scorecards: scorecards.map,
    offer: offer.offer,
    hiring: firstKnown(hiring.state, hiring.rows),
    joiningChecks: rowsOf(joiningChecks.state),
    documents: rowsOf(documents.state),
    sections: {
      history: history.state,
      notes: notes.state,
      screening: screening.state,
      interviews: interviews.state,
      scorecards: scorecards.state,
      offer: offer.state,
      hiring: hiring.state.status === 'ready' ? (hiring.rows[0] ? readySection(hiring.rows[0]) : emptySection()) : hiring.state.status === 'empty' ? emptySection() : hiring.state,
      joiningChecks: joiningChecks.state,
      documents: documents.state,
    },
  };
}

const RELOADABLE: readonly FileSectionKey[] = ['history', 'notes', 'screening', 'interviews', 'scorecards', 'offer', 'hiring', 'joiningChecks', 'documents'];

/** Refetch one section. Does not write, and does not replace the rest of the file. */
export async function reloadFileSection(file: ApplicationFile, key: FileSectionKey, opts: { keepScreeningPay?: boolean; approver?: boolean } = {}): Promise<ApplicationFile> {
  const id = file.requestedId ?? file.workspace.application.id;
  if (!RELOADABLE.includes(key)) return { ...file, requestedId: id };
  if (opts.approver && key !== 'documents') return { ...file, requestedId: id };
  if (key === 'scorecards' && !isSectionKnown(file.sections?.interviews)) {
    return {
      ...file,
      requestedId: id,
      sections: file.sections ? {
        ...file.sections,
        scorecards: file.sections.interviews?.status === 'unavailable'
          ? unavailableSection()
          : { status: 'error', failure: 'domain', statusCode: null, message: 'Scorecards were not requested because interviews could not be loaded.' },
      } : file.sections,
    };
  }
  const next = { ...file, requestedId: id, sections: file.sections ? { ...file.sections } : undefined };
  const assign = <K extends keyof FileSectionMap>(sectionKey: K, state: FileSectionMap[K]) => {
    if (next.sections) next.sections[sectionKey] = state;
  };
  if (key === 'history') {
    const read = await readList<HistoryItem>(`/applications/${enc(id)}/history`, false, SECTION_LABEL.history, isHistoryRow);
    next.history = rowsOf(read.state);
    assign('history', read.state);
  } else if (key === 'notes') {
    const read = await readList<NoteItem>(`/applications/${enc(id)}/notes`, false, SECTION_LABEL.notes, isNoteRow);
    next.notes = rowsOf(read.state);
    assign('notes', read.state);
  } else if (key === 'screening') {
    const read = await readList<ScreeningItem>(`/screening/application/${enc(id)}`, !!opts.keepScreeningPay, SECTION_LABEL.screening, isScreeningRow);
    next.screening = rowsOf(read.state);
    assign('screening', read.state);
  } else if (key === 'interviews') {
    const read = await readList<InterviewItem>(`/interviews?applicationId=${enc(id)}`, false, SECTION_LABEL.interviews, isInterviewRow(id));
    const scorecards = await readScorecards(read.rows, read.state);
    next.scorecards = scorecards.map;
    assign('scorecards', scorecards.state);
    next.interviews = rowsOf(read.state);
    assign('interviews', read.state);
  } else if (key === 'scorecards') {
    const read = await readScorecards(file.interviews, file.sections?.interviews ?? readySection(file.interviews));
    next.scorecards = read.map;
    assign('scorecards', read.state);
  } else if (key === 'offer') {
    const read = await readList<OfferItem>(`/offers?applicationId=${enc(id)}`, false, SECTION_LABEL.offer, isOfferRow(id));
    const offer = await readOffer(id, read.rows, read.state);
    next.offer = offer.offer;
    assign('offer', offer.state);
  } else if (key === 'hiring') {
    const read = await readList<HiringItem>(`/hiring?applicationId=${enc(id)}`, false, SECTION_LABEL.hiring, isHiringRow(id));
    next.hiring = firstKnown(read.state, read.rows);
    assign('hiring', read.state.status === 'ready' ? (read.rows[0] ? readySection(read.rows[0]) : emptySection()) : read.state.status === 'empty' ? emptySection() : read.state);
  } else if (key === 'joiningChecks') {
    const read = await readList<JoiningCheck>(`/applications/${enc(id)}/joining-checks`, false, SECTION_LABEL.joiningChecks, isJoiningCheckRow);
    next.joiningChecks = rowsOf(read.state);
    assign('joiningChecks', read.state);
  } else if (key === 'documents') {
    const read = opts.approver
      ? await readCandidateDocuments(file.workspace.application.candidateId)
      : await readList<FileDocument>(`/applications/${enc(id)}/documents`, false, SECTION_LABEL.documents, isFileDocumentRow);
    next.documents = rowsOf(read.state);
    assign('documents', read.state);
  }
  return next;
}

/** Messages stay a section read. A failure is not an empty attempt list. */
export async function loadMessageSection(applicationId: string): Promise<SectionState<FileMessages>> {
  try {
    const row = await getApi<FileMessages>(`/applications/${enc(applicationId)}/messages`);
    if (
      !row
      || typeof row !== 'object'
      || !Array.isArray(row.attempts)
      || !Array.isArray(row.templates)
      || typeof row.destination !== 'string'
      || !row.templates.every((t) => isPlainObject(t) && nonEmptyString(t.id) && nonEmptyString(t.name))
      || !row.attempts.every((a) => isPlainObject(a) && nonEmptyString(a.id) && nonEmptyString(a.templateId) && nonEmptyString(a.templateName) && (a.state === 'Queued' || a.state === 'Sent' || a.state === 'Failed') && nonEmptyString(a.at))
    ) {
      return { status: 'error', failure: 'domain', statusCode: null, message: 'Message history could not be read.' };
    }
    return readySection({
      followUpDate: row.followUpDate ?? null,
      destination: row.destination,
      templates: row.templates,
      attempts: row.attempts,
    });
  } catch (error) {
    return classifyReadError(error);
  }
}

/**
 * #34: a final-hire approver (FINAL_HIRING_APPROVAL, no APPLICATION_VIEW) reads the file read-only while their
 * approval is pending: GET /applications/:id and the candidate's documents (GET /documents/candidate/:id). Every
 * other file call needs APPLICATION_VIEW, so it is skipped rather than sent to fail.
 */
const skippedSections = (): Pick<FileSectionMap, 'history' | 'notes' | 'screening' | 'interviews' | 'scorecards' | 'offer' | 'messages'> => ({
  history: unavailableSection(),
  notes: unavailableSection(),
  screening: unavailableSection(),
  interviews: unavailableSection(),
  scorecards: unavailableSection(),
  offer: unavailableSection(),
  messages: unavailableSection(),
});

/** Licence specialist: GET /hiring already allows LICENSE_CHECK. The file opens on that case, with the licence item as the pre-hire check. Other file reads are not sent. */
export async function loadLicenseFile(id: string): Promise<ApplicationFile> {
  const rows = parseList<HiringItem & { candidateName?: string; positionTitle?: string }>(await getApi(`/hiring?applicationId=${enc(id)}`), isHiringRow(id));
  if (!rows) throw new Error('Hiring could not be read.');
  const hiring = rows[0];
  if (!hiring) throw new ApiError(404, 'No licence work is assigned on this file.', { code: 'NOT_FOUND' });
  if (hiring.complianceRequirements !== undefined && !Array.isArray(hiring.complianceRequirements)) {
    throw new Error('Hiring could not be read.');
  }
  const fullName = hiring.candidateName?.trim() || 'Candidate';
  const [firstName, ...rest] = fullName.split(/\s+/);
  const licences = (hiring.complianceRequirements ?? []).filter((item) => item.type === 'License');
  const now = new Date().toISOString();
  const joiningChecks: JoiningCheck[] = licences.length ? [{
    type: 'SCFHS_LICENCE',
    label: licences.map((item) => item.name).filter(Boolean).join(', ') || 'SCFHS licence',
    verified: licences.every((item) => item.status === 'Verified' || item.status === 'Not Required'),
    verifiedBy: null,
    verifiedAt: licences.find((item) => item.verifiedAt)?.verifiedAt ?? null,
    documentId: null,
  }] : [];
  return {
    requestedId: id,
    workspace: {
      application: {
        id, applicationCode: id, vacancyId: '', candidateId: '', stage: 'Pre-Hire', allowedTransitions: [], version: 0,
        positionTitle: hiring.positionTitle, candidate: { id: '', firstName, lastName: rest.join(' '), fullName }, appliedAt: now, updatedAt: now,
      },
      stages: [], nextStageRequirements: [], canAdvance: false,
    },
    history: [], notes: [], screening: [], interviews: [], scorecards: {}, offer: null,
    hiring, joiningChecks, documents: [],
    sections: {
      ...skippedSections(),
      hiring: readySection(hiring),
      joiningChecks: joiningChecks.length ? readySection(joiningChecks) : emptySection(),
      documents: unavailableSection(),
    },
  };
}

type RawCandidateDoc = { id: string; documentType?: string; type?: string; fileName?: string; name?: string; createdAt?: string; uploadedAt?: string };

async function readCandidateDocuments(candidateId: string | null | undefined): Promise<{ rows: FileDocument[]; state: SectionState<FileDocument[]> }> {
  if (!candidateId) return { rows: [], state: unavailableSection() };
  try {
    const docs = parseList<RawCandidateDoc>(stripPay(await getApi(`/documents/candidate/${enc(candidateId)}`)), isCandidateDocumentRow);
    if (!docs || docs.some((d) => typeof d?.id !== 'string' || !d.id)) {
      return { rows: [], state: malformedSection('Documents could not be read.') };
    }
    const rows = docs.map((d) => ({ id: d.id, type: d.documentType ?? d.type ?? '', name: d.fileName ?? d.name ?? 'Document', uploadedAt: d.uploadedAt ?? d.createdAt ?? '', uploadedBy: null }));
    return { rows, state: listState(rows) };
  } catch (error) {
    const failed = classifyReadError(error);
    return { rows: [], state: failed.status === 'unavailable' ? unavailableSection() : failed };
  }
}

export async function loadApproverFile(id: string): Promise<ApplicationFile> {
  const application = stripPay(await getApi<FileApplication>(`/applications/${enc(id)}`));
  if (!application || typeof application !== 'object' || Array.isArray(application) || typeof application.id !== 'string') {
    throw new Error('The application file could not be read.');
  }
  const { rows: documents, state: documentState } = await readCandidateDocuments(application.candidateId);
  return {
    requestedId: id,
    workspace: { application, stages: [], nextStage: null, nextStageRequirements: [], canAdvance: false },
    history: [], notes: [], screening: [], interviews: [], scorecards: {}, offer: null, hiring: null, joiningChecks: [],
    documents,
    sections: {
      ...skippedSections(),
      hiring: unavailableSection(),
      joiningChecks: unavailableSection(),
      documents: documentState,
    },
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
/** = CreateScreeningLogDto WITHOUT the salary fields. Next step is stored text; it does not move the stage. */
export const logScreening = (body: {
  applicationId: string;
  outcome: ScreeningItem['outcome'];
  notes: string;
  method: string;
  evidenceSource: string;
  nextStep: string;
  noticePeriodDays?: number;
}) => postApi<ScreeningItem>('/screening', body);

function emptyToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export type ScreeningDraftLoad =
  | { status: 'ready'; draft: ScreeningDraft }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'error'; failure: 'not-found' | 'domain' | 'transient'; statusCode: number | null; message: string };

/** GET /screening/application/:id/draft — this user's private draft, or an explicit empty/failed read. */
export async function loadScreeningDraft(applicationId: string): Promise<ScreeningDraftLoad> {
  try {
    const draft = await getApi<ScreeningDraft | null>(`/screening/application/${enc(applicationId)}/draft`);
    if (draft === null) return { status: 'empty' };
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return { status: 'error', failure: 'domain', statusCode: null, message: 'The screening draft could not be read.' };
    }
    if (draft.applicationId && draft.applicationId !== applicationId) {
      return { status: 'error', failure: 'domain', statusCode: null, message: 'The draft belonged to another application and was not applied.' };
    }
    if (draft.outcome !== 'Passed' && draft.outcome !== 'Failed' && draft.outcome !== 'On Hold') {
      return { status: 'error', failure: 'domain', statusCode: null, message: 'The screening draft could not be read.' };
    }
    return {
      status: 'ready',
      draft: {
        id: draft.id,
        organizationId: draft.organizationId,
        userId: draft.userId,
        applicationId: draft.applicationId,
        outcome: draft.outcome,
        notes: draft.notes ?? null,
        noticePeriodDays: draft.noticePeriodDays ?? null,
        method: draft.method ?? null,
        evidenceSource: draft.evidenceSource ?? null,
        nextStep: draft.nextStep ?? null,
        moveToInterview: draft.moveToInterview !== false,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
    };
  } catch (error) {
    return classifyReadError(error);
  }
}

/** PUT /screening/application/:id/draft. Does not log the screen or move the stage. */
export function saveScreeningDraft(applicationId: string, body: UpsertScreeningDraftInput) {
  return putApi<ScreeningDraft>(`/screening/application/${enc(applicationId)}/draft`, {
    outcome: body.outcome,
    notes: emptyToNull(body.notes),
    noticePeriodDays: body.noticePeriodDays ?? null,
    method: emptyToNull(body.method),
    evidenceSource: emptyToNull(body.evidenceSource),
    nextStep: emptyToNull(body.nextStep),
    moveToInterview: body.moveToInterview ?? true,
  });
}
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
  const rows = parseList<{ id: string; name: string; category: string; isDefault?: boolean; status: string }>(
    await getApi(channel === 'email' ? '/email-templates' : '/whatsapp-templates/for-send'),
    (t) => nonEmptyString(t.id) && nonEmptyString(t.name) && typeof t.category === 'string' && nonEmptyString(t.status));
  if (!rows) throw new Error('Offer templates could not be read.');
  return rows.filter((t) => t.status === 'Active')
    .map((t) => ({ id: t.id, name: t.name, category: t.category, isDefault: Boolean(t.isDefault) }))
    .sort((a, b) => Number(/offer/i.test(b.category)) - Number(/offer/i.test(a.category)) || Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}
/** = UpdateOfferStatusDto. 'Sent' is no longer set here (send only via /send). Declined also rejects the file ("Declined offer"); Expired keeps it in Offer. */
export const setOfferStatus = (offerId: string, status: 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired') => patchApi(`/offers/${enc(offerId)}/status`, { status });
/** PATCH /applications/:id/follow-up (owner only; 403 FOLLOW_UP_NOT_OWNER). YYYY-MM-DD or null. */
export const setFollowUp = (id: string, followUpDate: string | null) => patchApi<{ id: string; followUpDate: string | null }>(`/applications/${enc(id)}/follow-up`, { followUpDate });
/** PUT /applications/:id/joining-checks/:type → the full list. A licence expiry is stored with the check. */
export const setJoiningCheck = (id: string, type: JoiningCheckType, body: { verified: boolean; expiryDate?: string | null }) => putApi<JoiningCheck[]>(`/applications/${enc(id)}/joining-checks/${type}`, {
  verified: body.verified,
  ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ? isoDate(body.expiryDate) : null } : {}),
});
/** PATCH /interviews/:id. A date change reschedules; status No-show closes the slot. */
export const updateInterview = (id: string, body: { status?: 'No-show' | 'Rescheduled' | 'Cancelled' | 'Completed'; scheduledStart?: string; scheduledEnd?: string; rescheduleReason?: string; locationUrl?: string }) => patchApi(`/interviews/${enc(id)}`, body);
/** POST /hiring/:id/submit. Final approval is requested here. It does not record a hire. */
export const submitHiringCase = (id: string) => postApi<{ id: string; status: string }>(`/hiring/${enc(id)}/submit`, {});
/** POST /hiring/:id/joining. The responsible recruiter records the hire once. */
export const recordActualJoining = (id: string, actualJoiningDate: string) => postApi<{ success: boolean; alreadyJoined: boolean }>(`/hiring/${enc(id)}/joining`, { status: 'Joined', actualJoiningDate });
/** = CreateHiringCaseDto (kept: the hiring case still opens at Pre-hire for the downstream steps). */
export const createHiringCase = (offerId: string) => postApi<HiringItem>('/hiring', { offerId });
export const rejectionReasons = () => getApi<Array<{ name: string; status?: string }>>('/master-data/catalog/rejection-reasons')
  .then((raw) => {
    const rows = parseList<{ name: string; status?: string }>(raw, (r) => nonEmptyString(r.name) && (r.status === undefined || typeof r.status === 'string'));
    if (!rows) throw new Error('Rejection reasons could not be read.');
    return rows.filter((r) => r.name?.trim() && r.status !== 'Inactive' && r.status !== 'Archived').map((r) => r.name.trim());
  });

// ── client pre-checks (mirror #11's gates; the API stays the authority) ──
export interface GateState {
  screenNote: boolean;
  scorecard: boolean;
  offerAccepted: boolean;
  joining: { type: JoiningCheckType; label: string; done: boolean }[];
  /** True when that fact cannot be decided. Callers must not treat the boolean as absence. */
  unknown: { screening: boolean; interviews: boolean; scorecards: boolean; offer: boolean; hiring: boolean; joining: boolean };
}

export function unknownSection(file: Pick<ApplicationFile, 'sections'>, key: FileSectionKey): boolean {
  const state = file.sections?.[key];
  if (!state) return false;
  return state.status === 'loading' || state.status === 'error' || state.status === 'unavailable';
}

/** The stage action that would be a guess while this section is unknown. */
export function blockingSection(file: ApplicationFile): FileSectionKey | null {
  const stage = file.workspace.application.stage;
  if (stage === 'Applied' || stage === 'Screening') return unknownSection(file, 'screening') ? 'screening' : null;
  if (stage === 'Interview') {
    if (unknownSection(file, 'interviews')) return 'interviews';
    if (unknownSection(file, 'scorecards')) return 'scorecards';
    return null;
  }
  if (stage === 'Offer') return unknownSection(file, 'offer') ? 'offer' : null;
  if (stage === 'Pre-Hire') {
    if (unknownSection(file, 'offer')) return 'offer';
    if (unknownSection(file, 'hiring')) return 'hiring';
    if (unknownSection(file, 'joiningChecks')) return 'joiningChecks';
  }
  return null;
}

export function gateState(f: ApplicationFile): GateState {
  const unknown = {
    screening: unknownSection(f, 'screening'),
    interviews: unknownSection(f, 'interviews'),
    scorecards: unknownSection(f, 'scorecards'),
    offer: unknownSection(f, 'offer'),
    hiring: unknownSection(f, 'hiring'),
    joining: unknownSection(f, 'joiningChecks'),
  };
  const screenNote = !unknown.screening && f.screening.some((s) => Boolean(s.notes?.trim()));
  const live = new Set(f.interviews.filter((i) => i.status !== 'Cancelled').map((i) => i.id));
  const scorecard = !unknown.scorecards && !unknown.interviews && Object.entries(f.scorecards).some(([iid, cards]) => live.has(iid) && cards.some(isScorecardSubmitted));
  const offerAccepted = !unknown.offer && (f.offer?.status === 'Accepted' || Boolean(f.offer?.versions?.some((v) => v.status === 'Accepted')));
  const joining = unknown.joining ? [] : f.joiningChecks.map((c) => ({ type: c.type, label: c.label, done: c.verified }));
  return { screenNote, scorecard, offerAccepted, joining, unknown };
}

export function candidateName(app: FileApplication): string {
  const c = app.candidate;
  return c?.fullName || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || app.applicationCode;
}
