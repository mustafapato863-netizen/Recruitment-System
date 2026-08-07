import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import type { HiringCase } from '@recruitflow/contracts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function HiringCasePage() {
  const { id } = useParams<{ id: string }>();
  const [hiringCase, setHiringCase] = useState<HiringCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadCase = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setHiringCase(await getApi<HiringCase>(`/hiring/${id}`));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCase(); }, [id]);

  const submitForApproval = async () => {
    if (!id) return;
    try {
      await postApi(`/hiring/${id}/submit`);
      setActionMessage('Hiring case submitted for final approval.');
      await loadCase();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  if (loading) return <div className="page" style={{ padding: '24px' }}>Loading hiring case...</div>;
  if (error || !hiringCase) return <div className="page"><div className="alert error">{error ?? 'Hiring case not found.'}</div><Link to="/hires">Back to hiring cases</Link></div>;

  const requirements = hiringCase.complianceRequirements ?? [];
  const requiredCount = requirements.filter((item) => item.isRequired).length;
  const verifiedCount = requirements.filter((item) => item.isRequired && ['Verified', 'Not Required'].includes(item.status)).length;
  const isReady = requiredCount === verifiedCount;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Link to="/hires">Hiring Cases</Link> / {hiringCase.id}</div>
          <h1>{hiringCase.candidateName ?? 'Candidate'} · Hiring Case</h1>
          <p className="subtitle">{hiringCase.positionTitle ?? 'Position'} · {hiringCase.branchName ?? 'Branch'} · Status: {hiringCase.status}</p>
        </div>
        <div className="page-actions">
          {hiringCase.status === 'Pending Compliance' && <button className="btn primary" onClick={submitForApproval} disabled={!isReady}>Submit for Final Approval</button>}
        </div>
      </div>

      {actionMessage && <div className="alert success">{actionMessage}</div>}
      {!isReady && hiringCase.status === 'Pending Compliance' && <div className="alert warning">All required compliance items must be verified before submission.</div>}

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="metric-card"><div className="m-label">Status</div><div className="m-value" style={{ fontSize: '1.1rem' }}>{hiringCase.status}</div><div className="m-foot">Current workflow state</div></div>
        <div className="metric-card"><div className="m-label">Compliance</div><div className="m-value">{verifiedCount}/{requiredCount}</div><div className="m-foot">Required items ready</div></div>
        <div className="metric-card"><div className="m-label">Final Approvals</div><div className="m-value">{hiringCase.approvals?.filter((approval) => approval.status === 'Approved').length ?? 0}/{hiringCase.approvals?.length ?? 0}</div><div className="m-foot">Recorded approvals</div></div>
        <div className="metric-card"><div className="m-label">Joining Date</div><div className="m-value" style={{ fontSize: '1.1rem' }}>{hiringCase.actualJoiningDate ? new Date(hiringCase.actualJoiningDate).toLocaleDateString() : 'Pending'}</div><div className="m-foot">Actual joining date</div></div>
      </div>

      <div className="grid main-side" style={{ marginTop: '24px' }}>
        <section className="card">
          <div className="card-h"><div><b>Compliance Checklist</b><small>Only recorded requirements are shown.</small></div></div>
          <div className="card-b">
            {requirements.length === 0 ? <p className="text-muted">No compliance requirements configured.</p> : requirements.map((item) => (
              <div key={item.id} className="prow" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                <span><Icon name={item.status === 'Verified' || item.status === 'Not Required' ? 'check' : 'clock'} size={16} /> {item.name}</span>
                <span className={`badge ${item.status === 'Verified' || item.status === 'Not Required' ? 'badge-green' : 'badge-amber'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="grid">
          <section className="card"><div className="card-h"><div><b>Approval History</b><small>Decision state from the API.</small></div></div><div className="card-b">
            {(hiringCase.approvals ?? []).length === 0 ? <p className="text-muted">No approvals recorded.</p> : hiringCase.approvals?.map((approval) => <div className="prow" key={approval.id}><span>{approval.roleCode}</span><span className={`badge ${approval.status === 'Approved' ? 'badge-green' : 'badge-amber'}`}>{approval.status}</span></div>)}
          </div></section>
          <section className="card"><div className="card-h"><div><b>Case Ownership</b><small>Organization-scoped record.</small></div></div><div className="card-b"><div className="info-grid"><div className="k">Owner</div><div className="v">{hiringCase.ownerUserId ?? 'Unassigned'}</div><div className="k">Created</div><div className="v">{new Date(hiringCase.createdAt).toLocaleString()}</div><div className="k">Updated</div><div className="v">{new Date(hiringCase.updatedAt).toLocaleString()}</div></div></div></section>
        </aside>
      </div>
    </div>
  );
}
