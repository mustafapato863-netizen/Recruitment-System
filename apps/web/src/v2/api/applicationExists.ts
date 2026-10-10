import { getApi } from '../../api/client';
import { domainError } from './gates';

/**
 * #23 (B2-12): POST /applications answers 409 APPLICATION_EXISTS when this person already has a file on this job.
 * The 409 carries no id, so the existing file is looked up (GET /applications?vacancyId&candidateId) to link to it.
 */
export const isApplicationExists = (e: unknown) => domainError(e)?.code === 'APPLICATION_EXISTS';
export async function findExistingFile(vacancyId: string, candidateId: string): Promise<string | null> {
  const q = new URLSearchParams({ vacancyId, candidateId, page: '1', pageSize: '5' });
  const r = await getApi<{ data?: Array<{ id: string; candidateId?: string; vacancyId?: string }> } | Array<{ id: string; candidateId?: string; vacancyId?: string }>>(`/applications?${q}`).catch(() => null);
  const rows = Array.isArray(r) ? r : r?.data ?? [];
  return rows.find((a) => (!a.candidateId || a.candidateId === candidateId) && (!a.vacancyId || a.vacancyId === vacancyId))?.id ?? null;
}
