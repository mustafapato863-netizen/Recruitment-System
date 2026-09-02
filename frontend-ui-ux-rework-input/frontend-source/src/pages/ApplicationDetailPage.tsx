import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getApi, patchApi, postApi } from '../api/client';
import type {
  Application,
  ApplicationStage,
  ApplicationStatusHistoryItem,
  ScreeningLog,
  ScreeningOutcome,
} from '@recruitflow/contracts';
import { PipelineStepper } from '../components/PipelineStepper';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { ResponsiveDataView } from '../components/ui/ResponsiveDataView';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

const APPLICATION_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];

const ALLOWED_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening', 'Rejected', 'Withdrawn'],
  Screening: ['Interview', 'Rejected', 'Withdrawn'],
  Interview: ['Offer', 'Rejected', 'Withdrawn'],
  Offer: ['Pre-Hire', 'Rejected', 'Withdrawn'],
  'Pre-Hire': ['Joined', 'Rejected', 'Withdrawn'],
  Joined: [],
  Rejected: ['Applied', 'Screening', 'Interview'],
  Withdrawn: ['Applied'],
};

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryItem[]>([]);
  const [screeningLogs, setScreeningLogs] = useState<ScreeningLog[]>([]);
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetStage, setTargetStage] = useState<ApplicationStage>('Screening');
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  // Phone Screening form state
  const [screeningOutcome, setScreeningOutcome] = useState<ScreeningOutcome>('Passed');
  const [screeningNotes, setScreeningNotes] = useState('');
  const [submittingScreening, setSubmittingScreening] = useState(false);
  const [screeningFeedback, setScreeningFeedback] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setScreeningError(null);
    try {
      const [app, hist] = await Promise.all([
        getApi<Application>(`/applications/${id}`),
        getApi<ApplicationStatusHistoryItem[]>(`/applications/${id}/history`),
      ]);
      setApplication(app);
      setHistory(hist);
      const allowed = ALLOWED_TRANSITIONS[app.stage as ApplicationStage] || [];
      if (allowed.length > 0) {
        setTargetStage(allowed[0]);
      }

      try {
        setScreeningLogs(await getApi<ScreeningLog[]>(`/screening/application/${id}`));
      } catch (err: unknown) {
        setScreeningLogs([]);
        setScreeningError((err as Error).message || 'Screening history is currently unavailable.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load application detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const handleStageChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !application) return;
    setUpdating(true);
    setStageError(null);

    try {
      await patchApi(`/applications/${id}/stage`, {
        stage: targetStage,
        reason,
      });
      setReason('');
      await loadData();
    } catch (err: unknown) {
      setStageError((err as Error).message || 'Failed to update application stage.');
    } finally {
      setUpdating(false);
    }
  };

  const handleScreeningSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmittingScreening(true);
    setScreeningFeedback(null);

    try {
      await postApi('/screening', {
        applicationId: id,
        outcome: screeningOutcome,
        notes: screeningNotes.trim() || undefined,
      });
      setScreeningNotes('');
      setScreeningFeedback('Phone screening log recorded successfully.');
      const updatedLogs = await getApi<ScreeningLog[]>(`/screening/application/${id}`);
      setScreeningLogs(updatedLogs);
      setScreeningError(null);
    } catch (err: unknown) {
      setScreeningError((err as Error).message || 'Failed to save screening log.');
    } finally {
      setSubmittingScreening(false);
    }
  };

  if (loading) {
    return (
      <PageFrame eyebrow="Recruitment Pipeline" title="Application Details" description="Loading application...">
        <PageState kind="loading" title="Loading application" description="Fetching application progress and evaluation history." />
      </PageFrame>
    );
  }

  if (error && !application) {
    const isForbidden = error?.toLowerCase().includes('denied') || error?.toLowerCase().includes('permission') || error?.includes('403');
    return (
      <PageFrame eyebrow="Recruitment Pipeline" title="Application Details" description="Application detail view.">
        {isForbidden ? (
          <PageState
            kind="forbidden"
            title="Access Restricted"
            description="You do not have the required permissions to view this application."
            actionLabel="Back to Applications"
            onAction={() => navigate('/applications')}
          />
        ) : (
          <PageState
            kind="error"
            title="Unable to load application"
            description={error}
            actionLabel="Retry"
            onAction={() => void loadData()}
          />
        )}
      </PageFrame>
    );
  }

  if (!application) return null;

  const candidateName = application.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : 'Candidate';

  const allowedTransitions = ALLOWED_TRANSITIONS[application.stage as ApplicationStage] || [];
  const currentStepIndex = Math.max(0, APPLICATION_STAGES.indexOf(application.stage));

  return (
    <PageFrame
      eyebrow={`Applications / ${application.applicationCode || application.id.slice(0, 8)}`}
      title={`Application ${application.applicationCode || application.id.slice(0, 8)}`}
      description={`${candidateName} applying for ${application.positionTitle || 'Position not reported'} (${application.vacancyCode || '—'})`}
      actions={
        <>
          <StatusBadge status={application.stage} />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/applications">
              <Icon name="arrow-left" size={13} />
              Back to pipeline
            </Link>
          </Button>
          {application.candidate && (
            <Button variant="primary" size="sm" asChild>
              <Link to={`/candidates/${application.candidate.id}`}>
                <Icon name="users" size={14} />
                Candidate profile
              </Link>
            </Button>
          )}
        </>
      }
    >
      <div className="bg-white p-4 rounded-2xl border border-rf-border-subtle/90 shadow-xs">
        <PipelineStepper steps={APPLICATION_STAGES} currentStep={currentStepIndex} />
      </div>

      {stageError && (
        <Alert tone="danger" title="Stage change error">
          {stageError}
        </Alert>
      )}

      {screeningError && (
        <Alert
          tone="danger"
          title="Screening history unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {screeningError}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rf-panel rf-detail-hero rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Application Summary</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Stage, rating, next action and owner are application-specific.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Candidate Name</span>
                <strong className="text-rf-ink font-bold">{candidateName}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Email</span>
                <strong className="text-rf-ink font-bold">{application.candidate?.email || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Position Title</span>
                <strong className="text-rf-ink font-bold">{application.positionTitle || 'Position not reported'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Vacancy Code</span>
                <strong className="text-rf-ink font-bold">{application.vacancyCode || '—'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Applied Date</span>
                <strong className="text-rf-ink font-bold">{new Date(application.createdAt).toLocaleDateString()}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Source</span>
                <strong className="text-rf-ink font-bold">{application.source || '—'}</strong>
              </div>
            </div>
          </section>

          {/* Advance Pipeline Stage */}
          {allowedTransitions.length > 0 && (
            <section className="rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Advance Pipeline Stage</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Move candidate to the next valid stage with an audit reason.</p>
              </div>
              <form onSubmit={(e) => void handleStageChange(e)}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="target-stage" label="Next Stage" required>
                    <Select
                      id="target-stage"
                      value={targetStage}
                      onChange={(e) => setTargetStage(e.target.value as ApplicationStage)}
                    >
                      {allowedTransitions.map((stg) => (
                        <option key={stg} value={stg}>
                          {stg}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id="stage-reason" label="Transition Reason" hint="Optional rationale for stage movement.">
                    <Input
                      id="stage-reason"
                      placeholder="e.g. Passed technical evaluation"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </FormField>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="primary" loading={updating} loadingLabel="Updating stage" type="submit">
                    Advance stage
                  </Button>
                </div>
              </form>
            </section>
          )}

          {/* Phone Screening Evaluation */}
          <section className="rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Phone Screening ({screeningLogs.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Record recruiter initial phone screening and qualification notes.</p>
            </div>

            {screeningFeedback && (
              <Alert tone="success" title="Recorded">
                {screeningFeedback}
              </Alert>
            )}

            {screeningLogs.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-4">
                {screeningLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/60">
                    <div className="flex items-center justify-between pb-2 border-b border-rf-border-subtle">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={log.outcome} />
                        <span className="font-bold text-xs text-rf-ink">{log.screenerName || 'Recruiter'}</span>
                      </div>
                      <span className="text-[11px] text-rf-ink-muted font-medium">{new Date(log.screenedAt).toLocaleString()}</span>
                    </div>
                    {log.notes && <p className="text-xs text-slate-700 font-medium m-0 mt-2 leading-relaxed">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handleScreeningSubmit(e)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="screening-outcome" label="Screening Outcome" required>
                  <Select
                    id="screening-outcome"
                    value={screeningOutcome}
                    onChange={(e) => setScreeningOutcome(e.target.value as ScreeningOutcome)}
                  >
                    <option value="Passed">Passed — Recommend for Interview</option>
                    <option value="Failed">Failed — Unqualified</option>
                    <option value="On Hold">On Hold — Fit for other role</option>
                  </Select>
                </FormField>
                <FormField id="screening-notes" label="Screening Notes" hint="Summary of candidate discussion.">
                  <Input

                    id="screening-notes"
                    placeholder="e.g. Strong fundamentals, salary aligned"
                    value={screeningNotes}
                    onChange={(e) => setScreeningNotes(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" size="sm" loading={submittingScreening} loadingLabel="Saving log" type="submit">
                  Add screening record
                </Button>
              </div>
            </form>
          </section>

          <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle/90 bg-white shadow-xs">
            <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle/50">
              <h3 className="text-xs font-bold text-rf-ink m-0">Stage History & Transitions ({history.length})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Chronological record of candidate progression.</p>
            </div>
            {history.length === 0 ? (
              <PageState kind="empty" title="No stage transitions" description="No stage movements recorded yet." />
            ) : (
              <ResponsiveDataView<ApplicationStatusHistoryItem>
                rows={history}
                rowKey={(row) => row.id || `${row.applicationId}-${row.toStage}-${row.createdAt}`}
                label="Stage History"
                columns={[
                  { key: 'stage', header: 'Stage', render: (row) => <StatusBadge status={row.toStage} /> },
                  { key: 'movedBy', header: 'Moved By', render: (row) => <span className="text-rf-ink font-medium">{row.changedByName || 'System'}</span> },
                  { key: 'movedAt', header: 'Moved At', render: (row) => <span className="text-rf-ink-muted font-medium text-xs">{new Date(row.createdAt).toLocaleString()}</span> },
                  { key: 'notes', header: 'Notes', render: (row) => <span className="text-rf-ink-muted font-medium">{row.reason || 'Workflow progression'}</span> },
                ]}
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Candidate Profile</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Linked person record.</p>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                {(application.candidate?.firstName?.[0] || 'C') + (application.candidate?.lastName?.[0] || 'P')}
              </div>
              <div>
                <strong className="text-xs font-bold text-rf-ink block">{candidateName}</strong>
                <span className="text-[11px] text-rf-ink-muted font-medium">{application.candidate?.email || 'N/A'}</span>
              </div>
            </div>
            {application.candidate && (
              <Button variant="secondary" size="sm" className="w-full" asChild>
                <Link to={`/candidates/${application.candidate.id}`}>Open candidate profile</Link>
              </Button>
            )}
          </section>

          <section className="rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Next Pipeline Actions</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Schedule interviews or extend offer.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" asChild>
                <Link to="/interviews">
                  <Icon name="calendar" size={14} />
                  Schedule interview
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/offers/create">
                  <Icon name="offer" size={14} />
                  Create offer package
                </Link>
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </PageFrame>
  );
}
