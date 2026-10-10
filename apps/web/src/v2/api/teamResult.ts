/**
 * M4 Team result — mirrors backend B8 PR #20 (`feat/b8-results` @1376c9c):
 * GET /results/team?month=YYYY-MM[&vacancyId=]  → ResultsResponse { scope:'team', month, range, filters, people[{id,name}], tiles{…} }
 *   team = the caller's direct reports (users.managerId = me); 403 when you have none (admins excepted).
 *   tile = { value, of, sampleSize, detail, tooFewToJudge } — tooFewToJudge from the server; seats are always exempt.
 * The response is ONE set of team tiles. Figma M07 draws one row per recruiter; B8 has no per-person breakdown, so we read an
 * optional `rows[{person{id,name}, tiles}]` if Backend adds it and otherwise show the team row + who is in it.
 * /reports dropped comparison, comparisonRange, kpis.*.change and recruiterWorkload[].activity (B8): nothing here reads them,
 * and there is no prior-period comparison ("Activity is not a score").
 */
import { getApi } from '../../api/client';
import { stripPay } from './paySafety';
import { tooFew, type ResultsResponse, type ResultTile, type TileKey } from './myResult';

export const TEAM_RESULT_PATH = '/results/team';
export const TILE_KEYS: TileKey[] = ['seats', 'overdueFollowUps', 'screensReachedInterview', 'offersAccepted'];
export interface TeamRow { person: { id: string; name: string } | null; tiles: Record<TileKey, ResultTile> }
export interface TeamResult extends ResultsResponse { rows: TeamRow[]; perPerson: boolean }
export type TeamResultLoad = { kind: 'ready'; data: TeamResult } | { kind: 'unavailable' } | { kind: 'no-reports' };

const isTile = (t: unknown): t is ResultTile => !!t && typeof t === 'object' && typeof (t as ResultTile).value === 'number' && typeof (t as ResultTile).sampleSize === 'number';
const okTiles = (t: unknown): t is Record<TileKey, ResultTile> => !!t && typeof t === 'object' && TILE_KEYS.every((k) => isTile((t as Record<string, unknown>)[k]));

export async function fetchTeamResult(month: string, vacancyId?: string | null): Promise<TeamResultLoad> {
  const q = new URLSearchParams({ month });
  if (vacancyId) q.set('vacancyId', vacancyId);
  let r: ResultsResponse & { rows?: unknown };
  try {
    r = stripPay(await getApi<ResultsResponse & { rows?: unknown }>(`${TEAM_RESULT_PATH}?${q}`));
  } catch (e) {
    const s = (e as { statusCode?: number })?.statusCode;
    if (s === 404 || s === 501) return { kind: 'unavailable' };
    if (s === 403) return { kind: 'no-reports' };
    throw e;
  }
  if (!okTiles(r?.tiles)) return { kind: 'unavailable' };
  const people = [...(r.people ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const perPersonRaw = Array.isArray(r.rows) ? (r.rows as Array<{ person?: { id: string; name: string }; tiles?: unknown }>).filter((x) => x.person && okTiles(x.tiles)) : [];
  const rows: TeamRow[] = perPersonRaw.length
    ? perPersonRaw.map((x) => ({ person: x.person!, tiles: x.tiles as Record<TileKey, ResultTile> })).sort((a, b) => a.person!.name.localeCompare(b.person!.name))
    : [{ person: null, tiles: r.tiles }];
  return { kind: 'ready', data: { ...r, people, rows, perPerson: perPersonRaw.length > 0 } };
}

/** A row is "too few to judge" when any judged tile (not seats) is — the server's flag first. */
export const rowTooFew = (tiles: Record<TileKey, ResultTile>) => TILE_KEYS.some((k) => tooFew(k, tiles[k]));
export const sampleText = (tiles: Record<TileKey, ResultTile>) => {
  const s = tiles.screensReachedInterview.sampleSize; const o = tiles.offersAccepted.sampleSize; const f = tiles.overdueFollowUps.sampleSize;
  return `${f} follow-up${f === 1 ? '' : 's'} · ${s} screen${s === 1 ? '' : 's'} · ${o} offer${o === 1 ? '' : 's'}`;
};
