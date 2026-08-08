import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import { Spinner } from '../components/Spinner';
import { Icon } from '../components/Icon';
import type { Offer } from '@recruitflow/contracts';

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined'] as const;

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const data = await getApi<Offer[]>(`/offers?${params.toString()}`);
      setOffers(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load offers.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  const filteredOffers = offers.filter((o) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      o.offerCode.toLowerCase().includes(s) ||
      (o as { candidateName?: string }).candidateName?.toLowerCase().includes(s) ||
      (o as { positionTitle?: string }).positionTitle?.toLowerCase().includes(s)
    );
  });

  const draftCount = offers.filter((o) => o.status === 'Draft').length;
  const pendingCount = offers.filter((o) => o.status === 'Pending Approval').length;
  const sentCount = offers.filter((o) => o.status === 'Sent').length;
  const acceptedCount = offers.filter((o) => o.status === 'Accepted').length;
  const declinedCount = offers.filter((o) => o.status === 'Declined').length;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Offer Management</h1>
          <p className="page-subtitle">Track offer versions, approval workflows, package components, and candidate responses</p>
        </div>
        <div className="page-actions">
          <Link to="/offers/create" className="button button-primary" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={14} /> Create Offer
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        <div className="card metric-card card-neon-purple">
          <span>Draft Offers</span>
          <strong>{draftCount}</strong>
          <small>Under preparation</small>
        </div>
        <div className="card metric-card card-neon-amber">
          <span>Pending Approval</span>
          <strong>{pendingCount}</strong>
          <small>Awaiting decision</small>
        </div>
        <div className="card metric-card card-neon-blue">
          <span>Sent to Candidate</span>
          <strong>{sentCount}</strong>
          <small>Awaiting candidate response</small>
        </div>
        <div className="card metric-card card-neon-emerald">
          <span>Accepted / Declined</span>
          <strong>{acceptedCount} <small style={{ fontSize: '13px', display: 'inline', color: 'var(--muted)' }}>({declinedCount} declined)</small></strong>
          <small>Proceeding to pre-hire</small>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="card" style={{ padding: '20px' }}>
        {/* Search & Filter Toolbar */}
        <div className="toolbar" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="global-search" style={{ margin: 0, maxWidth: '280px' }}>
            <Icon name="search" size={14} />
            <input
              type="search"
              placeholder="Search offers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search offers"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              background: 'var(--surface-soft)',
              color: 'var(--text)',
            }}
            aria-label="Filter by status"
          >
            <option value="">All Statuses ({offers.length})</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {statusFilter && (
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => setStatusFilter('')}
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="alert error" style={{ marginBottom: '16px' }}>
            {error}
            <button type="button" className="button button-sm button-secondary" onClick={() => void loadOffers()} style={{ marginLeft: '12px' }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size={32} />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredOffers.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)', background: 'var(--surface-soft)', borderRadius: '12px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {statusFilter || search ? 'No offers match the current criteria.' : 'No offers found. Create your first offer to get started.'}
            </p>
          </div>
        )}

        {/* Offers Table */}
        {!loading && !error && filteredOffers.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '11px' }}>
                  <th style={{ padding: '12px 10px' }}>Offer Code</th>
                  <th style={{ padding: '12px 10px' }}>Candidate</th>
                  <th style={{ padding: '12px 10px' }}>Position</th>
                  <th style={{ padding: '12px 10px' }}>Version</th>
                  <th style={{ padding: '12px 10px' }}>Monthly Package</th>
                  <th style={{ padding: '12px 10px' }}>Joining Date</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((o) => {
                  const candidateName = (o as { candidateName?: string }).candidateName || 'Candidate';
                  const positionTitle = (o as { positionTitle?: string }).positionTitle || 'Position';
                  const version = (o as { currentVersion?: { versionNumber?: number; monthlyPackage?: number; proposedJoiningDate?: string } }).currentVersion;

                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        {o.offerCode}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{candidateName}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{positionTitle}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: 'var(--surface-soft)', fontWeight: 600 }}>
                          V{version?.versionNumber ?? 1}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {version?.monthlyPackage ? `AED ${version.monthlyPackage.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>
                        {version?.proposedJoiningDate ? new Date(version.proposedJoiningDate).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontWeight: 600,
                            background: o.status === 'Accepted' ? '#dcfce7' : o.status === 'Sent' ? '#dbeafe' : o.status === 'Pending Approval' ? '#fef3c7' : o.status === 'Declined' ? '#fee2e2' : 'var(--surface-soft)',
                            color: o.status === 'Accepted' ? '#15803d' : o.status === 'Sent' ? '#1d4ed8' : o.status === 'Pending Approval' ? '#b45309' : o.status === 'Declined' ? '#b91c1c' : 'var(--muted)',
                          }}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <Link to={`/offers/${o.id}`} className="button button-sm button-secondary" style={{ textDecoration: 'none' }}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
