/**
 * M4 Team results — monthly history, or explicit monthly/weekly period analytics.
 * Team scope is the caller's direct reports. Tiles keep the server tooFewToJudge flag; seats stay exempt.
 * Optional rows[] are per recruiter. Funnel, joinedBySite, and sites are read only when the payload includes them.
 * The page may request up to six trailing months so a delta or sparkline is shown only from fetched periods.
 * Pay fields are stripped before the payload reaches the page.
 */
import { getApi } from '../../api/client';
import { stripPay } from './paySafety';
import { tooFew, type ResultsResponse, type ResultTile, type TileKey, type TargetMetricKey, type TargetPeriodType } from './myResult';

export const TEAM_RESULT_PATH = '/results/team';
export const TILE_KEYS: TileKey[] = ['seats', 'overdueFollowUps', 'screensReachedInterview', 'offersAccepted'];
export interface TeamPerson { id: string; name: string; role?: string | null }
export interface TeamFunnelStep { label: string; count: number; stepPercent: number | null }
export interface JoinedSite { siteId: string | null; site: string; joined: number }
export interface TeamSite { id: string; name: string }
export interface TeamRow {
  person: TeamPerson | null;
  tiles: Record<TileKey, ResultTile>;
  capacity?: ResultsResponse['capacity'];
  details?: ResultsResponse['details'];
  workCounts?: Record<TargetMetricKey, number>;
}
export interface TeamResult extends ResultsResponse {
  people: TeamPerson[];
  rows: TeamRow[];
  perPerson: boolean;
  funnel?: TeamFunnelStep[];
  joinedBySite?: JoinedSite[];
  sites?: TeamSite[];
  periodType?: TargetPeriodType;
  periodKey?: string;
  periodLabel?: string;
}
export type TeamResultLoad = { kind: 'ready'; data: TeamResult } | { kind: 'unavailable' } | { kind: 'no-reports' };

const isTile = (t: unknown): t is ResultTile => !!t && typeof t === 'object' && typeof (t as ResultTile).value === 'number' && typeof (t as ResultTile).sampleSize === 'number';
const okTiles = (t: unknown): t is Record<TileKey, ResultTile> => !!t && typeof t === 'object' && TILE_KEYS.every((k) => isTile((t as Record<string, unknown>)[k]));

const personOf = (raw: { id?: unknown; name?: unknown; role?: unknown } | null | undefined): TeamPerson | null => {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const role = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : undefined;
  return { id: raw.id, name: raw.name, ...(role ? { role } : {}) };
};

function readFunnel(raw: unknown): TeamFunnelStep[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const steps = raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { label?: unknown; count?: unknown; stepPercent?: unknown };
    if (typeof row.label !== 'string' || typeof row.count !== 'number' || !Number.isFinite(row.count)) return [];
    const stepPercent = typeof row.stepPercent === 'number' && Number.isFinite(row.stepPercent) ? row.stepPercent : null;
    return [{ label: row.label, count: row.count, stepPercent }];
  });
  return steps.length ? steps : undefined;
}

function readJoined(raw: unknown): JoinedSite[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { siteId?: unknown; site?: unknown; joined?: unknown };
    if (typeof row.site !== 'string' || typeof row.joined !== 'number' || !Number.isFinite(row.joined)) return [];
    const siteId = typeof row.siteId === 'string' ? row.siteId : null;
    return [{ siteId, site: row.site, joined: row.joined }];
  });
}

function readSites(raw: unknown): TeamSite[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { id?: unknown; name?: unknown };
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.name.trim()) return [];
    return [{ id: row.id, name: row.name }];
  });
}

