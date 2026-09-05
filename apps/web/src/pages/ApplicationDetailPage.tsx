import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getApi, patchApi, postApi, ApiError } from '../api/client';
import type {
  Application,
  ApplicationNote,
  ApplicationStage,
  ApplicationStatusHistoryItem,
  Interview,
  ScreeningLog,
  UpdateApplicationStageInput,
} from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageState } from '../components/ui/PageState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { ActivityFeed, type FeedEntry } from '../components/candidate/ActivityFeed';
import { SmartActionBar, getDefaultActions } from '../components/candidate/SmartActionBar';
import { computeInterviewsStats } from '../components/candidate/ScorecardSummary';
import './PageEnhancementsV2.css';

function getInitials(name?: string | null): string {
  if (!name) return 'UN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryItem[]>([]);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [, setScreeningLogs] = useState<ScreeningLog[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'interviews' | 'activity' | 'tasks'>('overview');

  const interviewStats = useMemo(() => computeInterviewsStats(interviews), [interviews]);

  // Modals
  const [isMoveStageModalOpen, setIsMoveStageModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [modalNoteContent, setModalNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isViewResumeModalOpen, setIsViewResumeModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Move stage selection & optimistic locking states
  const [selectedNextStage, setSelectedNextStage] = useState<ApplicationStage>('Screening');
  const [stageReason, setStageReason] = useState('');
  const [isStageMoving, setIsStageMoving] = useState(false);
  const [conflictAlert, setConflictAlert] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const conflictTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (conflictTimeoutRef.current) {
        clearTimeout(conflictTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (application?.allowedTransitions && application.allowedTransitions.length > 0) {
      setSelectedNextStage(application.allowedTransitions[0]);
    } else if (application?.stage) {
      const remaining: ApplicationStage[] = [
        'Applied',
        'Screening',
        'Interview',
        'Offer',
        'Pre-Hire',
        'Joined',
        'Rejected',
        'Withdrawn',
      ].filter((s) => s !== application.stage) as ApplicationStage[];
      if (remaining.length > 0 && !remaining.includes(selectedNextStage)) {
        setSelectedNextStage(remaining[0]);
      }
    }
  }, [application?.stage, application?.allowedTransitions]);

  const refetchApplication = useCallback(async () => {
    if (!id) return;
    setIsFeedLoading(true);
    setFeedError(null);
    try {
      const [appRes, histRes, scrRes, notesRes, intvsRes] = await Promise.allSettled([
        getApi<Application>(`/applications/${id}`),
        getApi<ApplicationStatusHistoryItem[]>(`/applications/${id}/history`),
        getApi<ScreeningLog[]>(`/screening/application/${id}`),
        getApi<ApplicationNote[]>(`/applications/${id}/notes`),
        getApi<Interview[]>(`/interviews?applicationId=${id}`),
      ]);
      if (appRes.status === 'fulfilled' && appRes.value) {
        setApplication(appRes.value);
        if (appRes.value.candidate?.skills && appRes.value.candidate.skills.length > 0) {
          setTags(appRes.value.candidate.skills);
        }
      }
      if (histRes.status === 'fulfilled' && histRes.value) {
        setHistory(Array.isArray(histRes.value) ? histRes.value : []);
      }
      if (scrRes.status === 'fulfilled' && scrRes.value) {
        setScreeningLogs(scrRes.value);
      }
      if (notesRes.status === 'fulfilled' && notesRes.value) {
        setNotes(Array.isArray(notesRes.value) ? notesRes.value : []);
      } else if (notesRes.status === 'rejected') {
        setFeedError('Failed to load application notes.');
      }
      if (intvsRes.status === 'fulfilled' && Array.isArray(intvsRes.value)) {
        setInterviews(intvsRes.value);
      } else {
        setInterviews([]);
      }
    } catch {
      // ignore
    } finally {
      setIsFeedLoading(false);
    }
  }, [id]);

  const refetchAll = refetchApplication;

  const mergedEntries: FeedEntry[] = useMemo(() => {
    const historyEntries: FeedEntry[] = history.map((item) => {
      const transitionText = item.fromStage
        ? `${item.fromStage} → ${item.toStage}`
        : `Stage set to ${item.toStage}`;
      const label = item.reason
        ? `${transitionText} — ${item.reason}`
        : transitionText;
      const byUser = item.changedByName?.trim() || 'System';

      return {
        type: 'stage_change',
        id: `history-${item.id}`,
        label,
        byUser,
        createdAt: item.createdAt,
      };
    });

    const noteEntries: FeedEntry[] = notes.map((note) => {
      const authorName = note.authorName?.trim() || 'Unknown';
      return {
        type: 'note',
        id: `note-${note.id}`,
        authorName,
        authorInitials: getInitials(authorName),
        content: note.content,
        createdAt: note.createdAt,
      };
    });

    return [...historyEntries, ...noteEntries];
  }, [history, notes]);

  const handleSaveModalNote = async () => {
    if (!id || !modalNoteContent.trim() || isSavingNote) return;
    setIsSavingNote(true);
    try {
      await postApi(`/applications/${id}/notes`, { content: modalNoteContent.trim() });
      setModalNoteContent('');
      setIsAddNoteModalOpen(false);
      showToast('Note added successfully');
      await refetchAll();
    } catch {
      showToast('Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    refetchApplication().finally(() => {
      setIsLoading(false);
    });
  }, [id, refetchApplication]);

  const candidateName = application?.candidate
    ? `${application.candidate.firstName || ''} ${application.candidate.lastName || ''}`.trim() || 'Unknown candidate'
    : 'Unknown candidate';
  const roleName = application?.positionTitle || 'No position';
  const candidateEmail = application?.candidate?.email || null;
  const candidatePhone = application?.candidate?.phone || null;
  const candidateLocation = application?.candidate?.location || null;
  const rawAppId = application?.id || id || '';
  const cleanAppId = rawAppId.replace(/^app[-_]?/i, '');
  const appIdDisplay = rawAppId ? `APP-${(cleanAppId || rawAppId).slice(0, 8).toUpperCase()}` : '';

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
      setIsAddTagModalOpen(false);
    }
  };

  const handleStageMove = async () => {
    if (!id || !application) return;
    setIsStageMoving(true);
    setStageError(null);
    setConflictAlert(null);

    const payload: UpdateApplicationStageInput = {
      stage: selectedNextStage,
      expectedStage: application.stage,
      expectedVersion: application.version ?? 1,
      ...(stageReason.trim() ? { reason: stageReason.trim() } : {}),
    };

    try {
      const updated = await patchApi<Application>(`/applications/${id}/stage`, payload);
      if (updated) {
        setApplication(updated);
      } else {
        const refreshed = await getApi<Application>(`/applications/${id}`);
        if (refreshed) setApplication(refreshed);
      }
      setIsMoveStageModalOpen(false);
      setStageReason('');
      showToast('Stage updated successfully');
    } catch (err: unknown) {
      const isConflict =
        (err instanceof ApiError && (err.statusCode === 409 || err.code === 'CONFLICT')) ||
        (Boolean(err) &&
          typeof err === 'object' &&
          ((err as { statusCode?: number }).statusCode === 409 ||
            (err as { status?: number }).status === 409 ||
            (err as { code?: string }).code === 'CONFLICT'));

      setIsMoveStageModalOpen(false);

      if (isConflict) {
        setConflictAlert('This application was updated by someone else. Refreshing...');
        try {
          const refreshed = await getApi<Application>(`/applications/${id}`);
          if (refreshed) {
            setApplication(refreshed);
          }
        } catch {
          // ignore refresh failure on conflict
        }
        if (conflictTimeoutRef.current) {
          clearTimeout(conflictTimeoutRef.current);
        }
        conflictTimeoutRef.current = setTimeout(() => {
          setConflictAlert(null);
        }, 4000);
      } else {
        const errorMsg =
          err instanceof ApiError && err.statusCode >= 500
            ? 'Server error occurred while updating stage. Please try again.'
            : err instanceof Error && err.message
              ? err.message
              : 'Server error occurred while updating stage. Please try again.';
        setStageError(errorMsg);
      }
    } finally {
      setIsStageMoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
        <PageState kind="loading" title="Loading applicant profile..." />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/applications')}>
            <Icon name="arrow-left" size={13} />
            <span>Back to applications</span>
          </Button>
        </div>
        <PageState
          kind="empty"
          title="Application not found"
          description="The requested application could not be found or you do not have permission to view it."
          actionLabel="Back to applications"
          actionHref="/applications"
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumb & Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span
              onClick={() => navigate('/applications')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Applications
            </span>
            <span className="mx-2">&bull;</span>
            <span className="text-slate-700 dark:text-slate-200">{appIdDisplay || '—'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight m-0">
              Applicant Profile
            </h1>
            {application?.stage && <StatusBadge status={application.stage} />}
            <Link
              to="/interviews"
              className="inline-flex items-center gap-1.5 no-underline hover:opacity-85 transition-opacity"
              title="View interviews"
            >
              {interviews.length === 0 ? (
                <Badge variant="neutral">No interviews</Badge>
              ) : interviewStats.strongHire === 0 && interviewStats.hire === 0 && interviewStats.noHire === 0 ? (
                <Badge variant="neutral">Pending feedback</Badge>
              ) : (
                <>
                  <Badge variant="success">{interviewStats.strongHire} Strong Hire</Badge>
                  <Badge variant="info">{interviewStats.hire} Hire</Badge>
                  <Badge variant="danger">{interviewStats.noHire} No Hire</Badge>
                  {interviewStats.pending > 0 && (
                    <Badge variant="neutral">{interviewStats.pending} Pending</Badge>
                  )}
                </>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Optimistic Concurrency Conflict / Server Error Banners ── */}
      {conflictAlert && (
        <Alert tone="warning" role="alert" className="w-full">
          {conflictAlert}
        </Alert>
      )}

      {stageError && (
        <Alert
          tone="danger"
          role="alert"
          className="w-full"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleStageMove()}
              loading={isStageMoving}
              disabled={isStageMoving}
            >
              Retry
            </Button>
          }
        >
          {stageError}
        </Alert>
      )}

      {/* ── Horizontal Navigation Tabs (Overview, Resume, Interviews, Activity, Tasks) ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 overflow-x-auto rf-scrollbar text-xs font-semibold">
        {(['overview', 'resume', 'interviews', 'activity', 'tasks'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (tab === 'interviews') navigate('/interviews');
              else setActiveTab(tab);
            }}
            className={`pb-3.5 border-b-2 transition capitalize cursor-pointer shrink-0 ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ════════ Left Sidebar (~28% width / 4 cols) ════════ */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          {!application?.candidate ? (
            <PageState
              kind="empty"
              title="Candidate data unavailable"
              description="Candidate details are not linked to this application."
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5">
              {/* Candidate Photo & Basic Info */}
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl font-bold text-slate-700 dark:text-slate-200 mb-3 shadow-xs">
                  {candidateName
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || '?'}
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {candidateName}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {roleName}
                </p>

                {application.candidate.status && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-2 border border-slate-200 dark:border-slate-700">
                    Status: {application.candidate.status}
                  </span>
                )}
              </div>

              {/* Contact & Meta Rows */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                {candidateEmail && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Icon name="mail" size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{candidateEmail}</span>
                  </div>
                )}
                {candidatePhone && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Icon name="phone" size={14} className="text-slate-400 shrink-0" />
                    <span>{candidatePhone}</span>
                  </div>
                )}
                {candidateLocation && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Icon name="map-pin" size={14} className="text-slate-400 shrink-0" />
                    <span>{candidateLocation}</span>
                  </div>
                )}
                {application.candidate.experienceYears != null && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Icon name="briefcase" size={14} className="text-slate-400 shrink-0" />
                    <span>
                      {application.candidate.experienceYears}{' '}
                      {application.candidate.experienceYears === 1 ? 'year' : 'years'} experience
                    </span>
                  </div>
                )}
                {(application.appliedAt || application.createdAt) && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Icon name="calendar" size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <span className="block text-[10px] text-slate-400">Applied on</span>
                      <span className="font-semibold">
                        {new Date(application.appliedAt || application.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                )}
                {application.candidate.currentCompany && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Icon name="briefcase" size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <span className="block text-[10px] text-slate-400">Current company</span>
                      <span className="font-semibold">{application.candidate.currentCompany}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Summary */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Profile summary</h3>

                {application.candidate.skills && application.candidate.skills.length > 0 ? (
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-500">Skills on file</span>
                      <span className="text-slate-900 dark:text-white font-bold">{application.candidate.skills.length}</span>
                    </div>
                  </div>
                ) : null}

                {application.candidate.experienceYears != null ? (
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-500">Total experience</span>
                      <span className="text-slate-900 dark:text-white font-bold">
                        {application.candidate.experienceYears} {application.candidate.experienceYears === 1 ? 'year' : 'years'}
                      </span>
                    </div>
                  </div>
                ) : null}

                {!application.candidate.skills?.length && application.candidate.experienceYears == null ? (
                  <p className="text-xs text-slate-400 italic">No skills or experience records on file.</p>
                ) : null}
              </div>

              {/* View Resume Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsViewResumeModalOpen(true)}
                  className="w-full py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon name="file-text" size={14} className="text-slate-400" />
                  <span>View r&eacute;sum&eacute;</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════════ Right Main Column (~72% width / 8 cols) ════════ */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* ── Top KPI Summary Strip (5 metric cells) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Cell 1: Current stage */}
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Current stage</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {application?.stage || '—'}
                </span>
                {(application?.updatedAt || application?.appliedAt) && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    Since{' '}
                    {new Date(application.updatedAt || application.appliedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {/* Cell 2: Next action */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Next action</span>
                <span className="block text-xs font-bold text-slate-400 italic">None scheduled</span>
              </div>

              {/* Cell 3: Owner */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Owner</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                    {((application?.primaryRecruiterName || application?.taskOwnerName || 'Unassigned')
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()) || '—'}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {application?.primaryRecruiterName || application?.taskOwnerName || 'Unassigned'}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {application?.primaryRecruiterName
                        ? 'Primary Recruiter'
                        : application?.taskOwnerName
                          ? 'Task Owner'
                          : 'No owner assigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cell 4: SLA */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">SLA</span>
                <span className="block text-xs font-bold text-slate-400 italic">No SLA target</span>
              </div>

              {/* Cell 5: Last activity */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Last activity</span>
                {history.length > 0 ? (
                  <>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                      {history[0].toStage ? `Moved to ${history[0].toStage}` : 'Updated'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Icon name="clock" size={12} />
                      <span>{new Date(history[0].createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  </>
                ) : (
                  <span className="block text-xs text-slate-400 italic">No activity recorded</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Tab Views ── */}
          {activeTab === 'activity' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Activity &amp; Notes
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological record of status changes, notes, and events for this application.
                </p>
              </div>

              {feedError && (
                <Alert
                  tone="danger"
                  role="alert"
                  action={
                    <Button size="sm" variant="outline" onClick={() => void refetchAll()}>
                      Retry
                    </Button>
                  }
                >
                  {feedError}
                </Alert>
              )}

              {isFeedLoading && mergedEntries.length === 0 ? (
                <ListSkeleton count={3} />
              ) : (
                <ActivityFeed
                  entityType="application"
                  entityId={id!}
                  entries={mergedEntries}
                  onRefresh={refetchAll}
                />
              )}
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              {/* ── Middle Row: Timeline (Left ~60%) & Quick Actions / About (Right ~40%) ── */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Timeline Card (7 cols) */}
                <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Timeline
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('activity')}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      View full timeline
                    </button>
                  </div>

                  {/* Stepper Timeline List */}
                  {history.length > 0 ? (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {history.slice(0, 5).map((item) => (
                        <div key={item.id} className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center text-[10px]">
                            <Icon name="check-circle" size={11} />
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div>
                              <span className="block text-xs font-bold text-slate-900 dark:text-white">
                                {item.fromStage ? `Moved from ${item.fromStage} to ${item.toStage}` : `Stage set to ${item.toStage}`}
                              </span>
                              {item.changedByName && (
                                <span className="block text-[11px] text-slate-400">by {item.changedByName}</span>
                              )}
                              {item.reason && (
                                <span className="block text-[11px] text-slate-500 italic mt-0.5">&quot;{item.reason}&quot;</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {new Date(item.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400 italic">
                      No status transitions recorded yet.
                    </div>
                  )}
                </div>

                {/* Right: Quick Actions & About this application (5 cols) */}
                <div className="md:col-span-5 space-y-6">
                  {/* Quick Actions Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                      Quick actions
                    </h2>

                    <div
                      onClick={() => {
                        setStageError(null);
                        setIsMoveStageModalOpen(true);
                      }}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                          <Icon name="arrow-right" size={15} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                            Move stage
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Advance or change stage
                          </span>
                        </div>
                      </div>
                      <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                    </div>

                    <div
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                          <Icon name="calendar" size={15} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                            Schedule interview
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Plan interview with team
                          </span>
                        </div>
                      </div>
                      <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                    </div>

                    <div
                      onClick={() => {
                        setModalNoteContent('');
                        setIsAddNoteModalOpen(true);
                      }}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                          <Icon name="file-text" size={15} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition">
                            Add note
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Add internal note
                          </span>
                        </div>
                      </div>
                      <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                    </div>

                    <div
                      onClick={() => setIsRejectModalOpen(true)}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
                          <Icon name="slash" size={15} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-red-600 transition">
                            Reject applicant
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Move to rejected
                          </span>
                        </div>
                      </div>
                      <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>

                  {/* About this application Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                      About this application
                    </h2>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                        <span className="text-slate-400">Application ID</span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">{appIdDisplay || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                        <span className="text-slate-400">Source</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {application?.source || application?.candidate?.source || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                        <span className="text-slate-400">Position</span>
                        <span className="font-bold text-slate-900 dark:text-white">{roleName}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                        <span className="text-slate-400">Requisition</span>
                        <span className="font-bold text-slate-900 dark:text-white">{application?.vacancyCode || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">Location</span>
                        <span className="font-bold text-slate-900 dark:text-white">{candidateLocation || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bottom Row: Notes (Left ~60%) & Tags (Right ~40%) ── */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Notes Card (7 cols) */}
                <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Notes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('activity')}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      View all notes
                    </button>
                  </div>

                  {notes.length > 0 ? (
                    <div className="space-y-3">
                      {notes.slice(0, 3).map((n) => (
                        <div
                          key={n.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs mb-1">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {n.authorName || 'Unknown'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(n.createdAt).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 break-words">
                            {n.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400 italic">
                      No notes recorded yet.
                    </div>
                  )}
                </div>

                {/* Tags Card (5 cols) */}
                <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Tags
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No tags</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddTagModalOpen(true)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 transition cursor-pointer"
                    >
                      + Add tag
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'resume' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Resume &amp; Experience
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Candidate profile credentials, employment history, and verified skills.
                </p>
              </div>
              {!application.candidate ? (
                <PageState
                  kind="empty"
                  title="Candidate data unavailable"
                  description="No candidate profile is attached to this application."
                />
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{candidateName}</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {[roleName !== 'No position' ? roleName : null, candidateLocation, candidateEmail]
                        .filter(Boolean)
                        .join(' • ') || 'No contact details available'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                      Summary &amp; Skills
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {application.candidate.skills && application.candidate.skills.length > 0
                        ? `Candidate with verified skills in ${application.candidate.skills.join(', ')}.`
                        : 'No summary provided.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                      Experience
                    </h4>
                    <div className="space-y-2">
                      {application.candidate.currentCompany || application.candidate.currentTitle ? (
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {application.candidate.currentTitle || 'Role'} • {application.candidate.currentCompany || 'Company'}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {application.candidate.experienceYears != null
                              ? `${application.candidate.experienceYears} ${application.candidate.experienceYears === 1 ? 'year' : 'years'} experience`
                              : 'Experience recorded'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No experience records available.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
              <PageState
                kind="empty"
                title="No tasks assigned"
                description="Tasks and recruitment assignments for this application will appear here."
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Smart Action Bar ── */}
      {application != null && (
        <SmartActionBar
          applicationId={id || application.id}
          stage={application.stage}
          version={application.version ?? 1}
          actions={getDefaultActions(application.stage)}
          onActionComplete={refetchApplication}
        />
      )}

      {/* ── Modals for Quick Actions ── */}
      {/* 1. Move Stage Modal */}
      <Modal
        isOpen={isMoveStageModalOpen}
        onClose={() => {
          if (!isStageMoving) setIsMoveStageModalOpen(false);
        }}
        title="Move Candidate Stage"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold block mb-1">Select Next Stage</label>
            <Select
              value={selectedNextStage}
              onChange={(e) => setSelectedNextStage(e.target.value as ApplicationStage)}
              disabled={isStageMoving}
            >
              {(application?.allowedTransitions && application.allowedTransitions.length > 0
                ? application.allowedTransitions
                : ([
                    'Applied',
                    'Screening',
                    'Interview',
                    'Offer',
                    'Pre-Hire',
                    'Joined',
                    'Rejected',
                    'Withdrawn',
                  ] as ApplicationStage[])
              ).map((stageOption) => (
                <option key={stageOption} value={stageOption}>
                  {stageOption}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="font-bold block mb-1">Reason (Optional)</label>
            <Input
              type="text"
              placeholder="e.g. Cleared technical screening"
              value={stageReason}
              onChange={(e) => setStageReason(e.target.value)}
              disabled={isStageMoving}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsMoveStageModalOpen(false)}
              disabled={isStageMoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleStageMove()}
              loading={isStageMoving}
              disabled={isStageMoving}
            >
              {isStageMoving ? 'Updating...' : 'Confirm Move'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Schedule Interview Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Interview"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Interview Type</label>
            <Select defaultValue="Technical Interview">
              <option value="Phone Screen">Phone Screen</option>
              <option value="Technical Interview">Technical Interview</option>
              <option value="HM Interview">HM Interview</option>
            </Select>
          </div>
          <div>
            <label className="font-bold block mb-1">Date &amp; Time</label>
            <Input type="datetime-local" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Send Invitation
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Add Note Modal */}
      <Modal
        isOpen={isAddNoteModalOpen}
        onClose={() => {
          if (!isSavingNote) setIsAddNoteModalOpen(false);
        }}
        title="Add Internal Note"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Note Content</label>
            <textarea
              rows={4}
              placeholder="Type candidate observations..."
              value={modalNoteContent}
              onChange={(e) => setModalNoteContent(e.target.value)}
              disabled={isSavingNote}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddNoteModalOpen(false)}
              disabled={isSavingNote}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveModalNote()}
              disabled={isSavingNote || !modalNoteContent.trim()}
              className="px-4 py-1.5 bg-amber-600 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
            >
              {isSavingNote ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Applicant"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">
            Are you sure you want to reject this applicant? This will transition their status to Rejected.
          </p>
          <div>
            <label className="font-bold block mb-1">Reason for Rejection</label>
            <Select defaultValue="Skills mismatch">
              <option value="Skills mismatch">Skills mismatch</option>
              <option value="Salary expectations">Salary expectations</option>
              <option value="Not responsive">Not responsive</option>
              <option value="Position filled">Position filled</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>

      {/* 5. View Resume Modal */}
      <Modal
        isOpen={isViewResumeModalOpen}
        onClose={() => setIsViewResumeModalOpen(false)}
        title={`${candidateName} - R\u00e9sum\u00e9`}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-xs p-2">
          {!application?.candidate ? (
            <PageState
              kind="empty"
              title="Candidate data unavailable"
              description="No candidate profile is attached to this application."
            />
          ) : (
            <>
              <div className="border-b pb-3">
                <h3 className="text-sm font-bold">{candidateName}</h3>
                <p className="text-slate-500">
                  {[roleName !== 'No position' ? roleName : null, candidateLocation, candidateEmail]
                    .filter(Boolean)
                    .join(' \u2022 ') || 'No contact details available'}
                </p>
              </div>
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Summary
                </h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {application.candidate.skills && application.candidate.skills.length > 0
                    ? `Candidate with verified skills in ${application.candidate.skills.join(', ')}.`
                    : 'No summary provided.'}
                </p>
              </div>
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Experience
                </h4>
                <div className="space-y-2">
                  {application.candidate.currentCompany || application.candidate.currentTitle ? (
                    <div>
                      <span className="font-bold block">
                        {application.candidate.currentTitle || 'Role'} &bull; {application.candidate.currentCompany || 'Company'}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {application.candidate.experienceYears != null
                          ? `${application.candidate.experienceYears} ${application.candidate.experienceYears === 1 ? 'year' : 'years'} experience`
                          : 'Experience recorded'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No experience records available.</p>
                  )}
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsViewResumeModalOpen(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* 6. Add Tag Modal */}
      <Modal
        isOpen={isAddTagModalOpen}
        onClose={() => setIsAddTagModalOpen(false)}
        title="Add Tag"
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Tag Name</label>
            <Input
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="e.g. Docker, Redux"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddTagModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddTag}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Add Tag
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default ApplicationDetailPage;
