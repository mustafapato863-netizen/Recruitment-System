import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { CheckboxField } from '../ui/CheckboxField';
import { ProgressBar } from '../ui/ProgressBar';
import { ConfirmDialog } from '../ConfirmDialog';

export interface ComplianceItem {
  id: string;
  label: string;
  isCompleted: boolean;
  notes: string | null;
  completedAt: string | null;
}

export interface JoiningChecklistProps {
  hiringCaseId: string;
  candidateName: string;
  items: ComplianceItem[];
  hiringCaseStatus: string;
  canConfirmJoining: boolean;
  onItemToggle: (itemId: string, isCompleted: boolean) => Promise<void>;
  onConfirmJoining: () => Promise<void>;
  className?: string;
}

function formatCompletionDate(isoString: string | null): string | null {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString();
    }
  } catch {
    // Fallback to raw string if date parsing fails
  }
  return isoString;
}

function getItemDescription(item: ComplianceItem): string | undefined {
  const parts: string[] = [];
  if (item.notes && item.notes.trim()) {
    parts.push(item.notes.trim());
  }
  if (item.completedAt) {
    const formatted = formatCompletionDate(item.completedAt);
    if (formatted) {
      parts.push(`Completed ${formatted}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Failed to update compliance item.';
}

export function JoiningChecklist({
  hiringCaseId,
  candidateName,
  items,
  hiringCaseStatus,
  canConfirmJoining,
  onItemToggle,
  onConfirmJoining,
  className,
}: JoiningChecklistProps) {
  const [localItems, setLocalItems] = useState<ComplianceItem[]>(items);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [itemErrors, setItemErrors] = useState<Record<string, string | null>>({});
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const isJoined = hiringCaseStatus === 'Joined';

  // Synchronize with parent items while preserving optimistic in-flight toggles
  useEffect(() => {
    setLocalItems((prev) => {
      return items.map((incoming) => {
        if (togglingIds.has(incoming.id)) {
          const local = prev.find((p) => p.id === incoming.id);
          if (local) {
            return { ...incoming, isCompleted: local.isCompleted };
          }
        }
        return incoming;
      });
    });
  }, [items, togglingIds]);

  const totalCount = localItems.length;
  const completedCount = localItems.filter((i) => i.isCompleted).length;
  const allComplete = totalCount > 0 && localItems.every((i) => i.isCompleted);
  const isConfirmDisabled = !(allComplete && canConfirmJoining && !isJoined);

  const handleToggle = async (itemId: string) => {
    if (isJoined || togglingIds.has(itemId)) return;

    const currentItem = localItems.find((i) => i.id === itemId);
    if (!currentItem) return;

    const nextCompleted = !currentItem.isCompleted;

    // Clear previous inline error for this item
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    // Mark as toggling in-flight
    setTogglingIds((prev) => new Set(prev).add(itemId));

    // Optimistic update
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isCompleted: nextCompleted } : item,
      ),
    );

    try {
      await onItemToggle(itemId, nextCompleted);
    } catch (err: unknown) {
      // Revert optimistic update on reject
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isCompleted: currentItem.isCompleted } : item,
        ),
      );
      setItemErrors((prev) => ({
        ...prev,
        [itemId]: getErrorMessage(err),
      }));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      await onConfirmJoining();
      setIsConfirmDialogOpen(false);
    } catch (err: unknown) {
      setConfirmError(
        err instanceof Error ? err.message : 'Failed to confirm candidate joining.',
      );
      setIsConfirmDialogOpen(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <section
      className={cn(
        'rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs flex flex-col gap-5',
        className,
      )}
      data-hiring-case-id={hiringCaseId}
      aria-labelledby="joining-checklist-title"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rf-border-subtle">
        <div className="flex items-center gap-2.5">
          <Icon name="tasks" size={18} className="text-rf-action shrink-0" />
          <h3 id="joining-checklist-title" className="text-sm font-bold text-rf-ink m-0">
            Joining Checklist — {candidateName}
          </h3>
        </div>
        {isJoined && (
          <Badge variant="success">
            Joined ✓
          </Badge>
        )}
      </div>

      {/* Terminal Joined Banner */}
      {isJoined && (
        <Alert tone="success" title="Joined ✓">
          Candidate has officially joined. All pre-hire compliance requirements are finalized and locked.
        </Alert>
      )}

      {/* Confirmation Error Alert */}
      {confirmError && (
        <Alert tone="danger" title="Confirmation Error">
          {confirmError}
        </Alert>
      )}

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <ProgressBar
          value={completedCount}
          max={totalCount > 0 ? totalCount : 1}
          label="Progress"
          description={`${completedCount}/${totalCount} complete`}
          tone={isJoined || (allComplete && totalCount > 0) ? 'success' : 'action'}
          showValue={true}
        />
      </div>

      {/* Checklist Rows */}
      {localItems.length === 0 ? (
        <div className="py-6 text-center text-xs text-rf-ink-muted">
          No compliance requirements defined for this candidate.
        </div>
      ) : (
        <div className="flex flex-col gap-2" role="group" aria-label="Compliance items">
          {localItems.map((item) => {
            const isToggling = togglingIds.has(item.id);
            const itemError = itemErrors[item.id];
            const itemDescription = getItemDescription(item);

            return (
              <div
                key={item.id}
                className={cn(
                  'relative flex items-start justify-between rounded-xl border border-rf-border-subtle/80 bg-white p-1 transition-colors',
                  item.isCompleted && !isJoined && 'bg-rf-surface-subtle/35',
                  isJoined && 'bg-rf-surface-subtle/20',
                  itemError && 'border-rf-danger/40 bg-rf-danger-soft/10',
                )}
              >
                <div className="flex-1 min-w-0">
                  <CheckboxField
                    id={`compliance-item-${item.id}`}
                    label={
                      <span className="inline-flex items-center gap-2 text-rf-ink">
                        <span>{item.label}</span>
                        {isToggling && (
                          <Spinner
                            size={13}
                            className="text-rf-action shrink-0"
                            aria-label="Updating requirement status..."
                          />
                        )}
                      </span>
                    }
                    description={itemDescription}
                    error={
                      itemError ? (
                        <span className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 text-rf-danger font-semibold">
                            <Icon name="alert-triangle" size={13} className="shrink-0" />
                            <span>{itemError}</span>
                          </span>
                          {itemDescription && (
                            <span className="text-rf-ink-muted font-normal">
                              {itemDescription}
                            </span>
                          )}
                        </span>
                      ) : undefined
                    }
                    checked={item.isCompleted}
                    disabled={isJoined || isToggling}
                    onChange={() => void handleToggle(item.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rf-border-subtle">
        <span className="text-xs text-rf-ink-muted">
          {isJoined
            ? 'Headcount closed — candidate joined.'
            : allComplete
            ? 'All compliance items verified. Ready to confirm joining.'
            : `${totalCount - completedCount} requirement${totalCount - completedCount === 1 ? '' : 's'} remaining`}
        </span>
        <Button
          variant="primary"
          size="sm"
          disabled={isConfirmDisabled || isConfirming}
          loading={isConfirming}
          loadingLabel="Confirming..."
          onClick={() => setIsConfirmDialogOpen(true)}
        >
          <Icon name="check-circle" size={14} />
          Confirm Joining
        </Button>
      </div>

      {/* Confirm Joining Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => {
          if (!isConfirming) {
            setIsConfirmDialogOpen(false);
          }
        }}
        onConfirm={handleConfirm}
        title="Confirm joining and close headcount"
        description={`Confirm that ${candidateName} has reported for work. This will automatically update the vacancy filled headcount.`}
        confirmLabel="Confirm Joining"
        cancelLabel="Cancel"
        tone="success"
        icon="check-circle"
        isLoading={isConfirming}
      />
    </section>
  );
}
