import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Application, ApplicationStage, UpdateApplicationStageInput } from '@recruitflow/contracts';
import { patchApi, ApiError } from '../../api/client';
import { Icon, type IconName } from '../Icon';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ConfirmDialog';
import { Drawer } from '../ui/Drawer';
import { CommentsThread, type CommentItem } from '../ui/CommentsThread';
import { Alert } from '../ui/Alert';
import { cn } from '@/lib/utils';

export type SmartAction = {
  id: string;
  label: string;
  icon: IconName;
  variant: 'primary' | 'secondary' | 'danger';
  enabled: boolean;
  blockedReason?: string;
  requiresConfirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  onClick?: () => void | Promise<void>;
};

export interface SmartActionBarProps {
  applicationId: string;
  stage: ApplicationStage;
  version: number;
  actions: SmartAction[];
  onActionComplete: () => void;
  className?: string;
  onBack?: () => void;
}

/**
 * Returns default context-aware actions for a given application stage.
 * Follows exact @recruitflow/contracts ApplicationStage values.
 */
export function getDefaultActions(stage: ApplicationStage): SmartAction[] {
  switch (stage) {
    case 'Applied':
      return [
        {
          id: 'schedule-screening',
          label: 'Schedule Screening',
          icon: 'calendar-clock',
          variant: 'primary',
          enabled: true,
        },
        {
          id: 'add-note',
          label: 'Add Note',
          icon: 'chat',
          variant: 'secondary',
          enabled: true,
        },
        {
          id: 'reject',
          label: 'Reject',
          icon: 'close',
          variant: 'danger',
          enabled: true,
          requiresConfirm: true,
          confirmTitle: 'Reject Application',
          confirmDescription:
            'Are you sure you want to reject this applicant? This will transition their status to Rejected.',
        },
      ];

    case 'Screening':
      return [
        {
          id: 'move-interview',
          label: 'Move to Interview',
          icon: 'arrow-right',
          variant: 'primary',
          enabled: true,
        },
        {
          id: 'add-note',
          label: 'Add Note',
          icon: 'chat',
          variant: 'secondary',
          enabled: true,
        },
        {
          id: 'reject',
          label: 'Reject',
          icon: 'close',
          variant: 'danger',
          enabled: true,
          requiresConfirm: true,
          confirmTitle: 'Reject Application',
          confirmDescription:
            'Are you sure you want to reject this applicant? This will transition their status to Rejected.',
        },
      ];

    case 'Interview':
      return [
        {
          id: 'submit-scorecard',
          label: 'Submit Scorecard',
          icon: 'tasks',
          variant: 'secondary',
          enabled: true,
        },
        {
          id: 'move-offer',
          label: 'Move to Offer',
          icon: 'offer',
          variant: 'primary',
          enabled: true,
        },
        {
          id: 'add-note',
          label: 'Add Note',
          icon: 'chat',
          variant: 'secondary',
          enabled: true,
        },
        {
          id: 'reject',
          label: 'Reject',
          icon: 'close',
          variant: 'danger',
          enabled: true,
          requiresConfirm: true,
          confirmTitle: 'Reject Application',
          confirmDescription:
            'Are you sure you want to reject this applicant? This will transition their status to Rejected.',
        },
      ];

    case 'Offer':
      return [
        {
          id: 'generate-offer',
          label: 'Generate Offer',
          icon: 'offer',
          variant: 'primary',
          enabled: true,
        },
        {
          id: 'view-hiring-case',
          label: 'View Hiring Case',
          icon: 'briefcase',
          variant: 'secondary',
          enabled: true,
        },
        {
          id: 'add-note',
          label: 'Add Note',
          icon: 'chat',
          variant: 'secondary',
          enabled: true,
        },
        {
          id: 'reject',
          label: 'Reject',
          icon: 'close',
          variant: 'danger',
          enabled: true,
          requiresConfirm: true,
          confirmTitle: 'Reject Application',
          confirmDescription:
            'Are you sure you want to reject this applicant? This will transition their status to Rejected.',
        },
      ];

    case 'Pre-Hire':
      return [
        {
          id: 'view-hiring-case',
          label: 'View Hiring Case',
          icon: 'briefcase',
          variant: 'primary',
          enabled: true,
        },
        {
          id: 'add-note',
          label: 'Add Note',
          icon: 'chat',
          variant: 'secondary',
          enabled: true,
        },
      ];

    case 'Joined':
      return [
        {
          id: 'view-joining-status',
          label: 'View Joining Status',
          icon: 'user-check',
          variant: 'primary',
          enabled: true,
        },
      ];

    case 'Rejected':
    case 'Withdrawn':
      return [];

    default:
      return [];
  }
}

