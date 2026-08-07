import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VacancyRequest, VacancyRequestStatus } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';

export function VacancyRequestsPage() {
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | VacancyRequestStatus>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setRequests(await fetchApi<VacancyRequest[]>('/vacancy-requests'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vacancy requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => requests.filter((request) => {
    const searchable = `${request.requestCode} ${request.positionId} ${request.branchId}`.toLowerCase();
    return (!search || searchable.includes(search.toLowerCase())) && (!status || request.status === status);
  }), [requests, search, status]);

  const count = (value: VacancyRequestStatus) => requests.filter((request) => request.status === value).length;

  return (
    <div className="vacancy-requests-page">
      <div className="page-heading"><div><span className="eyebrow">Vacancy Management</span><h1>Vacancy Requests</h1><p>Manage and track the approval workflow for new headcount requests.</p></div><Link className="primary-button" to="/vacancy-requests/create">Create Vacancy Request</Link></div>
      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

      <div className="metric-grid request-metrics" style={{ marginBottom: '20px' }}>
        <div className="metric-card"><span>All Requests</span><strong>{requests.length}</strong></div>
        <div className="metric-card"><span>Draft</span><strong>{count('Draft')}</strong></div>
        <div className="metric-card"><span>Pending Approval</span><strong>{count('Pending Approval')}</strong></div>
        <div className="metric-card"><span>Changes Requested</span><strong>{count('Changes Requested')}</strong></div>
        <div className="metric-card"><span>Approved</span><strong>{count('Approved')}</strong></div>
      </div>

      <div className="panel request-panel">
        <div className="panel-heading filter-heading"><div><strong>Request directory</strong><small>{filtered.length} of {requests.length} requests shown</small></div><div className="filter-row"><label className="global-search inline-search"><Icon name="search" size={15} /><input aria-label="Search vacancy requests" placeholder="Search by request or position..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter request status" className="quiet-button" value={status} onChange={(event) => setStatus(event.target.value as '' | VacancyRequestStatus)}><option value="">All statuses</option>{['Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Rejected', 'Cancelled', 'Converted to Vacancy'].map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="quiet-button" type="button" onClick={() => void load()}>Refresh</button></div></div>
        {isLoading ? <div className="alert loading-alert" role="status">Loading vacancy requests...</div> : filtered.length === 0 ? <div className="empty-state"><strong>No matching requests</strong><span>Adjust the filters or create a new vacancy request.</span><Link className="primary-button" to="/vacancy-requests/create">Create request</Link></div> : <div className="request-table" role="region" aria-label="Vacancy requests" tabIndex={0}><div className="request-row request-header request-directory-row"><span>Request ID</span><span>Position / Branch</span><span>Headcount</span><span>Updated</span><span>Status</span><span>Actions</span></div>{filtered.map((request) => <div className="request-row request-directory-row" key={request.id}><div><strong>{request.requestCode}</strong><small>Revision {request.approvalRevision}</small></div><div><strong>{request.positionId}</strong><small>{request.branchId}</small></div><div><strong>{request.requestedHeadcount}</strong><small>{request.employmentType || 'Not set'}</small></div><div><strong>{new Date(request.updatedAt).toLocaleDateString()}</strong><small>{request.targetStartDate || 'No target date'}</small></div><div><StatusBadge status={request.status} /></div><div><Link className="small-button" to={`/vacancy-requests/${request.id}`}>View</Link></div></div>)}</div>}
      </div>
    </div>
  );
}
