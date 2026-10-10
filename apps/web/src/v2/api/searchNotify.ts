/**
 * E6 adapters: global search (E07) and notifications (E06), on EXISTING endpoints.
 *
 * GET /search?q=&limit= → GlobalSearchResponse {query, groups[{entityType,label,items[{entityType,entityId,title,subtitle?,status?}]}], total}
 *   Backend gap: /search is NOT B1-scoped (no open PR touches search.service.ts) and the candidate subtitle includes the email.
 *   Client mitigation here (the API must still fix it):
 *   - vacancy: kept only if it is one of my jobs (full) or a B1-redacted team job (title · site · seats, read-only);
 *     anything else is dropped ("outside your scope").
 *   - application: kept only if GET /applications?search= (B1-scoped) returns it, i.e. a file I own.
 *   - candidate: subtitle reduced to the current title (email/code removed); opens my file for that person when I own one,
 *     otherwise the bank list. Never the v1 candidate detail (PII).
 *   - task: my own tasks (server filters by assignee); due ISO formatted.
 *   - other entity types: dropped on the Employee seat.
 * GET /notifications?page=1&pageSize= → {data: NotificationRecord[], total, page, pageSize}
 * GET /notifications/unread-count → {unreadCount}; PATCH /notifications/:id/read; POST /notifications/read-all → {count}
 */
import { getApi, patchApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { fetchOpenJobs } from './jobs';

export interface GlobalSearchItem { entityType: string; entityId: string; title: string; subtitle?: string; status?: string }
export interface GlobalSearchResponse { query: string; groups: Array<{ entityType: string; label: string; items: GlobalSearchItem[] }>; total: number }

export interface ScopedResult { key: string; kind: 'file' | 'person' | 'job' | 'redacted-job' | 'task'; title: string; meta: string; href: string | null; note?: string }
export interface ScopedSearch { query: string; groups: Array<{ label: string; items: ScopedResult[] }>; shown: number; hidden: number }

const EMAIL = /\S+@\S+/;
const enc = encodeURIComponent;
type MyApp = { id: string; candidateId: string; stage: string; positionTitle?: string; primaryRecruiterName?: string | null };
const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
const day = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' }).format(d); };

export async function scopedSearch(q: string, signal?: { aborted: boolean }): Promise<ScopedSearch> {
  const query = q.trim();
  const [raw, apps, jobs] = await Promise.all([
    getApi<GlobalSearchResponse>(`/search?q=${enc(query)}&limit=10`),
    getApi<MyApp[] | { data: MyApp[] }>(`/applications?search=${enc(query)}&pageSize=50`).then(list).catch(() => [] as MyApp[]),
    fetchOpenJobs().catch(() => null),
  ]);
  if (signal?.aborted) return { query, groups: [], shown: 0, hidden: 0 };
  const res = stripPay(raw);
  const myAppIds = new Set(apps.map((a) => a.id));
  const appByCandidate = new Map(apps.map((a) => [a.candidateId, a]));
  const mine = new Map((jobs?.mine ?? []).map((j) => [j.id, j]));
  const others = new Map((jobs?.others ?? []).map((j) => [j.id, j]));
  let hidden = 0;
  const files: ScopedResult[] = []; const people: ScopedResult[] = []; const jobRows: ScopedResult[] = []; const tasks: ScopedResult[] = [];
  const seenCandidates = new Set<string>();
  for (const g of res.groups ?? []) for (const it of g.items ?? []) {
    switch (it.entityType) {
      case 'application':
        if (!myAppIds.has(it.entityId)) { hidden++; break; }
        files.push({ key: `a:${it.entityId}`, kind: 'file', title: it.title, meta: [it.subtitle, it.status].filter(Boolean).join(' · '), href: `/applications/${enc(it.entityId)}` });
        break;
      case 'candidate': {
        if (seenCandidates.has(it.entityId)) break;
        seenCandidates.add(it.entityId);
        const app = appByCandidate.get(it.entityId);
        const titleOnly = (it.subtitle ?? '').split(' · ').filter((p) => !EMAIL.test(p) && !/^CAN-/.test(p))[0] ?? '';
        if (app) people.push({ key: `c:${it.entityId}`, kind: 'file', title: it.title, meta: [app.positionTitle, app.stage, app.primaryRecruiterName ? `Owner: ${app.primaryRecruiterName}` : null].filter(Boolean).join(' · '), href: `/applications/${enc(app.id)}` });
        else people.push({ key: `c:${it.entityId}`, kind: 'person', title: it.title, meta: [titleOnly, 'In the bank'].filter(Boolean).join(' · '), href: `/candidates?tab=bank` });
        break;
      }
      case 'vacancy': {
        const m = mine.get(it.entityId); const o = others.get(it.entityId);
        if (m) jobRows.push({ key: `v:${it.entityId}`, kind: 'job', title: it.title, meta: [it.subtitle, it.status].filter(Boolean).join(' · '), href: `/vacancies/${enc(it.entityId)}` });
        else if (o) jobRows.push({ key: `v:${it.entityId}`, kind: 'redacted-job', title: o.title, meta: [o.site, `${o.seats.filled} of ${o.seats.target} seats`].filter(Boolean).join(' · '), href: `/vacancies/${enc(it.entityId)}`, note: 'Owned by another recruiter' });
        else hidden++;
        break;
      }
      case 'task':
        tasks.push({ key: `t:${it.entityId}`, kind: 'task', title: it.title, meta: (it.subtitle ?? '').replace(/Due (\S+)/, (_, iso: string) => `Due ${day(iso)}`), href: '/my-work' });
        break;
      default: hidden++;
    }
  }
  const groups = [{ label: 'Candidates', items: [...people, ...files.filter((f) => !people.some((p) => p.href === f.href))] }, { label: 'Jobs', items: jobRows }, { label: 'Tasks', items: tasks }].filter((g) => g.items.length);
  return { query, groups, shown: groups.reduce((n, g) => n + g.items.length, 0), hidden };
}

// ── notifications ───────────────────────────────────────────────────────────
export interface NotificationRecord { id: string; type: string; title: string; message: string; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string }
export const fetchNotifications = async (pageSize = 10) => {
  const r = await getApi<{ data: NotificationRecord[]; total: number } | NotificationRecord[]>(`/notifications?page=1&pageSize=${pageSize}`);
  return stripPay(Array.isArray(r) ? { data: r, total: r.length } : { data: r?.data ?? [], total: r?.total ?? 0 });
};
export const markRead = (id: string) => patchApi(`/notifications/${enc(id)}/read`, {});
export const markAllRead = () => postApi<{ count: number }>('/notifications/read-all', {});
/** v2 Employee routing: only E13 files, jobs and My Work. Offers/requisitions/interviews/candidates have no Employee-safe page → no link. */
export function notificationHref(n: NotificationRecord): string | null {
  if (!n.entityId) return null;
  const t = (n.entityType ?? '').toLowerCase();
  if (t === 'application') return `/applications/${enc(n.entityId)}`;
  if (t === 'vacancy' || t === 'job') return `/vacancies/${enc(n.entityId)}`;
  if (t === 'task') return '/my-work';
  return null;
}
/** Hide pay text even inside messages (e.g. a v1 template that quotes a salary). */
export const PAY_TEXT = /\b(salary|package|compensation|EGP|AED|SAR|USD)\b|\d{1,3}(,\d{3})+(\.\d+)?/i;
export const safeText = (s: string) => (PAY_TEXT.test(s) ? 'Details are on the file.' : s);
