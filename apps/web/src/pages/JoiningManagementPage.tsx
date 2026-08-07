import { useState, useEffect, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { getApi } from '../api/client';

type JoiningRow = {
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

export function JoiningManagementPage() {
  const [items, setItems] = useState<JoiningRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApi<JoiningRow[]>('/hiring')
      .then(setItems)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, []);

  if (error) return <div className="page"><div className="alert error">Failed to load joining cases: {error}</div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>Joining Management</h1>
          <p className="subtitle">Confirm attendance, postpone, record no-show and close vacancy headcount accurately.</p>
        </div>
        <div className="page-actions">
          <button className="btn">Export</button>
          <button className="btn primary">Confirm Joining</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Awaiting Joining</span><span className="m-ico"><Icon name="user-check" size={16} /></span></div>
          <div className="m-value">{items.filter((item) => item.status === 'Awaiting Joining').length}</div>
          <div className="m-foot">Awaiting confirmation</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#2563eb', '--ms': '#eff6ff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Joining This Week</span><span className="m-ico"><Icon name="clock" size={16} /></span></div>
          <div className="m-value">{new Set(items.map((item) => item.branchName)).size}</div>
          <div className="m-foot">Branches in the current queue</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#16a34a', '--ms': '#ecfdf3' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Joined This Month</span><span className="m-ico"><Icon name="check" size={16} /></span></div>
          <div className="m-value">{items.filter((item) => item.status === 'Joined').length}</div>
          <div className="m-foot">Joined cases in the current data</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#d97706', '--ms': '#fffbeb' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Postponed</span><span className="m-ico"><Icon name="calendar" size={16} /></span></div>
          <div className="m-value">{items.filter((item) => item.status === 'Postponed').length}</div>
          <div className="m-foot">Postponed cases</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#dc2626', '--ms': '#fff1f2' } as CSSProperties}>
          <div className="m-top"><span className="m-label">No-show</span><span className="m-ico"><Icon name="close" size={16} /></span></div>
          <div className="m-value">{items.filter((item) => item.status === 'No-show').length}</div>
          <div className="m-foot">No-show cases</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input type="text" placeholder="Search records..." />
          </div>
          <button className="filter-btn active">Joining Status <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">Date Range <Icon name="chevron-down" size={14} /></button>
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
                <th>Position</th>
                <th>Branch</th>
                <th>Planned Date</th>
                <th>Status</th>
                <th>Employee Code</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>Loading joining records...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>No records found.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="fw-500">{item.id}</td>
                    <td>{item.candidateName}</td>
                    <td>{item.positionTitle}</td>
                    <td>{item.branchName}</td>
                    <td>{item.plannedJoiningDate ? new Date(item.plannedJoiningDate).toLocaleDateString() : '—'}</td>
                    <td><span className="badge badge-blue">{item.status}</span></td>
                    <td>—</td>
                    <td>{item.ownerUserId || 'Unassigned'}</td>
                    <td><button className="btn btn-sm">Open</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="callout" style={{ margin: '16px' }}>
          <strong>Workflow rule:</strong> Hired/Joined is recorded only after an actual joining date and confirmation. Accepted offers do not consume joined headcount.
        </div>
      </section>
    </div>
  );
}
