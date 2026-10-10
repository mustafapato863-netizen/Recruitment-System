import { isSeat, type Seat } from './seat';
import { resolveUiVersion } from '../theme/uiVersion';

/**
 * Seat-by-seat v2 rollout (Roadmap v2 §3, §10): v2 renders only when the v2
 * flag is on AND the user's seat is enabled. Default: Employee first.
 *
 * B10 #22: /auth/me returns `seat`, `v2Seats`, `v2Enabled` and `flags.v2Seats`. Server values win:
 * - `v2Enabled` (boolean) decides v2 vs v1 for this user outright;
 * - else seats: `v2Seats` > `flags.v2Seats` > dev fallback ?v2seats=… (persisted) > localStorage
 *   "recruitflow.ui.v2seats" > VITE_UI_V2_SEATS > "employee", gated by the v2 UI flag.
 */
export const V2_SEATS_STORAGE_KEY = 'recruitflow.ui.v2seats';
export const DEFAULT_V2_SEATS: readonly Seat[] = ['employee'];

export function parseSeats(raw: string | null | undefined): Seat[] | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'none' || trimmed === '') return [];
  if (trimmed === 'all') return ['employee', 'manager', 'admin'];
  const seats = trimmed.split(',').map((s) => s.trim()).filter(isSeat) as Seat[];
  return Array.from(new Set(seats));
}

type Store = Pick<Storage, 'getItem' | 'setItem'> | null;

const asSeatList = (raw: unknown): Seat[] | null => {
  if (Array.isArray(raw)) return parseSeats(raw.filter((v) => typeof v === 'string').join(',') || 'none');
  if (typeof raw === 'string') return parseSeats(raw);
  return null;
};
/** Server seat list from /auth/me: `v2Seats`, else `flags.v2Seats` (B10). null when absent so the dev fallbacks apply. */
export function serverV2Seats(me: unknown): Seat[] | null {
  if (!me || typeof me !== 'object') return null;
  const m = me as { v2Seats?: unknown; flags?: { v2Seats?: unknown } | null };
  return asSeatList(m.v2Seats) ?? asSeatList(m.flags?.v2Seats);
}
/** Server decision from /auth/me `v2Enabled` (B10); null when absent. */
export function serverV2Enabled(me: unknown): boolean | null {
  const v = me && typeof me === 'object' ? (me as { v2Enabled?: unknown }).v2Enabled : undefined;
  return typeof v === 'boolean' ? v : null;
}

export function resolveV2Seats(options: { search?: string; storage?: Store; envSeats?: string; me?: unknown } = {}): Set<Seat> {
  const { search = '', storage = null, envSeats, me } = options;
  const fromServer = serverV2Seats(me);
  if (fromServer) return new Set(fromServer);
  const q = new URLSearchParams(search).get('v2seats');
  const fromQuery = parseSeats(q);
  if (fromQuery) {
    try { storage?.setItem(V2_SEATS_STORAGE_KEY, q ?? ''); } catch { /* storage unavailable */ }
    return new Set(fromQuery);
  }
  let stored: string | null;
  try { stored = storage?.getItem(V2_SEATS_STORAGE_KEY) ?? null; } catch { stored = null; }
  const fromStorage = parseSeats(stored);
  if (fromStorage) return new Set(fromStorage);
  const fromEnv = parseSeats(envSeats);
  if (fromEnv) return new Set(fromEnv);
  return new Set(DEFAULT_V2_SEATS);
}

export function shouldUseV2Shell(seat: Seat, options: { search?: string; storage?: Store; envFlag?: string | boolean; envSeats?: string; me?: unknown }): boolean {
  const fromServer = serverV2Enabled(options.me);
  if (fromServer !== null) return fromServer;
  const version = resolveUiVersion({ search: options.search, storage: options.storage, envFlag: options.envFlag });
  return version === 'v2' && resolveV2Seats(options).has(seat);
}

/** Browser wiring. */
export function shouldUseV2ShellInBrowser(seat: Seat, me?: unknown): boolean {
  if (typeof window === 'undefined') return false;
  let storage: Storage | null;
  try { storage = window.localStorage; } catch { storage = null; }
  return shouldUseV2Shell(seat, {
    search: window.location.search,
    storage,
    envFlag: import.meta.env.VITE_UI_V2,
    envSeats: import.meta.env.VITE_UI_V2_SEATS,
    me,
  });
}
