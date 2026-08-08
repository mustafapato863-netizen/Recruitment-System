import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { Icon } from '../components/Icon';
import { getApi, postApi } from '../api/client';
import type { Candidate, Application, Vacancy, PaginatedResult, CandidateDocument } from '@recruitflow/contracts';

type TabKey = 'overview' | 'applications' | 'documents' | 'activity';

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [c, appsRes, docsRes, vacsRes] = await Promise.all([
        getApi<Candidate>(`/candidates/${id}`),
        getApi<PaginatedResult<Application>>(`/applications?candidateId=${id}`).catch(() => ({ data: [], total: 0, page: 1, pageSize: 20 })),
        getApi<CandidateDocument[]>(`/documents/candidate/${id}`).catch(() => []),
        getApi<Vacancy[]>('/vacancies').catch(() => []),
      ]);
      setCandidate(c);
      setApplications(appsRes.data);
      setDocuments(docsRes);
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
    void loadData();
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
      void loadData();
    } catch (err: unknown) {
      setApplyError((err as Error).message || 'Failed to submit application.');
    } finally {
      setApplySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="alert error" style={{ margin: '24px' }}>
        {error || 'Candidate not found.'}
        <Link to="/candidates" className="button button-sm button-secondary" style={{ marginLeft: '12px' }}>
          Back to Candidates
        </Link>
      </div>
    );
  }

  const initials = `${candidate.firstName[0] ?? ''}${candidate.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header Profile Hero */}
      <div className="card card-neon-purple" style={{ padding: '24px', marginBottom: '20px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Avatar Circle */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #a855f7)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '22px',
                fontWeight: 800,
                boxShadow: '0 8px 20px rgba(124, 58, 237, 0.25)',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {candidate.firstName} {candidate.lastName}
                </h1>
                <StatusBadge status={candidate.status} />
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '10px',
                    background: 'var(--surface-soft)',
                    color: 'var(--muted)',
                    fontWeight: 600,
                  }}
                >
                  Code: {candidate.candidateCode}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                {candidate.currentTitle || 'Candidate'} {candidate.currentCompany ? `at ${candidate.currentCompany}` : ''}
              </p>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                <span><Icon name="document" size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> {candidate.email}</span>
                {candidate.phone && <span><Icon name="user" size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> {candidate.phone}</span>}
                <span>Source: <strong style={{ color: 'var(--text)' }}>{candidate.source || 'Direct'}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={`mailto:${candidate.email}`}
              className="button button-secondary"
              style={{ textDecoration: 'none' }}
            >
              Email Candidate
            </a>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsApplyModalOpen(true)}
            >
              <Icon name="plus" size={14} /> Apply to Vacancy
            </button>
          </div>
        </div>

        {/* Profile Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {(['overview', 'applications', 'documents', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'none',
                color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}
            >
              {tab === 'applications' ? `Applications (${applications.length})` : tab === 'documents' ? `Documents (${documents.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Professional Summary</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                {candidate.firstName} is an experienced professional currently working as {candidate.currentTitle || 'a candidate'} at {candidate.currentCompany || 'their current organization'}.
                They joined the talent pipeline on {new Date(candidate.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              </p>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Active Vacancy Applications</h3>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{applications.length} active</span>
              </div>
              {applications.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', background: 'var(--surface-soft)', borderRadius: '8px' }}>
                  No active applications. Click <strong>+ Apply to Vacancy</strong> to match this candidate with open requisitions.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        background: 'var(--surface)',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', display: 'block' }}>{app.positionTitle || app.vacancyCode}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          App #{app.applicationCode} · Applied {new Date(app.appliedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '11px' }}>
                          {app.stage}
                        </span>
                        <Link to={`/applications/${app.id}`} className="button button-sm button-secondary" style={{ textDecoration: 'none' }}>
                          View Pipeline
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Candidate Overview</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Full Name</span>
                  <strong>{candidate.firstName} {candidate.lastName}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Email Address</span>
                  <strong>{candidate.email}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Phone Number</span>
                  <strong>{candidate.phone || 'Not provided'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>Candidate Code</span>
                  <code style={{ fontSize: '12px', color: 'var(--primary)' }}>{candidate.candidateCode}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>System Status</span>
                  <StatusBadge status={candidate.status} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Applications History</h3>
          {applications.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No applications submitted yet.
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '11px' }}>
                  <th style={{ padding: '10px' }}>App Code</th>
                  <th style={{ padding: '10px' }}>Vacancy</th>
                  <th style={{ padding: '10px' }}>Stage</th>
                  <th style={{ padding: '10px' }}>Primary Recruiter</th>
                  <th style={{ padding: '10px' }}>Applied Date</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{app.applicationCode}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <strong>{app.positionTitle || app.vacancyCode}</strong>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '11px' }}>
                        {app.stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{app.primaryRecruiterName || 'Unassigned'}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{new Date(app.appliedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <Link to={`/applications/${app.id}`} className="button button-sm button-secondary" style={{ textDecoration: 'none' }}>
                        View Pipeline
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Candidate Vault Documents</h3>
            <Link to={`/candidates/${id}/documents`} className="button button-sm button-primary" style={{ textDecoration: 'none' }}>
              <Icon name="upload" size={13} /> Manage Documents
            </Link>
          </div>
          {documents.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No documents uploaded yet. Go to <Link to={`/candidates/${id}/documents`} style={{ color: 'var(--primary)' }}>Manage Documents</Link> to upload CV or certificates.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block' }}>{doc.fileName}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{doc.documentType} · {(doc.fileSize / 1024).toFixed(1)} KB · Scan: {doc.scanStatus}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Recent Candidate Timeline</h3>
          <div style={{ padding: '20px', color: 'var(--muted)', fontSize: '13px' }}>
            Profile created on {new Date(candidate.createdAt).toLocaleDateString()} with status <strong>{candidate.status}</strong>.
          </div>
        </div>
      )}

      {/* Apply to Vacancy Modal */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Apply Candidate to Vacancy">
        <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {applyError && <div className="alert error">{applyError}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>Select Target Vacancy *</label>
            <select
              value={selectedVacancyId}
              onChange={(e) => setSelectedVacancyId(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--surface-soft)' }}
            >
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vacancyCode} — Approved Headcount: {v.approvedHeadcount} (Status: {v.status})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setIsApplyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={applySubmitting || !selectedVacancyId}
            >
              {applySubmitting ? <Spinner size={14} /> : null}
              {applySubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
