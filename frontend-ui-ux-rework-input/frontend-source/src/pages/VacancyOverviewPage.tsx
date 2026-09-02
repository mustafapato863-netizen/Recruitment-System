import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { VacancyDetailView, VacancyStatus, Application, PaginatedResult, Interview, Offer } from '@recruitflow/contracts';
import { fetchApi, getApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { Tabs } from '../components/ui/Tabs';
import { ResponsiveDataView } from '../components/ui/ResponsiveDataView';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './PageEnhancementsV2.css';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'success' | 'danger' | 'warning';
  icon?: IconName;
  action: () => Promise<void>;
}

const initialConfirmState: ConfirmState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  tone: 'primary',
  action: async () => {},
};

export function VacancyOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<VacancyDetailView | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [vRes, appsRes, intsRes, offsRes] = await Promise.allSettled([
        fetchApi<VacancyDetailView>(`/vacancies/${id}`),
        getApi<PaginatedResult<Application>>(`/applications?vacancyId=${id}&pageSize=100`),
        getApi<Interview[]>('/interviews'),
        getApi<Offer[]>('/offers'),
      ]);

      if (vRes.status === 'fulfilled') {
        setVacancy(vRes.value);
      } else {
        throw new Error('Unable to load this vacancy');
      }

      if (appsRes.status === 'fulfilled') {
        setApplications(appsRes.value.data || []);
      } else {
        setApplications([]);
      }

      if (intsRes.status === 'fulfilled') {
        setInterviews(intsRes.value || []);
      } else {
        setInterviews([]);
      }

      if (offsRes.status === 'fulfilled') {
        setOffers(offsRes.value || []);
      } else {
        setOffers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this vacancy');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const triggerUpdateStatus = (status: VacancyStatus) => {
    if (!id || !vacancy) return;
    const isOpen = status === 'Open';
    setConfirmDialog({
      isOpen: true,
      title: `Change Vacancy Status to ${status}`,
      description: isOpen
        ? `Opening this vacancy will allow publishing it to candidate pipelines and active sourcing.`
        : `Putting this vacancy on hold will pause candidate progression and new applications.`,
      confirmLabel: `Set as ${status}`,
      tone: isOpen ? 'success' : 'warning',
      icon: isOpen ? 'check-circle' : 'alert-triangle',
      action: async () => {
        setBusyAction(true);
        try {
          await fetchApi(`/vacancies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to update vacancy status');
        } finally {
          setBusyAction(false);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <PageFrame eyebrow="Vacancy Management" title="Vacancy Overview" description="Review vacancy details, funnel and ownership.">
        <PageState kind="loading" title="Loading vacancy" description="Fetching vacancy progress and metadata." />
      </PageFrame>
    );
  }

  if (!vacancy) {
    return (
      <PageFrame eyebrow="Vacancy Management" title="Vacancy Not Found" description="The requested vacancy could not be located.">
        <PageState
          kind="not-found"
          title="Vacancy Not Found"
          description={error || 'The requested vacancy record was not found or has been removed.'}
          actionLabel="Back to Vacancies"
          onAction={() => navigate('/vacancies')}
        />
      </PageFrame>
    );
  }

  const remainingHeadcount = Math.max(0, vacancy.approvedHeadcount - vacancy.joinedHeadcount);
  const funnel = [
    { label: 'Applied', count: vacancy.funnelCounts?.applied ?? 0 },
    { label: 'Screening', count: vacancy.funnelCounts?.screening ?? 0 },
    { label: 'Interviews', count: vacancy.funnelCounts?.interviews ?? 0 },
    { label: 'Offer', count: vacancy.funnelCounts?.offer ?? 0 },
    { label: 'Pre-Hire', count: vacancy.funnelCounts?.preHire ?? 0 },
    { label: 'Joined', count: vacancy.funnelCounts?.joined ?? vacancy.joinedHeadcount },
  ];

  const appIds = new Set(applications.map((a) => a.id));
  const vacancyInterviews = interviews.filter((i) => appIds.has(i.applicationId));
  const vacancyOffers = offers.filter((o) => appIds.has(o.applicationId));
  const joinedApplications = applications.filter((a) => a.stage === 'Joined');

  const getCandidateName = (app: Application) => {
    if (app.candidate) {
      return `${app.candidate.firstName || ''} ${app.candidate.lastName || ''}`.trim() || 'Candidate';
    }
    return 'Candidate';
  };

  return (
    <PageFrame
      eyebrow={`Vacancy / ${vacancy.vacancyCode}`}
      title={vacancy.positionTitle || vacancy.vacancyCode}
      description={`Branch: ${vacancy.branchName || vacancy.branchId} · Code: ${vacancy.vacancyCode}`}
      actions={
        <>
          <StatusBadge status={vacancy.status} />
          {vacancy.status === 'Pending Activation' && (
            <Button
              variant="primary"
              size="sm"
              loading={busyAction}
              loadingLabel="Publishing"
              onClick={() => triggerUpdateStatus('Open')}
            >
              Open Vacancy
            </Button>
          )}
          {vacancy.status === 'On Hold' && (
            <Button
              variant="primary"
              size="sm"
              loading={busyAction}
              loadingLabel="Resuming"
              onClick={() => triggerUpdateStatus('Open')}
            >
              Resume Vacancy
            </Button>
          )}
          {vacancy.status === 'Open' && (
            <Button
              variant="secondary"
              size="sm"
              loading={busyAction}
              loadingLabel="Updating"
              onClick={() => triggerUpdateStatus('On Hold')}
            >
              Put on Hold
            </Button>
          )}
          <Button variant="primary" size="sm" asChild>
            <Link to={`/applications?vacancyId=${vacancy.id}`}>
              <Icon name="users" size={14} />
              View Pipeline
            </Link>
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" title="Update failed">
          {error}
        </Alert>
      )}

      <Tabs
        ariaLabel="Vacancy sections"
        activeKey={activeTab}
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'applications', label: `Applicants (${applications.length})` },
          { key: 'interviews', label: `Interviews (${vacancyInterviews.length})` },
          { key: 'offers', label: `Offers (${vacancyOffers.length})` },
          { key: 'hires', label: `Activity (${joinedApplications.length})` },
        ]}
        onChange={setActiveTab}
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Approved Headcount" value={vacancy.approvedHeadcount} detail="Approved positions" tone="action" icon={<Icon name="users" size={14} />} />
        <MetricCard label="Joined Candidates" value={vacancy.joinedHeadcount} detail="Actual joining confirmed" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Offers In Pipeline" value={vacancy.funnelCounts?.offer ?? 0} detail="Pending/accepted offers" tone="info" icon={<Icon name="offer" size={14} />} />
        <MetricCard label="Remaining Seats" value={remainingHeadcount} detail="Open positions to fill" tone="warning" icon={<Icon name="clock" size={14} />} />
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <section className="rf-panel rf-detail-hero rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Vacancy Recruitment Funnel</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Candidate movement across workflow stages.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-4 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
                {funnel.map((step) => (
                  <div key={step.label} className="flex flex-col items-center justify-center p-3 rounded-xl bg-rf-surface border border-rf-border-subtle shadow-2xs text-center">
                    <span className="text-lg font-extrabold text-rf-action tabular-nums">{step.count}</span>
                    <span className="text-[11px] font-bold text-rf-ink-muted mt-0.5">{step.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Position & Vacancy Information</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Approved requisition metadata.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Legal Entity</span>
                  <strong className="text-rf-ink font-bold">{vacancy.legalEntityName || '—'}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Branch Location</span>
                  <strong className="text-rf-ink font-bold">{vacancy.branchName || vacancy.branchId}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Position Title</span>
                  <strong className="text-rf-ink font-bold">{vacancy.positionTitle || vacancy.positionId}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Employment Type</span>
                  <strong className="text-rf-ink font-bold">{vacancy.vacancyRequest?.employmentType || '—'}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Approved Headcount</span>
                  <strong className="text-rf-ink font-bold">{vacancy.approvedHeadcount} positions</strong>
                </div>
                <div>
                  <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Requisition Request Code</span>
                  <strong className="text-rf-ink font-bold">{vacancy.vacancyRequest?.requestCode || '—'}</strong>
                </div>
              </div>
            </section>

            <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
              <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
                <h3 className="text-xs font-bold text-rf-ink m-0">Recent Applications ({applications.length})</h3>
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/applications?vacancyId=${vacancy.id}`}>View full pipeline</Link>
                </Button>
              </div>
              <ResponsiveDataView
                rows={applications.slice(0, 5)}
                columns={[
                  { key: 'candidate', header: 'Candidate', priority: 'primary', render: (app) => <div className="font-bold text-xs text-rf-ink">{getCandidateName(app)}</div> },
                  { key: 'stage', header: 'Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
                  { key: 'applied', header: 'Applied', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted text-xs">{new Date(app.createdAt).toLocaleDateString()}</span> },
                  { key: 'action', header: 'Action', priority: 'secondary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={`/applications/${app.id}`}>View</Link></Button> },
                ]}
                rowKey={(app) => app.id}
                label="Recent applications table"
              />
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Position Status & Demand</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Current operational state.</p>
              </div>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-rf-ink-muted">Lifecycle Status</span>
                  <StatusBadge status={vacancy.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rf-ink-muted">Created</span>
                  <span className="font-medium text-rf-ink">{new Date(vacancy.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rf-ink-muted">Vacancy Code</span>
                  <span className="font-mono font-bold text-rf-ink">{vacancy.vacancyCode}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}

      {activeTab === 'applications' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-rf-ink m-0">All Applications ({applications.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Candidates progressing through this vacancy.</p>
            </div>
            <Button variant="primary" size="sm" asChild>
              <Link to={`/applications?vacancyId=${vacancy.id}`}>Open in Pipeline Board</Link>
            </Button>
          </div>
          {applications.length === 0 ? (
            <div className="p-8">
              <PageState kind="empty" title="No applications recorded" description="No candidates have applied to this vacancy yet." />
            </div>
          ) : (
            <ResponsiveDataView
              rows={applications}
              columns={[
                { key: 'candidate', header: 'Candidate', priority: 'primary', render: (app) => <div><div className="font-bold text-xs text-rf-ink">{getCandidateName(app)}</div><div className="text-[11px] text-rf-ink-muted">{app.candidate?.email || '—'}</div></div> },
                { key: 'stage', header: 'Current Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
                { key: 'source', header: 'Source', priority: 'tertiary', render: (app) => <span className="font-mono text-[10.5px] text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md">{app.source || '—'}</span> },
                { key: 'applied', header: 'Applied Date', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted text-xs">{new Date(app.createdAt).toLocaleDateString()}</span> },
                { key: 'action', header: 'Action', priority: 'primary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={`/applications/${app.id}`}>View details</Link></Button> },
              ]}
              rowKey={(app) => app.id}
              label="Vacancy applications table"
            />
          )}
        </section>
      )}

      {activeTab === 'interviews' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-rf-ink m-0">Scheduled Interviews ({vacancyInterviews.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Evaluation rounds conducted for this vacancy.</p>
            </div>
          </div>
          {vacancyInterviews.length === 0 ? (
            <div className="p-8">
              <PageState kind="empty" title="No interviews scheduled" description="No candidate interviews have been scheduled for this vacancy." />
            </div>
          ) : (
            <ResponsiveDataView
              rows={vacancyInterviews}
              columns={[
                { key: 'title', header: 'Round / Title', priority: 'primary', render: (inv) => <div><div className="font-bold text-xs text-rf-ink">{inv.title}</div><div className="text-[11px] text-rf-ink-muted">{inv.candidateName || 'Candidate'}</div></div> },
                { key: 'type', header: 'Interview Type', priority: 'secondary', render: (inv) => <span className="font-bold text-xs text-rf-ink">{inv.interviewType}</span> },
                { key: 'start', header: 'Scheduled Start', priority: 'secondary', render: (inv) => <span className="text-rf-ink-muted text-xs">{new Date(inv.scheduledStart).toLocaleString()}</span> },
                { key: 'status', header: 'Status', priority: 'secondary', render: (inv) => <StatusBadge status={inv.status} /> },
                { key: 'action', header: 'Action', priority: 'primary', render: (inv) => <Button variant="secondary" size="sm" asChild><Link to={`/interviews/${inv.id}`}>View scorecard</Link></Button> },
              ]}
              rowKey={(inv) => inv.id}
              label="Vacancy interviews table"
            />
          )}
        </section>
      )}

      {activeTab === 'offers' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-rf-ink m-0">Offers In Pipeline ({vacancyOffers.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Offer letters and compensation packages extended for this vacancy.</p>
            </div>
          </div>
          {vacancyOffers.length === 0 ? (
            <div className="p-8">
              <PageState kind="empty" title="No offers extended" description="No candidate offers have been prepared for this vacancy yet." />
            </div>
          ) : (
            <ResponsiveDataView
              rows={vacancyOffers}
              columns={[
                { key: 'code', header: 'Offer Code', priority: 'primary', render: (o) => <span className="font-mono font-bold text-xs text-rf-ink">{o.offerCode}</span> },
                { key: 'candidate', header: 'Candidate', priority: 'primary', render: (o) => <span className="font-bold text-xs text-rf-ink">{o.candidateName || 'Candidate'}</span> },
                { key: 'status', header: 'Status', priority: 'secondary', render: (o) => <StatusBadge status={o.status} /> },
                { key: 'created', header: 'Created Date', priority: 'secondary', render: (o) => <span className="text-rf-ink-muted text-xs">{new Date(o.createdAt).toLocaleDateString()}</span> },
                { key: 'action', header: 'Action', priority: 'primary', render: (o) => <Button variant="secondary" size="sm" asChild><Link to={`/offers/${o.id}`}>View offer</Link></Button> },
              ]}
              rowKey={(o) => o.id}
              label="Vacancy offers table"
            />
          )}
        </section>
      )}

      {activeTab === 'hires' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-rf-ink m-0">Activity & Confirmed Hires ({joinedApplications.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Audit log of candidate progression and confirmed hires.</p>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/hires">Open Hire Management</Link>
            </Button>
          </div>
          {joinedApplications.length === 0 ? (
            <div className="p-8">
              <PageState kind="empty" title="No confirmed hires" description="No candidates have reached the Hired stage yet." />
            </div>
          ) : (
            <ResponsiveDataView
              rows={joinedApplications}
              columns={[
                { key: 'candidate', header: 'Hired Candidate', priority: 'primary', render: (app) => <span className="font-bold text-xs text-rf-ink">{getCandidateName(app)}</span> },
                { key: 'stage', header: 'Stage', priority: 'secondary', render: (app) => <StatusBadge status={app.stage} /> },
                { key: 'joined', header: 'Hired Date', priority: 'secondary', render: (app) => <span className="text-rf-ink-muted text-xs">{new Date(app.updatedAt).toLocaleDateString()}</span> },
                { key: 'action', header: 'Action', priority: 'primary', render: (app) => <Button variant="secondary" size="sm" asChild><Link to={`/applications/${app.id}`}>View Case</Link></Button> },
              ]}
              rowKey={(app) => app.id}
              label="Vacancy hires table"
            />
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(initialConfirmState)}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        icon={confirmDialog.icon}
        isLoading={busyAction}
      />
    </PageFrame>
  );
}