export async function fetchTeamResult(month: string, vacancyId?: string | null, branchId?: string | null, period?: { type: TargetPeriodType; key: string }): Promise<TeamResultLoad> {
  const q = new URLSearchParams(period ? { periodType: period.type, periodKey: period.key } : { month });
  // Older monthly servers still honor month even if they ignore the additive period fields.
  if (period?.type === 'monthly') q.set('month', period.key);
  if (vacancyId) q.set('vacancyId', vacancyId);
  if (branchId) q.set('branchId', branchId);
  let r: ResultsResponse & { rows?: unknown; funnel?: unknown; joinedBySite?: unknown; sites?: unknown; periodType?: TargetPeriodType; periodKey?: string; periodLabel?: string };
  try {
    r = stripPay(await getApi<ResultsResponse & { rows?: unknown; funnel?: unknown; joinedBySite?: unknown; sites?: unknown }>(`${TEAM_RESULT_PATH}?${q}`));
  } catch (e) {
    const s = (e as { statusCode?: number })?.statusCode;
    if (s === 404 || s === 501) return { kind: 'unavailable' };
    if (s === 403) return { kind: 'no-reports' };
    throw e;
  }
  if (!okTiles(r?.tiles)) return { kind: 'unavailable' };
  // An older server may ignore new query parameters: never display monthly data as weekly.
  if (period?.type === 'weekly' && (r.periodType !== 'weekly' || r.periodKey !== period.key)) return { kind: 'unavailable' };
  const people = (r.people ?? []).flatMap((p) => {
    const person = personOf(p);
    return person ? [person] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
  const perPersonRaw = Array.isArray(r.rows)
    ? (r.rows as Array<{ person?: { id: string; name: string; role?: string | null }; tiles?: unknown; workCounts?: unknown; capacity?: ResultsResponse['capacity']; details?: ResultsResponse['details'] }>).flatMap((x) => {
        const person = personOf(x.person);
        return person && okTiles(x.tiles) ? [{ ...x, person }] : [];
      })
    : [];
  const rows: TeamRow[] = perPersonRaw.length
    ? perPersonRaw.map((x) => ({
        person: x.person,
        tiles: x.tiles as Record<TileKey, ResultTile>,
        ...(x.capacity ? { capacity: x.capacity } : {}),
        ...(x.details ? { details: x.details } : {}),
        ...(validWorkCounts(x.workCounts) ? { workCounts: x.workCounts } : {}),
      })).sort((a, b) => a.person!.name.localeCompare(b.person!.name))
    : [{ person: null, tiles: r.tiles }];
  const funnel = readFunnel(r.funnel);
  const joinedBySite = readJoined(r.joinedBySite);
  const sites = readSites(r.sites);
  const rest: Record<string, unknown> = { ...r };
  delete rest.funnel;
  delete rest.joinedBySite;
  delete rest.sites;
  delete rest.rows;
  return {
    kind: 'ready',
    data: {
      ...(rest as unknown as ResultsResponse),
      people,
      rows,
      perPerson: perPersonRaw.length > 0,
      ...(funnel ? { funnel } : {}),
      ...(joinedBySite ? { joinedBySite } : {}),
      ...(sites ? { sites } : {}),
    },
  };
}

function validWorkCounts(raw: unknown): raw is Record<TargetMetricKey, number> {
  if (!raw || typeof raw !== 'object') return false;
  const counts = raw as Record<string, unknown>;
  return ['screenings_completed', 'interviews_conducted', 'feedback_submitted', 'seats_joined'].every((key) => typeof counts[key] === 'number' && Number.isInteger(counts[key]) && (counts[key] as number) >= 0);
}

export function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

/** Selected month first, then older months. Never includes a month after `ceiling`. */
export function trailingMonths(month: string, count = 6, ceiling = month): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = shiftMonth(month, -i);
    if (next > ceiling) continue;
    out.push(next);
  }
  return out;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function percentOf(value: number, total: number): number | null {
  if (total <= 0) return null;
  return (value / total) * 100;
}

/** Percent change. Null when the previous value is 0 and the current value is not. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatSignedPercent(delta: number): string {
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function formatSignedPoints(delta: number): string {
  const rounded = Number(delta.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} pp`;
}

export function formatSignedCount(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta}`;
}

export function acceptableRecruiters(data: TeamResult): { acceptable: number; total: number } | null {
  if (!data.perPerson) return null;
  const rows = data.rows.filter((row) => row.person);
  return { acceptable: rows.filter((row) => !rowTooFew(row.tiles)).length, total: rows.length };
}

/** A row is "too few to judge" when any judged tile (not seats) is — the server's flag first. */
export const rowTooFew = (tiles: Record<TileKey, ResultTile>) => TILE_KEYS.some((k) => tooFew(k, tiles[k]));
export const sampleText = (tiles: Record<TileKey, ResultTile>) => {
  const s = tiles.screensReachedInterview.sampleSize; const o = tiles.offersAccepted.sampleSize; const f = tiles.overdueFollowUps.sampleSize;
  return `${f} follow-up${f === 1 ? '' : 's'} · ${s} screen${s === 1 ? '' : 's'} · ${o} offer${o === 1 ? '' : 's'}`;
};
