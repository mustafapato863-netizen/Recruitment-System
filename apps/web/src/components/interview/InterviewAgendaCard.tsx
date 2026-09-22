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
  onQuickScorecard?: (interviewId: string) => void;
  onDownloadIcs?: (interviewId: string) => void;
}

function getInterviewNextAction(item: InterviewAgendaItem) {
  if (item.statusBadge === 'Feedback Pending') {
    return { kind: 'scorecard' as const, label: 'Submit scorecard', hint: 'Interview ended. Record feedback.' };
  }
  if (item.statusBadge === 'Feedback Done') {
    return { kind: 'application' as const, label: 'Open application', hint: 'Scorecard is in. Continue the pipeline.' };
  }
  if (item.locationUrl) {
    return { kind: 'join' as const, label: 'Join interview', hint: `${item.time} · ${item.mode}` };
  }
  return { kind: 'details' as const, label: 'Open interview', hint: `${item.time} · ${item.mode}` };
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

export const InterviewAgendaCard: React.FC<InterviewAgendaCardProps> = ({
  item,
  onQuickScorecard,
  onDownloadIcs,
}) => {
  const navigate = useNavigate();
  const next = getInterviewNextAction(item);

  const runNext = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (next.kind === 'scorecard') {
      onQuickScorecard?.(item.id);
      return;
    }
    if (next.kind === 'application' && item.applicationId) {
      navigate(`/applications/${item.applicationId}`);
      return;
    }
    if (next.kind === 'join' && item.locationUrl) {
      window.open(item.locationUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/interviews/${item.id}`);
  };

  return (
    <div
      onClick={() => navigate(`/interviews/${item.id}`)}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-16 shrink-0 text-center">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{item.time}</span>
            <span className="block text-[11px] text-slate-500">{item.duration}</span>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {item.candidateAvatar}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.candidateName}</p>
            <p className="truncate text-xs text-slate-500">
              {item.jobTitle}
              {item.department && item.department !== '—' ? ` · ${item.department}` : ''}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClass(item.statusTone)}`}>
          {item.statusBadge}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-slate-500">
            {item.interviewerName} · {item.typeTag.replace(/ Round$/i, '')}
          </p>
          <p className="truncate text-[11px] text-slate-500">{next.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onDownloadIcs && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDownloadIcs(item.id);
              }}
              className="inline-flex min-h-7 items-center rounded-lg px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Add to calendar"
            >
              Calendar
            </button>
          )}
          <button
            type="button"
            onClick={runNext}
            className="inline-flex min-h-7 items-center rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            {next.label}
          </button>
        </div>
      </div>
    </div>
  );
};
