/**
 * E4 adapters: Suggest from bank (E10), Compare on skills (E24), Candidates (E23).
 *
 * Mirrors backend B6 PR #13 (`feat/b6-suggest-compare`, matching.service.ts) exactly:
 * - GET /vacancies/:id/suggestions → SuggestionsResponse (no score, no %, documented ordering).
 * - GET /vacancies/:id/compare?candidateIds=a,b[,c,d] → CompareResponse; 400 COMPARE_COUNT, 404 COMPARE_CANDIDATE_NOT_FOUND.
 * - Both: 403 NOT_JOB_OWNER for non-owners.
 * Add to this job: POST /applications {vacancyId, candidateId, source}.
 * Candidates: GET /applications (my files, B1-scoped) and GET /candidates (bank). Every row is reduced to an
 * allowlist: no email/phone/salary/notice/national id is kept. Error codes are dropped by the API filter
 * (CONFLICT/VALIDATION_ERROR/FORBIDDEN/NOT_FOUND + message), so `matchErrorFromError` maps messages back.
 */
import { getApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';

const enc = encodeURIComponent;

export interface EvidenceItem { id: string; sourceType: string; sourceRef: string | null; snippet: string | null; addedBy: { id: string; name: string } | null; addedAt: string }
export interface SkillRef { id: string | null; name: string }
export interface MatchedSkill { skill: SkillRef; hasEvidence: boolean; evidence: EvidenceItem[] }
export interface SuggestionCandidate { id: string; code: string; name: string; currentTitle: string | null; location: string | null }
export interface Suggestion { candidate: SuggestionCandidate; matchedSkills: MatchedSkill[]; missingSkills: SkillRef[] }
export interface SuggestionsResponse { vacancyId: string; requiredSkills: SkillRef[]; unmappedRequiredSkills: string[]; orderedBy: string[]; suggestions: Suggestion[] }
export type CompareStatus = 'evidence' | 'no-evidence' | 'missing';
export interface CompareCell { candidateId: string; status: CompareStatus; evidence: EvidenceItem[] }
export interface CompareResponse { vacancyId: string; candidates: SuggestionCandidate[]; rows: Array<{ skill: SkillRef; cells: CompareCell[] }> }

/** Defensive: drop any numeric "score"/"percent"/"rank"-like field a future server might add. Never rendered. */
const SCORE_KEY = /score|percent|pct|rank|match(ing)?rate|confidence/i;
export function stripScores<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripScores) as unknown as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!SCORE_KEY.test(k)) o[k] = stripScores(x);
    return o as T;
  }
  return v;
}

export const fetchSuggestions = async (vacancyId: string) => stripScores(stripPay(await getApi<SuggestionsResponse>(`/vacancies/${enc(vacancyId)}/suggestions`)));
export const fetchCompare = async (vacancyId: string, ids: string[]) =>
  stripScores(stripPay(await getApi<CompareResponse>(`/vacancies/${enc(vacancyId)}/compare?candidateIds=${ids.map(enc).join(',')}`)));
export const addToJob = (vacancyId: string, candidateId: string) => postApi<{ id: string }>('/applications', { vacancyId, candidateId, source: 'Suggested from bank' });

export const SOURCE_LABEL: Record<string, string> = { CV: 'CV', SCREENING_NOTE: 'screening note', SCORECARD: 'scorecard', IMPORT: 'import', MANUAL: 'added by hand', NOTE: 'note' };
export const sourceLabel = (t: string) => SOURCE_LABEL[t] ?? t.toLowerCase().replace(/_/g, ' ');

// ── E23 Candidates ──────────────────────────────────────────────────────────
export interface ActiveRow { applicationId: string; candidateId: string; name: string; title: string | null; experienceYears: number | null; vacancyId: string; job: string; stage: string; source: string | null; owner: string | null; next: string | null; nextAt: string | null }
export interface BankRow { candidateId: string; code: string; name: string; title: string | null; location: string | null; experienceYears: number | null; status: string }

type RawApp = { id: string; candidateId: string; vacancyId: string; stage: string; source?: string | null; positionTitle?: string; primaryRecruiterName?: string | null; lastActivityLabel?: string | null; nextFollowUpAt?: string | null; candidate?: { firstName?: string; lastName?: string; currentTitle?: string | null; experienceYears?: number | null } };
type RawCand = { id: string; candidateCode: string; firstName: string; lastName: string; currentTitle?: string | null; location?: string | null; experienceYears?: number | null; status: string };
const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
const OPEN = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'];

export async function fetchActiveApplications(): Promise<ActiveRow[]> {
  const raw = list(await getApi<RawApp[] | { data: RawApp[] }>('/applications?pageSize=100&sortBy=updatedAt&sortDirection=desc'));
  return raw.filter((a) => OPEN.includes(a.stage)).map((a) => ({
    applicationId: a.id, candidateId: a.candidateId,
    name: `${a.candidate?.firstName ?? ''} ${a.candidate?.lastName ?? ''}`.trim() || 'Unnamed',
    title: a.candidate?.currentTitle ?? null, experienceYears: a.candidate?.experienceYears ?? null,
    vacancyId: a.vacancyId, job: a.positionTitle ?? '—', stage: a.stage, source: a.source ?? null,
    owner: a.primaryRecruiterName ?? null, next: a.lastActivityLabel ?? null, nextAt: a.nextFollowUpAt ?? null,
  }));
}
export async function fetchBank(search: string): Promise<BankRow[]> {
  const q = new URLSearchParams({ pageSize: '50', status: 'Active' });
  if (search.trim()) q.set('search', search.trim());
  const raw = list(await getApi<RawCand[] | { data: RawCand[] }>(`/candidates?${q}`));
  return raw.map((c) => ({ candidateId: c.id, code: c.candidateCode, name: `${c.firstName} ${c.lastName}`.trim(), title: c.currentTitle ?? null, location: c.location ?? null, experienceYears: c.experienceYears ?? null, status: c.status }));
}

// ── errors ──────────────────────────────────────────────────────────────────
export type MatchCode = 'COMPARE_COUNT' | 'COMPARE_CANDIDATE_NOT_FOUND' | 'NOT_JOB_OWNER' | 'APPLICATION_EXISTS' | 'JOB_NOT_ACCEPTING_APPLICATIONS';
const BY_MESSAGE: Array<[RegExp, MatchCode]> = [
  [/^Compare 2 to 4 candidates\.$/, 'COMPARE_COUNT'],
  [/^One or more candidates were not found or are not active\.$/, 'COMPARE_CANDIDATE_NOT_FOUND'],
  [/^Only the job owner, their manager or a full-access user can suggest or compare/, 'NOT_JOB_OWNER'],
  [/has already applied to vacancy/, 'APPLICATION_EXISTS'],
  [/accepts no new applications\.$/, 'JOB_NOT_ACCEPTING_APPLICATIONS'],
];
export function matchErrorFromError(e: unknown): { code: MatchCode; message: string } | null {
  if (!e || typeof e !== 'object') return null;
  const x = e as { code?: unknown; message?: unknown };
  const msg = typeof x.message === 'string' ? x.message.trim() : '';
  if (typeof x.code === 'string' && BY_MESSAGE.some(([, c]) => c === x.code)) return { code: x.code as MatchCode, message: msg };
  const hit = BY_MESSAGE.find(([re]) => re.test(msg));
  return hit ? { code: hit[1], message: msg } : null;
}
