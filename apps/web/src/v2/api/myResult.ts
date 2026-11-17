/**
 * E04 My result — mirrors backend B8 PR #20 (`feat/b8-results` @691ec41) + R01/R02/R06 enhancements:
 *
 * GET /results/me?month=YYYY-MM[&vacancyId=]   (Cairo months; scope ANDed with access; no activity counters, no prior period)
 * 200 → ResultsResponse { scope, month, range {from,to}, asOf?, filters {vacancyId, managerId}, people[{id,name}],
 *        tiles { seats, overdueFollowUps, screensReachedInterview, offersAccepted },
 *        capacity?, vacancies?, details? }
 * ResultTile = { value, of, sampleSize, detail, tooFewToJudge }  (tooFewToJudge = sampleSize < 5; seats exempt)
 *
 * The server's tooFewToJudge wins. Only when a tile lacks it do we apply the under-5 rule; Seats are never "too few".
 * 404/501 (an API without B8) → an honest "not available yet" state.
 */
import { getApi, patchApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';

export const MIN_SAMPLE = 5;
export interface ResultTile { value: number; of: number; sampleSize: number; detail: string; tooFewToJudge?: boolean }
export type TileKey = 'seats' | 'overdueFollowUps' | 'screensReachedInterview' | 'offersAccepted';

export interface ResultDetailItem {
  id: string;
  applicationId: string;
  candidateName: string;
  jobId?: string | null;
  jobTitle: string;
  date: string | null;
  dateLabel: string;
  status: string;
  counted: boolean;
  summary?: string | null;
}

export type TargetMetricKey = 'screenings_completed' | 'interviews_conducted' | 'feedback_submitted' | 'seats_joined';
export type TargetPeriodType = 'monthly' | 'weekly';

export interface TargetRevisionItem {
  id: string;
  priorTarget: number | null;
  newTarget: number;
  reason: string | null;
  actorName: string;
  createdAt: string;
}

export interface EmployeeTargetItem {
  id: string;
  employeeId: string;
  employeeName: string;
  metric: TargetMetricKey;
  metricLabel: string;
  periodType: TargetPeriodType;
  periodKey: string;
  periodLabel: string;
  vacancyId: string | null;
  jobTitle: string | null;
  target: number;
  achieved: number;
  remaining: number;
  progressPercent: number;
  version?: number;
  setByName?: string;
  updatedAt?: string;
  revisions?: TargetRevisionItem[];
  records?: ResultDetailItem[];
  source?: 'monthly' | 'legacy-weekly';
  monthlySources?: Array<{ id: string; month: string; monthlyQuantity: number; weeklyQuantity: number; version: number }>;
}

export interface ResultsCapacity {
  approved: number;
  joined: number;
  remaining: number;
}

export interface ResultsVacancyOption {
  id: string;
  title: string;
  approvedHeadcount: number;
  joinedHeadcount: number;
}

export interface ResultsResponse {
  scope: 'me' | 'team' | 'org';
  month: string;
  range: { from: string; to: string };
  asOf?: string;
  filters: { vacancyId: string | null; managerId: string | null; branchId?: string | null };
  people: Array<{ id: string; name: string }>;
  tiles: Record<TileKey, ResultTile>;
  capacity?: ResultsCapacity;
  vacancies?: ResultsVacancyOption[];
  details?: Partial<Record<TileKey, ResultDetailItem[]>>;
  targets?: EmployeeTargetItem[];
  jobOptions?: Array<{ id: string; title: string }>;
}

/** View model for the page: the response plus the job title and authoritative current seat capacity. */
export interface MyResult extends ResultsResponse {
  vacancy: { id: string; title: string; approvedHeadcount?: number; joinedHeadcount?: number } | null;
  effectiveCapacity: ResultsCapacity | null;
}
export const RESULT_PATH = '/results/me';

export type MyResultLoad = { kind: 'ready'; data: MyResult } | { kind: 'unavailable' };
const isTile = (t: unknown): t is ResultTile => !!t && typeof t === 'object' && typeof (t as ResultTile).value === 'number' && typeof (t as ResultTile).sampleSize === 'number';
const KEYS: TileKey[] = ['seats', 'overdueFollowUps', 'screensReachedInterview', 'offersAccepted'];

type RawVacancy = {
  title?: string | null;
  position?: { title?: string } | null;
  approvedHeadcount?: number | null;
  joinedHeadcount?: number | null;
  headcount?: { approved?: number | null; joined?: number | null; remaining?: number | null } | null;
  seats?: { filled?: number | null; target?: number | null } | null;
};

function extractVacancyCapacity(v: RawVacancy | null | undefined): ResultsCapacity | null {
  if (!v || typeof v !== 'object') return null;
  const approved =
    typeof v.approvedHeadcount === 'number'
      ? v.approvedHeadcount
      : typeof v.headcount?.approved === 'number'
        ? v.headcount.approved
        : typeof v.seats?.target === 'number'
          ? v.seats.target
          : null;
  const joined =
    typeof v.joinedHeadcount === 'number'
      ? v.joinedHeadcount
      : typeof v.headcount?.joined === 'number'
        ? v.headcount.joined
        : typeof v.seats?.filled === 'number'
          ? v.seats.filled
          : null;
  if (approved === null || joined === null) return null;
  const safeApproved = Math.max(0, approved);
  const safeJoined = Math.max(0, joined);
  const remaining =
    typeof v.headcount?.remaining === 'number'
      ? Math.max(0, v.headcount.remaining)
      : Math.max(0, safeApproved - safeJoined);
  return { approved: safeApproved, joined: safeJoined, remaining };
}

export async function fetchMyResult(month: string, vacancyId?: string | null): Promise<MyResultLoad> {
  const q = new URLSearchParams({ month });
  if (vacancyId) q.set('vacancyId', vacancyId);
  let r: ResultsResponse;
  try {
    r = stripPay(await getApi<ResultsResponse>(`${RESULT_PATH}?${q}`));
  } catch (e) {
    const s = (e as { statusCode?: number })?.statusCode;
    if (s === 404 || s === 501) return { kind: 'unavailable' };
    throw e;
  }
  if (!r?.tiles || !KEYS.every((k) => isTile(r.tiles[k]))) return { kind: 'unavailable' };
  const id = r.filters?.vacancyId ?? vacancyId ?? null;
  let vacancy: MyResult['vacancy'] = null;
  let vacancyCap: ResultsCapacity | null = null;
  if (id) {
    const v = await getApi<RawVacancy>(`/vacancies/${encodeURIComponent(id)}`).catch(() => null);
    vacancyCap = extractVacancyCapacity(v);
    vacancy = {
      id,
      title: v?.title || v?.position?.title || 'One job',
      ...(vacancyCap ? { approvedHeadcount: vacancyCap.approved, joinedHeadcount: vacancyCap.joined } : {}),
    };
  }
  const effectiveCapacity: ResultsCapacity | null =
    vacancyCap ??
    (r.capacity &&
    typeof r.capacity.approved === 'number' &&
    typeof r.capacity.joined === 'number' &&
    typeof r.capacity.remaining === 'number'
      ? r.capacity
      : null);

  return { kind: 'ready', data: { ...r, vacancy, effectiveCapacity } };
}

/** Server flag first; under-5 fallback only when it is missing. Seats are exempt. */
export const tooFew = (key: TileKey, t: ResultTile) => (key === 'seats' ? false : typeof t.tooFewToJudge === 'boolean' ? t.tooFewToJudge : t.sampleSize < MIN_SAMPLE);

/** Current month in Africa/Cairo as YYYY-MM. */
export function cairoMonth(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
}

function cairoOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (
    (Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute')) -
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes())) /
    60_000
  );
}

