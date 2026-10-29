import { useLocation } from 'react-router-dom';
import { canOpenRoute, v2Redirect, type RoutePolicy } from './destinations';

export type ReturnDest = {
  href: string;
  kind: 'candidates' | 'compare' | 'my-work' | 'vacancy' | 'notifications' | 'search' | 'cv-bank';
  vacancyId?: string;
};

const OPEN_CANDIDATE_STAGES = new Set(['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire']);
const CANDIDATE_QUERY_KEYS = new Set(['tab', 'search', 'q', 'job', 'source', 'stage', 'ids']);
const TOKEN = /^[A-Za-z0-9_-]+$/;

const hasControl = (value: string) => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
};

function encodePair(key: string, value: string): string {
  return new URLSearchParams({ [key]: value }).toString();
}

function hasUnsafeQueryValue(val: string): boolean {
  const trimmed = val.trim();
  if (hasControl(val) || val.includes('\\') || val.includes('#') || val.includes('://') || trimmed.startsWith('//')) {
    return true;
  }
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return true;
  if (/(?:^|[?&])returnTo=/i.test(val)) return true;
  return false;
}

export function knownCandidateStage(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return OPEN_CANDIDATE_STAGES.has(trimmed) ? trimmed : '';
}

export function parseCompareIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (!id || !TOKEN.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function buildCandidatesHref(opts: {
  tab?: string | null;
  search?: string | null;
  q?: string | null;
  job?: string | null;
  source?: string | null;
  stage?: string | null;
  ids?: readonly string[] | string | null;
}): string {
  const parts: string[] = [];
  const tab = (opts.tab ?? '').trim();
  if (tab === 'bank') parts.push('tab=bank');
  const search = (opts.search ?? '').trim();
  if (search) parts.push(encodePair('search', search));
  const q = (opts.q ?? '').trim();
  if (q && !search) parts.push(encodePair('q', q));
  if (tab !== 'bank') {
    const job = (opts.job ?? '').trim();
    if (job && TOKEN.test(job)) parts.push(`job=${encodeURIComponent(job)}`);
    const source = (opts.source ?? '').trim();
    if (source) parts.push(encodePair('source', source));
    const stage = knownCandidateStage(opts.stage);
    if (stage) parts.push(encodePair('stage', stage));
    const ids = (typeof opts.ids === 'string'
      ? parseCompareIds(opts.ids)
      : opts.ids
        ? parseCompareIds(opts.ids.join(','))
        : []).slice(0, 4);
    if (ids.length > 0) parts.push(`ids=${ids.map(encodeURIComponent).join(',')}`);
  }
  return parts.length > 0 ? `/candidates?${parts.join('&')}` : '/candidates';
}

export function buildCompareHref(opts: {
  job: string;
  ids: readonly string[] | string;
  search?: string | null;
  source?: string | null;
  stage?: string | null;
}): string | null {
  const job = opts.job.trim();
  const ids = typeof opts.ids === 'string' ? parseCompareIds(opts.ids) : parseCompareIds(opts.ids.join(','));
  if (!TOKEN.test(job) || ids.length < 2 || ids.length > 4) return null;
  const parts = [
    `job=${encodeURIComponent(job)}`,
    `ids=${ids.map(encodeURIComponent).join(',')}`,
  ];
  const search = (opts.search ?? '').trim();
  const source = (opts.source ?? '').trim();
  const stage = knownCandidateStage(opts.stage);
  if (search) parts.push(encodePair('search', search));
  if (source) parts.push(encodePair('source', source));
  if (stage) parts.push(encodePair('stage', stage));
  return `/candidates/compare?${parts.join('&')}`;
}

export function compareCandidatesReturn(params: URLSearchParams): string {
  return buildCandidatesHref({
    search: params.get('search'),
    job: params.get('job'),
    source: params.get('source'),
    stage: params.get('stage'),
    ids: params.get('ids'),
  });
}

function sanitizeCandidatesQuery(queryParams: URLSearchParams): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const [key, rawVal] of queryParams.entries()) {
    if (!CANDIDATE_QUERY_KEYS.has(key) || seen.has(key)) continue;
    const val = rawVal.trim();
    if (!val) continue;
    if (key === 'tab') {
      if (val !== 'bank' && val !== 'active') continue;
      seen.add(key);
      parts.push(encodePair(key, val));
      continue;
    }
    if (key === 'job') {
      if (!TOKEN.test(val)) continue;
      seen.add(key);
      parts.push(`job=${encodeURIComponent(val)}`);
      continue;
    }
    if (key === 'stage') {
      const st = knownCandidateStage(val);
      if (!st) continue;
      seen.add(key);
      parts.push(encodePair(key, st));
      continue;
    }
    if (key === 'ids') {
      const ids = parseCompareIds(val).slice(0, 4);
      if (ids.length === 0) continue;
      seen.add(key);
      parts.push(`ids=${ids.map(encodeURIComponent).join(',')}`);
      continue;
    }
    seen.add(key);
    parts.push(encodePair(key, val));
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function sanitizeGeneralQuery(queryParams: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [key, rawVal] of queryParams.entries()) {
    const val = rawVal.trim();
    if (!val) continue;
    out.append(key, val);
  }
  const str = out.toString();
  return str ? `?${str}` : '';
}

