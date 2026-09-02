import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { FormField } from './ui/FormField';
import { Textarea } from './ui/Textarea';
import { Icon, type IconName } from './Icon';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void> | void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'success' | 'danger' | 'warning';
  icon?: IconName;
  withComment?: boolean;
  commentLabel?: string;
  commentPlaceholder?: string;
  commentRequired?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  icon,
  withComment = false,
  commentLabel = 'Decision comment or notes',
  commentPlaceholder = 'Add reason or context...',
  commentRequired = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (commentRequired && !comment.trim()) return;
    await onConfirm(comment.trim() || undefined);
    setComment('');
  };

  const getTonePill = () => {
    switch (tone) {
      case 'success':
        return {
          bg: 'bg-rf-success-soft text-rf-success border-rf-success-border',
          iconName: (icon || 'check-circle') as IconName,
          btnVariant: 'success' as const,
        };
      case 'danger':
        return {
          bg: 'bg-rf-danger-soft text-rf-danger border-rf-danger-border',
          iconName: (icon || 'alert-triangle') as IconName,
          btnVariant: 'danger' as const,
        };
      case 'warning':
        return {
          bg: 'bg-rf-warning-soft text-rf-warning border-rf-warning-border',
          iconName: (icon || 'alert-triangle') as IconName,
          btnVariant: 'warning' as const,
        };
      default:
        return {
          bg: 'bg-rf-action-soft text-rf-action border-rf-action/20',
          iconName: (icon || 'check-circle') as IconName,
          btnVariant: 'primary' as const,
        };
    }
  };

  const { bg, iconName, btnVariant } = getTonePill();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div className={['w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs', bg].join(' ')}>
            <Icon name={iconName} size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-bold text-rf-ink m-0">{title}</h3>
            {description && (
              <p className="text-xs text-rf-ink-muted font-medium m-0 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {withComment && (
          <FormField id="confirm-dialog-comment" label={commentLabel} required={commentRequired}>
            <Textarea
              id="confirm-dialog-comment"
              rows={3}
              required={commentRequired}
              autoFocus={commentRequired}
              placeholder={commentPlaceholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </FormField>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-rf-border-subtle mt-1">
          <Button variant="ghost" size="sm" type="button" disabled={isLoading} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={btnVariant}
            size="sm"
            type="submit"
            loading={isLoading}
            loadingLabel="Processing..."
            disabled={commentRequired && !comment.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
