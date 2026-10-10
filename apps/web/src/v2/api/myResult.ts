/**
 * E04 My result — mirrors backend B8 PR #20 (`feat/b8-results` @691ec41) exactly:
 *
 * GET /results/me?month=YYYY-MM[&vacancyId=]   (Cairo months; scope ANDed with access; no activity counters, no prior period)
 * 200 → ResultsResponse { scope, month, range {from,to}, filters {vacancyId, managerId}, people[{id,name}],
 *        tiles { seats, overdueFollowUps, screensReachedInterview, offersAccepted } }
 * ResultTile = { value, of, sampleSize, detail, tooFewToJudge }  (tooFewToJudge = sampleSize < 5; seats exempt)
 *
 * The server's tooFewToJudge wins. Only when a tile lacks it do we apply the under-5 rule; Seats are never "too few".
 * 404/501 (an API without B8) → an honest "not available yet" state.
 */
import { getApi } from '../../api/client';
import { stripPay } from './paySafety';

export const MIN_SAMPLE = 5;
export interface ResultTile { value: number; of: number; sampleSize: number; detail: string; tooFewToJudge?: boolean }
export type TileKey = 'seats' | 'overdueFollowUps' | 'screensReachedInterview' | 'offersAccepted';
export interface ResultsResponse {
  scope: 'me' | 'team' | 'org';
  month: string;
  range: { from: string; to: string };
  filters: { vacancyId: string | null; managerId: string | null };
  people: Array<{ id: string; name: string }>;
  tiles: Record<TileKey, ResultTile>;
}
/** View model for the page: the response plus the job title when filtered to one job. */
export interface MyResult extends ResultsResponse { vacancy: { id: string; title: string } | null }
export const RESULT_PATH = '/results/me';

export type MyResultLoad = { kind: 'ready'; data: MyResult } | { kind: 'unavailable' };
const isTile = (t: unknown): t is ResultTile => !!t && typeof t === 'object' && typeof (t as ResultTile).value === 'number' && typeof (t as ResultTile).sampleSize === 'number';
const KEYS: TileKey[] = ['seats', 'overdueFollowUps', 'screensReachedInterview', 'offersAccepted'];

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
  if (id) {
    const v = await getApi<{ title?: string | null; position?: { title?: string } | null }>(`/vacancies/${encodeURIComponent(id)}`).catch(() => null);
    vacancy = { id, title: v?.title || v?.position?.title || 'One job' };
  }
  return { kind: 'ready', data: { ...r, vacancy } };
}

/** Server flag first; under-5 fallback only when it is missing. Seats are exempt. */
export const tooFew = (key: TileKey, t: ResultTile) => (key === 'seats' ? false : typeof t.tooFewToJudge === 'boolean' ? t.tooFewToJudge : t.sampleSize < MIN_SAMPLE);

/** Current month in Africa/Cairo as YYYY-MM. */
export function cairoMonth(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
}
export const monthLabel = (m: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T12:00:00Z`));
