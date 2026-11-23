import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_VIEW_STALE_MS,
  loadCachedView,
  readViewCache,
  setViewCacheUser,
  writeViewCache,
} from './viewCache';

export type CachedResourceState<T> =
  | { kind: 'loading'; isRefreshing: false }
  | { kind: 'ready'; data: T; isRefreshing: boolean }
  | { kind: 'error'; error: unknown; isRefreshing: false };

export interface UseCachedResourceOptions<T> {
  key: string;
  enabled?: boolean;
  staleMs?: number;
  attempt?: number;
  userId?: string | null;
  revalidateOnVisible?: boolean;
  fetcher: () => Promise<T>;
}

/**
 * Shared SWR data hook for V2 pages and tabs.
 * Synchronously reads cached state for the active key so route and tab switches
 * render immediately without loading-skeleton flashes or cross-key races.
 */
export function useCachedResource<T>({
  key,
  enabled = true,
  staleMs = DEFAULT_VIEW_STALE_MS,
  attempt = 0,
  userId,
  revalidateOnVisible = false,
  fetcher,
}: UseCachedResourceOptions<T>): CachedResourceState<T> & { setData: (next: T) => void } {
  if (userId !== undefined) {
    setViewCacheUser(userId);
  }

  const [snapshot, setSnapshot] = useState<{ key: string; state: CachedResourceState<T> }>(() => {
    const hit = enabled ? readViewCache<T>(key, staleMs) : null;
    if (hit) {
      return { key, state: { kind: 'ready', data: hit.data, isRefreshing: false } };
    }
    return { key, state: { kind: 'loading', isRefreshing: false } };
  });

  const reqGenRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const currentHit = enabled ? readViewCache<T>(key, staleMs) : null;
  const resolvedState: CachedResourceState<T> = snapshot.key === key
    ? snapshot.state
    : currentHit
      ? { kind: 'ready', data: currentHit.data, isRefreshing: false }
      : { kind: 'loading', isRefreshing: false };

  const setData = useCallback((next: T) => {
    writeViewCache(key, next);
    setSnapshot({ key, state: { kind: 'ready', data: next, isRefreshing: false } });
  }, [key]);

  useEffect(() => {
    if (!enabled) return undefined;
    const hit = readViewCache<T>(key, staleMs);
    const shouldFetch = attempt > 0 || !hit || !hit.fresh;
    if (!shouldFetch) {
      setSnapshot((prev) => (
        prev.key === key && prev.state.kind === 'ready'
          ? prev
          : { key, state: { kind: 'ready', data: hit.data, isRefreshing: false } }
      ));
      return undefined;
    }

    let alive = true;
    const reqId = ++reqGenRef.current;

    if (hit) {
      setSnapshot((prev) => {
        if (prev.key === key && prev.state.kind === 'error') {
          return { key, state: { kind: 'loading', isRefreshing: false } };
        }
        return { key, state: { kind: 'ready', data: hit.data, isRefreshing: true } };
      });
    } else {
      setSnapshot({ key, state: { kind: 'loading', isRefreshing: false } });
    }

    loadCachedView(key, () => fetcherRef.current(), { force: attempt > 0, staleMs })
      .then((data) => {
        if (!alive || reqGenRef.current !== reqId) return;
        setSnapshot({ key, state: { kind: 'ready', data, isRefreshing: false } });
      })
      .catch((error: unknown) => {
        if (!alive || reqGenRef.current !== reqId) return;
        setSnapshot((prev) => {
          // Keep cached content interactive if a passive background refresh fails.
          if (hit && attempt === 0 && prev.key === key && prev.state.kind === 'ready') {
            return { key, state: { kind: 'ready', data: prev.state.data, isRefreshing: false } };
          }
          return { key, state: { kind: 'error', error, isRefreshing: false } };
        });
      });

    return () => {
      alive = false;
    };
  }, [key, enabled, attempt, staleMs]);

  useEffect(() => {
    if (!enabled || !revalidateOnVisible) return undefined;
    let alive = true;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const reqId = ++reqGenRef.current;
      loadCachedView(key, () => fetcherRef.current(), { force: true, staleMs })
        .then((data) => {
          if (!alive || reqGenRef.current !== reqId) return;
          setSnapshot({ key, state: { kind: 'ready', data, isRefreshing: false } });
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, enabled, revalidateOnVisible, staleMs]);

  return { ...resolvedState, setData };
}
