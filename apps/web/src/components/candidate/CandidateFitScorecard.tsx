import { useState } from 'react';
import {
  calculateCandidateFitScore,
  type CandidateMatchProfile,
  type PositionRequirements,
  type CriteriaBreakdown,
  type MatchLevel,
} from '@recruitflow/validation';
import { Icon } from '../Icon';

export interface CandidateFitScorecardProps {
  candidate?: CandidateMatchProfile | null;
  requirements?: PositionRequirements | null;
  /** Pre-calculated breakdown if already available */
  breakdown?: CriteriaBreakdown | null;
  variant?: 'full' | 'compact' | 'badge';
  className?: string;
  showBreakdownInitially?: boolean;
}

function getScoreTone(score: number, matchLevel: MatchLevel) {
  if (matchLevel === 'high' || score >= 80) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-600 text-white',
      barBg: 'bg-emerald-600 dark:bg-emerald-500',
      barTrack: 'bg-emerald-100 dark:bg-emerald-950',
      label: 'High Match',
      icon: 'sparkles',
    };
  }
  if (matchLevel === 'moderate' || score >= 60) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-600 text-white',
      barBg: 'bg-amber-500 dark:bg-amber-400',
      barTrack: 'bg-amber-100 dark:bg-amber-950',
      label: 'Moderate Match',
      icon: 'info',
    };
  }
  return {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-300',
    badgeBg: 'bg-rose-600 text-white',
    barBg: 'bg-rose-500 dark:bg-rose-400',
    barTrack: 'bg-rose-100 dark:bg-rose-950',
    label: 'Skill Gap',
    icon: 'alert-triangle',
  };
}

export function CandidateFitScorecard({
  candidate,
  requirements,
  breakdown: providedBreakdown,
  variant = 'full',
  className = '',
  showBreakdownInitially = true,
}: CandidateFitScorecardProps) {
  const [isExpanded, setIsExpanded] = useState(showBreakdownInitially);

  const result: CriteriaBreakdown =
    providedBreakdown ||
    calculateCandidateFitScore(
      candidate || { skills: [], experienceYears: 0 },
      requirements || { requiredSkills: [] },
    );

  const tone = getScoreTone(result.score, result.matchLevel);

  // Variant: Pure Badge (used on Kanban cards and dense lists)
  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${tone.bg} ${tone.border} ${tone.text} ${className}`}
        title={`Candidate Fit Score: ${result.score}% (${tone.label})\n${result.summaryText}`}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'currentColor' }} />
        <span>{result.score}% Match</span>
      </span>
    );
  }

  // Variant: Compact (used in list headers or summary banners)
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${tone.bg} ${tone.border} ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`px-2 py-1 rounded-lg text-xs font-black ${tone.badgeBg}`}>
            {result.score}%
          </div>
          <div>
            <div className={`text-xs font-bold ${tone.text}`}>{tone.label}</div>
            <p className="text-[11px] text-rf-ink-muted m-0">
              {result.breakdown.skills.matched.length} of{' '}
              {result.breakdown.skills.matched.length + result.breakdown.skills.missing.length || 0} skills met
              {result.breakdown.experience.required > 0 && ` · ${result.breakdown.experience.actual}/${result.breakdown.experience.required} yrs exp`}
            </p>
          </div>
        </div>
        <div className="w-24 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tone.barBg}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>
    );
  }

  // Variant: Full Scorecard (Dossier & Drawer)
  const { skills, experience, certifications, location } = result.breakdown;

  return (
    <div
      className={`rounded-2xl border ${tone.border} bg-white dark:bg-slate-900 p-5 shadow-xs transition-all space-y-4 ${className}`}
    >
      {/* Header Metric & Tier */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center font-black border shadow-xs ${tone.bg} ${tone.border} ${tone.text}`}
          >
            <span className="text-lg leading-none">{result.score}%</span>
            <span className="text-[9px] uppercase tracking-wider opacity-80 mt-0.5">Fit</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white m-0">
                Position Fit &amp; Screening Score
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${tone.badgeBg}`}>
                {tone.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5 max-w-md">
              {result.summaryText}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-xs font-bold text-sky-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer p-1"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Hide Breakdown' : 'View Breakdown'}</span>
          <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
      </div>

      {/* Criteria Breakdown Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* 1. Clinical & Technical Skills */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Icon name="sparkles" size={13} className="text-sky-600 dark:text-cyan-400" />
                  Skills Match (40%)
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {skills.percentage}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${tone.barBg}`}
                  style={{ width: `${skills.percentage}%` }}
                />
              </div>

              {/* Matched Skills */}
              <div className="space-y-1.5">
                {skills.matched.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {skills.matched.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10.5px] font-semibold"
                      >
                        <Icon name="check" size={10} />
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Missing Skills */}
                {skills.missing.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {skills.missing.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10.5px] font-semibold"
                        title="Skill gap identified"
                      >
                        <span className="font-mono text-[9px]">⚠️</span>
                        Missing: {skill}
                      </span>
                    ))}
                  </div>
                )}
                {skills.matched.length === 0 && skills.missing.length === 0 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">General role intake (no mandatory skills).</span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Experience Requirement */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Icon name="briefcase" size={13} className="text-sky-600 dark:text-cyan-400" />
                  Experience (25%)
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {experience.actual} / {experience.required || 'Flexible'} yrs
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    experience.met ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-amber-500 dark:bg-amber-400'
                  }`}
                  style={{ width: `${experience.percentage}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                {experience.met ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10.5px] font-semibold">
                    <Icon name="check" size={10} />
                    Meets Minimum Requirement ({experience.actual} yrs)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10.5px] font-semibold">
                    ⚠️ {experience.required - experience.actual} yrs below preferred benchmark
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Certifications & SCFHS */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Icon name="shield-check" size={13} className="text-sky-600 dark:text-cyan-400" />
                  Licenses &amp; Certs (25%)
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {certifications.percentage}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    certifications.met ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-amber-500 dark:bg-amber-400'
                  }`}
                  style={{ width: `${certifications.percentage}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {certifications.matched.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10.5px] font-semibold"
                  >
                    <Icon name="check" size={10} />
                    {cert}
                  </span>
                ))}
                {certifications.missing.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[10.5px] font-semibold"
                  >
                    Missing: {cert}
                  </span>
                ))}
                {certifications.matched.length === 0 && certifications.missing.length === 0 && (
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    {certifications.evidenceStatus === 'not_applicable'
                      ? 'No certification requirement configured.'
                      : certifications.evidenceStatus === 'provided'
                        ? 'Certificate listed on CV; verification required.'
                        : 'No certification evidence provided.'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Branch & Location */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Icon name="building" size={13} className="text-sky-600 dark:text-cyan-400" />
                  Location (10%)
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {location.met ? 'Local Match' : 'Relocation Required'}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    location.met ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                  style={{ width: `${location.percentage}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">
                Candidate: <strong className="text-slate-800 dark:text-slate-200">{location.actual}</strong> · Opening:{' '}
                <strong className="text-slate-800 dark:text-slate-200">{location.expected}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
