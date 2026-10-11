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
import { Modal } from '../Modal';

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
  onItemNoteSave?: (itemId: string, notes: string) => Promise<void>;
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

function isClinicalItem(label: string): boolean {
  return /license|scfhs|dataflow|mumaris|medical|clinical|bls|acls|cpr|credential|health/i.test(label);
}

export function JoiningChecklist({
  hiringCaseId,
  candidateName,
  items,
  hiringCaseStatus,
  canConfirmJoining,
  onItemToggle,
  onConfirmJoining,
  onItemNoteSave,
  className,
}: JoiningChecklistProps) {
  const [localItems, setLocalItems] = useState<ComplianceItem[]>(items);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [itemErrors, setItemErrors] = useState<Record<string, string | null>>({});
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const isJoined = hiringCaseStatus === 'Joined';
  const isAwaitingJoining = hiringCaseStatus === 'Awaiting Joining';

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
  const isConfirmDisabled = !(allComplete && canConfirmJoining && isAwaitingJoining);

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

  const handleSaveNote = async () => {
    if (!editingItem) return;
    setIsSavingNote(true);
    const cleanedNote = noteInput.trim() || null;
    try {
      if (onItemNoteSave) {
        await onItemNoteSave(editingItem.id, noteInput.trim());
      }
      setLocalItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, notes: cleanedNote } : i)),
      );
      setEditingItem(null);
    } catch {
      setLocalItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, notes: cleanedNote } : i)),
      );
      setEditingItem(null);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handlePrintDossier = () => {
    window.print();
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrintDossier}
            className="gap-1.5 font-bold h-7 px-2 text-xs"
            title="Print or export the pre-hire verification compliance dossier"
          >
            <Icon name="download" size={13} />
            <span>Print Dossier</span>
          </Button>
          {isJoined && (
            <Badge variant="success">
              Joined ✓
            </Badge>
          )}
        </div>
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
                  'relative flex items-center justify-between gap-2 rounded-xl border border-rf-border-subtle/80 bg-white p-1 transition-colors',
                  item.isCompleted && !isJoined && 'bg-rf-surface-subtle/35',
                  isJoined && 'bg-rf-surface-subtle/20',
                  itemError && 'border-rf-danger/40 bg-rf-danger-soft/10',
                )}
              >
                <div className="flex-1 min-w-0">
                  <CheckboxField
                    id={`compliance-item-${item.id}`}
                    label={
                      <span className="inline-flex items-center gap-2 flex-wrap text-rf-ink">
                        <span>{item.label}</span>
                        {isClinicalItem(item.label) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Clinical Gate
                          </span>
                        )}
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
                {!isJoined && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setNoteInput(item.notes || '');
                    }}
                    className="p-1.5 mr-1 rounded-lg text-rf-ink-muted hover:text-rf-action hover:bg-rf-surface-subtle transition cursor-pointer shrink-0"
                    title={item.notes ? `Edit note: "${item.notes}"` : 'Attach verification note / license reference'}
                    aria-label={`Attach verification note for ${item.label}`}
                  >
                    <Icon name={item.notes ? 'document' : 'edit'} size={13} />
                  </button>
                )}
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
            : !isAwaitingJoining
            ? 'Awaiting final approval before candidate joining can be confirmed.'
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

      {/* Verification Note Modal */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={editingItem ? `Verification Reference: ${editingItem.label}` : 'Verification Note'}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-rf-ink-muted">
            Attach credential verification details, official registration numbers (e.g. SCFHS, DataFlow, Mumaris+), or audit reference notes.
          </p>
          <div>
            <label htmlFor="verification-note-input" className="block text-[11px] font-bold text-rf-ink mb-1">
              Verification Notes / License Reference
            </label>
            <textarea
              id="verification-note-input"
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. SCFHS Registration #24-10948, Primary Source Verified via DataFlow report #DF-99218..."
              className="w-full p-2.5 border border-rf-border rounded-xl bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-rf-border-subtle">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSavingNote}
              loadingLabel="Saving..."
              onClick={handleSaveNote}
            >
              Save Verification Note
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
