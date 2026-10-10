import { Icon } from '../Icon';
import type { RedactedVacancy } from '../../types/redactedVacancy';
import { REDACTED_OWNER_LABEL, redactedSeats, redactedSite, redactedTitle } from '../../utils/vacancyAccess';

/**
 * B1: other recruiters' jobs, read-only. Title, site and seats only; no
 * actions and no navigation into the restricted detail.
 */
export function RedactedJobsSection({ jobs, title = "Other recruiters' jobs" }: { jobs: RedactedVacancy[]; title?: string }) {
  if (jobs.length === 0) return null;
  return (
    <section aria-label={title} className="rounded-2xl border border-rf-border bg-rf-surface p-4" data-testid="redacted-jobs">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-rf-ink">{title} <span className="font-semibold text-rf-ink-muted">· {jobs.length}</span></h2>
        <span className="text-xs text-rf-ink-muted">Read-only. Ask the owner or your manager for access.</span>
      </header>
      <ul className="divide-y divide-rf-border-subtle">
        {jobs.map((job) => <RedactedJobRow key={job.id} job={job} />)}
      </ul>
    </section>
  );
}

export function RedactedJobRow({ job }: { job: RedactedVacancy }) {
  const seats = redactedSeats(job);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm" data-redacted="true">
      <span className="min-w-0 flex-1 truncate font-semibold text-rf-ink">{redactedTitle(job)}</span>
      <span className="inline-flex items-center gap-1 text-xs text-rf-ink-muted">
        <Icon name="map-pin" size={13} />
        {redactedSite(job)}
      </span>
      <span className="text-xs tabular-nums text-rf-ink-muted">{seats.filled} of {seats.target} seats filled</span>
      <span className="inline-flex items-center gap-1 rounded-md bg-rf-surface-muted px-2 py-0.5 text-[11px] font-semibold text-rf-ink-muted">
        <Icon name="lock" size={12} />
        {REDACTED_OWNER_LABEL}
      </span>
    </li>
  );
}
