import { Link } from 'react-router-dom';
import type { Interview, InterviewScorecardItem } from '@recruitflow/contracts';
import { Badge } from '../ui/Badge';
import { ProgressBar, type ProgressTone } from '../ui/ProgressBar';
import { Icon } from '../Icon';

export type UiRecommendation = 'strong_hire' | 'hire' | 'no_hire';

export interface ScorecardSummaryProps {
  interviewTitle: string;
  interviewDate: string;
  interviewerName: string;
  recommendation: 'strong_hire' | 'hire' | 'no_hire' | null;
  averageRating: number | null;
  interviewId: string;
  isLocked: boolean;
  pendingLabel?: string;
  className?: string;
}

export interface AggregatedScorecard {
  averageRating: number | null;
  recommendation: UiRecommendation | null;
  interviewerNames: string;
  isLocked: boolean;
}

export interface InterviewStats {
  strongHire: number;
  hire: number;
  noHire: number;
  pending: number;
  total: number;
}

/**
 * Maps backend recommendation strings to canonical UI enum ('strong_hire' | 'hire' | 'no_hire' | null).
 * Reuses inline mapping logic matching P3.2 without importing from page.
 */
export function mapBackendToUiRecommendation(rec?: string | null): UiRecommendation | null {
  if (!rec) return null;
  switch (rec) {
    case 'Strong Hire':
      return 'strong_hire';
    case 'Hire':
    case 'Neutral':
      return 'hire';
    case 'No Hire':
    case 'Strong No Hire':
      return 'no_hire';
    default:
      return null;
  }
}

/**
 * Aggregates multiple scorecards for a single interview round:
 * - averageRating: average of valid overallRating (1-5), rounded to 1 decimal
 * - recommendation: majority/top recommendation (tie-break: strong_hire > hire > no_hire)
 * - interviewerNames: deduplicated comma-separated list of interviewer names
 * - isLocked: true if any scorecard is locked
 */
export function aggregateInterviewScorecards(scorecards?: InterviewScorecardItem[]): AggregatedScorecard {
  if (!scorecards || scorecards.length === 0) {
    return {
      averageRating: null,
      recommendation: null,
      interviewerNames: '',
      isLocked: false,
    };
  }

  const validRatings = scorecards
    .map((s) => s.overallRating)
    .filter((r): r is number => typeof r === 'number' && !Number.isNaN(r) && r > 0);

  const averageRating =
    validRatings.length > 0
      ? Math.round((validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length) * 10) / 10
      : null;

  const counts: Record<UiRecommendation, number> = {
    strong_hire: 0,
    hire: 0,
    no_hire: 0,
  };

  for (const sc of scorecards) {
    const uiRec = mapBackendToUiRecommendation(sc.recommendation);
    if (uiRec) {
      counts[uiRec]++;
    }
  }

  let topRec: UiRecommendation | null = null;
  let maxCount = 0;
  // Order of priority if tied: strong_hire > hire > no_hire
  for (const rec of ['no_hire', 'hire', 'strong_hire'] as const) {
    if (counts[rec] >= maxCount && counts[rec] > 0) {
      maxCount = counts[rec];
      topRec = rec;
    }
  }

  const interviewerNames = Array.from(
    new Set(
      scorecards
        .map((s) => s.interviewerName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).join(', ');

  const isLocked = scorecards.some((s) => s.isLocked);

  return {
    averageRating,
    recommendation: topRec,
    interviewerNames,
    isLocked,
  };
}

/**
 * Computes aggregate recommendation counts across a list of interviews.
 */
export function computeInterviewsStats(interviews?: Interview[]): InterviewStats {
  if (!interviews || interviews.length === 0) {
    return { strongHire: 0, hire: 0, noHire: 0, pending: 0, total: 0 };
  }

  let strongHire = 0;
  let hire = 0;
  let noHire = 0;
  let pending = 0;

  for (const intv of interviews) {
    if (!intv.scorecards || intv.scorecards.length === 0) {
      pending++;
      continue;
    }
    const agg = aggregateInterviewScorecards(intv.scorecards);
    if (agg.recommendation === 'strong_hire') {
      strongHire++;
    } else if (agg.recommendation === 'hire') {
      hire++;
    } else if (agg.recommendation === 'no_hire') {
      noHire++;
    } else {
      pending++;
    }
  }

  return {
    strongHire,
    hire,
    noHire,
    pending,
    total: interviews.length,
  };
}

export function ScorecardSummary({
  interviewTitle,
  interviewDate,
  interviewerName,
  recommendation,
  averageRating,
  interviewId,
  isLocked,
  pendingLabel = 'Pending',
  className = '',
}: ScorecardSummaryProps) {
  const recMap = {
    strong_hire: { variant: 'success' as const, label: 'Strong Hire' },
    hire: { variant: 'info' as const, label: 'Hire' },
    no_hire: { variant: 'danger' as const, label: 'No Hire' },
  };

  const recBadge = recommendation
    ? recMap[recommendation]
    : { variant: 'neutral' as const, label: pendingLabel };

  let progressTone: ProgressTone = 'neutral';
  if (recommendation === 'strong_hire') {
    progressTone = 'success';
  } else if (recommendation === 'hire') {
    progressTone = 'action';
  } else if (recommendation === 'no_hire') {
    progressTone = 'danger';
  } else if (averageRating != null) {
    if (averageRating >= 4) progressTone = 'success';
    else if (averageRating >= 3) progressTone = 'action';
    else progressTone = 'danger';
  }

  const ratingText = averageRating != null ? `${averageRating} / 5` : 'Pending';

  return (
    <div
      className={`rounded-2xl border border-rf-border-subtle bg-white dark:bg-rf-surface p-5 shadow-xs flex flex-col justify-between gap-4 transition-all ${className}`}
      data-testid="scorecard-summary"
    >
      {/* Title + Date & Colored Recommendation */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-sm font-bold text-rf-ink truncate m-0" title={interviewTitle}>
            {interviewTitle}
          </h4>
          <p className="text-xs text-rf-ink-muted m-0">{interviewDate}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={recBadge.variant}>{recBadge.label}</Badge>
          {isLocked && (
            <span title="Scorecard finalized" className="text-rf-ink-muted inline-flex items-center">
              <Icon name="lock" size={12} />
            </span>
          )}
        </div>
      </div>

      {/* Interviewer */}
      <div className="text-xs text-rf-ink font-medium flex items-center gap-2">
        <span className="text-rf-ink-muted flex items-center gap-1 shrink-0">
          <Icon name="user" size={13} />
          Interviewer:
        </span>
        <span className="truncate">{interviewerName || '—'}</span>
      </div>

      {/* Rating ProgressBar */}
      <div className="space-y-1">
        <ProgressBar
          value={averageRating ?? 0}
          max={5}
          label="Rating"
          description={ratingText}
          tone={progressTone}
          showValue={false}
        />
      </div>

      {/* Full Scorecard Link */}
      <div className="pt-2 border-t border-rf-border-subtle/60 flex items-center justify-between">
        <Link
          to={`/interviews/${interviewId}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-rf-action hover:underline"
        >
          View full scorecard -&gt;
        </Link>
      </div>
    </div>
  );
}
