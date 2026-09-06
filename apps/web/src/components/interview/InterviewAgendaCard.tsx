import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';

export interface InterviewAgendaItem {
  id: string;
  applicationId: string;
  candidateId: string;
  locationUrl?: string;
  time: string;
  duration: string;
  candidateName: string;
  candidateRole: string;
  candidateAvatar: string;
  jobTitle: string;
  department: string;
  typeTag: string;
  typeTone: 'purple' | 'blue' | 'green';
  panel: string;
  mode: string;
  modeIcon: 'video' | 'phone' | 'map-pin';
  interviewerName: string;
  interviewerAvatar: string;
  statusBadge: string;
  statusTone: 'green' | 'amber' | 'blue';
}

interface InterviewAgendaCardProps {
  item: InterviewAgendaItem;
}

const getStatusBadgeClass = (tone: 'green' | 'amber' | 'blue') => {
  switch (tone) {
    case 'green':
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    case 'amber':
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    case 'blue':
    default:
      return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
  }
};

const getTypeTagClass = (tone: 'purple' | 'blue' | 'green') => {
  switch (tone) {
    case 'purple':
      return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    case 'blue':
      return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    case 'green':
    default:
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
  }
};

export const InterviewAgendaCard: React.FC<InterviewAgendaCardProps> = ({ item }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/interviews/${item.id}`)}
      className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer space-y-3 group"
    >
      {/* Top Row: Time, Candidate, Position, Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Time pill + Candidate */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-16 sm:w-20 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-center shrink-0">
            <span className="block text-xs font-black text-slate-900 dark:text-white leading-tight">
              {item.time}
            </span>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {item.duration}
            </span>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              {item.candidateAvatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {item.candidateId ? (
                  <Link
                    to={`/candidates/${item.candidateId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-blue-600 transition truncate no-underline"
                    title="View Candidate 360 Profile"
                  >
                    {item.candidateName}
                  </Link>
                ) : (
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {item.candidateName}
                  </span>
                )}
                {item.candidateId && (
                  <Link
                    to={`/candidates/${item.candidateId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 no-underline hover:bg-purple-100 shrink-0"
                    title="Open Candidate 360 Profile"
                  >
                    360°
                  </Link>
                )}
              </div>
              <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                {item.jobTitle} {item.department && item.department !== '—' ? `• ${item.department}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Round Tag, Mode Pill & Status */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${getTypeTagClass(item.typeTone)}`}>
            {item.typeTag}
          </span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Icon
              name={item.modeIcon === 'phone' ? 'phone' : item.modeIcon === 'map-pin' ? 'map-pin' : 'video'}
              size={12}
              className="text-slate-400"
            />
            <span>{item.mode}</span>
          </div>
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap ${getStatusBadgeClass(item.statusTone)}`}>
            {item.statusBadge}
          </span>
        </div>
      </div>

      {/* Bottom Row: Panel Members & 1-Click Quick Actions */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Panel info */}
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
          <span className="font-semibold text-slate-400 text-[11px]">Interviewer:</span>
          <div className="flex items-center gap-1.5">
            {item.interviewerAvatar && item.interviewerAvatar.startsWith('http') ? (
              <img
                src={item.interviewerAvatar}
                alt={item.interviewerName}
                className="w-5 h-5 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[9px] flex items-center justify-center">
                {item.interviewerAvatar}
              </div>
            )}
            <span className="font-bold text-slate-700 dark:text-slate-300">{item.interviewerName}</span>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {item.locationUrl ? (
            <a
              href={item.locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs no-underline"
              title="Launch Meeting"
            >
              <Icon name="video" size={12} />
              <span>Join Meeting</span>
            </a>
          ) : null}

          <Link
            to={`/interviews/${item.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition shadow-2xs no-underline"
            title="View Scorecard & Evaluation"
          >
            <Icon name="edit" size={12} />
            <span>Scorecard</span>
          </Link>

          {item.candidateId && (
            <Link
              to={`/candidates/${item.candidateId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition shadow-2xs no-underline"
              title="View 360 Profile"
            >
              <Icon name="user" size={12} />
              <span>360° Profile</span>
            </Link>
          )}

          <Link
            to={`/interviews/${item.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition shadow-2xs no-underline"
            title="View Interview Details"
          >
            <span>Details</span>
            <Icon name="arrow-right" size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
};
