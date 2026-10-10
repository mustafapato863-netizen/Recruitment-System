import { PageState } from '../ui/PageState';
import type { RedactedVacancy } from '../../types/redactedVacancy';
import { REDACTED_OWNER_LABEL, redactedSeats, redactedSite, redactedTitle } from '../../utils/vacancyAccess';

/** B1: read-only view of another owner's job. Title, site and seats only; no actions. */
export function RedactedJobDetail({ job, onBack }: { job: RedactedVacancy; onBack?: () => void }) {
  const seats = redactedSeats(job);
  return (
    <div className="flex w-full flex-col p-3 sm:p-4 max-w-[1720px] mx-auto" data-testid="redacted-job-detail">
      <PageState
        kind="forbidden"
        title={redactedTitle(job)}
        description={`${REDACTED_OWNER_LABEL}. You can see the site and seats, but the job file, candidates and actions are only available to its owner and their manager.`}
        actionLabel="Back to Job Positions"
        onAction={onBack}
      >
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-xs">
          <dt className="font-semibold text-rf-ink-muted">Site</dt>
          <dd className="text-rf-ink">{redactedSite(job)}</dd>
          <dt className="font-semibold text-rf-ink-muted">Seats</dt>
          <dd className="tabular-nums text-rf-ink">{seats.filled} of {seats.target} filled</dd>
        </dl>
      </PageState>
    </div>
  );
}
