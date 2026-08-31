import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ResponsiveDataView } from '../components/ui/ResponsiveDataView';
import { DetailSummary } from '../components/ui/DetailSummary';
import { Avatar } from '../components/ui/Avatar';
import { FormField } from '../components/ui/FormField';
import { Select } from '../components/ui/Select';
import { Tabs } from '../components/ui/Tabs';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { Icon } from '../components/Icon';
import { getApi, postApi } from '../api/client';
import type { Candidate, Application, Vacancy, PaginatedResult, CandidateDocument } from '@recruitflow/contracts';
import './PageEnhancementsV2.css';

type TabKey = 'overview' | 'applications' | 'documents' | 'history';

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedDataError, setRelatedDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setRelatedDataError(null);
    try {
      const c = await getApi<Candidate>(`/candidates/${id}`);
      const [appsRes, docsRes, vacsRes] = await Promise.allSettled([
        getApi<PaginatedResult<Application>>(`/applications?candidateId=${id}`),
        getApi<CandidateDocument[]>(`/documents/candidate/${id}`),
        getApi<Vacancy[]>('/vacancies'),
      ]);

      const relatedErrors: string[] = [];
      setCandidate(c);
      if (appsRes.status === 'fulfilled') {
        setApplications(appsRes.value.data);
      } else {
        setApplications([]);
        relatedErrors.push('applications');
      }
      if (docsRes.status === 'fulfilled') {
        setDocuments(docsRes.value);
      } else {
        setDocuments([]);
        relatedErrors.push('documents');
      }
      if (vacsRes.status === 'fulfilled') {
        setVacancies(vacsRes.value);
        if (vacsRes.value.length > 0) {
          setSelectedVacancyId((current) => current || vacsRes.value[0].id);
        }
      } else {
        setVacancies([]);
        relatedErrors.push('vacancies');
      }
      if (relatedErrors.length > 0) {
        setRelatedDataError(`Some related candidate data could not be loaded: ${relatedErrors.join(', ')}.`);
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

  const handleApply = async (e: FormEvent) => {
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
      <PageFrame eyebrow="Talent Operations" title="Candidate Profile" description="Candidate identity directory.">
        <PageState kind="loading" title="Loading candidate" description="Fetching candidate profile and records." />
      </PageFrame>
    );
  }

  const isForbidden =
    error?.toLowerCase().includes('denied') ||
    error?.toLowerCase().includes('permission') ||
    error?.includes('403');

  if (error || !candidate) {
    return (
      <PageFrame eyebrow="Talent Operations" title="Candidate Profile" description="Candidate identity directory.">
        {isForbidden ? (
          <PageState
            kind="forbidden"
            title="Access Restricted"
            description="You do not have the required permissions to view this candidate profile."
            actionLabel="Back to Candidates"
            onAction={() => navigate('/candidates')}
          />
        ) : (
          <PageState
            kind="not-found"
            title="Candidate Not Found"
            description="The requested candidate profile does not exist or has been removed."
            actionLabel="Back to Candidates"
            onAction={() => navigate('/candidates')}
          />
        )}
      </PageFrame>
    );
  }

  const initials = `${candidate.firstName?.[0] || ''}${candidate.lastName?.[0] || ''}`.toUpperCase() || 'CP';
  const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Candidate';
  const latestCv = documents.find((d) => d.documentType === 'CV' || d.fileName.endsWith('.pdf') || d.fileName.endsWith('.docx')) || documents[0] || null;

  return (
    <PageFrame
      eyebrow={`Talent / Candidates / ${candidate.candidateCode || ''}`}
      title={fullName}
      description={`${candidate.currentTitle || 'Candidate'} · ${candidate.currentCompany || 'Experience not specified'}`}
      actions={
        <>
          <StatusBadge status={candidate.status} />
          <Button variant="primary" size="sm" onClick={() => setIsApplyModalOpen(true)}>
            <Icon name="plus" size={13} />
            Assign to Vacancy
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/candidates/${candidate.id}/documents`}>
              <Icon name="file-text" size={13} />
              Documents ({documents.length})
            </Link>
          </Button>
        </>
      }
    >
      {relatedDataError && (
        <div className="mb-4">
          <Alert tone="warning" title="Partial data warning">{relatedDataError}</Alert>
        </div>
      )}

      <div className="rf-panel rf-detail-hero flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <div className="flex items-center gap-4">
          <Avatar
            initials={initials}
            size="lg"
            className="w-16 h-16 text-xl font-black bg-rf-action text-rf-on-action border-2 border-white/30 shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-rf-heading font-black text-rf-ink m-0 tracking-tight">{fullName}</h2>
              <span className="font-mono text-xs font-bold text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md border border-rf-border-subtle">
                {candidate.candidateCode || '—'}
              </span>
            </div>
            <p className="text-xs text-rf-ink-muted font-medium m-0 mt-1">
              {candidate.currentTitle || 'Role not specified'} {candidate.currentCompany ? `at ${candidate.currentCompany}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-rf-border-subtle">
          <Badge variant="neutral" className="text-xs py-1 px-2.5">
            {applications.length} {applications.length === 1 ? 'Application' : 'Applications'}
          </Badge>
          <Badge variant="neutral" className="text-xs py-1 px-2.5">
            {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
          </Badge>
        </div>
      </div>

      <Tabs
        ariaLabel="Candidate information sections"
        activeKey={activeTab}
        items={[
          { key: 'overview', label: 'Overview & Applications' },
          { key: 'applications', label: `Applications (${applications.length})` },
          { key: 'documents', label: `Documents (${documents.length})` },
          { key: 'history', label: 'Activity & History' },
        ]}
        onChange={(key) => setActiveTab(key as TabKey)}
      />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Professional Summary</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Profile summary and background information.</p>
              </div>
              <p className="text-xs text-rf-ink leading-relaxed m-0">
                {candidate.currentTitle
                  ? `Experienced professional in ${candidate.currentTitle} with demonstrated expertise and background.`
                  : 'Candidate profile record in workspace directory.'}
              </p>
            </section>

            <DetailSummary
              title="Personal & Contact Information"
              description="Sensitive contact and consent metadata."
              items={[
                { label: 'Email', value: candidate.email, icon: <Icon name="mail" size={14} /> },
                { label: 'Phone', value: candidate.phone || 'Not provided', icon: <Icon name="phone" size={14} /> },
                { label: 'Current Company', value: candidate.currentCompany || 'Not provided', icon: <Icon name="building" size={14} /> },
                { label: 'Source', value: candidate.source || '—', icon: <Icon name="inbox" size={14} /> },
                { label: 'Consent Status', value: candidate.status ? `${candidate.status} · Recorded` : 'Recorded', icon: <Icon name="check-circle" size={14} /> },
                { label: 'Profile Created', value: new Date(candidate.createdAt).toLocaleDateString(), icon: <Icon name="clock" size={14} /> },
              ]}
            />

            <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
              <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-rf-ink m-0">Recent Applications</h3>
                </div>
              </div>
              <ResponsiveDataView
                rows={applications}
                columns={[
                  { key: 'vacancy', header: 'Vacancy', priority: 'primary', render: (app) => (<div><div className="font-bold">{app.positionTitle || 'Position not reported'}</div><div className="text-xs text-rf-ink-muted">{app.vacancyCode || app.vacancyId}</div></div>) },
                  { key: 'stage', header: 'Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
                  { key: 'source', header: 'Source', priority: 'secondary', render: (app) => <span className="font-mono text-[10.5px] text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md">{app.source || '—'}</span> },
                  { key: 'applied', header: 'Applied', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted font-medium">{new Date(app.createdAt).toLocaleDateString()}</span> },
                  { key: 'action', header: 'Action', priority: 'secondary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={`/applications/${app.id}`}>View</Link></Button> }
                ]}
                rowKey={(app) => app.id}
                label="Applications table"
              />
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Current CV Record</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Most recent candidate document metadata.</p>
              </div>
              {latestCv ? (
                <div className="p-3 rounded-xl bg-rf-action-soft/60 border border-rf-action-soft flex items-center gap-3">
                  <Icon name="file-text" size={20} className="text-rf-action" />
                  <div>
                    <strong className="text-xs font-bold text-rf-ink block">{latestCv.fileName}</strong>
                    <span className="text-[11px] text-rf-ink-muted font-medium">{latestCv.fileSize ? `${Math.round(latestCv.fileSize / 1024)} KB` : 'File size not reported'}</span>
                  </div>
                </div>
              ) : (
                <PageState kind="empty" title="No CV record" description="No candidate CV metadata is available." />
              )}
            </section>

            <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Recent Activity</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Candidate and application events.</p>
              </div>
              <Alert tone="info" title="Activity log not available">Activity log is not yet available.</Alert>
              <ActivityTimeline label="Recent candidate activity" items={[]} />
            </section>
          </aside>
        </div>
      )}

      {activeTab === 'applications' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-rf-ink m-0">All Applications ({applications.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Complete application history across all vacancies.</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setIsApplyModalOpen(true)}>
              <Icon name="plus" size={14} />
              Apply to vacancy
            </Button>
          </div>
          <ResponsiveDataView
            rows={applications}
            columns={[
              { key: 'vacancy', header: 'Vacancy', priority: 'primary', render: (app) => (<div><div className="font-bold">{app.positionTitle || 'Position not reported'}</div><div className="text-xs text-rf-ink-muted">{app.vacancyCode || app.vacancyId}</div></div>) },
              { key: 'stage', header: 'Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
              { key: 'source', header: 'Source', priority: 'secondary', render: (app) => <span className="font-mono text-[10.5px] text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md">{app.source || '—'}</span> },
              { key: 'applied', header: 'Applied Date', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted font-medium">{new Date(app.createdAt).toLocaleDateString()}</span> },
              { key: 'action', header: 'Action', priority: 'secondary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={`/applications/${app.id}`}>View details</Link></Button> }
            ]}
            rowKey={(app) => app.id}
            label="Applications history table"
          />
        </section>
      )}

      {activeTab === 'documents' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-rf-ink m-0">Candidate Documents ({documents.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Document records and reported scan status.</p>
            </div>
            <Button variant="primary" size="sm" asChild>
              <Link to={`/candidates/${candidate.id}/documents`}>
                <Icon name="upload" size={14} />
                Manage documents
              </Link>
            </Button>
          </div>
          <ResponsiveDataView
            rows={documents}
            columns={[
              { key: 'name', header: 'Document Name', priority: 'primary', render: (doc) => (<div className="flex items-center gap-2.5"><Icon name="document" size={16} className="text-rf-action shrink-0" /><div><div className="font-bold">{doc.documentType}</div><div className="text-xs text-rf-ink-muted">{doc.fileName}</div></div></div>) },
              { key: 'type', header: 'Type', priority: 'secondary', render: (doc) => <span className="font-mono text-xs text-rf-ink-muted">{doc.documentType}</span> },
              { key: 'scan', header: 'Scan Status', priority: 'secondary', render: (doc) => <StatusBadge status={doc.scanStatus || 'Pending'} /> },
              { key: 'uploaded', header: 'Uploaded', priority: 'secondary', render: (doc) => <span className="text-rf-ink-muted font-medium">{new Date(doc.createdAt).toLocaleDateString()}</span> }
            ]}
            rowKey={(doc) => doc.id}
            label="Documents table"
          />
        </section>
      )}

      {activeTab === 'history' && (
        <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
          <div className="pb-3 border-b border-rf-border-subtle mb-4">
            <h3 className="text-xs font-bold text-rf-ink m-0">Activity Timeline</h3>
            <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">System, recruiter, and candidate interaction audit history.</p>
          </div>
          <Alert tone="info" title="Activity log not available">Activity log is not yet available.</Alert>
          <ActivityTimeline items={[]} />
        </section>
      )}

      {/* Apply to Vacancy Modal */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Add application for candidate">
        <form onSubmit={(e) => void handleApply(e)}>
          {applyError && (
            <div style={{ marginBottom: '16px' }}>
              <Alert tone="danger" title="Application failed">
                {applyError}
              </Alert>
            </div>
          )}
          <FormField id="apply-vacancy" label="Select Vacancy" required hint="Choose an open vacancy to link this candidate.">
            <Select
              id="apply-vacancy"
              required
              value={selectedVacancyId}
              onChange={(e) => setSelectedVacancyId(e.target.value)}
            >
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vacancyCode} ({v.status})
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-center justify-end gap-2 mt-5">
            <Button variant="ghost" type="button" onClick={() => setIsApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={applySubmitting} loadingLabel="Submitting application" type="submit">
              Link application
            </Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
