import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VacancyRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

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
    <div className="approval-inbox-page">
      <div className="page-heading"><div><span className="eyebrow">Vacancy Management</span><h1>Approval Inbox</h1><p>Review and action pending vacancy requests assigned to your role.</p></div><button className="quiet-button" type="button" onClick={() => void load()}>Refresh</button></div>

      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        <div className="metric-card"><span>Assigned to Me</span><strong>{requests.length}</strong><small>Current pending steps</small></div>
        <div className="metric-card"><span>Current Step</span><strong>{requests.filter((request) => currentApproval(request)?.step === 1).length}</strong><small>First-level reviews</small></div>
        <div className="metric-card"><span>Escalated Step</span><strong>{requests.filter((request) => (currentApproval(request)?.step || 0) > 1).length}</strong><small>Follow-up approvals</small></div>
        <div className="metric-card"><span>Data Status</span><strong>{isLoading ? '...' : 'Live'}</strong><small>Loaded from API</small></div>
      </div>

      <div className="panel request-panel">
        <div className="panel-heading"><div><strong>Assigned to Me</strong><small>Only requests matching your server-authorized role are shown.</small></div></div>
        {isLoading ? <div className="alert loading-alert" role="status">Loading approval inbox...</div> : requests.length === 0 ? (
          <div className="empty-state"><strong>Your inbox is clear</strong><span>No pending vacancy request is assigned to your current role.</span></div>
        ) : (
          <div className="request-table" role="region" aria-label="Approval requests" tabIndex={0}>
            <div className="request-row request-header"><span>Request</span><span>Current step</span><span>Status</span><span>Action</span></div>
            {requests.map((request) => {
              const approval = currentApproval(request);
              return <div className="request-row" key={request.id}>
                <div><strong>{request.requestCode}</strong><small>Headcount: {request.requestedHeadcount}</small></div>
                <div><strong>{approval?.roleCode || 'Pending'}</strong><small>Revision {request.approvalRevision}, step {approval?.step || '-'}</small></div>
                <div><StatusBadge status={request.status} /></div>
                <div className="inline-actions"><Link className="small-button" to={`/vacancy-requests/${request.id}`}>Review</Link><button className="small-button success-button" disabled={busyId !== null} type="button" onClick={() => void approve(request)}>{busyId === request.id ? 'Approving...' : 'Approve'}</button></div>
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
