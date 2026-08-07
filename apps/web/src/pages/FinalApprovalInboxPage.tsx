import { useState, useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getApi, postApi } from '../api/client';

type FinalApprovalRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  status: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function FinalApprovalInboxPage() {
  const [items, setItems] = useState<FinalApprovalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApi<FinalApprovalRow[]>('/hiring/final-approvals')
      .then(setItems)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, []);

  const decide = async (caseId: string, decision: 'Approve' | 'Reject') => {
    try {
      await postApi(`/hiring/${caseId}/final-approval`, { decision, comment: 'Decision recorded from final approval inbox.' });
      setItems((current) => current.filter((item) => item.id !== caseId));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  if (error) return <div className="page"><div className="alert error">Failed to load inbox: {error}</div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>Final Hiring Approval Inbox</h1>
          <p className="subtitle">Final gate before the candidate can move to Awaiting Joining.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" disabled title="Select a case to decide it individually">Approve Selected</button>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="metric-card" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Assigned to Me</span><span className="m-ico"><Icon name="user" size={16} /></span></div>
          <div className="m-value">7</div>
          <div className="m-foot">Oldest 1 day</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#16a34a', '--ms': '#ecfdf3' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Ready</span><span className="m-ico"><Icon name="check" size={16} /></span></div>
          <div className="m-value">5</div>
          <div className="m-foot">All mandatory gates passed</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#dc2626', '--ms': '#fff1f2' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Blocked</span><span className="m-ico"><Icon name="close" size={16} /></span></div>
          <div className="m-value">2</div>
          <div className="m-foot">License or document issue</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#2563eb', '--ms': '#eff6ff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Approved This Week</span><span className="m-ico"><Icon name="check" size={16} /></span></div>
          <div className="m-value">19</div>
          <div className="m-foot">Median decision 2.8h</div>
        </div>
      </div>

      <div className="grid main-side" style={{ marginTop: '24px' }}>
        <section className="card">
          <div className="toolbar">
            <button className="filter-btn active">Assigned to Me</button>
            <button className="filter-btn">Readiness</button>
            <button className="filter-btn">Branch</button>
            <button className="filter-btn">Joining Date</button>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Candidate</th>
                  <th>Vacancy</th>
                  <th>Branch</th>
                  <th>Package</th>
                  <th>Joining</th>
                  <th>Documents</th>
                  <th>License</th>
                  <th>Waiting</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>Loading inbox...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>No pending final approvals.</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="fw-500">{item.id}</td>
                      <td>{item.candidateName}</td>
                      <td>{item.positionTitle}</td>
                      <td>{item.branchName}</td>
                      <td>—</td>
                      <td>—</td>
                      <td><span className="badge badge-neutral">Not tracked</span></td>
                      <td><span className="badge badge-neutral">Not tracked</span></td>
                      <td>—</td>
                      <td>
                        <div className="actions">
                          <Link to={`/hires/${item.id}`} className="btn btn-sm">Review</Link>
                          <button className="btn btn-sm" onClick={() => void decide(item.id, 'Reject')}>Reject</button>
                          <button className="btn primary btn-sm" onClick={() => void decide(item.id, 'Approve')}>Approve</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="grid">
          <section className="card">
            <div className="card-h">
              <div>
                <b>Approval Gate</b>
                <small>Backend-enforced readiness policy.</small>
              </div>
            </div>
            <div className="card-b">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Icon name="check" size={16} color="#16a34a" />
                  <div>
                    <div className="fw-500 text-sm">Accepted offer</div>
                    <div className="text-xs text-muted">Approved immutable version</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Icon name="check" size={16} color="#16a34a" />
                  <div>
                    <div className="fw-500 text-sm">Documents</div>
                    <div className="text-xs text-muted">All mandatory items approved</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Icon name="check" size={16} color="#16a34a" />
                  <div>
                    <div className="fw-500 text-sm">License</div>
                    <div className="text-xs text-muted">Approved or not required</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Icon name="check" size={16} color="#16a34a" />
                  <div>
                    <div className="fw-500 text-sm">Checks</div>
                    <div className="text-xs text-muted">Completed where required</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Icon name="check" size={16} color="#16a34a" />
                  <div>
                    <div className="fw-500 text-sm">Joining date</div>
                    <div className="text-xs text-muted">Confirmed</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Icon name="check" size={16} color="#16a34a" />
                  <div>
                    <div className="fw-500 text-sm">Headcount</div>
                    <div className="text-xs text-muted">Vacancy still has capacity</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <div>
                <b>Decision</b>
                <small>Comments are required for changes or rejection.</small>
              </div>
            </div>
            <div className="card-b">
              <div className="field">
                <label>Decision Comment</label>
                <textarea rows={3} placeholder="Add any comments before approving/rejecting..."></textarea>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-outline" style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }}>Request Changes</button>
                <button className="btn primary" style={{ flex: 1 }}>Approve</button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
