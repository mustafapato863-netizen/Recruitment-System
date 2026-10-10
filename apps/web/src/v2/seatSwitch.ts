import { isSeat, type Seat } from './seat';
import { resolveUiVersion } from '../theme/uiVersion';

/**
 * Seat-by-seat v2 rollout (Roadmap v2 §3, §10): v2 renders only when the v2
 * flag is on AND the user's seat is enabled. Default: Employee first.
 *
 * Seats precedence: SERVER (/auth/me `v2Seats`, confirmed by Backend) >
 * ?v2seats=employee,manager (persisted) > localStorage "recruitflow.ui.v2seats"
 * > VITE_UI_V2_SEATS > "employee".
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

/**
 * Server-side seat list from /auth/me: `me.v2Seats` (field confirmed by Backend;
 * the earlier `flags.v2Seats` guess is dropped), as string[] or a comma string. Returns null when absent so client sources apply.
 */
export function serverV2Seats(me: unknown): Seat[] | null {
  if (!me || typeof me !== 'object') return null;
  const raw = (me as { v2Seats?: unknown }).v2Seats;
  if (Array.isArray(raw)) return parseSeats(raw.filter((v) => typeof v === 'string').join(',') || 'none');
  if (typeof raw === 'string') return parseSeats(raw);
  return null;
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
