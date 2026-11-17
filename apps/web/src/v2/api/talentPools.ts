import type { CreateTalentPoolInput, TalentPoolCandidateItem, TalentPoolItem } from '@recruitflow/contracts';
import { deleteApi, getApi, postApi } from '../../api/client';

const enc = encodeURIComponent;

export interface PoolPage {
  data: TalentPoolItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PoolDetail {
  pool: {
    id: string;
    name: string;
    description?: string | null;
    tags: string[];
    status: string;
    updatedAt: string;
  };
  candidates: TalentPoolCandidateItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PoolPerson {
  id: string;
  name: string;
  code: string;
}

type RawPerson = {
  id: string;
  candidateCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
};

const PAGE = '100';

export async function fetchPools(search = ''): Promise<PoolPage> {
  const query = new URLSearchParams({ page: '1', pageSize: PAGE });
  const term = search.trim();
  if (term) query.set('search', term);
  const first = await getApi<PoolPage>(`/talent-pools?${query.toString()}`);
  const rows = [...(first?.data ?? [])];
  const total = first?.total ?? rows.length;
  for (let page = 2; rows.length < total && (first?.data?.length ?? 0) >= 100 && page <= 100; page += 1) {
    query.set('page', String(page));
    const next = await getApi<PoolPage>(`/talent-pools?${query.toString()}`);
    const pageRows = next?.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return { ...first, data: rows, total };
}

export function createPool(input: CreateTalentPoolInput): Promise<TalentPoolItem> {
  return postApi<TalentPoolItem>('/talent-pools', input);
}

export async function fetchPool(id: string): Promise<PoolDetail> {
  const query = new URLSearchParams({ page: '1', pageSize: PAGE });
  const first = await getApi<PoolDetail>(`/talent-pools/${enc(id)}?${query.toString()}`);
  const candidates = [...(first?.candidates ?? [])];
  const total = first?.total ?? candidates.length;
  for (let page = 2; candidates.length < total && (first?.candidates?.length ?? 0) >= 100 && page <= 100; page += 1) {
    query.set('page', String(page));
    const next = await getApi<PoolDetail>(`/talent-pools/${enc(id)}?${query.toString()}`);
    const pageRows = next?.candidates ?? [];
    candidates.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return { ...first, candidates, total };
}

/** Membership only. Does not open or move an application. */
export function addPoolMember(poolId: string, candidateId: string) {
  return postApi<unknown>(`/talent-pools/${enc(poolId)}/candidates`, { candidateId });
}

/** Soft-removes the membership. Does not change an application stage. */
export function removePoolMember(poolId: string, candidateId: string) {
  return deleteApi<{ success: boolean }>(`/talent-pools/${enc(poolId)}/candidates/${enc(candidateId)}`);
}

/** Active people in the bank. Contact fields on the payload are dropped. */
export async function searchPoolPeople(search: string): Promise<PoolPerson[]> {
  const query = new URLSearchParams({ page: '1', pageSize: '20', status: 'Active', search: search.trim() });
  const result = await getApi<RawPerson[] | { data?: RawPerson[] }>(`/candidates?${query.toString()}`);
  const rows = Array.isArray(result) ? result : result.data ?? [];
  return rows.filter((row) => row.status === 'Active').map((row) => ({
    id: row.id,
    name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Unnamed',
    code: row.candidateCode ?? '',
  }));
}
