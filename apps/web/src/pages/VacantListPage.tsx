import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Vacancy, VacancyStatus } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';

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
  }), [search, status, vacancies]);
  const required = vacancies.reduce((total, vacancy) => total + vacancy.approvedHeadcount, 0);
  const joined = vacancies.reduce((total, vacancy) => total + vacancy.joinedHeadcount, 0);

  return (
    <div className="vacant-list-page">
      <div className="page-heading"><div><span className="eyebrow">Vacancy Management</span><h1>Vacant List</h1><p>Directory of approved and active vacancies.</p></div><button className="quiet-button" type="button" onClick={() => void load()}>Refresh</button></div>
      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

      <div className="metric-grid request-metrics" style={{ marginBottom: '20px' }}><div className="metric-card"><span>Total Vacancies</span><strong>{vacancies.length}</strong></div><div className="metric-card"><span>Required Headcount</span><strong>{required}</strong></div><div className="metric-card"><span>Joined Headcount</span><strong>{joined}</strong></div><div className="metric-card"><span>Remaining</span><strong>{Math.max(required - joined, 0)}</strong></div><div className="metric-card"><span>Open</span><strong>{vacancies.filter((vacancy) => vacancy.status === 'Open').length}</strong></div></div>

      <div className="panel request-panel"><div className="panel-heading filter-heading"><div><strong>Vacancy directory</strong><small>{filtered.length} of {vacancies.length} vacancies shown</small></div><div className="filter-row"><label className="global-search inline-search"><Icon name="search" size={15} /><input aria-label="Search vacancies" placeholder="Search by vacancy or position..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter vacancy status" className="quiet-button" value={status} onChange={(event) => setStatus(event.target.value as '' | VacancyStatus)}><option value="">All statuses</option>{['Pending Activation', 'Open', 'On Hold', 'Partially Filled', 'Filled', 'Cancelled'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>{isLoading ? <div className="alert loading-alert" role="status">Loading vacancies...</div> : filtered.length === 0 ? <div className="empty-state"><strong>No matching vacancies</strong><span>Approved vacancy conversions will appear here.</span></div> : <div className="request-table" role="region" aria-label="Vacancies" tabIndex={0}><div className="request-row request-header vacancy-directory-row"><span>Vacancy ID</span><span>Position / Branch</span><span>Headcount</span><span>Target date</span><span>Status</span><span>Actions</span></div>{filtered.map((vacancy) => <div className="request-row vacancy-directory-row" key={vacancy.id}><div><strong>{vacancy.vacancyCode}</strong><small>Request {vacancy.vacancyRequestId}</small></div><div><strong>{vacancy.positionId}</strong><small>{vacancy.branchId}</small></div><div><strong>{vacancy.joinedHeadcount} / {vacancy.approvedHeadcount}</strong><div aria-label={`${vacancy.joinedHeadcount} of ${vacancy.approvedHeadcount} joined`} className="bar"><i className="bar-purple" style={{ width: `${vacancy.approvedHeadcount ? Math.min((vacancy.joinedHeadcount / vacancy.approvedHeadcount) * 100, 100) : 0}%` }} /></div></div><div>{vacancy.targetStartDate || 'Not set'}</div><div><StatusBadge status={vacancy.status} /></div><div><Link className="small-button" to={`/vacancies/${vacancy.id}`}>View</Link></div></div>)}</div>}</div>
    </div>
  );
}
