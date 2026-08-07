import { useState, useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Offer } from '@recruitflow/contracts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchOffers();
  }, [statusFilter]);

  async function fetchOffers() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const data = await getApi<Offer[]>(`/offers?${params.toString()}`);
      setOffers(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (error) return <div className="page"><div className="alert error">Failed to load offers: {error}</div></div>;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Draft': return 'badge gray';
      case 'Pending Approval': return 'badge amber';
      case 'Approved': return 'badge green';
      case 'Sent': return 'badge blue';
      case 'Accepted': return 'badge green';
      case 'Declined': return 'badge red';
      default: return 'badge gray';
    }
  };

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>Offer Management</h1>
          <div className="sub">Track versions, approval, negotiation, acceptance and decline reasons.</div>
        </div>
      </div>

      <div className="grid c5">
        <div className="card metric" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Draft</span><span className="m-ico">✎</span></div>
          <div className="m-value">{offers.filter(o => o.status === 'Draft').length}</div>
          <div className="m-foot">Under preparation</div>
        </div>
        <div className="card metric" style={{ '--mc': '#d97706', '--ms': '#fffbeb' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Pending Approval</span><span className="m-ico">◎</span></div>
          <div className="m-value">{offers.filter(o => o.status === 'Pending Approval').length}</div>
          <div className="m-foot">Awaiting decision</div>
        </div>
        <div className="card metric" style={{ '--mc': '#2563eb', '--ms': '#eff6ff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Sent</span><span className="m-ico">◇</span></div>
          <div className="m-value">{offers.filter(o => o.status === 'Sent').length}</div>
          <div className="m-foot">Pending candidate</div>
        </div>
        <div className="card metric" style={{ '--mc': '#16a34a', '--ms': '#ecfdf3' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Accepted</span><span className="m-ico">✓</span></div>
          <div className="m-value">{offers.filter(o => o.status === 'Accepted').length}</div>
          <div className="m-foot">Proceeding to hire</div>
        </div>
        <div className="card metric" style={{ '--mc': '#dc2626', '--ms': '#fff1f2' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Declined</span><span className="m-ico">×</span></div>
          <div className="m-value">{offers.filter(o => o.status === 'Declined').length}</div>
          <div className="m-foot">Rejected offers</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 15 }}>
        <div className="toolbar">
          <div className="searchbox">⌕ Search records...</div>
          <select
            className="filter active"
            style={{ border: 'none', background: 'transparent' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Declined">Declined</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>Loading offers...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Offer ID</th>
                <th>Candidate</th>
                <th>Vacancy</th>
                <th>Version</th>
                <th>Total Package</th>
                <th>Joining Date</th>
                <th>Approval</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {offers.map(offer => (
                <tr key={offer.id}>
                  <td className="cell">{offer.offerCode}</td>
                  <td>{offer.candidateName}</td>
                  <td>{offer.positionTitle}</td>
                  <td><span className="badge purple">V{offer.currentVersion?.versionNumber || 1}</span></td>
                  <td><b>AED {offer.currentVersion?.monthlyPackage?.toLocaleString() || '-'}</b></td>
                  <td>{offer.currentVersion?.proposedJoiningDate ? new Date(offer.currentVersion.proposedJoiningDate).toLocaleDateString() : '-'}</td>
                  <td>
                    {offer.currentVersion?.approvalStatus ? (
                      <span className={getStatusBadgeClass(offer.currentVersion.approvalStatus)}>{offer.currentVersion.approvalStatus}</span>
                    ) : '-'}
                  </td>
                  <td><span className={getStatusBadgeClass(offer.status)}>{offer.status}</span></td>
                  <td><Link className="btn sm" to={`/offers/${offer.id}`}>Open</Link></td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No offers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
