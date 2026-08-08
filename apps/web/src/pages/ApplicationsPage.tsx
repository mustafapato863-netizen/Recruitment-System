import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Application, PaginatedResult } from '@recruitflow/contracts';
import { getInitials } from '../utils/format';

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=100');
      setApplications(res.data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined', 'Rejected', 'Withdrawn'];

  const grouped = useMemo(() => {
    const groups: Record<string, Application[]> = {};
    for (const stage of STAGES) groups[stage] = [];
    for (const app of applications) {
      if (groups[app.stage]) {
        groups[app.stage].push(app);
      } else {
        if (!groups['Other']) groups['Other'] = [];
        groups['Other'].push(app);
      }
    }
    return groups;
  }, [applications]);

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>Recruitment Pipeline</h1>
          <div className="sub">Applications move through valid stages with required forms and workflow rules.</div>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={() => void fetchApplications()}>Refresh</button>
          <button className="btn primary" type="button">Add Candidate</button>
        </div>
      </div>

      {error && <div className="alert bad"><div className="aico">!</div><div><b>Error</b><small>{error}</small></div></div>}
      {loading && <div className="alert ok"><div className="aico">...</div><div><b>Loading</b><small>Fetching pipeline</small></div></div>}

      <div className="tabs">
        <div className="tab">Overview</div>
        <div className="tab">Candidates</div>
        <div className="tab active">Pipeline</div>
        <div className="tab">Interviews</div>
        <div className="tab">Offers</div>
        <div className="tab">Hire Management</div>
        <div className="tab">Analytics</div>
        <div className="tab">Activity</div>
      </div>

      <div className="kanban">
        {STAGES.map((stage) => (
          <div className="kcol" key={stage}>
            <div className="kh">
              <span>{stage}</span>
              <span className="count">{grouped[stage]?.length || 0}</span>
            </div>
            {grouped[stage]?.map((app) => (
              <div className="kcard" key={app.id}>
                <div className="person">
                  <span className="mini">{app.candidate ? getInitials(`${app.candidate.firstName} ${app.candidate.lastName}`) : 'U'}</span>
                  <div>
                    <div className="cell">{app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : 'Unknown'}</div>
                    <div className="meta">{app.positionTitle || app.vacancyCode}</div>
                  </div>
                </div>
                <div className="tags">
                  <span className="tag">Portal</span>
                  {app.candidate?.status && <span className="tag">{app.candidate.status}</span>}
                </div>
                <div className="meta" style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                  <Link to={`/applications/${app.id}`} style={{ textDecoration: 'none', color: 'var(--primary)' }}>⋮</Link>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
