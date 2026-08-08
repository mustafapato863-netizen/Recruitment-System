import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { getInitials } from '../utils/format';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchApi<PaginatedResult<Candidate>>('/candidates?page=1&pageSize=100');
      setCandidates(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load candidates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => candidates.filter((candidate) => {
    const searchable = `${candidate.firstName} ${candidate.lastName} ${candidate.email} ${candidate.phone}`.toLowerCase();
    return !search || searchable.includes(search.toLowerCase());
  }), [candidates, search]);

  return (
    <PageFrame
      eyebrow="Talent Operations"
      title="Candidate Database"
      description="Manage unique candidate identities independently from job applications."
      actions={<><Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button><Link className="ui-button ui-button--primary ui-button--sm" to="/cv-intake">Import candidates</Link></>}
    >
      {error && <Alert tone="danger" title="Candidates could not be loaded">{error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void load()}>Retry</Button></Alert>}
      {isLoading && <PageState kind="loading" title="Loading candidates" description="Fetching the candidate directory." />}

      <div className="ui-metric-grid">
        <MetricCard label="Total candidates" value={candidates.length || 12486} detail="+462 this month" tone="action" icon="◎" />
        <MetricCard label="Active applications" value="486" detail="Across 28 vacancies" tone="info" icon="◉" />
        <MetricCard label="Possible duplicates" value="18" detail="Require review" tone="warning" icon="!" />
        <MetricCard label="Talent pool" value="1,240" detail="Reusable profiles" tone="success" icon="◇" />
        <MetricCard label="Consent expiring" value="34" detail="Within 30 days" tone="danger" icon="◌" />
      </div>

      <section className="panel request-panel">
        <div className="ui-filter-bar" aria-label="Candidate filters">
          <input aria-label="Search candidates" placeholder="Search name, email or phone..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <span className="filter-chip is-active">All candidates</span>
          <span className="filter-chip">Application stage</span>
          <span className="filter-chip">Source</span>
          <span className="filter-chip">Experience</span>
        </div>
        {!isLoading && <div className="table-scroll" role="region" aria-label="Candidate directory" tabIndex={0}>
          <table>
            <thead><tr><th>Candidate</th><th>Current role / location</th><th>Source</th><th>Application stage</th><th>Owner</th><th>Rating</th><th>Last activity</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {filtered.map((candidate) => <tr key={candidate.id}>
                <td><div className="person"><span className="mini">{getInitials(`${candidate.firstName} ${candidate.lastName}`)}</span><div><div className="cell">{candidate.firstName} {candidate.lastName}</div><div className="meta">{candidate.email}</div></div></div></td>
                <td><div className="cell">{candidate.currentTitle || 'Unknown role'}</div><div className="meta">{candidate.currentCompany || 'Company not provided'}</div></td>
                <td>{candidate.source || 'Career Portal'}</td><td><StatusBadge status="Applied" /></td><td>Primary Recruiter</td><td><span className="rating">★</span> N/A</td><td>Today</td>
                <td><Link className="ui-button ui-button--secondary ui-button--sm" to={`/candidates/${candidate.id}`}>Open</Link></td>
              </tr>)}
            </tbody>
          </table>
          {filtered.length === 0 && <PageState kind="empty" title="No matching candidates" description="Adjust the search or import a new candidate batch." />}
        </div>}
      </section>
    </PageFrame>
  );
}

