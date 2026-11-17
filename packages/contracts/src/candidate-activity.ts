export type CandidateActivityKind = 'Call' | 'Note' | 'Email' | 'Meeting' | 'Document Verification' | 'Offer Follow-up' | 'FollowUp';

export interface CandidateActivityEntry {
  id: string;
  kind: string;
  title: string;
  actorId: string | null;
  actorName: string;
  at: string;
  dueAt: string | null;
  status: 'Completed' | 'Open' | 'Event';
  applicationId: string | null;
  canComplete: boolean;
  /** Reschedule lines stored on the task. Absent when the follow-up has not moved. */
  detail?: string | null;
}

export interface CandidateActivitySummary {
  completed: number;
  completedByMe: number;
  pending: number;
  overdue: number;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  byKind: Record<string, number>;
  byRecruiter: Array<{ userId: string; name: string; completed: number }>;
  entries: CandidateActivityEntry[];
  totalEntries: number;
  page: number;
  pageSize: number;
}

export interface CreateCandidateActivityInput {
  kind: CandidateActivityKind;
  summary: string;
  /** Schedule-only mode. Mutually exclusive with followUpDueAt. */
  dueAt?: string;
  /** ISO-8601 UTC instant for a next follow-up saved with a completed activity. */
  followUpDueAt?: string;
  /** Note for the scheduled follow-up. Defaults to "Follow-up: {summary}". */
  followUpSummary?: string;
  /** Kind of the scheduled follow-up. Defaults to FollowUp. */
  followUpKind?: CandidateActivityKind;
  /** Client key so a timeout retry returns the first write instead of a second row. */
  idempotencyKey?: string;
}

export interface CreateCandidateActivityResponse {
  id: string;
  followUpId?: string;
  deduplicated?: boolean;
}
