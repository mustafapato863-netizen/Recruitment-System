import React from 'react';
import { Link } from 'react-router-dom';
import { SkillTagsOverflow } from './SkillTagsOverflow';
import { CandidateFitScoreBadge } from './CandidateFitScorecard';

export interface ComparisonCandidate {
  id: string;
  applicationId?: string;
  candidateCode?: string;
  name: string;
  role: string;
  avatarColor: string;
  matchScore: number;
  matchGrade: string;
  skills: string[];
  /** Matched requirement skills for chip priority/highlight. */
  matchedSkills?: string[];
  experience: string;
  education: string;
  stage?: string;
  ratings: {
    technical: number;
    communication: number;
    teamwork: number;
  };
  recommendation: string;
}

interface ComparisonMatrixCardProps {
  candidate: ComparisonCandidate;
  onRemove: (id: string) => void;
  onSelectOffer: (candidate: ComparisonCandidate) => void;
}

export const ComparisonMatrixCard: React.FC<ComparisonMatrixCardProps> = ({
  candidate: c,
  onRemove,
  onSelectOffer,
}) => {
  const awaitingPosition = c.matchGrade === 'Select a position';
  const scoreLabel = awaitingPosition ? '—' : `${c.matchScore}%`;
  const scoreDetail = awaitingPosition ? 'Select a position' : 'Position fit';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4 relative">
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(c.id)}
        title="Remove from comparison"
        className="absolute top-3.5 right-3.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 text-xs cursor-pointer transition"
      >
        ✕
      </button>

      {/* Header Profile with 360 Link */}
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl ${c.avatarColor} font-black text-sm flex items-center justify-center shrink-0 shadow-xs`}>
          {c.name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 pr-4">
          <Link
            to={`/candidates/${c.id}`}
            className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate hover:text-blue-600 block no-underline"
            title="Open Candidate 360 Profile"
          >
            {c.name}
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-slate-400 font-medium truncate">{c.role}</span>
            {c.candidateCode && (
              <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {c.candidateCode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Compact Match Score */}
      <div className="py-2.5 px-3 flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
        {awaitingPosition ? (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
            {scoreLabel}
          </span>
        ) : (
          <CandidateFitScoreBadge score={c.matchScore} />
        )}
        <div>
          <span className="text-xs font-bold text-slate-900 dark:text-white block">{scoreDetail}</span>
          <span className={`text-[10px] font-semibold ${awaitingPosition ? "text-slate-500 dark:text-slate-400" : "text-emerald-600 dark:text-emerald-400"}`}>{c.matchGrade}</span>
        </div>
      </div>

      {/* Skills / Key Competencies */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Key Competencies
        </span>
        <SkillTagsOverflow
          skills={c.skills}
          prioritySkills={c.matchedSkills}
          limit={6}
        />
      </div>

      {/* Experience */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Clinical Background
        </span>
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">{c.experience}</p>
      </div>

      {/* Education */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Degrees & Academics
        </span>
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{c.education}</p>
      </div>

      {/* Interview Ratings Breakdown */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Scorecard Ratings
        </span>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">Technical Competence</span>
          <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.technical)}{'☆'.repeat(5 - c.ratings.technical)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">Communication & Bedside</span>
          <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.communication)}{'☆'.repeat(5 - c.ratings.communication)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">Team Collaboration</span>
          <span className="text-amber-400 text-xs">{'★'.repeat(c.ratings.teamwork)}{'☆'.repeat(5 - c.ratings.teamwork)}</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-500">Recommendation</span>
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {c.recommendation}
        </span>
      </div>

      <div className="pt-2 space-y-1.5">
        <button
          type="button"
          onClick={() => onSelectOffer(c)}
          className="w-full py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center"
        >
          Create offer
        </button>
        <Link
          to={`/candidates/${c.id}`}
          className="w-full py-1.5 text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline block"
        >
          Open profile
        </Link>
      </div>
    </div>
  );
};
