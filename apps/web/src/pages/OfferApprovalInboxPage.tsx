import { useState, useEffect, type CSSProperties } from 'react';

import { getApi, postApi } from '../api/client';

type OfferApprovalRow = {
  id: string;
  offerCode: string;
  candidateName: string;
  positionTitle: string;
  branchName?: string | null;
  monthlyPackage: number;
  versionNumber: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function OfferApprovalInboxPage() {
  const [approvals, setApprovals] = useState<OfferApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    try {
      setLoading(true);
      const data = await getApi<OfferApprovalRow[]>('/offers/approvals/inbox');
      setApprovals(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(approvalId: string, decision: 'Approve' | 'Reject') {
    try {
      await postApi(`/offers/approvals/${approvalId}/decide`, { decision, comment: '' });
      fetchApprovals();
    } catch (err: unknown) {
      alert(`Failed to submit decision: ${getErrorMessage(err)}`);
    }
  }

  if (error) return <div className="page"><div className="alert error">Failed to load approvals: {error}</div></div>;

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>Offer Approval Inbox</h1>
          <div className="sub">Review packages, budget variance and immutable offer versions.</div>
        </div>
      </div>

      <div className="grid c4">
        <div className="card metric" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Assigned to Me</span><span className="m-ico">◎</span></div>
          <div className="m-value">{approvals.length}</div>
          <div className="m-foot">Pending your review</div>
        </div>
        <div className="card metric" style={{ '--mc': '#16a34a', '--ms': '#ecfdf3' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Approved This Week</span><span className="m-ico">✓</span></div>
          <div className="m-value">0</div>
          <div className="m-foot">Median time 3.5h</div>
        </div>
      </div>

      <div className="grid main-side" style={{ marginTop: 15 }}>
        <section className="card">
          <div className="toolbar">
            <div className="filter active">Assigned to Me</div>
          </div>
          <div className="card-b">
            {loading ? (
              <p>Loading inbox...</p>
            ) : approvals.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                No offers pending your approval. You're all caught up!
              </p>
            ) : (
              approvals.map((app) => (
                <div key={app.id} className="check" style={{ gridTemplateColumns: '1fr auto', marginBottom: 8 }}>
                  <div>
                    <div className="cell">{app.offerCode} · {app.candidateName}</div>
                    <div className="meta">{app.positionTitle} {app.branchName ? `· ${app.branchName}` : ''}</div>
                    <div className="meta" style={{ marginTop: 6 }}>
                      AED {app.monthlyPackage.toLocaleString()} monthly package · Version {app.versionNumber}
                    </div>
                  </div>
                  <div className="actions">
                    <button className="btn sm" onClick={() => handleDecision(app.id, 'Reject')} style={{ color: 'var(--red)' }}>Reject</button>
                    <button className="btn primary sm" onClick={() => handleDecision(app.id, 'Approve')}>Approve</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside>
          <section className="card">
            <div className="card-h">
              <div><b>Offer Approval Policy</b><small>Conditional approval based on compensation.</small></div>
            </div>
            <div className="card-b">
              <div className="process">
                <div className="prow"><span className="pcheck">✓</span>HR Manager always required</div>
                <div className="prow"><span className="pcheck pending">•</span>Finance if above band or unbudgeted</div>
                <div className="prow"><span className="pcheck pending">•</span>Executive for senior grades</div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
