/**
 * E04 My result. Backend B8 is NOT built yet (no open PR; BACKEND_GAP §B8 proposes `GET /results/me|team|org?month=`).
 * PROVISIONAL contract below, used for typing only. There are NO fixtures outside tests: 404/501 → an honest
 * "not available yet" state. Every tile carries `sampleSize`; under MIN_SAMPLE the UI says "Too few to judge".
 *
 * GET /results/me?month=YYYY-MM[&vacancyId=]   (Employee: own work only; Africa/Cairo month)
 * 200 → MyResult
 */
import { getApi } from '../../api/client';
import { stripPay } from './paySafety';

export const MIN_SAMPLE = 5;
export interface ResultTile {
  /** Numerator / count the tile is about. */
  value: number;
  /** Denominator when the tile is "x of y" (seats target, offers sent, screens with note); null for plain counts. */
  of: number | null;
  /** How many records the number is based on. */
  sampleSize: number;
  /** One plain-language line from the server, e.g. "Salma Adel · follow-up date was 7 Oct". Optional. */
  detail: string | null;
}
export interface MyResult {
  scope: 'me';
  month: string;           // 'YYYY-MM'
  period: 'monthly';
  timezone: string;        // 'Africa/Cairo'
  vacancy: { id: string; title: string } | null;
  seats: ResultTile & { dueDate: string | null };
  overdueFollowUps: ResultTile;
  /** value = screens with a note that reached interview; of = screens with a note. */
  screensReachedInterview: ResultTile;
  /** value = offers accepted; of = offers sent. */
  offersAccepted: ResultTile;
}
export const RESULT_PATH = '/results/me';

export type MyResultLoad = { kind: 'ready'; data: MyResult } | { kind: 'unavailable' };
const isTile = (t: unknown): t is ResultTile => !!t && typeof t === 'object' && typeof (t as ResultTile).value === 'number' && typeof (t as ResultTile).sampleSize === 'number';

export async function fetchMyResult(month: string, vacancyId?: string | null): Promise<MyResultLoad> {
  const q = new URLSearchParams({ month });
  if (vacancyId) q.set('vacancyId', vacancyId);
  try {
    const r = stripPay(await getApi<MyResult>(`${RESULT_PATH}?${q}`));
    if (!r || ![r.seats, r.overdueFollowUps, r.screensReachedInterview, r.offersAccepted].every(isTile)) return { kind: 'unavailable' };
    return { kind: 'ready', data: r };
  } catch (e) {
    const s = (e as { statusCode?: number })?.statusCode;
    if (s === 404 || s === 501) return { kind: 'unavailable' };
    throw e;
  }
}
export const tooFew = (t: ResultTile) => t.sampleSize < MIN_SAMPLE;

/** Current month in Africa/Cairo as YYYY-MM. */
export function cairoMonth(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
}
export const monthLabel = (m: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T12:00:00Z`));
