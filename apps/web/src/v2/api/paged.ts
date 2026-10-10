import { getApi } from '../../api/client';

/** API list caps: pageSize must be 1..100 (B2-22). */
export const MAX_PAGE_SIZE = 100;
type Page<T> = T[] | { data?: T[]; total?: number; meta?: { total?: number; totalPages?: number } };

/**
 * Fetches every page of a list endpoint at pageSize ≤ 100 (B2-22). Stops at the server total, a short page, or maxPages.
 * `path` may already carry a query string; page/pageSize are set here.
 */
export async function fetchAllPages<T>(path: string, opts: { pageSize?: number; maxPages?: number } = {}): Promise<T[]> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? MAX_PAGE_SIZE));
  const maxPages = opts.maxPages ?? 20;
  const [base, qs = ''] = path.split('?');
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams(qs); q.set('page', String(page)); q.set('pageSize', String(pageSize));
    const r = await getApi<Page<T>>(`${base}?${q}`);
    const rows = Array.isArray(r) ? r : r?.data ?? [];
    out.push(...rows);
    if (Array.isArray(r)) break; // unpaged endpoint: one call is everything
    const total = r?.total ?? r?.meta?.total;
    if (rows.length < pageSize || (typeof total === 'number' && out.length >= total)) break;
  }
  return out;
}
