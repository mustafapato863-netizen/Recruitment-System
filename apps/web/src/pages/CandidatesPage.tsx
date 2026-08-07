import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { getApi, postApi } from '../api/client';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentTitle: '',
    currentCompany: '',
    source: 'LinkedIn',
  });

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await getApi<PaginatedResult<Candidate>>(`/candidates?${params.toString()}`);
      setCandidates(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load candidates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await postApi('/candidates', formData);
      setIsModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        currentTitle: '',
        currentCompany: '',
        source: 'LinkedIn',
      });
      fetchCandidates();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="candidates-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Talent & Sourcing</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>Candidates Directory</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Manage talent pool, contact info, and recruitment applications</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
        >
          + Add Candidate
        </button>
      </div>

      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Total Candidates</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px' }}>{total}</strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Active Talent</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: '#16a34a' }}>{candidates.filter(c => c.status === 'Active').length}</strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Direct Sourced</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px' }}>{candidates.filter(c => c.source === 'LinkedIn' || c.source === 'Referral').length}</strong>
        </div>
        <div className="metric-card panel" style={{ padding: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Archived / Blacklisted</span>
          <strong style={{ display: 'block', fontSize: '22px', marginTop: '4px', color: 'var(--muted)' }}>{candidates.filter(c => c.status !== 'Active').length}</strong>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div className="toolbar" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Blacklisted">Blacklisted</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {error && (
          <div className="error-alert" style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
            {error} <button onClick={fetchCandidates} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Loading candidate directory...</div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No candidates found matching your criteria.</div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: '10px' }}>Code</th>
                <th style={{ padding: '10px' }}>Name & Email</th>
                <th style={{ padding: '10px' }}>Current Position</th>
                <th style={{ padding: '10px' }}>Phone</th>
                <th style={{ padding: '10px' }}>Source</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{c.candidateCode}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{c.firstName} {c.lastName}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{c.email}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div>{c.currentTitle || '—'}</div>
                    <small style={{ color: 'var(--muted)' }}>{c.currentCompany || '—'}</small>
                  </td>
                  <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontSize: '11px' }}>{c.source || 'Direct'}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <Link to={`/candidates/${c.id}`} style={{ padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', textDecoration: 'none' }}>
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Candidate">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{formError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>First Name *</label>
              <input
                required
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Last Name *</label>
              <input
                required
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Email Address *</label>
            <input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Referral">Referral</option>
                <option value="Job Portal">Job Portal</option>
                <option value="Direct Agency">Direct Agency</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Current Job Title</label>
              <input
                type="text"
                value={formData.currentTitle}
                onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Current Company</label>
              <input
                type="text"
                value={formData.currentCompany}
                onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}
            >
              {submitting ? 'Saving...' : 'Create Candidate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
