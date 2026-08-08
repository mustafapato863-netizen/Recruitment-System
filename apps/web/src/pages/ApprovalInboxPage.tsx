import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VacancyRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

function currentApproval(request: VacancyRequest) {
  return [...request.approvals].reverse().find((approval) => approval.revision === request.approvalRevision && approval.status === 'Pending');
}

export function ApprovalInboxPage() {
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setRequests(await fetchApi<VacancyRequest[]>('/vacancy-requests/inbox'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the approval inbox');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const approve = async (request: VacancyRequest) => {
    if (!globalThis.confirm(`Approve ${request.requestCode}?`)) return;
    setBusyId(request.id);
    setError('');
    try {
      await fetchApi(`/vacancy-requests/${request.id}/approve`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve this request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageFrame
      className="approval-inbox-page"
      eyebrow="Vacancy Management"
      title="Approval Inbox"
      description="Review and action pending vacancy requests assigned to your role."
      actions={<Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button>}
    >

      {error && <Alert tone="danger" title="Unable to load approval inbox">{error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void load()}>Retry</Button></Alert>}

      <div className="ui-metric-grid">
        <MetricCard label="Assigned to Me" value={requests.length} detail="Current pending steps" tone="action" icon="↗" />
        <MetricCard label="Current Step" value={requests.filter((request) => currentApproval(request)?.step === 1).length} detail="First-level reviews" tone="info" icon="1" />
        <MetricCard label="Escalated Step" value={requests.filter((request) => (currentApproval(request)?.step || 0) > 1).length} detail="Follow-up approvals" tone="warning" icon="2" />
        <MetricCard label="Data Status" value={isLoading ? '…' : 'Live'} detail="Loaded from API" tone="success" icon="✓" />
      </div>

      <div className="panel request-panel">
        <div className="panel-heading"><div><strong>Assigned to Me</strong><small>Only requests matching your server-authorized role are shown.</small></div></div>
        {isLoading ? <PageState kind="loading" title="Loading approval inbox" description="Checking your assigned requests." /> : requests.length === 0 ? (
          <PageState kind="empty" title="Your inbox is clear" description="No pending vacancy request is assigned to your current role." />
        ) : (
          <div className="request-table" role="region" aria-label="Approval requests" tabIndex={0}>
            <div className="request-row request-header"><span>Request</span><span>Current step</span><span>Status</span><span>Action</span></div>
            {requests.map((request) => {
              const approval = currentApproval(request);
              return <div className="request-row" key={request.id}>
                <div><strong>{request.requestCode}</strong><small>Headcount: {request.requestedHeadcount}</small></div>
                <div><strong>{approval?.roleCode || 'Pending'}</strong><small>Revision {request.approvalRevision}, step {approval?.step || '-'}</small></div>
                <div><StatusBadge status={request.status} /></div>
                <div className="inline-actions"><Link className="ui-button ui-button--secondary ui-button--sm" to={`/vacancy-requests/${request.id}`}>Review</Link><Button variant="success" size="sm" loading={busyId === request.id} disabled={busyId !== null && busyId !== request.id} loadingLabel="Approving request" onClick={() => void approve(request)}>Approve</Button></div>
              </div>;
            })}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