/** Same-origin relative return targets only: /candidates, /candidates/compare, /my-work, /notifications, /search, or /vacancies/:id, with sanitized query. */
export function fileReturnTo(raw: string | null | undefined): ReturnDest | null {
  if (raw == null || typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 2000 || !value.startsWith('/') || value.startsWith('//')) return null;
  if (hasControl(value) || value.includes('\\') || value.includes('#') || value.includes('://')) return null;
  const qIndex = value.indexOf('?');
  const rawPath = qIndex === -1 ? value : value.slice(0, qIndex);
  const rawQuery = qIndex === -1 ? '' : value.slice(qIndex);
  if (rawQuery.slice(1).includes('?')) return null;
  const queryParams = new URLSearchParams(rawQuery ? rawQuery.slice(1) : '');
  if (rawQuery) {
    try {
      decodeURIComponent(rawQuery.slice(1));
    } catch {
      return null;
    }
    for (const [key, val] of queryParams.entries()) {
      if (!TOKEN.test(key)) return null;
      if (key.toLowerCase() === 'returnto') return null;
      if (hasUnsafeQueryValue(val)) return null;
    }
  }
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('://')) return null;
  const segments = path.split('/');
  if (segments[0] !== '' || segments.slice(1).some((seg) => seg === '' || seg === '.' || seg === '..')) return null;
  if (path === '/candidates') {
    return { href: `/candidates${sanitizeCandidatesQuery(queryParams)}`, kind: 'candidates' };
  }
  if (path === '/cv-bank') {
    const params = new URLSearchParams();
    const search = (queryParams.get('search') ?? '').trim();
    const page = queryParams.get('page');
    if (search) params.set('search', search);
    if (page && /^[1-9]\d{0,5}$/.test(page)) params.set('page', page);
    const query = params.toString();
    return { href: query ? `/cv-bank?${query}` : '/cv-bank', kind: 'cv-bank' };
  }
  if (path === '/candidates/compare') {
    const href = buildCompareHref({
      job: queryParams.get('job') ?? '',
      ids: queryParams.get('ids') ?? '',
      search: queryParams.get('search'),
      source: queryParams.get('source'),
      stage: queryParams.get('stage'),
    });
    return href ? { href, kind: 'compare' } : null;
  }
  if (path === '/search') {
    const q = (queryParams.get('q') ?? '').trim();
    if (!q) return null;
    return { href: `/search?${encodePair('q', q)}`, kind: 'search' };
  }
  if (path === '/my-work') return { href: `/my-work${sanitizeGeneralQuery(queryParams)}`, kind: 'my-work' };
  if (path === '/notifications') return { href: `/notifications${sanitizeGeneralQuery(queryParams)}`, kind: 'notifications' };
  if (segments.length === 3 && segments[1] === 'vacancies' && TOKEN.test(segments[2] ?? '')) {
    return { href: `/vacancies/${segments[2]}${sanitizeGeneralQuery(queryParams)}`, kind: 'vacancy', vacancyId: segments[2] };
  }
  return null;
}

/**
 * Current page, when the application file will navigate back to it.
 * A returnTo already on this page is dropped so it cannot be nested.
 */
export function returnFromLocation(pathname: string, search = ''): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of [...params.keys()]) {
    if (key.toLowerCase() === 'returnto') params.delete(key);
  }
  const query = params.toString();
  const path = (pathname.split('?')[0].split('#')[0] || '/').replace(/\/+$/, '') || '/';
  const raw = query ? `${path}?${query}` : path;
  return fileReturnTo(raw)?.href ?? null;
}

function asReturn(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

/**
 * Parsed return destination when both the file contract and the actor's route policy accept it.
 */
export function allowedReturnDest(raw: string | null | undefined, actor: RoutePolicy): ReturnDest | null {
  const shaped = fileReturnTo(asReturn(raw));
  if (!shaped) return null;
  if (v2Redirect(actor.seat, shaped.href, actor) != null) return null;
  if ((actor.permissions !== undefined || actor.isAdministrator) && !canOpenRoute(shaped.href, actor.permissions, actor.isAdministrator)) return null;
  return shaped;
}

/**
 * Untrusted returnTo: same shape as the file, and a page this actor's shell would keep.
 * External, malformed, and unauthorized targets are dropped. The caller then uses its own landing.
 */
export function allowedReturn(raw: string | null | undefined, actor: RoutePolicy): string | null {
  return allowedReturnDest(raw, actor)?.href ?? null;
}

const RECORD = /^\/(?:applications\/[^/?#]+|offers\/[^/?#]+|hires\/[^/?#]+|candidates\/(?!compare(?:\/|$))[^/?#]+(?:\/documents)?)$/;

/** Append a shaped return onto an application, offer, hire, or candidate detail link. Other hrefs stay as they are. */
export function withReturnTo(href: string, returnTo: string | null | undefined): string {
  const shaped = fileReturnTo(asReturn(returnTo));
  if (!shaped) return href;
  const hashAt = href.indexOf('#');
  const bare = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const queryAt = bare.indexOf('?');
  const path = queryAt === -1 ? bare : bare.slice(0, queryAt);
  const query = queryAt === -1 ? '' : bare.slice(queryAt + 1);
  if (!RECORD.test(path)) return href;
  const params = new URLSearchParams(query);
  if (params.has('returnTo')) return href;
  params.set('returnTo', shaped.href);
  return `${path}?${params.toString()}${hash}`;
}

/** Return target for the page the user is on, when the file contract accepts it. */
export function usePageReturn(): string | null {
  const { pathname, search } = useLocation();
  return returnFromLocation(pathname, search);
}
