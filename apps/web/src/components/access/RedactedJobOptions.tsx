import { Icon } from '../Icon';
import type { RedactedVacancy } from '../../types/redactedVacancy';
import { REDACTED_OWNER_LABEL, REDACTED_PICKER_REASON, redactedSite, redactedTitle } from '../../utils/vacancyAccess';

/** Native <select> options: other owners' jobs, visible but never selectable. */
export function RedactedJobOptions({ jobs }: { jobs: RedactedVacancy[] }) {
  if (jobs.length === 0) return null;
  return (
    <optgroup label={REDACTED_OWNER_LABEL}>
      {jobs.map((job) => (
        <option key={job.id} value={`redacted:${job.id}`} disabled>
          {redactedTitle(job)} · {redactedSite(job)} ({REDACTED_PICKER_REASON})
        </option>
      ))}
    </optgroup>
  );
}

/** Card-list pickers: disabled rows with the reason. */
export function RedactedJobPickerRows({ jobs }: { jobs: RedactedVacancy[] }) {
  if (jobs.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1.5" aria-label={REDACTED_OWNER_LABEL}>
      {jobs.map((job) => (
        <li
          key={job.id}
          aria-disabled="true"
          data-redacted="true"
          className="flex cursor-not-allowed items-center justify-between gap-3 rounded-xl border border-rf-border-subtle bg-rf-surface-muted p-3 text-xs text-rf-ink-muted"
        >
          <span className="min-w-0 truncate"><strong className="font-semibold">{redactedTitle(job)}</strong> · {redactedSite(job)}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold"><Icon name="lock" size={12} />{REDACTED_OWNER_LABEL}</span>
        </li>
      ))}
    </ul>
  );
}
