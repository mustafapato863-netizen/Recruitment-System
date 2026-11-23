/**
 * Lightweight user-scoped Stale-While-Revalidate (SWR) cache for V2 page views.
 *
 * Goals:
 * - Instant view switches across sidebar routes and internal tabs (no loading-skeleton flash).
 * - Deduplicate concurrent in-flight loads for the same view key.
 * - Automatic invalidation on API mutations (marks cached views stale so returning pages
 *   show cached data immediately and refresh silently in the background).
 * - Complete purge on logout, login, unauthorized session loss, or user switch.
 */

export const DEFAULT_VIEW_STALE_MS = 30_000;

interface CacheEntry<T = unknown> {
  data: T;
  storedAt: number;
  epoch: number;
  stale: boolean;
}

const entries = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

let activeUserKey = 'anon';
let cacheEpoch = 0;
let clearEpoch = 0;
let cacheEnabled = import.meta.env.MODE !== 'test';

export function setViewCacheEnabled(enabled: boolean): void {
  cacheEnabled = enabled;
  if (!enabled) {
    clearViewCache();
  }
}

export function isViewCacheEnabled(): boolean {
  return cacheEnabled;
}

function emitInvalidation(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors during invalidation broadcast.
    }
  }
}

export function getCacheEpoch(): number {
  return cacheEpoch;
}

/**
 * Scope cache entries to the signed-in user. Switching users immediately purges
 * all cached entries and cancels in-flight writes from the prior session.
 */
export function setViewCacheUser(userId: string | null | undefined): void {
  const nextKey = userId ? String(userId) : 'anon';
  if (nextKey !== activeUserKey) {
    activeUserKey = nextKey;
    entries.clear();
    inFlight.clear();
    clearEpoch += 1;
    cacheEpoch += 1;
  }
}

/** Completely purge every cached entry and in-flight handle (auth change / test cleanup). */
export function clearViewCache(): void {
  entries.clear();
  inFlight.clear();
  clearEpoch += 1;
  cacheEpoch += 1;
  emitInvalidation();
}

/**
 * Mark matching cached views as stale without deleting their last known good data.
 * Returning to a view renders the cached snapshot immediately and revalidates in the background.
 */
export function invalidateViewCache(prefix?: string): void {
  cacheEpoch += 1;
  inFlight.clear();
  for (const [key, entry] of entries.entries()) {
    if (!prefix || key.startsWith(prefix)) {
      entry.stale = true;
    }
  }
  emitInvalidation();
}

export function subscribeCacheInvalidation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readViewCache<T>(
  key: string,
  staleMs = DEFAULT_VIEW_STALE_MS,
): { data: T; fresh: boolean; epoch: number } | null {
  if (!cacheEnabled) return null;
  const entry = entries.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const withinWindow = Date.now() - entry.storedAt < staleMs;
  const fresh = !entry.stale && entry.epoch === cacheEpoch && withinWindow;
  return { data: entry.data, fresh, epoch: entry.epoch };
}

export function writeViewCache<T>(key: string, data: T): void {
  if (!cacheEnabled) return;
  entries.set(key, {
    data,
    storedAt: Date.now(),
    epoch: cacheEpoch,
    stale: false,
  });
}

/**
 * Load a view with SWR caching and in-flight deduplication.
 * Safe across user switches and concurrent mutations: an in-flight load started
 * before a session change never pollutes the new session's cache.
 */
export function loadCachedView<T>(
  key: string,
  loader: () => Promise<T>,
  opts?: { force?: boolean; staleMs?: number },
): Promise<T> {
  if (!cacheEnabled) {
    return loader();
  }
  const force = Boolean(opts?.force);
  const staleMs = opts?.staleMs ?? DEFAULT_VIEW_STALE_MS;

  if (!force) {
    const hit = readViewCache<T>(key, staleMs);
    if (hit?.fresh) {
      return Promise.resolve(hit.data);
    }
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }
  }

  const startUser = activeUserKey;
  const startClearEpoch = clearEpoch;
  const startCacheEpoch = cacheEpoch;

  const promise = loader().then((result) => {
    if (activeUserKey === startUser && clearEpoch === startClearEpoch) {
      entries.set(key, {
        data: result,
        storedAt: Date.now(),
        epoch: startCacheEpoch,
        stale: startCacheEpoch !== cacheEpoch,
      });
    }
    return result;
  }).finally(() => {
    if (inFlight.get(key) === promise) {
      inFlight.delete(key);
    }
  });

  if (!force) {
    inFlight.set(key, promise);
  }
  return promise;
}
