import React from 'react';
import { Link } from 'react-router-dom';

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
  const isTop = c.matchScore >= 90;
  const ringColor = isTop ? 'text-blue-600' : c.matchScore >= 75 ? 'text-emerald-500' : 'text-amber-500';

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

      {/* Circular Match Gauge */}
      <div className="py-2.5 px-3 flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-200 dark:text-slate-700"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={ringColor}
              strokeDasharray={`${c.matchScore}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[11px] font-black text-slate-900 dark:text-white">{c.matchScore}%</span>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-900 dark:text-white block">{c.matchScore}% Match</span>
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{c.matchGrade}</span>
        </div>
      </div>

      {/* Skills / Key Competencies */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Key Competencies
        </span>
        <div className="flex flex-wrap gap-1">
          {c.skills.map((skill, idx) => (
            <span
              key={idx}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40"
            >
              {skill}
            </span>
          ))}
        </div>
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
        <span className="text-[10px] text-slate-400 font-semibold uppercase">Recommendation</span>
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
          Select & Create Offer
        </button>
        <Link
          to={`/candidates/${c.id}`}
          className="w-full py-1.5 text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline block"
        >
          View 360° Profile ↗
        </Link>
      </div>
    </div>
  );
};
