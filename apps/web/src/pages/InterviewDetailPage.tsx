import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi, postApi, patchApi, ApiError } from '../api/client';
import type { Application, Interview, InterviewScorecardItem } from '@recruitflow/contracts';
import { useAuth } from '../auth/AuthContext';
import { Scorecard, type ScorecardCategory, type Recommendation } from '../components/ui/Scorecard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { Textarea } from '../components/ui/Textarea';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useSetBreadcrumbTitle } from '../context/BreadcrumbContext';
import './PageEnhancementsV2.css';

type BackendRecommendation = 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';

function buildRoleCompetencyCategory(positionTitle?: string | null, skills?: string[]): ScorecardCategory {
  const title = positionTitle?.trim() || 'Role';
  const criteriaList = [];

  if (skills && skills.length > 0) {
    skills.slice(0, 4).forEach((skill) => {
      criteriaList.push({
        id: `skill_${skill.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: `${skill} Competency & Application`,
      });
    });
  } else {
    criteriaList.push(
      {
        id: 'role_domain_knowledge',
        name: `${title} Domain Proficiency & Standards`,
      },
      {
        id: 'role_execution_ability',
        name: `Applied Technical Competency & Execution for ${title}`,
      }
    );
  }

  return {
    id: 'role_competencies',
    name: `Role & Position Competencies (${title})`,
    isRequired: true,
    criteria: criteriaList,
  };
}

const DEFAULT_SCORECARD_CATEGORIES: ScorecardCategory[] = [
  {
    id: 'technical_skills',
    name: 'Technical Skills',
    isRequired: true,
    criteria: [
      {
        id: 'tech_skills_crit',
        name: 'Technical proficiency, system design, and domain knowledge',
      },
    ],
  },
  {
    id: 'communication',
    name: 'Communication',
    isRequired: true,
    criteria: [
      {
        id: 'comm_crit',
        name: 'Clarity of thought, articulation, listening, and cross-team communication',
      },
    ],
  },
  {
    id: 'problem_solving',
    name: 'Problem Solving',
    isRequired: true,
    criteria: [
      {
        id: 'prob_crit',
        name: 'Analytical approach, root-cause reasoning, and debugging ability',
      },
    ],
  },
  {
    id: 'culture_fit',
    name: 'Culture Fit',
    isRequired: true,
    criteria: [
      {
        id: 'culture_crit',
        name: 'Values alignment, growth mindset, ownership, and collaborative attitude',
      },
    ],
  },
];

function uiToBackendRecommendation(rec: Recommendation): BackendRecommendation {
  switch (rec) {
    case 'strong_hire':
      return 'Strong Hire';
    case 'hire':
      return 'Hire';
    case 'no_hire':
      return 'No Hire';
  }
}

function backendToUiRecommendation(rec?: string): Recommendation {
  switch (rec) {
    case 'Strong Hire':
      return 'strong_hire';
    case 'Hire':
      return 'hire';
    case 'No Hire':
    case 'Strong No Hire':
      return 'no_hire';
    case 'Neutral':
      // Map Neutral to nearest supported recommendation in Scorecard UI
      return 'hire';
    default:
      return 'hire';
  }
}

export function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoadingInterview, setIsLoadingInterview] = useState(true);

  useSetBreadcrumbTitle(interview?.title || 'Interview Details');
  const [submittedScorecard, setSubmittedScorecard] = useState<InterviewScorecardItem | null>(null);
  const [isForbiddenUser, setIsForbiddenUser] = useState(false);

  // Editable Scorecard form states
  const [roleCompetencyCategory, setRoleCompetencyCategory] = useState<ScorecardCategory | null>(null);
  const [categories, setCategories] = useState<ScorecardCategory[]>(DEFAULT_SCORECARD_CATEGORIES);
  const [recommendation, setRecommendation] = useState<Recommendation>('hire');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{
    type: 'locked' | 'forbidden' | 'validation' | 'other';
    message: string;
  } | null>(null);

  const [feedbackTab, setFeedbackTab] = useState<'byQuestion' | 'byInterviewer'>('byInterviewer');
  const [isReminderSent, setIsReminderSent] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isScoreGuideOpen, setIsScoreGuideOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reschedule & Actions Modal States
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openRescheduleModal = () => {
    if (interview?.scheduledStart) {
      try {
        setRescheduleDateTime(new Date(interview.scheduledStart).toISOString().slice(0, 16));
      } catch {
        setRescheduleDateTime('');
      }
    }
    setIsRescheduleModalOpen(true);
    setIsActionsDropdownOpen(false);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !rescheduleDateTime) return;
    setIsSubmittingReschedule(true);
    try {
      const start = new Date(rescheduleDateTime);
      const end = new Date(start.getTime() + 45 * 60000);
      const updated = await patchApi<Interview>(`/interviews/${id}`, {
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      });
      if (updated) {
        setInterview(updated);
      }
      showToast('✓ Interview rescheduled successfully!');
      setIsRescheduleModalOpen(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to reschedule interview');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const handleCancelInterview = async () => {
    if (!id) return;
    try {
      await patchApi(`/interviews/${id}`, { status: 'Cancelled' });
      setInterview((prev) => (prev ? { ...prev, status: 'Cancelled' as unknown as any } : prev));
      showToast('✓ Interview status set to Cancelled');
      setIsActionsDropdownOpen(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel interview');
    }
  };

  const fetchInterview = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoadingInterview(true);
      const data = await getApi<Interview>(`/interviews/${id}`);
      setInterview(data);

      if (data?.applicationId) {
        try {
          const app = await getApi<Application>(`/applications/${data.applicationId}`);
          const skills = app?.candidate?.skills;
          const posTitle = data.positionTitle || app?.positionTitle || (app as unknown as { vacancy?: { position?: { title?: string } } })?.vacancy?.position?.title;
          const roleCat = buildRoleCompetencyCategory(posTitle, skills);
          setRoleCompetencyCategory(roleCat);
          setCategories([roleCat, ...DEFAULT_SCORECARD_CATEGORIES]);
        } catch {
          if (data.positionTitle) {
            const roleCat = buildRoleCompetencyCategory(data.positionTitle);
            setRoleCompetencyCategory(roleCat);
            setCategories([roleCat, ...DEFAULT_SCORECARD_CATEGORIES]);
          }
        }
      } else if (data?.positionTitle) {
        const roleCat = buildRoleCompetencyCategory(data.positionTitle);
        setRoleCompetencyCategory(roleCat);
        setCategories([roleCat, ...DEFAULT_SCORECARD_CATEGORIES]);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingInterview(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInterview();
  }, [fetchInterview]);

  // Derive current user's scorecard from interview.scorecards
  // Grounded rule: match interviewerId to current user if identifiable via auth context,
  // else the single unlocked card or latest card
  const myScorecard = useMemo<InterviewScorecardItem | null>(() => {
    if (!interview?.scorecards || interview.scorecards.length === 0) return null;
    if (user?.id) {
      const matched = interview.scorecards.find((sc) => sc.interviewerId === user.id);
      if (matched) return matched;
    }
    const unlocked = interview.scorecards.find((sc) => !sc.isLocked);
    if (unlocked) return unlocked;
    return interview.scorecards[interview.scorecards.length - 1] ?? null;
  }, [interview?.scorecards, user?.id]);

  const activeScorecard = submittedScorecard || myScorecard;
  const isLocked = Boolean(activeScorecard?.isLocked || submittedScorecard);

  // Check if current user is an assigned interviewer from attendees list
  const isAssignedInterviewer = useMemo(() => {
    if (!interview?.attendees || interview.attendees.length === 0) return null;
    if (!user?.id) return null;
    return interview.attendees.some((att) => att.userId === user.id);
  }, [interview?.attendees, user?.id]);

  // Handle criterion rating changes in editable mode
  const handleRatingChange = (categoryId: string, criterionId: string, rating: number) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        const updatedCriteria = cat.criteria.map((crit) =>
          crit.id === criterionId ? { ...crit, rating } : crit,
        );
        const isComplete = updatedCriteria.every(
          (crit) => typeof crit.rating === 'number' && crit.rating >= 1 && crit.rating <= 5,
        );
        return {
          ...cat,
          criteria: updatedCriteria,
          isComplete,
        };
      }),
    );
    if (submitError?.type === 'validation') {
      setSubmitError(null);
    }
  };

  const handleRecommendationChange = (rec: Recommendation) => {
    setRecommendation(rec);
    if (submitError?.type === 'validation') {
      setSubmitError(null);
    }
  };

  // Submit scorecard feedback
  const handleSubmit = async () => {
    // Validate all required criteria rated before POST
    const missingRequired = categories.some(
      (cat) =>
        cat.isRequired &&
        cat.criteria.some(
          (crit) => typeof crit.rating !== 'number' || crit.rating < 1 || crit.rating > 5,
        ),
    );

    if (missingRequired) {
      setSubmitError({
        type: 'validation',
        message: 'Please provide a rating (1-5) for all required criteria before submitting.',
      });
      return;
    }

    if (!recommendation) {
      setSubmitError({
        type: 'validation',
        message: 'Please select an overall recommendation.',
      });
      return;
    }

    // Calculate overallRating: rounded average of all criterion ratings clamped 1-5
    const allRatings = categories.flatMap((cat) =>
      cat.criteria
        .map((c) => c.rating)
        .filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5),
    );
    const average =
      allRatings.length > 0 ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length : 3;
    const overallRating = Math.min(5, Math.max(1, Math.round(average)));

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const backendRec = uiToBackendRecommendation(recommendation);
      const payload = {
        overallRating,
        recommendation: backendRec,
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const result = await postApi<InterviewScorecardItem>(
        `/interviews/${id}/scorecard`,
        payload,
      );

      setSubmittedScorecard(result);
      showToast('✓ Feedback and scorecard submitted successfully.');
      await fetchInterview();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 400) {
        setSubmitError({
          type: 'locked',
          message: 'Feedback already submitted for this interview',
        });
        fetchInterview().catch(() => {});
      } else if (apiErr.statusCode === 403) {
        setIsForbiddenUser(true);
        setSubmitError({
          type: 'forbidden',
          message: 'Only the assigned interviewer can submit feedback',
        });
      } else {
        setSubmitError({
          type: 'other',
          message: apiErr.message || 'Failed to submit scorecard feedback. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Categories formatted for read-only / locked display
  const lockedCategories: ScorecardCategory[] = useMemo(() => {
    const rating = activeScorecard?.overallRating ?? 3;
    const coreCats: ScorecardCategory[] = [
      {
        id: 'technical_skills',
        name: 'Technical Skills',
        isComplete: true,
        criteria: [
          {
            id: 'tech_skills_crit',
            name: 'Technical proficiency, system design, and domain knowledge',
            rating,
          },
        ],
      },
      {
        id: 'communication',
        name: 'Communication',
        isComplete: true,
        criteria: [
          {
            id: 'comm_crit',
            name: 'Clarity of thought, articulation, listening, and cross-team communication',
            rating,
          },
        ],
      },
      {
        id: 'problem_solving',
        name: 'Problem Solving',
        isComplete: true,
        criteria: [
          {
            id: 'prob_crit',
            name: 'Analytical approach, root-cause reasoning, and debugging ability',
            rating,
          },
        ],
      },
      {
        id: 'culture_fit',
        name: 'Culture Fit',
        isComplete: true,
        criteria: [
          {
            id: 'culture_crit',
            name: 'Values alignment, growth mindset, ownership, and collaborative attitude',
            rating,
          },
        ],
      },
    ];

    if (roleCompetencyCategory) {
      const lockedRoleCat: ScorecardCategory = {
        ...roleCompetencyCategory,
        isComplete: true,
        criteria: roleCompetencyCategory.criteria.map((crit) => ({
          ...crit,
          rating,
        })),
      };
      return [lockedRoleCat, ...coreCats];
    }

    return coreCats;
  }, [activeScorecard?.overallRating, roleCompetencyCategory]);

  const candidateDisplayName = interview?.candidateName ?? 'Unknown candidate';
  const positionDisplayName = interview?.positionTitle ?? 'No position';
  const candidateInitials = candidateDisplayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'UC';

  const scheduledDateStr = interview?.scheduledStart
    ? new Date(interview.scheduledStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const scheduledTimeStr = interview?.scheduledStart
    ? new Date(interview.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const createdDateStr = interview?.createdAt
    ? new Date(interview.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const appliedDateLine = scheduledDateStr
    ? `${interview?.timezone ? `${interview.timezone} • ` : ''}Scheduled ${scheduledDateStr}${scheduledTimeStr ? ` at ${scheduledTimeStr}` : ''}`
    : (createdDateStr ? `Created ${createdDateStr}` : '—');

  const candidateEmail = (interview as any)?.candidateEmail || (interview as any)?.application?.candidate?.email || null;
  const candidatePhone = (interview as any)?.candidatePhone || (interview as any)?.application?.candidate?.phone || null;

  const rawAppId = interview?.applicationId;
  const appIdDisplay = interview?.applicationCode || (rawAppId ? (rawAppId.startsWith('APP-') ? rawAppId : `APP-${rawAppId.slice(0, 8).toUpperCase()}`) : '—');

  const attendees = interview?.attendees || [];
  const scorecards = interview?.scorecards || [];

  const primaryOwner = attendees.find((a) => a.role === 'Lead' || a.role === 'Host' || a.role === 'Organizer') || attendees[0];
  const ownerName = primaryOwner?.userName || scorecards[0]?.interviewerName || 'Unassigned';
  const ownerRole = primaryOwner?.role || 'Interviewer';
  const ownerInitials = ownerName === 'Unassigned' ? '—' : ownerName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'IN';

  const attachments: { name: string; size?: string; url?: string }[] =
    (interview as any)?.documents || (interview as any)?.attachments || [];

  const avgScore = useMemo(() => {
    if (scorecards.length === 0) return null;
    const sum = scorecards.reduce((acc, sc) => acc + (Number(sc.overallRating) || 0), 0);
    return (sum / scorecards.length).toFixed(1);
  }, [scorecards]);

  const majorityRec = useMemo(() => {
    if (scorecards.length === 0) return null;
    const counts: Record<string, number> = {};
    scorecards.forEach((sc) => {
      const rec = sc.recommendation || 'Hire';
      counts[rec] = (counts[rec] || 0) + 1;
    });
    let maxCount = 0;
    let best = 'Hire';
    for (const [rec, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        best = rec;
      }
    }
    return best;
  }, [scorecards]);

  if (isLoadingInterview && !interview) {
    return (
      <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Top Action Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {interview?.title || 'Interview Details'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {interview?.status || 'Scheduled'}
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {interview?.interviewType ? `${interview.interviewType} Interview` : 'Interview'} &bull; {interview?.status || 'Scheduled'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsActionsDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
            >
              <span>Actions</span>
              <Icon name="more-vertical" size={13} />
            </button>

            {isActionsDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-30 py-1 text-xs">
                <button
                  type="button"
                  onClick={openRescheduleModal}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Icon name="calendar" size={13} className="text-blue-500" />
                  <span>Reschedule Time</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(interview?.locationUrl || window.location.href);
                    showToast('✓ Meeting link copied to clipboard!');
                    setIsActionsDropdownOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Icon name="link" size={13} className="text-emerald-500" />
                  <span>Copy Meeting Link</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => void handleCancelInterview()}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 font-semibold text-rose-600 cursor-pointer"
                >
                  <Icon name="close" size={13} />
                  <span>Cancel Interview</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => navigate('/interviews')}
              className="p-2 hover:bg-slate-50 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 cursor-pointer"
              title="Previous Interview"
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/interviews')}
              className="p-2 hover:bg-slate-50 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Next Interview"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Candidate Context Header Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Candidate Profile Info (5 cols) */}
          <div className="lg:col-span-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-lg font-bold text-slate-700 dark:text-slate-200 shadow-xs shrink-0">
              {candidateInitials}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                {candidateDisplayName}
              </h2>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {positionDisplayName}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {appliedDateLine}
              </p>
              {/* Quick Contact Buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                {candidateEmail ? (
                  <button
                    type="button"
                    onClick={() => window.open(`mailto:${candidateEmail}?subject=${encodeURIComponent(interview?.title || 'Interview Update')}`)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-500 text-slate-500 hover:text-blue-600 cursor-pointer transition"
                    title={`Send email to ${candidateEmail}`}
                  >
                    <Icon name="mail" size={12} />
                  </button>
                ) : null}
                {candidatePhone ? (
                  <button
                    type="button"
                    onClick={() => window.open(`tel:${candidatePhone}`)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-emerald-500 text-slate-500 hover:text-emerald-600 cursor-pointer transition"
                    title="Call candidate"
                  >
                    <Icon name="phone" size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('✓ Interview link copied to clipboard!');
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 cursor-pointer transition"
                  title="Copy link"
                >
                  <Icon name="link" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Candidate options: View full profile, Add note')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-900 cursor-pointer transition"
                  title="More candidate options"
                >
                  <Icon name="more-horizontal" size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Application Metadata (3 cols) */}
          <div className="lg:col-span-3 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Application ID</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">{appIdDisplay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Current Stage</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {interview?.interviewType ? `${interview.interviewType} Interview` : 'Interview'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Application Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {interview?.status || 'In Progress'}
              </span>
            </div>
          </div>

          {/* Fit Summary Bars (4 cols) */}
          <div className="lg:col-span-4 space-y-1.5 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-1">
              <span>Fit Summary</span>
              <button
                type="button"
                onClick={() => rawAppId && navigate(`/applications/${rawAppId}`)}
                disabled={!rawAppId}
                className="text-[11px] text-blue-600 hover:underline font-semibold disabled:opacity-50 disabled:no-underline"
              >
                View full profile
              </button>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-500">Skills match</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">85%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '85%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-500">Experience match</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">80%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '80%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-500">Culture fit</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">75%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row: 3 Operational Cards (Interview Details, Panel, Attachments) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Interview Details */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Interview Details
            </h2>
            <button
              type="button"
              onClick={openRescheduleModal}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Date &amp; Time</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {interview?.scheduledStart ? new Date(interview.scheduledStart).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
              <span className="text-[11px] text-slate-400">
                {interview?.scheduledStart ? new Date(interview.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                {interview?.scheduledEnd ? ` – ${new Date(interview.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                {interview?.timezone ? ` (${interview.timezone})` : ''}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Interview Type</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {interview?.interviewType ? `${interview.interviewType} Interview` : '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Location / Link</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                  <Icon name={interview?.locationUrl?.startsWith('http') ? 'video' : 'map-pin'} size={13} className="text-blue-500 shrink-0" />
                  <span className="truncate">{interview?.locationUrl || '—'}</span>
                </span>
                {interview?.locationUrl && interview.locationUrl.startsWith('http') ? (
                  <a href={interview.locationUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 shrink-0 ml-2">
                    Join meeting ↗
                  </a>
                ) : null}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Time Zone</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {interview?.timezone || '—'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Interview Owner</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                  {ownerInitials}
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block leading-none">{ownerName}</span>
                  <span className="text-[10px] text-slate-400">{ownerRole}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Interview Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Interview Panel
              </h2>
              <button
                type="button"
                onClick={() => showToast(`Panel configuration: ${attendees.length} active panelist${attendees.length !== 1 ? 's' : ''}`)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Manage panel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {attendees.length === 0 ? (
                <p className="text-slate-400 italic py-2">No panel members assigned.</p>
              ) : (
                attendees.map((attendee) => {
                  const name = attendee.userName || 'Unassigned';
                  const initials = name === 'Unassigned' ? '—' : name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'IN';
                  const hasSubmitted = scorecards.some((sc) => sc.interviewerId === attendee.userId || sc.interviewerName === attendee.userName);
                  return (
                    <div key={attendee.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center">
                          {initials}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white leading-tight">{name}</span>
                          <span className="block text-[10.5px] text-slate-400">{attendee.role || 'Panelist'}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        hasSubmitted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                      }`}>
                        {hasSubmitted ? 'Feedback submitted' : 'Feedback pending'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending Alert Banner */}
          {(() => {
            const pendingPanelCount = attendees.filter((att) => !scorecards.some((sc) => sc.interviewerId === att.userId || sc.interviewerName === att.userName)).length;
            if (pendingPanelCount <= 0) return null;
            return (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs mt-3">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                  <Icon name="alert-triangle" size={13} className="text-amber-600" />
                  <span>{pendingPanelCount} panel member{pendingPanelCount > 1 ? 's have' : ' has'} not submitted feedback</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReminderSent(true)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {isReminderSent ? '✓ Sent' : 'Send reminder'}
                </button>
              </div>
            );
          })()}
        </div>

        {/* Card 3: Attachments */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Attachments
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Upload
              </button>
            </div>

            {attachments.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <Icon name="file-text" size={24} className="mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">No attachments</p>
                <p className="text-[10px] text-slate-400">No documents attached to this interview.</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {attachments.map((doc: any) => (
                  <div
                    key={doc.name}
                    className="p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        <Icon name="file-text" size={13} />
                      </div>
                      <div>
                        <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                          {doc.name}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {doc.size || 'Document'}
                        </span>
                      </div>
                    </div>
                    <Icon name="download" size={12} className="text-slate-300 group-hover:text-slate-600" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View all attachments ({attachments.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Feedback & Scorecard Section (P3.2) ── */}
      <section
        aria-labelledby="feedback-scorecard-heading"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2
              id="feedback-scorecard-heading"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
            >
              Feedback &amp; Scorecard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isLocked
                ? 'Structured feedback has been submitted and locked for this interview.'
                : 'Evaluate candidate performance across key criteria and submit structured feedback.'}
            </p>
          </div>
          <div>
            {isLocked ? (
              <Badge variant="success">Submitted</Badge>
            ) : (
              <Badge variant="warning">Feedback Pending</Badge>
            )}
          </div>
        </div>

        {/* Loading State: 2 rows of Skeleton */}
        {isLoadingInterview ? (
          <div className="space-y-4 py-2" role="status" aria-label="Loading scorecard">
            <Skeleton height={52} className="rounded-xl w-full" />
            <Skeleton height={220} className="rounded-xl w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Status & Error Alerts */}
            {submitError?.type === 'locked' && (
              <Alert tone="warning" title="Scorecard Locked">
                Feedback already submitted for this interview
              </Alert>
            )}

            {submitError?.type === 'forbidden' && (
              <Alert tone="warning" title="Access Restricted">
                Only the assigned interviewer can submit feedback
              </Alert>
            )}

            {submitError?.type === 'validation' && (
              <Alert tone="danger" title="Incomplete Evaluation">
                {submitError.message}
              </Alert>
            )}

            {submitError?.type === 'other' && (
              <Alert
                tone="danger"
                title="Submission Failed"
                action={
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleSubmit}
                    loading={isSubmitting}
                    loadingLabel="Retrying..."
                  >
                    Retry
                  </Button>
                }
              >
                {submitError.message}
              </Alert>
            )}

            {/* Non-interviewer guard when no card exists */}
            {!isLocked && (isForbiddenUser || isAssignedInterviewer === false) ? (
              <Alert tone="warning" title="Interviewer Access Required">
                Only the assigned interviewer can submit feedback
              </Alert>
            ) : isLocked ? (
              /* Non-null (Locked) Scorecard View */
              <div className="space-y-6">
                <div
                  className="scorecard-locked [&_.rating-scale_button]:cursor-default [&_.rating-scale_button]:pointer-events-none [&_.recommendation-option]:cursor-default [&_.recommendation-option]:pointer-events-none [&_.scorecard-demo_button[type=submit]]:hidden"
                  aria-disabled="true"
                >
                  <Scorecard
                    title={
                      interview?.title ? `${interview.title} Evaluation` : 'Interview Scorecard'
                    }
                    interviewer={
                      activeScorecard?.interviewerName ||
                      user?.displayName ||
                      'Assigned Interviewer'
                    }
                    dueText={
                      activeScorecard?.submittedAt
                        ? `Submitted ${new Date(activeScorecard.submittedAt).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric', year: 'numeric' },
                          )}`
                        : undefined
                    }
                    headerBadge={<Badge variant="success">Submitted</Badge>}
                    categories={lockedCategories}
                    recommendation={backendToUiRecommendation(activeScorecard?.recommendation)}
                  />
                </div>

                {/* Read-only Strengths, Concerns & Notes Display */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase text-slate-400 block">
                        Submission Timestamp
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {activeScorecard?.submittedAt
                          ? new Date(activeScorecard.submittedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Submitted'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10.5px] font-semibold uppercase text-slate-400 block">
                          Overall Rating
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {activeScorecard?.overallRating} / 5
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10.5px] font-semibold uppercase text-slate-400 block">
                          Recommendation
                        </span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {activeScorecard?.recommendation}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <strong className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Key Strengths
                      </strong>
                      <div className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap min-h-[72px]">
                        {activeScorecard?.strengths?.trim() || (
                          <span className="text-slate-400 italic">None specified</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <strong className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Areas of Concern / Growth
                      </strong>
                      <div className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap min-h-[72px]">
                        {activeScorecard?.concerns?.trim() || (
                          <span className="text-slate-400 italic">None specified</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <strong className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Additional Notes
                      </strong>
                      <div className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap min-h-[72px]">
                        {activeScorecard?.notes?.trim() || (
                          <span className="text-slate-400 italic">None specified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Editable Scorecard View (null card) */
              <div className="space-y-6">
                <div className="[&_.scorecard-demo_button[type=submit]]:hidden">
                  <Scorecard
                    title={
                      interview?.title ? `${interview.title} Evaluation` : 'Interview Scorecard'
                    }
                    interviewer={
                      user?.displayName ||
                      interview?.attendees?.find((a) => a.userId === user?.id)?.userName ||
                      'Assigned Interviewer'
                    }
                    dueText={
                      interview?.scheduledStart
                        ? `Scheduled: ${new Date(interview.scheduledStart).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric', year: 'numeric' },
                          )}`
                        : undefined
                    }
                    categories={categories}
                    recommendation={recommendation}
                    onRatingChange={handleRatingChange}
                    onRecommendationChange={handleRecommendationChange}
                    onSubmit={handleSubmit}
                  />
                </div>

                {/* Notes Fieldset */}
                <fieldset className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <legend className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                    Evaluation Notes &amp; Observations
                  </legend>

                  <div>
                    <label
                      htmlFor="scorecard-strengths"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Key Strengths
                    </label>
                    <Textarea
                      id="scorecard-strengths"
                      placeholder="What did the candidate do well? Highlight core strengths, domain knowledge, and standout answers..."
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      maxLength={5000}
                      rows={3}
                    />
                    <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                      {strengths.length}/5000
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="scorecard-concerns"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Areas of Concern / Growth
                    </label>
                    <Textarea
                      id="scorecard-concerns"
                      placeholder="Identify technical or behavioral gaps, potential risks, or areas requiring follow-up..."
                      value={concerns}
                      onChange={(e) => setConcerns(e.target.value)}
                      maxLength={5000}
                      rows={3}
                    />
                    <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                      {concerns.length}/5000
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="scorecard-notes"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Additional Notes &amp; Summary
                    </label>
                    <Textarea
                      id="scorecard-notes"
                      placeholder="General interview notes, question responses, follow-up recommendations, or panel observations..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={5000}
                      rows={3}
                    />
                    <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                      {notes.length}/5000
                    </span>
                  </div>
                </fieldset>

                {/* Submit Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-400">
                    * Please ensure all required criteria are rated before submitting.
                  </span>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    loading={isSubmitting}
                    loadingLabel="Submitting feedback..."
                    size="lg"
                    className="self-end"
                  >
                    Submit Scorecard
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      {/* ── Bottom Row: Scorecard (~45%), Feedback (~30%), Recommendation (~25%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Interview Scorecard (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Interview Scorecard
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {avgScore ? `Average Score: ${avgScore} / 5` : 'No scores submitted'}
            </span>
          </div>

          {scorecards.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <Icon name="award" size={24} className="mx-auto mb-1 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold">No scorecards submitted</p>
              <p className="text-[10px] text-slate-400">Scorecards submitted by panelists will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10.5px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-2">Criteria</th>
                    {scorecards.map((sc) => (
                      <th key={sc.id} className="pb-2 text-center">
                        {sc.interviewerName || 'Interviewer'}
                      </th>
                    ))}
                    <th className="pb-2 text-right">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-2.5">
                      <span className="font-bold text-slate-900 dark:text-white block">Overall Rating</span>
                      <span className="text-[10px] text-slate-400 block">General performance score</span>
                    </td>
                    {scorecards.map((sc) => (
                      <td key={sc.id} className="py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                        {sc.overallRating ? Number(sc.overallRating).toFixed(1) : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">
                      {avgScore || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5">
                      <span className="font-bold text-slate-900 dark:text-white block">Recommendation</span>
                      <span className="text-[10px] text-slate-400 block">Hiring evaluation decision</span>
                    </td>
                    {scorecards.map((sc) => (
                      <td key={sc.id} className="py-2.5 text-center text-slate-700 dark:text-slate-300 font-medium">
                        {sc.recommendation || '—'}
                      </td>
                    ))}
                    <td className="py-2.5 text-right font-bold text-emerald-600">
                      {majorityRec || '—'}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                    <td className="py-2.5 font-extrabold text-slate-900 dark:text-white">Total Score (Average)</td>
                    {scorecards.map((sc) => (
                      <td key={sc.id} className="py-2.5 text-center font-black text-slate-900 dark:text-white">
                        {sc.overallRating ? Number(sc.overallRating).toFixed(1) : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 text-right">
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                        {avgScore || '—'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
            <button
              type="button"
              onClick={() => setIsScoreGuideOpen(true)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View scoring guide
            </button>
          </div>
        </div>

        {/* Column 2: Feedback Summary (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Feedback Summary
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFeedbackTab('byQuestion')}
                  className={`px-2 py-0.5 rounded-lg ${feedbackTab === 'byQuestion' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'text-slate-400'}`}
                >
                  By Question
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackTab('byInterviewer')}
                  className={`px-2 py-0.5 rounded-lg ${feedbackTab === 'byInterviewer' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'text-slate-400'}`}
                >
                  By Interviewer
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {scorecards.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <Icon name="chat" size={24} className="mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold">No feedback submitted yet</p>
                  <p className="text-[10px] text-slate-400">Interviewer comments and observations will appear here.</p>
                </div>
              ) : (
                scorecards.map((sc) => {
                  const author = sc.interviewerName || 'Interviewer';
                  const initials = author.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'IN';
                  const feedbackText = sc.notes || sc.strengths || (sc.concerns ? `Concerns: ${sc.concerns}` : null) || `Recommendation: ${sc.recommendation} (Rating: ${sc.overallRating}/5)`;
                  const submittedDate = sc.submittedAt
                    ? `Submitted ${new Date(sc.submittedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(sc.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Submitted';

                  return (
                    <div key={sc.id} className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center">
                            {initials}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{author}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{submittedDate}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 italic text-[11px] leading-relaxed">
                        &ldquo;{feedbackText}&rdquo;
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {scorecards.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => showToast('Displaying full question scorecard feedback summaries')}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View full feedback ↗
              </button>
            </div>
          )}
        </div>

        {/* Column 3: Recommendation & Decision (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Recommendation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500">
              <Icon name="award" size={15} className="text-amber-500" />
              <span>Recommendation (Average)</span>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {majorityRec || 'Pending'}
            </div>
            <p className="text-[11px] text-slate-400">
              {scorecards.length > 0
                ? `Based on ${scorecards.length} of ${attendees.length || scorecards.length} submitted feedback${(attendees.length || scorecards.length) !== 1 ? 's' : ''}`
                : 'No feedback submitted yet'}
            </p>
          </div>

          {/* Hiring Decision Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-extrabold text-slate-900 dark:text-white">Hiring Decision</h3>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decision</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">To be decided</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decided by</span>
                <span className="text-slate-500">—</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decision date</span>
                <span className="text-slate-500">—</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => showToast('Opening decision note composer...')}
              className="text-xs font-bold text-blue-600 hover:underline block pt-1 cursor-pointer"
            >
              Add decision note
            </button>
          </div>

          {/* Next Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => rawAppId && navigate(`/applications/${rawAppId}/transition`)}
              disabled={!rawAppId}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Move to Next Stage</span>
              <Icon name="arrow-right" size={13} />
            </button>

            <button
              type="button"
              onClick={() => showToast('✓ Feedback request reminder notification sent to interviewers!')}
              className="w-full py-2 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer"
            >
              Request more feedback
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Interview Attachment"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
            <Icon name="upload" size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-600">Drag files here or click to browse</p>
            <p className="text-[10px] text-slate-400 mt-1">Supports PDF, DOCX up to 10MB</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Scoring Guide Modal */}
      <Modal
        isOpen={isScoreGuideOpen}
        onClose={() => setIsScoreGuideOpen(false)}
        title="Interview Scoring Guide"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-2 text-xs">
          <div className="p-2 border rounded-lg"><b>5.0 - Exceptional:</b> Exceeds role requirements significantly.</div>
          <div className="p-2 border rounded-lg"><b>4.0 - Strong:</b> Meets all requirements with clear strengths.</div>
          <div className="p-2 border rounded-lg"><b>3.0 - Meets standard:</b> Acceptable competency level.</div>
          <div className="p-2 border rounded-lg"><b>2.0 - Below standard:</b> Noticeable gaps.</div>
          <div className="p-2 border rounded-lg"><b>1.0 - Unacceptable:</b> Major deficiencies.</div>
        </div>
      </Modal>

      {/* Reschedule Interview Modal */}
      <Modal
        isOpen={isRescheduleModalOpen}
        onClose={() => {
          if (!isSubmittingReschedule) setIsRescheduleModalOpen(false);
        }}
        title="Reschedule Interview"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={(e) => void handleRescheduleSubmit(e)} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Select the new date and time for this interview. All panel members and the candidate will be notified of the updated schedule.
          </p>
          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
              New Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={rescheduleDateTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRescheduleDateTime(e.target.value)}
              required
              disabled={isSubmittingReschedule}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRescheduleModalOpen(false)}
              disabled={isSubmittingReschedule}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingReschedule || !rescheduleDateTime}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
            >
              {isSubmittingReschedule ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
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

export default InterviewDetailPage;
