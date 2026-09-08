import type { PaginatedResult, TaskRecord } from '@recruitflow/contracts';

export type TaskListResponse = PaginatedResult<TaskRecord> | TaskRecord[];

/** Accepts the current paginated API response and the legacy array shape used by older test adapters. */
export function getTaskRows(response: TaskListResponse): TaskRecord[] {
  return Array.isArray(response) ? response : response.data;
}
