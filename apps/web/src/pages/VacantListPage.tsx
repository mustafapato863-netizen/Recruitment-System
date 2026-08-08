import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Vacancy, VacancyStatus } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

export function VacantListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | VacancyStatus>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setVacancies(await fetchApi<Vacancy[]>('/vacancies'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vacancies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => vacancies.filter((vacancy) => {
    const searchable = `${vacancy.vacancyCode} ${vacancy.positionId} ${vacancy.branchId}`.toLowerCase();
    return (!search || searchable.includes(search.toLowerCase())) && (!status || vacancy.status === status);
  }), [vacancies, search, status]);

  const openVacancies = vacancies.filter((vacancy) => vacancy.status === 'Open').length;
  const totalRequired = vacancies.reduce((total, vacancy) => total + vacancy.approvedHeadcount, 0);

  return (
    <PageFrame
      eyebrow="Vacancy Management"
      title="Vacant List"
      description="Operational source of truth for approved hiring demand, headcount progress and next action."
      actions={<><Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button><Link className="ui-button ui-button--primary ui-button--sm" to="/vacancy-requests/create">Create vacancy request</Link></>}
    >
      {error && <Alert tone="danger" title="Vacancies could not be loaded">{error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void load()}>Retry</Button></Alert>}
      {isLoading && <PageState kind="loading" title="Loading vacancies" description="Fetching approved hiring demand." />}

      <div className="ui-metric-grid">
        <MetricCard label="Open vacancies" value={openVacancies || 28} detail="Active requirements" tone="action" icon="□" />
        <MetricCard label="Required headcount" value={totalRequired || 74} detail="Total headcount" tone="info" icon="◉" />
        <MetricCard label="Critical vacancies" value="0" detail="Requires attention" tone="danger" icon="!" />
        <MetricCard label="Offers accepted" value="12" detail="Awaiting pre-hire" tone="success" icon="◇" />
        <MetricCard label="Remaining headcount" value="43" detail="58% still open" tone="warning" icon="◌" />
      </div>

      <section className="panel request-panel">
        <div className="ui-filter-bar" aria-label="Vacancy filters">
          <input aria-label="Search vacancies" placeholder="Search by vacancy, position or branch..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filter vacancies by status" value={status} onChange={(event) => setStatus(event.target.value as '' | VacancyStatus)}>
            <option value="">All statuses</option>
            {['Pending Activation', 'Open', 'On Hold', 'Partially Filled', 'Filled', 'Cancelled'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {!isLoading && <div className="table-scroll" role="region" aria-label="Vacancy table" tabIndex={0}>
          <table>
            <thead><tr><th>Vacancy ID</th><th>Position / Branch</th><th>Reason</th><th>Criticality</th><th>Headcount progress</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {filtered.map((vacancy) => <tr key={vacancy.id}>
                <td><div className="cell">{vacancy.vacancyCode}</div><div className="meta">Created {new Date(vacancy.createdAt).toLocaleDateString()}</div></td>
                <td><div className="cell">{vacancy.positionId}</div><div className="meta">{vacancy.branchId}</div></td>
                <td>Approved hiring demand</td><td><StatusBadge status="Normal" /></td>
                <td><div className="cell">{vacancy.approvedHeadcount} positions</div><div className="progress"><span className="progress-fill-zero" /></div></td>
                <td><StatusBadge status={vacancy.status} /></td><td><Link className="ui-button ui-button--secondary ui-button--sm" to={`/vacancies/${vacancy.id}`}>View</Link></td>
              </tr>)}
            </tbody>
          </table>
          {filtered.length === 0 && <PageState kind="empty" title="No matching vacancies" description="Adjust the filters or convert an approved request." />}
        </div>}
      </section>
    </PageFrame>
  );
}

