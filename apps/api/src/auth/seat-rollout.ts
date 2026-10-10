/**
 * B10 (v2 §3 Rollout, §10): one seat at a time behind a switch — Employee, then Manager, then Admin.
 *
 * Precedence for the seats that get the v2 UI (first one that is set and valid wins):
 *   1. Org config: integrations row name='ROLLOUT_SEATS', configJson { "v2Seats": ["employee", ...] }
 *      (same per-org config pattern as RLS_ACCESS_POLICY; no migration). An empty array is valid = nobody.
 *   2. Env RF_V2_SEATS: comma-separated, e.g. "employee,manager". "none" = nobody.
 *   3. Default: ["employee"].
 * Unknown values are ignored; if nothing valid remains at a level, the next level is used.
 */
export const SEATS = ['employee', 'manager', 'admin'] as const;
export type Seat = (typeof SEATS)[number];
export const DEFAULT_V2_SEATS: Seat[] = ['employee'];
export const ROLLOUT_CONFIG_NAME = 'ROLLOUT_SEATS';

function clean(list: unknown): Seat[] | null {
  if (!Array.isArray(list)) return null;
  const valid = list.filter((s): s is Seat => typeof s === 'string' && (SEATS as readonly string[]).includes(s.trim().toLowerCase()))
    .map((s) => s.trim().toLowerCase() as Seat);
  if (list.length && !valid.length) return null;
  return SEATS.filter((s) => valid.includes(s));
}

export function resolveV2Seats(orgConfig: unknown, env: string | undefined): { v2Seats: Seat[]; source: 'org' | 'env' | 'default' } {
  const org = clean((orgConfig as { v2Seats?: unknown } | null | undefined)?.v2Seats);
  if (org) return { v2Seats: org, source: 'org' };
  if (env !== undefined && env.trim() !== '') {
    if (env.trim().toLowerCase() === 'none') return { v2Seats: [], source: 'env' };
    const fromEnv = clean(env.split(','));
    if (fromEnv && fromEnv.length) return { v2Seats: fromEnv, source: 'env' };
  }
  return { v2Seats: [...DEFAULT_V2_SEATS], source: 'default' };
}

/** The caller's seat: admin (ADMINISTRATOR), manager (HIRING_MANAGER role or has direct reports), else employee. */
export function seatOf(roleCodes: string[], hasDirectReports: boolean): Seat {
  if (roleCodes.includes('ADMINISTRATOR')) return 'admin';
  if (roleCodes.includes('HIRING_MANAGER') || hasDirectReports) return 'manager';
  return 'employee';
}
