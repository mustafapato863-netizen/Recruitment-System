import { getApi } from '../../api/client';
import { stripPay } from './paySafety';

export interface MyWorkActivityItem {
  id: string;
  name: string;
  job: string;
  stage: string;
  updatedAt: string;
}

/** Latest application updates, not an audit feed or a projection of scheduled events. */
export async function fetchMyWorkActivity(employeeId: string): Promise<MyWorkActivityItem[]> {
  if (!employeeId.trim()) throw new Error('Your account could not be identified.');
  const query = new URLSearchParams({ primaryRecruiterId: employeeId, sortBy: 'updatedAt', sortDirection: 'desc', page: '1', pageSize: '4' });
  const raw = stripPay(await getApi<{ data?: unknown }>(`/applications?${query}`));
  if (!Array.isArray(raw?.data)) throw new Error('Recent application updates are unavailable.');
  const items: MyWorkActivityItem[] = [];
  for (const value of raw.data) {
    if (!value || typeof value !== 'object') throw new Error('Recent application updates are unavailable.');
    const row = value as Record<string, unknown>;
    // Never relax the personal filter if a response contains an unverified or foreign owner.
    if (row.primaryRecruiterId !== employeeId) continue;
    if (typeof row.id !== 'string' || !row.id || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))) {
      throw new Error('Recent application updates are unavailable.');
    }
    const candidate = row.candidate && typeof row.candidate === 'object' ? row.candidate as Record<string, unknown> : {};
    const name = [candidate.firstName, candidate.lastName].filter((part): part is string => typeof part === 'string').join(' ').trim();
    items.push({
      id: row.id,
      name: name || (typeof row.applicationCode === 'string' && row.applicationCode ? row.applicationCode : 'Application'),
      job: typeof row.positionTitle === 'string' && row.positionTitle.trim() ? row.positionTitle : 'Job not specified',
      stage: typeof row.stage === 'string' ? row.stage : '',
      updatedAt: row.updatedAt,
    });
  }
  const sorted = items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  return sorted.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 4);
}
