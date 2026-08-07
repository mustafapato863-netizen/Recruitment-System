import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Application, PaginatedResult } from '@recruitflow/contracts';

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (stageFilter) params.set('stage', stageFilter);
      if (search) params.set('search', search);

      const res = await getApi<PaginatedResult<Application>>(`/applications?${params.toString()}`);
      setApplications(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [stageFilter, search]);

  const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined', 'Rejected', 'Withdrawn'];

  return (
    <div className="applications-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Recruitment & Funnel</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>Applications Pipeline</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Track candidate progress across funnel stages and assignments</p>
        </div>
      </div>

      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Total Applications</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px' }}>{total}</strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>In Screening / Interview</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#2563eb' }}>
            {applications.filter(a => a.stage === 'Screening' || a.stage === 'Interview').length}
          </strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Offers & Pre-Hire</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#7c3aed' }}>
            {applications.filter(a => a.stage === 'Offer' || a.stage === 'Pre-Hire').length}
          </strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Joined</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#16a34a' }}>
            {applications.filter(a => a.stage === 'Joined').length}
          </strong>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div className="toolbar" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by application code or candidate name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
            {error} <button onClick={fetchApplications} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Loading pipeline applications...</div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No applications found matching filters.</div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: '10px' }}>App Code</th>
                <th style={{ padding: '10px' }}>Candidate Name</th>
                <th style={{ padding: '10px' }}>Vacancy / Position</th>
                <th style={{ padding: '10px' }}>Current Stage</th>
                <th style={{ padding: '10px' }}>Primary Recruiter</th>
                <th style={{ padding: '10px' }}>Task Owner</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{app.applicationCode}</td>
                  <td style={{ padding: '12px 10px' }}>
                    {app.candidate ? (
                      <Link to={`/candidates/${app.candidate.id}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                        {app.candidate.firstName} {app.candidate.lastName}
                      </Link>
                    ) : '—'}
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{app.candidate?.email}</div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <strong>{app.positionTitle || app.vacancyCode}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Vacancy: {app.vacancyCode}</div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '11px' }}>
                      {app.stage}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{app.primaryRecruiterName || 'Unassigned'}</td>
                  <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{app.taskOwnerName || 'Unassigned'}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <Link to={`/applications/${app.id}`} style={{ padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', textDecoration: 'none' }}>
                      Manage Stage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
