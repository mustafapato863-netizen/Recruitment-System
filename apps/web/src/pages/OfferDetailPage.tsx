import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Offer, OfferStatus } from '@recruitflow/contracts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOffer();
  }, [id]);

  async function fetchOffer() {
    try {
      setLoading(true);
      const data = await getApi<Offer>(`/offers/${id}`);
      setOffer(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: OfferStatus) {
    if (!confirm(`Are you sure you want to change the status to ${newStatus}?`)) return;
    try {
      await patchApi(`/offers/${id}/status`, { status: newStatus });
      fetchOffer();
    } catch (err: unknown) {
      alert(`Failed to update status: ${getErrorMessage(err)}`);
    }
  }

  if (error) return <div className="page"><div className="alert error">Failed to load offer: {error}</div></div>;
  if (loading || !offer) return <div className="page" style={{ padding: 20 }}>Loading...</div>;

  const currentVersion = offer.currentVersion;

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow">
            <Link to="/offers" style={{ textDecoration: 'none', color: 'inherit' }}>Offers</Link> / {offer.offerCode}
          </div>
          <h1>{offer.candidateName}</h1>
          <div className="sub">
            {offer.positionTitle} · Version {currentVersion?.versionNumber} · Status: <strong>{offer.status}</strong>
          </div>
        </div>
        <div className="actions">
          {offer.status === 'Draft' || currentVersion?.approvalStatus === 'Rejected' ? (
            <Link to={`/offers/create?applicationId=${offer.applicationId}&revision=true&offerId=${offer.id}`} className="btn primary">Edit Revision</Link>
          ) : offer.status === 'Approved' ? (
            <button className="btn primary" onClick={() => handleStatusChange('Sent')}>Mark as Sent</button>
          ) : offer.status === 'Sent' ? (
            <>
              <button className="btn" style={{ color: 'var(--red)' }} onClick={() => handleStatusChange('Declined')}>Declined</button>
              <button className="btn primary" style={{ background: 'var(--green)' }} onClick={() => handleStatusChange('Accepted')}>Accepted</button>
            </>
          ) : null}
          {(offer.status === 'Sent' || offer.status === 'Declined') && (
            <Link to={`/offers/create?applicationId=${offer.applicationId}&revision=true&offerId=${offer.id}`} className="btn">Create New Version</Link>
          )}
        </div>
      </div>

      <div className="grid main-side">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section className="card">
            <div className="card-h">
              <div><b>Compensation Package</b><small>Version {currentVersion?.versionNumber}</small></div>
              {currentVersion?.isLocked && <span className="badge gray">Locked</span>}
            </div>
            <div className="card-b">
              <table style={{ width: '100%', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>Component</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>Type</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentVersion?.components.map(comp => (
                    <tr key={comp.id}>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>{comp.name}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>{comp.type}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        {comp.currency} {comp.amount?.toLocaleString()} ({comp.frequency})
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ paddingTop: 12, fontWeight: 'bold' }}>Total Monthly Package</td>
                    <td style={{ paddingTop: 12, textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>
                      AED {currentVersion?.monthlyPackage?.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <div><b>Terms & Logistics</b></div>
            </div>
            <div className="card-b">
              <div className="grid c2" style={{ gap: '1rem' }}>
                <div className="field">
                  <label>Contract Type</label>
                  <div>{currentVersion?.contractType || '-'}</div>
                </div>
                <div className="field">
                  <label>Probation Period</label>
                  <div>{currentVersion?.probationPeriod || '-'}</div>
                </div>
                <div className="field">
                  <label>Proposed Joining Date</label>
                  <div>{currentVersion?.proposedJoiningDate ? new Date(currentVersion.proposedJoiningDate).toLocaleDateString() : '-'}</div>
                </div>
                <div className="field">
                  <label>Offer Expiry</label>
                  <div>{currentVersion?.offerExpiry ? new Date(currentVersion.offerExpiry).toLocaleDateString() : '-'}</div>
                </div>
                <div className="field">
                  <label>Work Location</label>
                  <div>{currentVersion?.workLocation || '-'}</div>
                </div>
                <div className="field">
                  <label>Working Schedule</label>
                  <div>{currentVersion?.workingSchedule || '-'}</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div className="card">
            <div className="card-h">
              <div><b>Approval Chain</b><small>{currentVersion?.approvalStatus}</small></div>
            </div>
            <div className="card-b">
              <div className="process">
                {currentVersion?.approvals.map(app => (
                  <div key={app.id} className="prow">
                    <span className={`pcheck ${app.status === 'Approved' ? '' : 'pending'}`}>
                      {app.status === 'Approved' ? '✓' : app.status === 'Rejected' ? '×' : '•'}
                    </span>
                    <div>
                      {app.roleCode}
                      {app.approverName && <div className="meta">{app.approverName}</div>}
                      {app.status !== 'Pending' && (
                        <div className="meta">{app.status} on {new Date(app.decidedAt!).toLocaleDateString()}</div>
                      )}
                      {app.comment && <div className="meta" style={{ fontStyle: 'italic', marginTop: 4 }}>"{app.comment}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 15 }}>
            <div className="card-h">
              <div><b>Version History</b></div>
            </div>
            <div className="card-b" style={{ padding: 0 }}>
              {offer.versions?.map(v => (
                <div key={v.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b>Version {v.versionNumber}</b>
                    <span className="badge gray">{v.approvalStatus}</span>
                  </div>
                  <div className="meta" style={{ marginTop: 4 }}>
                    AED {v.monthlyPackage?.toLocaleString()} · {new Date(v.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
