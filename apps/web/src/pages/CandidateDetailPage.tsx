import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { getApi, postApi } from '../api/client';
import type { Candidate, Application, Vacancy, PaginatedResult } from '@recruitflow/contracts';

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [c, appsRes, vacsRes] = await Promise.all([
        getApi<Candidate>(`/candidates/${id}`),
        getApi<PaginatedResult<Application>>(`/applications?candidateId=${id}`),
        getApi<Vacancy[]>('/vacancies'),
      ]);
      setCandidate(c);
      setApplications(appsRes.data);
      setVacancies(vacsRes);
      if (vacsRes.length > 0) {
        setSelectedVacancyId(vacsRes[0].id);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load candidate details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedVacancyId) return;
    setApplySubmitting(true);
    setApplyError(null);
    try {
      await postApi('/applications', {
        candidateId: id,
        vacancyId: selectedVacancyId,
      });
      setIsApplyModalOpen(false);
      loadData();
    } catch (err: unknown) {
      setApplyError((err as Error).message || 'Failed to submit application.');
    } finally {
      setApplySubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading candidate profile...</div>;
  }

  if (error || !candidate) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
        {error || 'Candidate not found.'}
        <div><Link to="/candidates" style={{ textDecoration: 'underline', marginTop: '8px', display: 'inline-block' }}>Back to Candidates</Link></div>
      </div>
    );
  }

  return (
    <div className="candidate-detail-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Candidates / {candidate.candidateCode}</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>{candidate.firstName} {candidate.lastName}</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{candidate.currentTitle || 'No title'} at {candidate.currentCompany || 'N/A'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="primary-button"
            onClick={() => setIsApplyModalOpen(true)}
            style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
          >
            + Apply to Vacancy
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Profile Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Email</span>
              <strong>{candidate.email}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Phone</span>
              <strong>{candidate.phone || 'Not provided'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Source</span>
              <span>{candidate.source || 'Direct'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Status</span>
              <StatusBadge status={candidate.status} />
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Added On</span>
              <span>{new Date(candidate.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Vacancy Applications ({applications.length})</h3>

          {applications.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', background: 'var(--background)', borderRadius: '8px' }}>
              No applications submitted yet. Click "+ Apply to Vacancy" to link candidate to an open position.
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={{ padding: '10px' }}>App Code</th>
                  <th style={{ padding: '10px' }}>Vacancy / Position</th>
                  <th style={{ padding: '10px' }}>Stage</th>
                  <th style={{ padding: '10px' }}>Recruiter</th>
                  <th style={{ padding: '10px' }}>Applied Date</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{app.applicationCode}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <strong style={{ display: 'block' }}>{app.positionTitle || app.vacancyCode}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Code: {app.vacancyCode}</span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 500, fontSize: '11px' }}>
                        {app.stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{app.primaryRecruiterName || 'Unassigned'}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{new Date(app.appliedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <Link to={`/applications/${app.id}`} style={{ padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', textDecoration: 'none' }}>
                        View Pipeline
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mobile-actions">
        <a href={`mailto:${candidate.email}`} className="button button-sm button-secondary" style={{ flex: 1, textAlign: 'center' }}>
          Email
        </a>
        {candidate.phone && (
          <a href={`tel:${candidate.phone}`} className="button button-sm button-secondary" style={{ flex: 1, textAlign: 'center' }}>
            Call
          </a>
        )}
        <button type="button" className="button button-sm button-primary" style={{ flex: 1 }} onClick={() => setIsApplyModalOpen(true)}>
          Apply
        </button>
      </div>

      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Apply Candidate to Vacancy">
        <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {applyError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{applyError}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Select Target Vacancy *</label>
            <select
              value={selectedVacancyId}
              onChange={(e) => setSelectedVacancyId(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vacancyCode} — Approved Headcount: {v.approvedHeadcount} (Status: {v.status})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={applySubmitting || !selectedVacancyId}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}
            >
              {applySubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
