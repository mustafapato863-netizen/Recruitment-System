import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi, postApi, ApiError } from '../api/client';
import type { Interview, InterviewScorecardItem } from '@recruitflow/contracts';
import { useAuth } from '../auth/AuthContext';
import { Scorecard, type ScorecardCategory, type Recommendation } from '../components/ui/Scorecard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { Textarea } from '../components/ui/Textarea';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import './PageEnhancementsV2.css';

type BackendRecommendation = 'Strong Hire' | 'Hire' | 'Neutral' | 'No Hire' | 'Strong No Hire';

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
  const [submittedScorecard, setSubmittedScorecard] = useState<InterviewScorecardItem | null>(null);
  const [isForbiddenUser, setIsForbiddenUser] = useState(false);

  // Editable Scorecard form states
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchInterview = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoadingInterview(true);
      const data = await getApi<Interview>(`/interviews/${id}`);
      setInterview(data);
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
    return [
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
  }, [activeScorecard?.overallRating]);

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumbs & Top Action Bar matching 10-interview-detail-feedback.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span onClick={() => navigate('/')} className="hover:text-blue-600 cursor-pointer">
              My Work
            </span>
            <span className="mx-2">&gt;</span>
            <span onClick={() => navigate('/interviews')} className="hover:text-blue-600 cursor-pointer">
              Interviews
            </span>
            <span className="mx-2">&gt;</span>
            <span className="text-slate-900 dark:text-white font-bold">Interview Details</span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Technical Interview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Scheduled
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Next stage: Panel Interview &bull; After this: Offer Approval
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => showToast('Interview options: Reschedule, Cancel, or Reassign Panel')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <span>Actions</span>
            <Icon name="more-vertical" size={13} />
          </button>

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
            <img
              src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80"
              alt="Ali Hassan"
              className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-xs shrink-0"
            />
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                Ali Hassan
              </h2>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                Senior Frontend Engineer
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Engineering &bull; Cairo, Egypt &bull; Applied 28 Aug 2026
              </p>
              {/* Quick Contact Buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => window.open('mailto:ali.hassan@example.com?subject=Technical Interview Update')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-500 text-slate-500 hover:text-blue-600 cursor-pointer transition"
                  title="Send email"
                >
                  <Icon name="mail" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => window.open('tel:+966500000000')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-emerald-500 text-slate-500 hover:text-emerald-600 cursor-pointer transition"
                  title="Call candidate"
                >
                  <Icon name="phone" size={12} />
                </button>
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
              <span className="font-bold font-mono text-slate-900 dark:text-white">APP-02481</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Current Stage</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Technical Interview
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Application Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                In Progress
              </span>
            </div>
          </div>

          {/* Fit Summary Bars (4 cols) */}
          <div className="lg:col-span-4 space-y-1.5 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-1">
              <span>Fit Summary</span>
              <button
                type="button"
                onClick={() => navigate('/applications/APP-02481')}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
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
              onClick={() => showToast('Opening reschedule options for Technical Interview...')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Date &amp; Time</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Today, 2 Sep 2026</span>
              <span className="text-[11px] text-slate-400">2:00 PM – 3:00 PM (AST)</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Interview Type</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Video Interview</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Location / Link</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Icon name="video" size={13} className="text-blue-500" /> Microsoft Teams
                </span>
                <a href="#join" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                  Join meeting ↗
                </a>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Time Zone</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Asia/Riyadh (GMT+3)</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Interview Owner</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                  SA
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block leading-none">Sarah Ahmed</span>
                  <span className="text-[10px] text-slate-400">Senior Recruiter</span>
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
                onClick={() => showToast('Panel configuration: 3 active panelists')}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Manage panel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Member 1 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center">
                    SA
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Sarah Ahmed</span>
                    <span className="block text-[10.5px] text-slate-400">Senior Recruiter</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Feedback submitted
                </span>
              </div>

              {/* Member 2 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-teal-700 text-white text-[10px] font-black flex items-center justify-center">
                    AM
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Ahmed Mostafa</span>
                    <span className="block text-[10.5px] text-slate-400">Engineering Manager</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Feedback submitted
                </span>
              </div>

              {/* Member 3 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center">
                    KM
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Khaled Mostafa</span>
                    <span className="block text-[10.5px] text-slate-400">Senior Frontend Engineer</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Feedback pending
                </span>
              </div>

              {/* Member 4 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                    NS
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Nourhan Sami</span>
                    <span className="block text-[10.5px] text-slate-400">HR Business Partner</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Feedback submitted
                </span>
              </div>
            </div>
          </div>

          {/* Pending Alert Banner */}
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
              <Icon name="alert-triangle" size={13} className="text-amber-600" />
              <span>1 panel member has not submitted feedback</span>
            </div>
            <button
              type="button"
              onClick={() => setIsReminderSent(true)}
              className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
            >
              {isReminderSent ? '✓ Sent' : 'Send reminder'}
            </button>
          </div>
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

            <div className="space-y-2 text-xs">
              {[
                { name: 'Ali Hassan CV.pdf', size: 'PDF • 210 KB' },
                { name: 'Portfolio - Ali Hassan.pdf', size: 'PDF • 1.2 MB' },
                { name: 'Technical Assessment Report.pdf', size: 'PDF • 842 KB' },
                { name: 'Interview Agenda - Technical.pdf', size: 'PDF • 145 KB' },
              ].map((doc) => (
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
                        {doc.size}
                      </span>
                    </div>
                  </div>
                  <Icon name="download" size={12} className="text-slate-300 group-hover:text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View all attachments (5)
            </button>
          </div>
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Average Score: 4.1 / 5
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10.5px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2">Criteria</th>
                  <th className="pb-2 text-center">Sarah Ahmed</th>
                  <th className="pb-2 text-center">Ahmed Mostafa</th>
                  <th className="pb-2 text-center">Khaled Mostafa</th>
                  <th className="pb-2 text-right">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Technical Skills</span>
                    <span className="text-[10px] text-slate-400 block">Frontend, React, TypeScript</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.5</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.3</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Problem Solving</span>
                    <span className="text-[10px] text-slate-400 block">Analytical thinking &amp; approach</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.0</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Communication</span>
                    <span className="text-[10px] text-slate-400 block">Clarity &amp; collaboration</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.5</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.3</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Culture Fit</span>
                    <span className="text-[10px] text-slate-400 block">Values &amp; team alignment</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.0</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Ownership &amp; Initiative</span>
                    <span className="text-[10px] text-slate-400 block">Proactiveness &amp; ownership</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.5</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.3</td>
                </tr>

                <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                  <td className="py-2.5 font-extrabold text-slate-900 dark:text-white">Total Score (Average)</td>
                  <td className="py-2.5 text-center font-black text-slate-900 dark:text-white">4.2</td>
                  <td className="py-2.5 text-center font-black text-slate-900 dark:text-white">4.1</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right">
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                      4.1
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

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
                  className={`px-2 py-0.5 rounded-lg ${feedbackTab === 'byQuestion' ? 'font-bold text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                >
                  By Question
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackTab('byInterviewer')}
                  className={`px-2 py-0.5 rounded-lg ${feedbackTab === 'byInterviewer' ? 'font-bold text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                >
                  By Interviewer
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Feedback item 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center">
                      SA
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">Sarah Ahmed</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Submitted 2 Sep 2026, 2:55 PM</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic text-[11px] leading-relaxed">
                  &ldquo;Ali demonstrated strong knowledge of React and TypeScript. Communicates clearly and explains complex topics well.&rdquo;
                </p>
              </div>

              {/* Feedback item 2 */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-700 text-white text-[8px] font-extrabold flex items-center justify-center">
                      AM
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">Ahmed Mostafa</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Submitted 2 Sep 2026, 2:57 PM</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic text-[11px] leading-relaxed">
                  &ldquo;Solid problem solving skills and good system design thinking. I&apos;d like to see deeper discussion on scalability trade-offs.&rdquo;
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => showToast('Displaying full question scorecard feedback summaries')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View full feedback ↗
            </button>
          </div>
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
              Strong Hire
            </div>
            <p className="text-[11px] text-slate-400">
              Based on 2 of 3 submitted feedbacks
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
                <span className="text-slate-500">–</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decision date</span>
                <span className="text-slate-500">–</span>
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
              onClick={() => navigate('/applications/APP-02481/transition')}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Move to Panel Interview</span>
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
