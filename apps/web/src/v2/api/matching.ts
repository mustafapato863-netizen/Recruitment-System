/**
 * E4 adapters: Suggest from bank (E10), Compare on skills (E24), Candidates (E23).
 *
 * Mirrors backend B6 PR #13 (`feat/b6-suggest-compare`, matching.service.ts) exactly:
 * - GET /vacancies/:id/suggestions → SuggestionsResponse (no score, no %, documented ordering).
 * - Suggestions carry alreadyOnJob / stage / addable (ca137e3); Compare adds infoRows (notice period, fit note).
 * - GET /vacancies/:id/compare?candidateIds=a,b[,c,d] → CompareResponse; 400 COMPARE_COUNT, 404 COMPARE_CANDIDATE_NOT_FOUND.
 * - Both: 403 NOT_JOB_OWNER for non-owners.
 * Add to this job: POST /applications {vacancyId, candidateId, source}.
 * Candidates: GET /applications (my files, B1-scoped, paged) and GET /candidates (bank). The active list does
 * not send `search` (that parameter also matches email). Every row is reduced to an allowlist: no email/phone/
 * salary/notice/national id is kept. Error codes are dropped by the API filter
 * (CONFLICT/VALIDATION_ERROR/FORBIDDEN/NOT_FOUND + message), so `matchErrorFromError` maps messages back.
 */
