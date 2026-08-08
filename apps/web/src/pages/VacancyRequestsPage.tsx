import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VacancyRequest, VacancyRequestStatus } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

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
    <PageFrame
      eyebrow="Vacancy Management"
      title="Vacancy Requests"
      description="Create, review and track workforce requests before they become active vacancies."
      actions={<><Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button><Link className="ui-button ui-button--primary ui-button--sm" to="/vacancy-requests/create">Create vacancy request</Link></>}
    >
      {error && <Alert tone="danger" title="Vacancy requests could not be loaded">{error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void load()}>Retry</Button></Alert>}
      {isLoading && <PageState kind="loading" title="Loading vacancy requests" description="Fetching the latest workforce demand." />}

      <div className="ui-metric-grid">
        <MetricCard label="All requests" value={requests.length} detail="Total requests" tone="action" icon="□" />
        <MetricCard label="Draft" value={count('Draft')} detail="Owned by your team" tone="neutral" icon="✎" />
        <MetricCard label="Pending approval" value={count('Pending Approval')} detail="Waiting for decision" tone="warning" icon="◉" />
        <MetricCard label="Changes requested" value={count('Changes Requested')} detail="Action required" tone="danger" icon="!" />
        <MetricCard label="Approved" value={count('Approved')} detail="Converted to vacancies" tone="success" icon="✓" />
      </div>

      <section className="panel request-panel">
        <div className="ui-filter-bar" aria-label="Vacancy request filters">
          <input aria-label="Search vacancy requests" placeholder="Search by request, position or branch..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filter vacancy requests by status" value={status} onChange={(event) => setStatus(event.target.value as '' | VacancyRequestStatus)}>
            <option value="">All statuses</option>
            {['Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Rejected', 'Cancelled', 'Converted to Vacancy'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {!isLoading && <div className="table-scroll" role="region" aria-label="Vacancy requests table" tabIndex={0}>
          <table>
            <thead><tr><th>Request ID</th><th>Position</th><th>Department</th><th>Branch</th><th>Headcount</th><th>Request Type</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {filtered.map((request) => <tr key={request.id}>
                <td><div className="cell">{request.requestCode}</div><div className="meta">Updated {new Date(request.updatedAt).toLocaleDateString()}</div></td>
                <td>{request.positionId}</td><td>{request.reason || 'N/A'}</td><td>{request.branchId}</td><td>{request.requestedHeadcount}</td><td>{request.employmentType || 'Full-time'}</td>
                <td><StatusBadge status={request.status} /></td>
                <td><Link className="ui-button ui-button--secondary ui-button--sm" to={`/vacancy-requests/${request.id}`}>View</Link></td>
              </tr>)}
            </tbody>
          </table>
          {filtered.length === 0 && <PageState kind="empty" title="No matching requests" description="Adjust the filters or create a new vacancy request." />}
        </div>}
      </section>
    </PageFrame>
  );
}

