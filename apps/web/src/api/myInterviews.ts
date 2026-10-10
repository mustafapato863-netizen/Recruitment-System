/**
 * QA BUG-4: interviewer view (v1). Endpoints from backend #4 (feat/b1-ownership-scope):
 *   GET  /interviews/:id/cv         (attendee may download the candidate's current CV)
 *   GET  /interviews/:id/scorecard  (attendee sees only their own scorecard)
 *   POST /interviews/:id/scorecard  (SubmitScorecardDto)
 *   POST /interviews/:id/response   (UpdateInterviewResponseDto: RSVP)
 *   GET  /interviews/:id/ics
 *
 * The LIST endpoint is not in any backend PR yet. PROVISIONAL contract (for Backend):
 *   GET /me/interviews?scope=upcoming|past  → { data: MyInterview[] }
 * A 404/405/501 renders "not available yet". No fixtures are used outside tests.
 */
import { ApiError, downloadFileApi, getApi, postApi } from './client';

export type MyRsvp = 'Pending' | 'Accepted' | 'Confirmed' | 'Reschedule Requested' | 'Declined';
export type MyScorecardStatus = 'missing' | 'submitted' | 'locked';

/** PROVISIONAL — mirror whatever Backend ships. Only name + job: no other file data. */
export interface MyInterview {
  id: string;
  title: string;
  interviewType: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string | null;
  candidateName: string;
  positionTitle: string | null;
  /** v2: a room URL only. */
  locationUrl: string | null;
  myResponse: MyRsvp;
  scorecardStatus: MyScorecardStatus;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
}

export type ListResult = { available: true; items: MyInterview[] } | { available: false };

const ALLOWED_KEYS: ReadonlyArray<keyof MyInterview> = ['id', 'title', 'interviewType', 'scheduledStart', 'scheduledEnd', 'timezone', 'candidateName', 'positionTitle', 'locationUrl', 'myResponse', 'scorecardStatus', 'status'];

/** Keeps ONLY the whitelisted fields, so stray PII/pay/file data can never render. */
export function pickInterview(raw: Record<string, unknown>): MyInterview {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_KEYS) out[k] = raw[k] ?? null;
  return {
    ...(out as unknown as MyInterview),
    title: String(out.title ?? 'Interview'),
    candidateName: String(out.candidateName ?? 'Candidate'),
    myResponse: (out.myResponse as MyRsvp) ?? 'Pending',
    scorecardStatus: (out.scorecardStatus as MyScorecardStatus) ?? 'missing',
  };
}

export async function listMyInterviews(scope: 'upcoming' | 'past' = 'upcoming'): Promise<ListResult> {
  try {
    const res = await getApi<{ data?: unknown[] } | unknown[]>(`/me/interviews?scope=${scope}`);
    const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return { available: true, items: rows.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null).map(pickInterview) };
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 501].includes(error.statusCode)) return { available: false };
    throw error;
  }
}

/** = InterviewScorecardItem (contracts). */
export interface MyScorecard {
  id: string;
  interviewId: string;
  interviewerId: string;
  interviewerName?: string;
  overallRating: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';
  strengths?: string | null;
  concerns?: string | null;
  notes?: string | null;
  isLocked: boolean;
  submittedAt: string;
}
/** = SubmitScorecardDto. */
export interface SubmitScorecardBody {
  overallRating: number;
  recommendation: MyScorecard['recommendation'];
  strengths?: string;
  concerns?: string;
  notes: string;
}
export const RECOMMENDATIONS: MyScorecard['recommendation'][] = ['Strong Hire', 'Hire', 'Neutral', 'No Hire', 'Strong No Hire'];

export const getMyScorecards = (id: string) => getApi<MyScorecard[]>(`/interviews/${encodeURIComponent(id)}/scorecard`);
export const submitScorecard = (id: string, body: SubmitScorecardBody) => postApi<MyScorecard>(`/interviews/${encodeURIComponent(id)}/scorecard`, body);
/** = UpdateInterviewResponseDto. Accept = 'Confirmed'. */
export const respond = (id: string, response: 'Confirmed' | 'Declined', note?: string) =>
  postApi(`/interviews/${encodeURIComponent(id)}/response`, note ? { response, note } : { response });

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
export async function downloadCv(id: string): Promise<string> {
  const { blob, filename } = await downloadFileApi(`/interviews/${encodeURIComponent(id)}/cv`, 'cv');
  saveBlob(blob, filename);
  return filename;
}
export async function downloadIcs(id: string): Promise<string> {
  const { blob, filename } = await downloadFileApi(`/interviews/${encodeURIComponent(id)}/ics`, 'interview.ics');
  saveBlob(blob, filename);
  return filename;
}

/** Friendly copy for download failures (403 incl. B1 codes, 404 no CV). */
export function downloadErrorMessage(error: unknown, what: 'CV' | 'calendar file'): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 404) return what === 'CV' ? 'This candidate has no CV on file yet.' : 'This interview was not found.';
    if (error.statusCode === 403) return `You can't download this ${what}. ${error.message}`.trim();
    return error.message;
  }
  return `The ${what} could not be downloaded.`;
}
