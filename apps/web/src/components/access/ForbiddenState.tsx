import { PageState } from '../ui/PageState';

/** v1 Forbidden page for 403s on another owner's job or file (B1). No redirect. */
export function ForbiddenState({
  title = 'You do not have access to this',
  description = 'This belongs to another owner. Ask the owner or your manager if it should be reassigned to you.',
  backLabel,
  onBack,
}: { title?: string; description?: string; backLabel?: string; onBack?: () => void }) {
  return (
    <div className="flex w-full flex-col p-3 sm:p-4 max-w-[1720px] mx-auto" data-testid="forbidden-state">
      <PageState kind="forbidden" title={title} description={description} actionLabel={backLabel} onAction={onBack} />
    </div>
  );
}
