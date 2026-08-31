import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getApi, patchApi, postApi } from '../api/client';
import type { Offer, OfferStatus, HiringCase } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { DataTable, dataTableClasses } from '../components/ui/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './PageEnhancementsV2.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'success' | 'danger' | 'warning';
  icon?: IconName;
  action: () => Promise<void>;
}

const initialConfirmState: ConfirmState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  tone: 'primary',
  action: async () => {},
};

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [hiringCase, setHiringCase] = useState<HiringCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  useEffect(() => {
    void fetchOffer();
  }, [id]);

  async function fetchOffer() {
    try {
      setLoading(true);
      setError(null);
      const data = await getApi<Offer>(`/offers/${id}`);
      setOffer(data);

      if (data.status === 'Accepted') {
        try {
          const cases = await getApi<HiringCase[]>('/hiring');
          const found = cases.find((c) => (c as { offerId?: string }).offerId === id || c.candidateName === data.candidateName);
          if (found) setHiringCase(found);
        } catch {
          // Non-blocking
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function triggerStatusChange(newStatus: OfferStatus) {
    const isAccepted = newStatus === 'Accepted';
    const isDeclined = newStatus === 'Declined';
    setConfirmDialog({
      isOpen: true,
      title: `Update Offer Status to ${newStatus}`,
      description: isAccepted
        ? `Confirming candidate acceptance will enable creating a Pre-Hire onboarding case and initiating compliance gates.`
        : isDeclined
        ? `Marking this offer as declined will record candidate feedback and allow drafting an alternative package or closing the application.`
        : `Marking this offer package as Sent to Candidate.`,
      confirmLabel: `Mark as ${newStatus}`,
      tone: isAccepted ? 'success' : isDeclined ? 'danger' : 'primary',
      icon: isAccepted ? 'check-circle' : isDeclined ? 'alert-triangle' : 'send',
      action: async () => {
        setBusyAction(newStatus);
        try {
          await patchApi(`/offers/${id}/status`, { status: newStatus });
          await fetchOffer();
        } catch (err: unknown) {
          setError(`Failed to update status: ${getErrorMessage(err)}`);
        } finally {
          setBusyAction(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  }

  async function handleCreateHiringCase() {
    if (!offer) return;
    setBusyAction('create-case');
    try {
      const created = await postApi<HiringCase>('/hiring', { offerId: offer.id });
      navigate(`/hires/${created.id}`);
    } catch (err: unknown) {
      setError(`Failed to create hiring case: ${getErrorMessage(err)}`);
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <PageFrame eyebrow="Offers" title="Offer Package Details" description="Loading offer details...">
        <PageState kind="loading" title="Loading offer details" description="Fetching compensation components and approval history." />
      </PageFrame>
    );
  }

  if (error || !offer) {
    const isForbidden = error?.toLowerCase().includes('denied') || error?.toLowerCase().includes('permission') || error?.includes('403');
    return (
      <PageFrame eyebrow="Offers" title="Offer Package Details" description="Offer package detail.">
        {isForbidden ? (
          <PageState
            kind="forbidden"
            title="Access Restricted"
            description="You do not have the required permissions to view this offer."
            actionLabel="Back to Offers"
            onAction={() => navigate('/offers')}
          />
        ) : (
          <PageState
            kind="not-found"
            title="Offer Not Found"
            description="The requested offer record does not exist or has been removed."
            actionLabel="Back to Offers"
            onAction={() => navigate('/offers')}
          />
        )}
      </PageFrame>
    );
  }

  const currentVersion = offer.currentVersion;

  return (
    <PageFrame
      eyebrow={`Offers / ${offer.offerCode}`}
      title={`${offer.candidateName || 'Candidate not reported'} — ${offer.positionTitle || 'Position not reported'}`}
      description={`Version ${currentVersion?.versionNumber ?? '—'} · Status: ${offer.status}`}
      actions={
        <>
          <StatusBadge status={offer.status} />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/offers">
              <Icon name="arrow-left" size={13} />
              Back to offers
            </Link>
          </Button>

          {(offer.status === 'Draft' || currentVersion?.approvalStatus === 'Rejected') && (
            <Button variant="primary" size="sm" asChild>
              <Link to={`/offers/create?applicationId=${offer.applicationId}&revision=true&offerId=${offer.id}`}>
                <Icon name="edit" size={13} />
                Edit Revision
              </Link>
            </Button>
          )}

          {offer.status === 'Approved' && (
            <Button
              variant="primary"
              size="sm"
              loading={busyAction === 'Sent'}
              loadingLabel="Sending"
              onClick={() => triggerStatusChange('Sent')}
            >
              <Icon name="mail" size={13} />
              Mark as Sent to Candidate
            </Button>
          )}

          {offer.status === 'Sent' && (
            <>
              <Button
                variant="danger"
                size="sm"
                loading={busyAction === 'Declined'}
                loadingLabel="Updating"
                onClick={() => triggerStatusChange('Declined')}
              >
                Declined
              </Button>
              <Button
                variant="success"
                size="sm"
                loading={busyAction === 'Accepted'}
                loadingLabel="Updating"
                onClick={() => triggerStatusChange('Accepted')}
              >
                <Icon name="check-circle" size={13} />
                Accepted
              </Button>
            </>
          )}

          {offer.status === 'Accepted' && (
            hiringCase ? (
              <Button variant="primary" size="sm" asChild>
                <Link to={`/hires/${hiringCase.id}`}>
                  <Icon name="check-circle" size={14} />
                  Open Pre-Hire Case
                </Link>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={busyAction === 'create-case'}
                loadingLabel="Initiating"
                onClick={() => void handleCreateHiringCase()}
              >
                <Icon name="plus" size={14} />
                Initiate Pre-Hire Case
              </Button>
            )
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border bg-white shadow-xs">
            <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-rf-ink m-0">
                  Compensation Breakdown{currentVersion?.versionNumber != null ? ` (Version ${currentVersion.versionNumber})` : ''}
                </h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Approved remuneration schedule.</p>
              </div>
              {currentVersion?.isLocked && (
                <span className="px-2.5 py-0.5 rounded-full bg-rf-surface-subtle text-rf-ink text-[11px] font-bold border border-rf-border">
                  Locked Version
                </span>
              )}
            </div>
            <DataTable role="region" aria-label="Compensation breakdown table" tabIndex={0} className="rounded-none border-0 shadow-none">
              <thead className={dataTableClasses.head}>
                <tr>
                  <th className={dataTableClasses.th}>Component Name</th>
                  <th className={dataTableClasses.th}>Type</th>
                  <th className={dataTableClasses.th}>Frequency</th>
                  <th className={[dataTableClasses.th, 'text-right'].join(' ')}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(!currentVersion?.components || currentVersion.components.length === 0) ? (
                  <tr>
                    <td colSpan={4}>
                      <PageState kind="empty" title="No compensation components" description="Edit this revision to add components." />
                    </td>
                  </tr>
                ) : (
                  currentVersion.components.map((comp) => (
                    <tr className={dataTableClasses.row} key={comp.id}>
                      <td className={dataTableClasses.td}>
                        <div className={dataTableClasses.primary}>{comp.name}</div>
                      </td>
                      <td className={dataTableClasses.td}>
                        <span className="font-mono text-[10.5px] font-bold text-rf-ink bg-rf-surface-subtle px-2 py-0.5 rounded-md">
                          {comp.type}
                        </span>
                      </td>
                      <td className={dataTableClasses.td}><span className="text-rf-ink-muted font-medium text-xs">{comp.frequency || '—'}</span></td>
                      <td className={[dataTableClasses.td, 'text-right'].join(' ')}>
                        <span className="font-bold text-xs text-rf-ink tabular-nums">
                          {comp.amount == null ? '—' : `${comp.currency || ''} ${comp.amount.toLocaleString()}`.trim()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </section>

          <section className="rf-panel rf-detail-hero rounded-2xl border border-rf-border bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Contract Terms & Conditions</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Standard employment logistics.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Contract Type</span>
                <strong className="text-rf-ink font-bold">{currentVersion?.contractType || '—'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Probation Period</span>
                <strong className="text-rf-ink font-bold">{currentVersion?.probationPeriod || '—'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Work Location</span>
                <strong className="text-rf-ink font-bold">{currentVersion?.workLocation || '—'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Joining Date</span>
                <strong className="text-rf-ink font-bold">
                  {currentVersion?.proposedJoiningDate
                    ? new Date(currentVersion.proposedJoiningDate).toLocaleDateString()
                    : 'Pending Candidate Acceptance'}
                </strong>
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rf-panel rounded-2xl border border-rf-border bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Approval & Version History</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Sign-off records.</p>
            </div>
            <div className="flex flex-col gap-3 relative pl-4 border-l-2 border-rf-border-subtle">
              {currentVersion?.approvals && currentVersion.approvals.length > 0 ? (
                currentVersion.approvals.map((app) => (
                  <div key={app.id} className="relative">
                    <div className={['w-2 h-2 rounded-full absolute -left-[21px] top-1.5', app.status === 'Approved' ? 'bg-emerald-600' : 'bg-amber-500'].join(' ')} />
                    <strong className="text-xs font-bold text-rf-ink block">{app.roleCode} — {app.status}</strong>
                    <small className="text-[11px] text-rf-ink-muted font-medium">
                      {app.approverName || 'Approver'} · {app.decidedAt ? new Date(app.decidedAt).toLocaleString() : 'Pending'}
                    </small>
                  </div>
                ))
              ) : (
                <div className="text-rf-ink-muted text-xs">No approval history.</div>
              )}
            </div>
          </section>

          {offer.status === 'Accepted' && (
            <Alert tone="success" title="Candidate Accepted">
              This candidate accepted the offer. Proceed to Hire Management to verify compliance and background checks.
            </Alert>
          )}
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(initialConfirmState)}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        icon={confirmDialog.icon}
        isLoading={busyAction !== null}
      />
    </PageFrame>
  );
}
