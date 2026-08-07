import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { VacancyRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export function VacancyRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<VacancyRequest | null>(null);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      setRequest(await fetchApi<VacancyRequest>(`/vacancy-requests/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this vacancy request');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const runAction = async (action: 'approve' | 'request-changes' | 'reject' | 'cancel') => {
    if (!request || !id) return;
    if (action !== 'approve' && !globalThis.confirm(`Are you sure you want to ${action.replace('-', ' ')} this request?`)) return;
    setBusyAction(action);
    setError('');
    setFeedback('');
    try {
      await fetchApi(`/vacancy-requests/${id}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? undefined : JSON.stringify({ comment: comment || undefined }),
      });
      setComment('');
      setFeedback('Request updated successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update this request');
    } finally {
      setBusyAction(null);
    }
  };

  if (isLoading) return <div className="alert loading-alert" role="status">Loading request...</div>;
  if (error && !request) return <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>;
  if (!request) return null;

  const canDecide = request.status === 'Pending Approval';
  const canCancel = request.status === 'Draft' || request.status === 'Pending Approval';

  return (
    <div className="request-detail-page">
      <div className="page-heading">
        <div><span className="eyebrow">Vacancy Requests / {request.requestCode}</span><h1>{request.requestCode}</h1><p>Created {new Date(request.createdAt).toLocaleString()} · Last updated {new Date(request.updatedAt).toLocaleString()}</p></div>
        <div className="inline-actions"><StatusBadge status={request.status} /><button className="quiet-button" type="button" onClick={() => navigate('/vacancy-requests')}>Back to requests</button>{canCancel && <button className="quiet-button danger-button" type="button" onClick={() => void runAction('cancel')}>Cancel request</button>}</div>
      </div>

      {error && <div className="alert error-alert" role="alert">{error}</div>}
      {feedback && <div className="alert success-alert" role="status">{feedback}</div>}

      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        <div className="metric-card"><span>Headcount</span><strong>{request.requestedHeadcount}</strong><small>Requested positions</small></div>
        <div className="metric-card"><span>Budget Status</span><strong>{request.budgetStatus || 'Not set'}</strong></div>
        <div className="metric-card"><span>Criticality</span><strong>{request.criticality || 'Normal'}</strong></div>
        <div className="metric-card"><span>Target Date</span><strong>{request.targetStartDate || 'Not set'}</strong></div>
      </div>

      <div className="dashboard-grid">
        <div>
          <div className="panel detail-panel"><h2>Request Summary</h2><dl className="detail-grid"><div><dt>Legal entity</dt><dd>{request.legalEntityId || 'Not selected'}</dd></div><div><dt>Branch</dt><dd>{request.branchId}</dd></div><div><dt>Position</dt><dd>{request.positionId}</dd></div><div><dt>Employment type</dt><dd>{request.employmentType || 'Not set'}</dd></div><div><dt>Reason</dt><dd>{request.reason || 'Not provided'}</dd></div><div><dt>Requester</dt><dd>{request.requesterId}</dd></div></dl><h3>Justification</h3><p className="detail-copy">{request.justification || 'No justification provided.'}</p></div>
        </div>

        <div className="panel detail-panel"><h2>Approval Timeline</h2><div className="timeline">{request.approvals.length === 0 ? <p className="muted-copy">No approval step has been created yet.</p> : request.approvals.map((approval) => <div className={`timeline-item ${approval.status === 'Pending' ? 'current' : ''}`} key={approval.id}><strong>Step {approval.step} · {approval.roleCode}</strong><span>{approval.status}{approval.decidedAt ? ` · ${new Date(approval.decidedAt).toLocaleString()}` : ''}</span>{approval.comment && <p>{approval.comment}</p>}</div>)}</div>{canDecide && <div className="decision-box"><label htmlFor="decision-comment">Decision comment <textarea id="decision-comment" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add context for the requester (optional)" /></label><div className="decision-actions"><button className="primary-button approve-button" disabled={busyAction !== null} type="button" onClick={() => void runAction('approve')}>{busyAction === 'approve' ? 'Approving...' : 'Approve'}</button><button className="quiet-button" disabled={busyAction !== null} type="button" onClick={() => void runAction('request-changes')}>{busyAction === 'request-changes' ? 'Saving...' : 'Request changes'}</button><button className="quiet-button danger-button" disabled={busyAction !== null} type="button" onClick={() => void runAction('reject')}>{busyAction === 'reject' ? 'Rejecting...' : 'Reject'}</button></div></div>}</div>
      </div>
    </div>
  );
}
