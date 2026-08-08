import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/Spinner';
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

const STATUSES = [
  'Pending Compliance',
  'Pending Final Approval',
  'Awaiting Joining',
  'Joined',
  'Postponed',
  'No-show',
  'Withdrawn',
] as const;

export function HireManagementPage() {
  const [cases, setCases] = useState<HiringCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApi<HiringCaseRow[]>('/hiring');
      setCases(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load hiring cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const filteredCases = cases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        c.id.toLowerCase().includes(s) ||
        c.candidateName.toLowerCase().includes(s) ||
        c.positionTitle.toLowerCase().includes(s) ||
        c.branchName.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const pendingComplianceCount = cases.filter((c) => c.status === 'Pending Compliance').length;
  const pendingApprovalCount = cases.filter((c) => c.status === 'Pending Final Approval').length;
  const awaitingJoiningCount = cases.filter((c) => c.status === 'Awaiting Joining').length;
  const joinedCount = cases.filter((c) => c.status === 'Joined').length;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hire Management</h1>
          <p className="page-subtitle">Pre-hire compliance, document verification, final approvals, and joining execution</p>
        </div>
        <div className="page-actions">
          <Link to="/hires/approvals/inbox" className="button button-secondary" style={{ textDecoration: 'none' }}>
            <Icon name="inbox" size={14} /> Final Approvals Inbox ({pendingApprovalCount})
          </Link>
          <Link to="/joinings" className="button button-primary" style={{ textDecoration: 'none' }}>
            <Icon name="user-check" size={14} /> Joining Management
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        <div className="card metric-card card-neon-purple">
          <span>Active Cases</span>
          <strong>{cases.length}</strong>
          <small>Total hiring cases</small>
        </div>
        <div className="card metric-card card-neon-amber">
          <span>Pending Compliance</span>
          <strong>{pendingComplianceCount}</strong>
          <small>Document & requirement checks</small>
        </div>
        <div className="card metric-card card-neon-blue">
          <span>Pending Final Approval</span>
          <strong>{pendingApprovalCount}</strong>
          <small>Awaiting director approval</small>
        </div>
        <div className="card metric-card card-neon-emerald">
          <span>Awaiting Joining / Joined</span>
          <strong>{awaitingJoiningCount + joinedCount}</strong>
          <small>{joinedCount} confirmed joined</small>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: '20px' }}>
        {/* Toolbar */}
        <div className="toolbar" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="global-search" style={{ margin: 0, maxWidth: '280px' }}>
            <Icon name="search" size={14} />
            <input
              type="search"
              placeholder="Search candidate, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search hiring cases"
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
            aria-label="Filter by hiring status"
          >
            <option value="">All Statuses ({cases.length})</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {statusFilter && (
            <button type="button" className="button button-sm button-secondary" onClick={() => setStatusFilter('')}>
              Clear filter
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert error" style={{ marginBottom: '16px' }}>
            {error}
            <button type="button" className="button button-sm button-secondary" onClick={() => void loadCases()} style={{ marginLeft: '12px' }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size={32} />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filteredCases.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)', background: 'var(--surface-soft)', borderRadius: '12px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {statusFilter || search ? 'No hiring cases match the current criteria.' : 'No active hiring cases found.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filteredCases.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '11px' }}>
                  <th style={{ padding: '12px 10px' }}>Candidate</th>
                  <th style={{ padding: '12px 10px' }}>Position</th>
                  <th style={{ padding: '12px 10px' }}>Branch</th>
                  <th style={{ padding: '12px 10px' }}>Joining Date</th>
                  <th style={{ padding: '12px 10px' }}>Compliance</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const initials = c.candidateName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--primary), #a855f7)',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 800,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </span>
                          <div>
                            <strong style={{ display: 'block', fontSize: '13px' }}>{c.candidateName}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Accepted Offer</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{c.positionTitle}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{c.branchName}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>
                        {c.plannedJoiningDate ? new Date(c.plannedJoiningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--surface-soft)', color: 'var(--muted)', fontWeight: 600 }}>
                          Open Case
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontWeight: 600,
                            background: c.status === 'Joined' ? '#dcfce7' : c.status === 'Awaiting Joining' ? '#dbeafe' : c.status === 'Pending Final Approval' ? '#fef3c7' : 'var(--surface-soft)',
                            color: c.status === 'Joined' ? '#15803d' : c.status === 'Awaiting Joining' ? '#1d4ed8' : c.status === 'Pending Final Approval' ? '#b45309' : 'var(--muted)',
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <Link to={`/hires/${c.id}`} className="button button-sm button-secondary" style={{ textDecoration: 'none' }}>
                          Open Case
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
