import type { Vacancy, VacancyDetailView } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import type { ApiError } from '../api/client';
import type { MaybeRedacted, RedactedVacancy, Unredacted } from '../types/redactedVacancy';

export type { RedactedVacancy, MaybeRedacted } from '../types/redactedVacancy';

export const REDACTED_OWNER_LABEL = 'Owned by another recruiter';
export const REDACTED_PICKER_REASON = 'owned by another recruiter';

/** Type guard for B1 redacted jobs. Tolerates partial/malformed payloads. */
export function isRedactedVacancy(value: unknown): value is RedactedVacancy {
  return typeof value === 'object' && value !== null && (value as { redacted?: unknown }).redacted === true;
}

export function redactedTitle(v: RedactedVacancy): string {
  return v.title?.trim() || 'Untitled job';
}
export function redactedSite(v: RedactedVacancy): string {
  return v.site?.name?.trim() || 'Site not shared';
}
export function redactedSeats(v: RedactedVacancy): { filled: number; target: number } {
  const filled = Number.isFinite(v.seats?.filled) ? v.seats.filled : 0;
  const target = Number.isFinite(v.seats?.target) ? v.seats.target : 0;
  return { filled, target };
}

export interface PartitionedVacancies<T> {
  full: T[];
  redacted: RedactedVacancy[];
}

export function unwrapList<T>(res: T[] | { data?: T[] } | null | undefined): T[] {
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.data) ? res.data : [];
}

/** Split a mixed list. Callers must decide what to do with `redacted`. */
export function partitionVacancies<T extends { id: string }>(list: Array<MaybeRedacted<T>>): PartitionedVacancies<Unredacted<T>> {
  const full: Array<Unredacted<T>> = [];
  const redacted: RedactedVacancy[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    if (isRedactedVacancy(item)) redacted.push(item);
    else full.push(item);
  }
  return { full, redacted };
}

/** GET /vacancies (array or { data } envelope), partitioned. */
export async function fetchVacancyList<T extends { id: string } = Vacancy>(path = '/vacancies'): Promise<PartitionedVacancies<Unredacted<T>>> {
  const res = await getApi<Array<MaybeRedacted<T>> | { data?: Array<MaybeRedacted<T>> }>(path);
  return partitionVacancies(unwrapList(res));
}

/** GET /vacancies/:id → full detail or the redacted shape. */
export function fetchVacancyDetail(id: string): Promise<MaybeRedacted<VacancyDetailView>> {
  return getApi<MaybeRedacted<VacancyDetailView>>(`/vacancies/${id}`);
}

/** Full detail or null (redacted jobs carry no workflow context). */
export async function fetchVacancyContext(id: string): Promise<VacancyDetailView | null> {
  const v = await fetchVacancyDetail(id);
  return isRedactedVacancy(v) ? null : v;
}

export const OWNERSHIP_DENIED_CODES = new Set(['JOB_NOT_OWNED', 'FILE_NOT_OWNED']);

export function isForbiddenError(error: unknown): error is ApiError {
  // Structural check so module mocks of api/client don't break the guard.
  return typeof error === 'object' && error !== null && (error as { statusCode?: unknown }).statusCode === 403;
}

export function isOwnershipDenied(error: unknown): boolean {
  return isForbiddenError(error) && OWNERSHIP_DENIED_CODES.has(error.code ?? '');
}
