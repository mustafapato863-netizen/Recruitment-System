import { useState, useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getApi } from '../api/client';

type HiringCaseRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  plannedJoiningDate: string | null;
  status: string;
  ownerUserId: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function HireManagementPage() {
  const [cases, setCases] = useState<HiringCaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApi<HiringCaseRow[]>('/hiring')
      .then(setCases)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, []);

  if (error) return <div className="page"><div className="alert error">Failed to load hiring cases: {error}</div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>Hire Management</h1>
          <p className="subtitle">Control pre-hire readiness after offer acceptance through documents, licenses, final approval and joining.</p>
        </div>
        <div className="page-actions">
          <button className="btn">Export</button>
          <button className="btn primary">Create Manual Case</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as CSSProperties}>
          <div className="m-top">
            <span className="m-label">Active Cases</span>
            <span className="m-ico"><Icon name="hire" /></span>
          </div>
          <div className="m-value">{cases.length}</div>
          <div className="m-foot">Loaded from the organization</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#d97706', '--ms': '#fffbeb' } as CSSProperties}>
          <div className="m-top">
            <span className="m-label">Documents Pending</span>
            <span className="m-ico"><Icon name="document" /></span>
          </div>
          <div className="m-value">—</div>
          <div className="m-foot">Document readiness is shown in the case</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#dc2626', '--ms': '#fff1f2' } as CSSProperties}>
          <div className="m-top">
            <span className="m-label">License Pending</span>
            <span className="m-ico"><Icon name="document" /></span>
          </div>
          <div className="m-value">—</div>
          <div className="m-foot">License tracking is not modeled yet</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#2563eb', '--ms': '#eff6ff' } as CSSProperties}>
          <div className="m-top">
            <span className="m-label">Final Approval</span>
            <span className="m-ico"><Icon name="inbox" /></span>
          </div>
          <div className="m-value">{cases.filter((item) => item.status === 'Pending Final Approval').length}</div>
          <div className="m-foot">Backed by the final approval queue</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#16a34a', '--ms': '#ecfdf3' } as CSSProperties}>
          <div className="m-top">
            <span className="m-label">Awaiting Joining</span>
            <span className="m-ico"><Icon name="user-check" /></span>
          </div>
          <div className="m-value">{cases.filter((item) => item.status === 'Awaiting Joining').length}</div>
          <div className="m-foot">Awaiting joining confirmation</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input type="text" placeholder="Search records..." />
          </div>
          <button className="filter-btn active">All Hiring Status <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">Branch <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">Owner <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">More Filters</button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Candidate</th>
                <th>Vacancy</th>
                <th>Branch</th>
                <th>Joining</th>
                <th>Documents</th>
                <th>License</th>
                <th>Status</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>Loading cases...</td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>No active cases found.</td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.id}</strong></td>
                    <td>
                      <div className="person-cell">
                        <span className="avatar-sm">{c.candidateName.substring(0, 2).toUpperCase()}</span>
                        <div>
                          <div className="fw-500">{c.candidateName}</div>
                          <div className="text-xs text-muted">Accepted offer</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.positionTitle}</td>
                    <td>{c.branchName}</td>
                    <td>{c.plannedJoiningDate ? new Date(c.plannedJoiningDate).toLocaleDateString() : '—'}</td>
                    <td><span className="badge badge-neutral">Open case</span></td>
                    <td><span className="badge badge-neutral">Not tracked</span></td>
                    <td><span className="badge badge-blue">{c.status}</span></td>
                    <td>{c.ownerUserId || 'Unassigned'}</td>
                    <td>
                      <Link to={`/hires/${c.id}`} className="btn btn-sm">Open</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