/**
 * Priority sorting for SmartActionBar layout:
 * [Back] ... [Add Note] [Reject] [primary rightmost]
 */
function getActionSortOrder(action: SmartAction): number {
  if (action.variant === 'primary') return 100;
  if (action.variant === 'danger' || action.id === 'reject') return 50;
  if (action.id === 'add-note') return 10;
  return 0;
}

export function SmartActionBar({
  applicationId,
  stage,
  version,
  actions,
  onActionComplete,
  className,
  onBack,
}: SmartActionBarProps) {
  const navigate = useNavigate();

  // Internal dialog & drawer states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<SmartAction | null>(null);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [notes, setNotes] = useState<CommentItem[]>([]);

  // Optimistic locking, loading & alert states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [conflictAlert, setConflictAlert] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const conflictTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (conflictTimeoutRef.current) clearTimeout(conflictTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/applications');
    }
  };

  const executeStageTransition = async (targetStage: ApplicationStage, reason?: string) => {
    if (!applicationId) return;
    setIsTransitioning(true);
    setErrorAlert(null);
    setConflictAlert(null);

    const payload: UpdateApplicationStageInput = {
      stage: targetStage,
      expectedStage: stage,
      expectedVersion: version,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    };

    try {
      await patchApi<Application>(`/applications/${applicationId}/stage`, payload);
      onActionComplete();
    } catch (err: unknown) {
      const isConflict =
        (err instanceof ApiError && (err.statusCode === 409 || err.code === 'CONFLICT')) ||
        (Boolean(err) &&
          typeof err === 'object' &&
          ((err as { statusCode?: number }).statusCode === 409 ||
            (err as { status?: number }).status === 409 ||
            (err as { code?: string }).code === 'CONFLICT'));

      if (isConflict) {
        setConflictAlert('This application was updated by someone else. Refreshing...');
        if (conflictTimeoutRef.current) clearTimeout(conflictTimeoutRef.current);
        conflictTimeoutRef.current = setTimeout(() => {
          setConflictAlert(null);
        }, 4000);
        onActionComplete();
      } else {
        const errorMsg =
          err instanceof ApiError && err.statusCode >= 500
            ? 'Server error occurred while updating stage. Please try again.'
            : err instanceof Error && err.message
              ? err.message
              : 'Server error occurred while updating stage. Please try again.';
        setErrorAlert(errorMsg);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = setTimeout(() => {
          setErrorAlert(null);
        }, 5000);
      }
      throw err;
    } finally {
      setIsTransitioning(false);
    }
  };

  const runAction = async (action: SmartAction, comment?: string) => {
    if (action.onClick) {
      await action.onClick();
      return;
    }

    switch (action.id) {
      case 'reject':
        await executeStageTransition('Rejected', comment);
        break;

      case 'schedule-screening':
        await executeStageTransition('Screening', comment);
        break;

      case 'move-interview':
      case 'move-to-interview':
        await executeStageTransition('Interview', comment);
        break;

      case 'move-offer':
      case 'move-to-offer':
        await executeStageTransition('Offer', comment);
        break;

      case 'generate-offer':
        navigate(`/offers/create?applicationId=${encodeURIComponent(applicationId)}`);
        break;

      case 'view-hiring-case':
        navigate('/hires');
        break;

      case 'view-joining-status':
        navigate('/joinings');
        break;

      case 'submit-scorecard':
        navigate('/interviews');
        break;

      default:
        onActionComplete();
        break;
    }
  };

  const handleActionClick = async (action: SmartAction) => {
    if (!action.enabled || isTransitioning) return;

    if (action.id === 'add-note') {
      setIsNotesDrawerOpen(true);
      return;
    }

    if (action.requiresConfirm || action.id === 'reject') {
      setPendingConfirmAction(action);
      setIsConfirmOpen(true);
      return;
    }

    await runAction(action);
  };

  const handleConfirmSubmit = async (comment?: string) => {
    if (!pendingConfirmAction) return;
    try {
      await runAction(pendingConfirmAction, comment);
      setIsConfirmOpen(false);
      setPendingConfirmAction(null);
    } catch {
      setIsConfirmOpen(false);
      setPendingConfirmAction(null);
    }
  };

  const handlePostComment = (text: string) => {
    if (!text.trim()) return;
    const newComment: CommentItem = {
      id: `note-${Date.now()}`,
      authorName: 'Recruiter',
      authorInitials: 'RC',
      authorRole: 'Talent Acquisition',
      timeAgo: 'Just now',
      content: text.trim(),
    };
    setNotes((prev) => [newComment, ...prev]);
    onActionComplete();
  };

  const effectiveActions = actions ?? getDefaultActions(stage);
  const isClosed =
    stage === 'Rejected' ||
    stage === 'Withdrawn' ||
    effectiveActions.length === 0;

  const sortedActions = [...effectiveActions].sort(
    (a, b) => getActionSortOrder(a) - getActionSortOrder(b),
  );

  return (
    <div className={cn('smart-action-bar-wrapper sticky bottom-0 z-20 space-y-2 pt-2', className)}>
      {conflictAlert && (
        <Alert tone="warning" className="w-full">
          {conflictAlert}
        </Alert>
      )}
      {errorAlert && (
        <Alert tone="danger" className="w-full">
          {errorAlert}
        </Alert>
      )}

      <div
        role="toolbar"
        aria-label="Application actions"
        className="smart-action-bar flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rf-border bg-rf-surface/95 px-4 py-3 shadow-xs backdrop-blur-sm"
      >
        {/* Left: Back button */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={handleBack}
            aria-label="Back"
          >
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </Button>
        </div>

        {/* Right: Stage actions or Application Closed text */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isClosed ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-rf-ink-muted" role="status">
              <Icon name="slash" size={14} className="text-rf-ink-muted" />
              <span>Application closed</span>
            </div>
          ) : (
            sortedActions.map((action) => {
              const isBlocked = !action.enabled;
              const blockedReason =
                action.blockedReason || 'This action is currently not available for this stage.';
              const isActionLoading =
                isTransitioning && (action.variant === 'primary' || action.variant === 'danger');

              const button = (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  type="button"
                  disabled={isBlocked || isTransitioning}
                  aria-disabled={isBlocked || undefined}
                  aria-label={isBlocked ? `${action.label}: ${blockedReason}` : action.label}
                  loading={isActionLoading}
                  loadingLabel={action.label}
                  onClick={() => void handleActionClick(action)}
                >
                  <Icon name={action.icon} size={14} />
                  <span>{action.label}</span>
                </Button>
              );

              if (isBlocked) {
                return (
                  <Tooltip key={action.id} content={blockedReason}>
                    {button}
                  </Tooltip>
                );
              }

              return button;
            })
          )}
        </div>
      </div>

      {/* Confirm Dialog for destructive / requiresConfirm actions */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setPendingConfirmAction(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={
          pendingConfirmAction?.confirmTitle ||
          (pendingConfirmAction?.id === 'reject' ? 'Reject Application' : 'Confirm Action')
        }
        description={
          pendingConfirmAction?.confirmDescription ||
          (pendingConfirmAction?.id === 'reject'
            ? 'Please provide a reason for rejecting this candidate. This will transition their application status to Rejected.'
            : 'Are you sure you want to proceed?')
        }
        confirmLabel={pendingConfirmAction?.id === 'reject' ? 'Confirm Rejection' : 'Confirm'}
        cancelLabel="Cancel"
        tone={
          pendingConfirmAction?.variant === 'danger'
            ? 'danger'
            : pendingConfirmAction?.variant === 'primary'
              ? 'primary'
              : 'warning'
        }
        icon={pendingConfirmAction?.icon || (pendingConfirmAction?.id === 'reject' ? 'close' : 'alert-triangle')}
        withComment={pendingConfirmAction?.id === 'reject'}
        commentLabel={pendingConfirmAction?.id === 'reject' ? 'Rejection Reason' : 'Notes'}
        commentPlaceholder={
          pendingConfirmAction?.id === 'reject'
            ? 'Enter reason for rejection (required)...'
            : 'Add optional notes...'
        }
        commentRequired={pendingConfirmAction?.id === 'reject'}
        isLoading={isTransitioning}
      />

      {/* Drawer with CommentsThread for Add Note */}
      <Drawer
        isOpen={isNotesDrawerOpen}
        onClose={() => setIsNotesDrawerOpen(false)}
        title="Application Notes"
        subtitle={`Application ${applicationId}`}
        width="standard"
      >
        <CommentsThread
          comments={notes}
          onPostComment={handlePostComment}
        />
      </Drawer>
    </div>
  );
}

export default SmartActionBar;
