import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OfferApprovalInboxItem } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { getErrorMessage } from '../api/errors';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon, type IconName } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useFeedback } from '../hooks/useFeedback';
import { useTranslation } from 'react-i18next';
import './PageEnhancementsV2.css';

type OfferApprovalRow = OfferApprovalInboxItem;

type ConfirmState = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'success' | 'danger';
  icon: IconName;
  withComment: boolean;
  commentPlaceholder: string;
  action: (comment?: string) => Promise<void>;
};

const initialConfirmState: ConfirmState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: '',
  tone: 'success',
  icon: 'check-circle',
  withComment: false,
  commentPlaceholder: '',
  action: async () => undefined,
};

const offerApprovalColumns: ResponsiveDataColumn<OfferApprovalRow>[] = [
  {
    key: 'offer',
    header: 'Offer code',
    priority: 'secondary',
    render: (row) => <Badge variant="neutral">{row.offerCode}</Badge>,
  },
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (row) => <span className="font-bold text-rf-ink">{row.candidateName}</span>,
  },
  {
    key: 'position',
    header: 'Position / branch',
    priority: 'secondary',
    render: (row) => (
      <div className="grid gap-0.5">
        <span className="font-medium text-rf-ink">{row.positionTitle}</span>
        <span className="font-medium text-rf-ink-muted">{row.branchName || 'Branch not reported'}</span>
      </div>
    ),
  },
  {
    key: 'package',
    header: 'Monthly package',
    priority: 'secondary',
    render: (row) => (
      <div className="grid gap-0.5">
        <span className="font-bold text-rf-ink">{row.monthlyPackage === null ? 'Restricted' : `SAR ${row.monthlyPackage.toLocaleString()}`}</span>
        <span className="font-medium text-rf-ink-muted">{row.monthlyPackage === null ? 'Salary hidden by policy' : 'Monthly gross'}</span>
      </div>
    ),
  },
  {
    key: 'version',
    header: 'Version',
    priority: 'tertiary',
    render: (row) => <Badge variant="info">v{row.versionNumber}</Badge>,
  },
];

export function OfferApprovalInboxPage() {
  const { t } = useTranslation();
  const { success: toastSuccess, error: toastError } = useFeedback();
  const [approvals, setApprovals] = useState<OfferApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getApi<OfferApprovalRow[]>('/offers/approvals/inbox');
      setApprovals(data);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('offerInbox.loadErrorToast'));
      setError(message);
      toastError(err, t('offerInbox.loadErrorToast'));
    } finally {
      setLoading(false);
    }
  }, [toastError, t]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  const requestDecision = (approval: OfferApprovalRow, decision: 'Approve' | 'Reject') => {
    const isApproval = decision === 'Approve';
    setConfirmDialog({
      isOpen: true,
      title: isApproval
        ? t('offerInbox.approveTitle', { code: approval.offerCode })
        : t('offerInbox.rejectTitle', { code: approval.offerCode }),
      description: isApproval
        ? t('offerInbox.approveDescription', {
            candidate: approval.candidateName,
            version: approval.versionNumber,
          })
        : t('offerInbox.rejectDescription', { candidate: approval.candidateName }),
      confirmLabel: isApproval ? t('offerInbox.approveConfirm') : t('offerInbox.rejectConfirm'),
      tone: isApproval ? 'success' : 'danger',
      icon: isApproval ? 'check-circle' : 'alert-triangle',
      withComment: true,
      commentPlaceholder: isApproval
        ? t('offerInbox.approveCommentPlaceholder')
        : t('offerInbox.rejectCommentPlaceholder'),
      action: async (comment?: string) => {
        setBusyId(approval.id);
        setError(null);
        try {
          await postApi(`/offers/approvals/${approval.id}/decide`, {
            decision,
            comment: comment?.trim() || '',
          });
          toastSuccess(
            isApproval ? t('offerInbox.toastApprovedTitle') : t('offerInbox.toastRejectedTitle'),
            t('offerInbox.toastDecisionDetail', { code: approval.offerCode, decision }),
          );
          await fetchApprovals();
        } catch (err: unknown) {
          const message = getErrorMessage(err, t('offerInbox.decisionErrorFallback'));
          setError(message);
          toastError(err, t('offerInbox.decisionErrorToast'));
        } finally {
          setBusyId(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  return (
    <PageFrame
      eyebrow="Hiring Operations"
      title="Offer Approval Inbox"
      description="Review compensation packages, salary bands, and immutable offer versions requiring your role authorization."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void fetchApprovals()}>
          <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && <Alert tone="danger" title={t('offerInbox.loadErrorTitle')}>{error}</Alert>}

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border/90 bg-white shadow-xs">
        <SectionHeader
          title="Pending offer approvals"
          description="Review package details and authorize offer distribution."
          density="compact"
          className="border-b border-rf-border-subtle p-4 sm:p-5"
          actions={<Badge variant={approvals.length > 0 ? 'warning' : 'neutral'}>{approvals.length} pending</Badge>}
        />

        {loading ? (
          <TableSkeleton columns={6} rows={5} />
        ) : approvals.length === 0 ? (
          <PageState kind="empty" title="Your offer inbox is clear" description="No offers are currently awaiting your approval." />
        ) : (
          <ResponsiveDataView
            rows={approvals}
            columns={offerApprovalColumns}
            rowKey={(approval) => approval.id}
            label="Pending offer approvals"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(approval) => (
              <>
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/offers/${approval.offerId}`}>Review</Link>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busyId === approval.id}
                  onClick={() => requestDecision(approval, 'Reject')}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={busyId === approval.id}
                  loadingLabel="Approving"
                  onClick={() => requestDecision(approval, 'Approve')}
                >
                  Approve
                </Button>
              </>
            )}
          />
        )}
      </section>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(initialConfirmState)}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        icon={confirmDialog.icon}
        withComment={confirmDialog.withComment}
        commentPlaceholder={confirmDialog.commentPlaceholder}
        isLoading={busyId !== null}
      />
    </PageFrame>
  );
}
