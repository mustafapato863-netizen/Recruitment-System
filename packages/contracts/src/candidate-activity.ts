export type CandidateActivityKind = 'Call' | 'Note' | 'Email' | 'Meeting' | 'Document Verification' | 'Offer Follow-up';

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
  dueAt?: string;
}
