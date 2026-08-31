import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getApi, patchApi, postApi } from '../api/client';
import type { Interview, InterviewScorecardItem, InterviewStatus } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Scorecard, type Recommendation } from '../components/ui/Scorecard';
import { StatusBadge } from '../components/StatusBadge';
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

export function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const [rating, setRating] = useState(4);
  const [recommendation, setRecommendation] = useState<InterviewScorecardItem['recommendation']>('Hire');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [, setSubmitting] = useState(false);
  const [scorecardError, setScorecardError] = useState<string | null>(null);
  const [scorecardSuccess, setScorecardSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getApi<Interview>(`/interviews/${id}`);
      setInterview(res);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load interview details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const triggerUpdateStatus = (status: InterviewStatus) => {
    if (!id || !interview) return;
    const isCompleted = status === 'Completed';
    const isCancelled = status === 'Cancelled';
    setConfirmDialog({
      isOpen: true,
      title: `Update Interview Status to ${status}`,
      description: isCompleted
        ? `Mark this interview session as completed. Scorecards submitted will count towards candidate progression.`
        : isCancelled
        ? `Cancelling this session will remove it from the active schedule.`
        : `Change session status to ${status}.`,
      confirmLabel: `Mark as ${status}`,
      tone: isCompleted ? 'success' : isCancelled ? 'danger' : 'primary',
      icon: isCompleted ? 'check-circle' : isCancelled ? 'close' : 'calendar',
      action: async () => {
        setBusyAction(status);
        setScorecardError(null);
        setScorecardSuccess(null);
        try {
          await patchApi(`/interviews/${id}`, { status });
          setScorecardSuccess(`Interview marked as ${status}.`);
          await loadData();
        } catch (err: unknown) {
          setScorecardError((err as Error).message || `Failed to update interview status to ${status}.`);
        } finally {
          setBusyAction(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  const handleSubmitScorecard = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setScorecardError(null);
    setScorecardSuccess(null);

    try {
      await postApi(`/interviews/${id}/scorecard`, {
        overallRating: rating,
        recommendation,
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setScorecardSuccess('Scorecard evaluation submitted successfully.');
      setStrengths('');
      setConcerns('');
      setNotes('');
      await loadData();
    } catch (err: unknown) {
      setScorecardError((err as Error).message || 'Failed to submit scorecard.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageFrame eyebrow="Interviews" title="Interview Evaluation" description="Loading interview session...">
        <PageState kind="loading" title="Loading interview details" description="Fetching scheduled interview and scorecards." />
      </PageFrame>
    );
  }

  if (error || !interview) {
    const isForbidden = error?.toLowerCase().includes('denied') || error?.toLowerCase().includes('permission') || error?.includes('403');
    return (
      <PageFrame eyebrow="Interviews" title="Interview Evaluation" description="Evaluation scorecard.">
        {isForbidden ? (
          <PageState
            kind="forbidden"
            title="Access Restricted"
            description="You do not have the required permissions to view this interview."
            actionLabel="Back to Interviews"
            onAction={() => navigate('/interviews')}
          />
        ) : (
          <PageState
            kind="not-found"
            title="Interview Not Found"
            description="The requested interview record does not exist or has been removed."
            actionLabel="Back to Interviews"
            onAction={() => navigate('/interviews')}
          />
        )}
      </PageFrame>
    );
  }

  const isScheduled = interview.status === 'Scheduled';

  return (
    <PageFrame
      eyebrow={`Interviews / ${interview.interviewCode}`}
      title={`${interview.title} — ${interview.candidateName || 'Candidate'}`}
      description={`${interview.positionTitle || 'Position'} · ${interview.interviewType} Round`}
      actions={
        <>
          <StatusBadge status={interview.status} />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/interviews">
              <Icon name="arrow-left" size={13} />
              Back to interviews
            </Link>
          </Button>
          {isScheduled && (
            <>
              <Button
                variant="danger"
                size="sm"
                loading={busyAction === 'Cancelled'}
                loadingLabel="Cancelling"
                onClick={() => triggerUpdateStatus('Cancelled')}
              >
                Cancel Interview
              </Button>
              <Button
                variant="success"
                size="sm"
                loading={busyAction === 'Completed'}
                loadingLabel="Completing"
                onClick={() => triggerUpdateStatus('Completed')}
              >
                <Icon name="check-circle" size={14} />
                Mark Completed
              </Button>
            </>
          )}
        </>
      }
    >
      {scorecardError && (
        <Alert tone="danger" title="Action error">
          {scorecardError}
        </Alert>
      )}

      {scorecardSuccess && (
        <Alert tone="success" title="Success">
          {scorecardSuccess}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Submitted Scorecards List */}
          {interview.scorecards && interview.scorecards.length > 0 && (
            <section className="rf-panel rf-detail-hero rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Submitted Scorecards ({interview.scorecards.length})</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Evaluations from designated interviewers.</p>
              </div>
              <div className="flex flex-col gap-3">
                {interview.scorecards.map((sc) => (
                  <div key={sc.id} className="p-4 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-2 border-b border-rf-border-subtle">
                      <div className="flex items-center gap-2.5">
                        <strong className="text-xs font-bold text-rf-ink">{sc.interviewerName || 'Interviewer'}</strong>
                        <span className="text-rf-warning font-bold text-xs">
                          {'★'.repeat(sc.overallRating)} <span className="text-rf-ink-muted font-semibold">({sc.overallRating}/5)</span>
                        </span>
                      </div>
                      <StatusBadge status={sc.recommendation} />
                    </div>
                    {sc.strengths && (
                      <p className="text-xs text-rf-ink font-medium m-0 leading-relaxed">
                        <strong className="text-rf-ink">Strengths:</strong> {sc.strengths}
                      </p>
                    )}
                    {sc.concerns && (
                      <p className="text-xs text-rf-ink font-medium m-0 leading-relaxed">
                        <strong className="text-rf-ink">Concerns:</strong> {sc.concerns}
                      </p>
                    )}
                    {sc.notes && (
                      <p className="text-xs text-rf-ink-muted font-medium m-0 leading-relaxed">
                        <strong className="text-rf-ink">Notes:</strong> {sc.notes}
                      </p>
                    )}
                    <small className="text-[10.5px] text-rf-ink-muted font-medium pt-1">
                      Submitted {new Date(sc.submittedAt).toLocaleString()}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Scorecard Submission Form */}
          <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
            <Scorecard
              title="Submit Competency Scorecard"
              interviewer="Interviewer"
              recommendation={recommendation === 'Strong Hire' ? 'strong_hire' : recommendation === 'No Hire' || recommendation === 'Strong No Hire' ? 'no_hire' : 'hire'}
              onRecommendationChange={(val: Recommendation) => {
                setRecommendation(val === 'strong_hire' ? 'Strong Hire' : val === 'no_hire' ? 'No Hire' : 'Hire');
              }}
              categories={[{ id: 'overall', name: 'Overall Rating', criteria: [{ id: 'overall_rating', name: 'Evaluation', rating }] }]}
              onRatingChange={(_catId: string, _critId: string, newRating: number) => setRating(newRating)}
              onSubmit={() => void handleSubmitScorecard()}
              submitLabel="Submit evaluation scorecard"
            />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Meeting Details</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Session logistics.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Location / Link</span>
                <strong className="text-rf-ink font-bold">{interview.locationUrl || '—'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Timezone</span>
                <strong className="text-rf-ink font-bold">{interview.timezone || '—'}</strong>
              </div>
            </div>
          </section>

          <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Designated Panel ({interview.attendees?.length || 0})</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Assigned interviewers.</p>
            </div>
            {interview.attendees && interview.attendees.length > 0 ? (
              <div className="flex flex-col gap-2">
                {interview.attendees.map((att) => (
                  <div key={att.id} className="flex justify-between items-center p-2 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="font-bold text-xs text-rf-ink">{att.userName || 'Interviewer'}</span>
                    <StatusBadge status={att.response || 'Pending'} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-rf-ink-muted text-xs font-medium">No designated attendees assigned.</p>
            )}
          </section>

          <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Candidate Profile</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Person under evaluation.</p>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center font-bold text-sm border border-rf-action-soft">
                {interview.candidateName ? interview.candidateName.slice(0, 2).toUpperCase() : 'CP'}
              </div>
              <div>
                <strong className="text-xs font-bold text-rf-ink block">{interview.candidateName || 'Candidate Profile'}</strong>
                <span className="text-[11px] text-rf-ink-muted font-medium">{interview.positionTitle || 'Position not reported'}</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full" asChild>
              <Link to={`/applications/${interview.applicationId}`}>Open application pipeline</Link>
            </Button>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(initialConfirmState)}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        icon={confirmDialog.icon}
        isLoading={busyAction !== null}
      />
    </PageFrame>
  );
}