/** Instant of 00:00 Africa/Cairo on the given calendar day. */
export function cairoMidnight(year: number, month1: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month1 - 1, day));
  const off = cairoOffsetMinutes(new Date(guess.getTime() - 3 * 3_600_000));
  return new Date(guess.getTime() - off * 60_000);
}

/** Half-open [from, to) instants in Africa/Cairo for a YYYY-MM month. */
export function cairoMonthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const ny = mo === 12 ? y + 1 : y;
  const nm = mo === 12 ? 1 : mo + 1;
  return {
    from: cairoMidnight(y, mo, 1).toISOString(),
    to: cairoMidnight(ny, nm, 1).toISOString(),
  };
}

export const monthLabel = (m: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T12:00:00Z`));

interface CairoYmd { y: number; m: number; d: number }

function cairoYmd(now: Date): CairoYmd {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const n = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return { y: n('year'), m: n('month'), d: n('day') };
}

/** ISO week-numbering year and week for a calendar date. Matches the results API. */
function isoWeekOf(y: number, m: number, d: number): { isoYear: number; week: number } {
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, week };
}

function mondayOfIsoWeek(isoYear: number, week: number): CairoYmd | null {
  if (!Number.isInteger(isoYear) || !Number.isInteger(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7);
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  const check = isoWeekOf(y, m, d);
  if (check.isoYear !== isoYear || check.week !== week) return null;
  return { y, m, d };
}

/** Current ISO week in Africa/Cairo as YYYY-Www. */
export function cairoWeek(now = new Date()): string {
  const part = cairoYmd(now);
  const iso = isoWeekOf(part.y, part.m, part.d);
  return `${iso.isoYear}-W${String(iso.week).padStart(2, '0')}`;
}

/** Recent Cairo weeks, newest first. `value` is the ISO key the targets API expects. */
export function weekChoices(count = 12, now = new Date()): Array<{ value: string; label: string }> {
  const current = /^(\d{4})-W(\d{2})$/.exec(cairoWeek(now));
  if (!current) return [];
  let isoYear = Number(current[1]);
  let week = Number(current[2]);
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const monday = mondayOfIsoWeek(isoYear, week);
    const value = `${isoYear}-W${String(week).padStart(2, '0')}`;
    const label = monday
      ? `Week of ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(monday.y, monday.m - 1, monday.d, 12)))}`
      : value;
    out.push({ value, label });
    week -= 1;
    if (week < 1) {
      isoYear -= 1;
      week = isoWeekOf(isoYear, 12, 28).week;
    }
  }
  return out;
}

export interface TargetPeriodQuery {
  scope: 'me' | 'team';
  periodType: TargetPeriodType;
  periodKey: string;
  vacancyId?: string | null;
  branchId?: string | null;
  employeeId?: string;
}

/** Personal or team targets for an explicit month/week. Missing data is not an empty target list. */
export async function fetchTargetsForPeriod(params: TargetPeriodQuery): Promise<{ targets: EmployeeTargetItem[]; people?: Array<{ id: string; name: string }>; jobOptions?: Array<{ id: string; title: string }> }> {
  const q = new URLSearchParams({ scope: params.scope, periodType: params.periodType, periodKey: params.periodKey });
  if (params.vacancyId) q.set('vacancyId', params.vacancyId);
  if (params.branchId) q.set('branchId', params.branchId);
  if (params.employeeId) q.set('employeeId', params.employeeId);
  const raw = stripPay(await getApi<{ targets?: EmployeeTargetItem[]; people?: Array<{ id: string; name: string }>; jobOptions?: Array<{ id: string; title: string }> }>(`/results/targets?${q}`));
  if (!Array.isArray(raw?.targets)) throw new Error('Target data is unavailable. Please try again.');
  return {
    targets: raw.targets,
    ...(Array.isArray(raw?.people) ? { people: raw.people } : {}),
    ...(Array.isArray(raw?.jobOptions) ? { jobOptions: raw.jobOptions } : {}),
  };
}

export async function createEmployeeTarget(body: { employeeId: string; metric: TargetMetricKey; periodType: TargetPeriodType; periodKey: string; targetQuantity: number; vacancyId?: string | null; notes?: string }): Promise<EmployeeTargetItem> {
  return stripPay(await postApi<EmployeeTargetItem>('/results/targets', {
    employeeId: body.employeeId,
    metric: body.metric,
    periodType: body.periodType,
    periodKey: body.periodKey,
    targetQuantity: body.targetQuantity,
    ...(body.vacancyId ? { vacancyId: body.vacancyId } : {}),
    ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
  }));
}

export async function updateEmployeeTarget(id: string, body: { targetQuantity: number; reason: string; version?: number }): Promise<EmployeeTargetItem> {
  return stripPay(await patchApi<EmployeeTargetItem>(`/results/targets/${encodeURIComponent(id)}`, {
    targetQuantity: body.targetQuantity,
    reason: body.reason,
    ...(body.version !== undefined ? { version: body.version } : {}),
  }));
}

export async function saveMonthlyTargetPlan(body: {
  employeeId: string; month: string; vacancyId: string | null; reason?: string;
  targets: Array<{ metric: TargetMetricKey; targetQuantity: number; version: number | null }>;
}): Promise<EmployeeTargetItem[]> {
  const result = stripPay(await postApi<{ targets: EmployeeTargetItem[] }>('/results/target-plans', body));
  if (!Array.isArray(result?.targets) || result.targets.length === 0 || result.targets.some(item => !item || item.employeeId !== body.employeeId || item.periodType !== 'monthly' || item.periodKey !== body.month || (item.vacancyId ?? null) !== body.vacancyId)) throw new Error('The monthly plan could not be confirmed. Reload targets before retrying.');
  return result.targets;
}