import { domainError } from './gates';
import { getApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';

const enc = encodeURIComponent;

export interface EvidenceItem { id: string; sourceType: string; sourceRef: string | null; snippet: string | null; addedBy: { id: string; name: string } | null; addedAt: string }
export interface SkillRef { id: string | null; name: string }
export interface MatchedSkill { skill: SkillRef; hasEvidence: boolean; evidence: EvidenceItem[] }
export interface SuggestionCandidate { id: string; code: string; name: string; currentTitle: string | null; location: string | null }
/** ca137e3: people already on the job come back too, with their stage and addable:false. */
export interface Suggestion { candidate: SuggestionCandidate; matchedSkills: MatchedSkill[]; missingSkills: SkillRef[]; alreadyOnJob?: boolean; stage?: string | null; addable?: boolean }
export interface SuggestionsResponse { vacancyId: string; requiredSkills: SkillRef[]; unmappedRequiredSkills: string[]; orderedBy: string[]; suggestions: Suggestion[] }
export type CompareStatus = 'evidence' | 'no-evidence' | 'missing';
export interface CompareCell { candidateId: string; status: CompareStatus; evidence: EvidenceItem[] }
/** notice-period: days (number) or profile availability text; fit-note: this job's screening note. null = not recorded. */
export interface CompareInfoCell { candidateId: string; value: number | string | null; source: 'screening' | 'profile' | null; by?: { id: string; name: string } | null; at?: string | null }
export interface CompareInfoRow { key: 'notice-period' | 'fit-note'; label: string; cells: CompareInfoCell[] }
export interface CompareResponse { vacancyId: string; candidates: SuggestionCandidate[]; rows: Array<{ skill: SkillRef; cells: CompareCell[] }>; infoRows?: CompareInfoRow[] }
/** Server sends addable; older servers did not list people on the job at all, so missing = addable. */
export const canAdd = (s: Suggestion) => s.addable !== false && !s.alreadyOnJob;

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
/** Caller-scoped pages of GET /applications. `truncated` is set only when 10 full pages are loaded and `total` is still larger. */
export interface ActiveApplicationsResult { rows: ActiveRow[]; truncated: boolean; loaded: number; total: number | null }
export interface BankRow { candidateId: string; code: string; name: string; title: string | null; location: string | null; experienceYears: number | null; status: string }

type RawApp = { id: string; candidateId: string; vacancyId: string; stage: string; source?: string | null; positionTitle?: string; primaryRecruiterName?: string | null; lastActivityLabel?: string | null; nextFollowUpAt?: string | null; candidate?: { firstName?: string; lastName?: string; currentTitle?: string | null; experienceYears?: number | null } };
type RawCand = { id: string; candidateCode: string; firstName: string; lastName: string; currentTitle?: string | null; location?: string | null; experienceYears?: number | null; status: string };
const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
/** Open files on the candidates list. Same bound as the bank loader: 10 pages of 100. */
export const OPEN_APPLICATION_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'] as const;
const ACTIVE_PAGE_SIZE = 100;
const ACTIVE_MAX_PAGES = 10;

function toActiveRow(a: RawApp): ActiveRow {
  return {
    applicationId: a.id, candidateId: a.candidateId,
    name: `${a.candidate?.firstName ?? ''} ${a.candidate?.lastName ?? ''}`.trim() || 'Unnamed',
    title: a.candidate?.currentTitle ?? null, experienceYears: a.candidate?.experienceYears ?? null,
    vacancyId: a.vacancyId, job: a.positionTitle ?? '—', stage: a.stage, source: a.source ?? null,
    owner: a.primaryRecruiterName ?? null, next: a.lastActivityLabel ?? null, nextAt: a.nextFollowUpAt ?? null,
  };
}

/**
 * Pages this caller's applications. Stage, job, source, and name/title/job search are applied by Candidates
 * on the loaded window — `search` is not sent, because the server parameter also matches email.
 * A thrown request is left thrown so the page can show an error instead of an empty list.
 */
export async function fetchActiveApplications(): Promise<ActiveApplicationsResult> {
  const raw: RawApp[] = [];
  let total: number | null = null;
  let truncated = false;
  for (let page = 1; page <= ACTIVE_MAX_PAGES; page++) {
    const q = new URLSearchParams({ pageSize: String(ACTIVE_PAGE_SIZE), page: String(page), sortBy: 'updatedAt', sortDirection: 'desc' });
    const r = await getApi<RawApp[] | { data: RawApp[]; total?: number }>(`/applications?${q}`);
    const rows = list(r);
    raw.push(...rows);
    if (!Array.isArray(r) && typeof r?.total === 'number') total = r.total;
    if (rows.length < ACTIVE_PAGE_SIZE || (total !== null && raw.length >= total)) break;
    if (page === ACTIVE_MAX_PAGES && total !== null && raw.length < total) truncated = true;
  }
  const open = new Set<string>(OPEN_APPLICATION_STAGES);
  return { rows: raw.filter((a) => open.has(a.stage)).map(toActiveRow), truncated, loaded: raw.length, total };
}
/** Bank = everyone Active in the org (CoS: all seats see the whole bank, never contact fields). Pages through up to 1000. */
export async function fetchBank(search: string): Promise<BankRow[]> {
  const raw: RawCand[] = [];
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({ pageSize: '100', page: String(page), status: 'Active' });
    if (search.trim()) q.set('search', search.trim());
    const r = await getApi<RawCand[] | { data: RawCand[]; total?: number }>(`/candidates?${q}`);
    const rows = list(r);
    raw.push(...rows);
    const total = !Array.isArray(r) && typeof r?.total === 'number' ? r.total : null;
    if (rows.length < 100 || (total !== null && raw.length >= total)) break;
  }
  return raw.filter((c) => c.status === 'Active').map((c) => ({ candidateId: c.id, code: c.candidateCode, name: `${c.firstName} ${c.lastName}`.trim(), title: c.currentTitle ?? null, location: c.location ?? null, experienceYears: c.experienceYears ?? null, status: c.status }));
}

// ── errors ──────────────────────────────────────────────────────────────────
export type MatchCode = 'COMPARE_COUNT' | 'COMPARE_CANDIDATE_NOT_FOUND' | 'NOT_JOB_OWNER' | 'APPLICATION_EXISTS' | 'JOB_NOT_ACCEPTING_APPLICATIONS';
const MATCH_CODES: readonly string[] = ['COMPARE_COUNT', 'COMPARE_CANDIDATE_NOT_FOUND', 'NOT_JOB_OWNER', 'APPLICATION_EXISTS', 'JOB_NOT_ACCEPTING_APPLICATIONS'];
/** Custom codes now reach the client: read the code, never the message text. */
export function matchErrorFromError(e: unknown): { code: MatchCode; message: string } | null {
  const d = domainError(e);
  return d && MATCH_CODES.includes(d.code) ? { code: d.code as MatchCode, message: d.message } : null;
}
