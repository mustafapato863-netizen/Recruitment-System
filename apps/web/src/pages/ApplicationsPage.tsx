import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Application, ApplicationStage, PaginatedResult } from '@recruitflow/contracts';
import { getInitials } from '../utils/format';
import { PipelineBoard, type PipelineStageColumn } from '../components/ui/PipelineBoard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { CandidateSplitDrawer } from '../components/candidate/CandidateSplitDrawer';
import { RecruiterTargetProgressBar } from '../components/targets/RecruiterTargetProgressBar';
import { RecruiterTargetSettingsModal } from '../components/targets/RecruiterTargetSettingsModal';
import './PageEnhancementsV2.css';

const STAGES: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined', 'Rejected', 'Withdrawn'];

function isApplicationStage(value: string): value is ApplicationStage {
  return STAGES.some((stage) => stage === value);
}

export function ApplicationsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingApplicationId, setMovingApplicationId] = useState<string | null>(null);

  // Split Drawer & Target state
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  const canManageTargets = user?.permissions.includes('VACANCY_MANAGE') || user?.permissions.includes('USERS_MANAGE');

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = vacancyId
        ? `/applications?vacancyId=${vacancyId}&page=1&pageSize=100`
        : '/applications?page=1&pageSize=100';
      const res = await getApi<PaginatedResult<Application>>(url);
      setApplications(res.data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
  }, [vacancyId]);

  const grouped = useMemo(() => {
    const groups: Record<string, Application[]> = {};
    for (const stage of STAGES) groups[stage] = [];
    for (const app of applications) {
      if (groups[app.stage]) {
        groups[app.stage].push(app);
      } else {
        if (!groups['Applied']) groups['Applied'] = [];
        groups['Applied'].push(app);
      }
    }
    return groups;
  }, [applications]);

  const pipelineColumns: PipelineStageColumn[] = STAGES.map((stage) => ({
    id: stage.toLowerCase().replace(/\s+/g, '-'),
    name: stage,
    cards: (grouped[stage] || []).map((app) => {
      const candidateName = app.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`
        : 'Candidate Profile';
      return {
        id: app.id,
        name: candidateName,
        role: app.positionTitle || app.vacancyCode || 'Position not specified',
        initials: app.candidate ? getInitials(candidateName) : 'CP',
        stageName: stage,
        allowedStages: user?.permissions.includes('APPLICATION_MOVE_STAGE') ? app.allowedTransitions : [],
      };
    }),
  }));

  const moveApplication = async (applicationId: string, nextStage: string) => {
    if (movingApplicationId) return;
    const application = applications.find((item) => item.id === applicationId);
    if (!application || !isApplicationStage(nextStage) || !application.allowedTransitions.includes(nextStage)) return;

    const previousApplications = applications;
    setMoveError(null);
    setMovingApplicationId(applicationId);
    setApplications((current) => current.map((item) => (
      item.id === applicationId
        ? { ...item, stage: nextStage, allowedTransitions: [] }
        : item
    )));

    try {
      const updated = await patchApi<Application>(`/applications/${applicationId}/stage`, { stage: nextStage });
      setApplications((current) => current.map((item) => (item.id === applicationId ? updated : item)));
      if (selectedApplication?.id === applicationId) {
        setSelectedApplication(updated);
      }
    } catch (reason: unknown) {
      setApplications(previousApplications);
      setMoveError(reason instanceof Error ? reason.message : 'Unable to move this application.');
    } finally {
      setMovingApplicationId(null);
    }
  };

  const handleOpenDrawer = (applicationId: string) => {
    const found = applications.find((a) => a.id === applicationId);
    if (found) {
      setSelectedApplication(found);
    }
  };

  return (
    <PageFrame
      eyebrow="Recruitment Operations"
      title="Candidate Pipeline & Fast Review"
      description="Odoo-style kanban pipeline: drag candidates between stages, click for split-screen CV review, 1-click scorecard, and live targets."
      actions={
        <div className="flex items-center gap-2">
          {canManageTargets && (
            <Button variant="secondary" size="sm" onClick={() => setIsTargetModalOpen(true)}>
              <Icon name="settings" size={13} />
              Set Targets
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void fetchApplications()}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link to="/candidates">
              <Icon name="plus" size={14} />
              Add Candidate
            </Link>
          </Button>
        </div>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Pipeline unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => void fetchApplications()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {moveError && <Alert tone="danger" title="Stage move failed">{moveError}</Alert>}

      {/* Recruiter Activity & KPI Targets Component */}
      <RecruiterTargetProgressBar
        canConfigure={canManageTargets}
        onConfigureClick={() => setIsTargetModalOpen(true)}
      />

      {loading ? (
        <PageState kind="loading" title="Loading recruitment pipeline" description="Fetching active candidate applications." />
      ) : applications.length === 0 ? (
        <PageState kind="empty" title="No applications in this pipeline" description="Applications will appear here when candidates are linked to an opening." />
      ) : (
        <section className="rf-panel rf-long-content overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-3 shadow-[var(--shadow-card)] sm:p-4">
          <div className="mb-3 flex flex-col gap-1 border-b border-rf-border-subtle px-1 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="m-0 text-xs font-extrabold text-rf-ink">Live Kanban Stage Board</h2>
              <p className="m-0 mt-0.5 text-[11px] font-medium text-rf-ink-muted">
                Drag by handle or click &ldquo;Inspect &amp; Score&rdquo; to open the split-screen CV reviewer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rf-border-subtle bg-rf-action-soft px-2.5 py-1 text-[10px] font-bold text-rf-action">
                <span className="h-1.5 w-1.5 rounded-full bg-rf-action" />
                {applications.length} applications
              </span>
            </div>
          </div>

          <PipelineBoard
            columns={pipelineColumns}
            movingCardId={movingApplicationId}
            onCardMove={(card, stageName) => moveApplication(card.id, stageName)}
            renderExtra={(card) => {
              const app = applications.find((item) => item.id === card.id);
              return (
                <div className="pipeline-card-extra space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[11px] text-rf-ink-muted">
                    <span>Source: {app?.source || 'Direct'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDrawer(card.id);
                      }}
                    >
                      <Icon name="file-text" size={13} />
                      Inspect &amp; Score
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </section>
      )}

      {/* Candidate Split Review Drawer */}
      <CandidateSplitDrawer
        isOpen={Boolean(selectedApplication)}
        application={selectedApplication}
        onClose={() => setSelectedApplication(null)}
        onMoveStage={async (id, nextStage) => {
          await moveApplication(id, nextStage);
        }}
        onCallLogged={() => {
          // Increment local target tracker
          const saved = localStorage.getItem('recruitflow_targets_Daily');
          if (saved) {
            const data = JSON.parse(saved);
            data.calls.actual += 1;
            localStorage.setItem('recruitflow_targets_Daily', JSON.stringify(data));
          }
        }}
        onScorecardSubmitted={() => {
          // Increment screening/interview tracker
          const saved = localStorage.getItem('recruitflow_targets_Daily');
          if (saved) {
            const data = JSON.parse(saved);
            data.interviews.actual += 1;
            localStorage.setItem('recruitflow_targets_Daily', JSON.stringify(data));
          }
        }}
      />

      {/* Target Settings Modal */}
      <RecruiterTargetSettingsModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onSaved={() => setIsTargetModalOpen(false)}
      />
    </PageFrame>
  );
}
