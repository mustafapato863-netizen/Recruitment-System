/**
 * B1 (PR #4): another owner's job as returned to a non-oversight user.
 * Mirrors `RedactedVacancy` in packages/contracts on feat/b1-ownership-scope;
 * once #4 merges this can re-export from @recruitflow/contracts.
 */
export interface RedactedVacancy {
  id: string;
  redacted: true;
  title: string | null;
  site: { id: string; name: string } | null;
  seats: { filled: number; target: number };
}

/** A full record is never `redacted: true`. */
export type Unredacted<T> = T & { redacted?: false };

/** What GET /vacancies, /vacancies/:id and /vacancies/work-queue can return per item. */
export type MaybeRedacted<T> = Unredacted<T> | RedactedVacancy;
