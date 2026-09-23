import type { DragEvent } from 'react';
import type { ApplicationStage } from '@recruitflow/contracts';
import type { CriteriaBreakdown } from '@recruitflow/validation';
import { Icon } from '../Icon';

export type KanbanOwner = {
  name: string;
  initials: string;
  color: string;
};

export type ApplicationKanbanCardModel = {
  id: string;
  applicationCode: string;
  name: string;
  initials: string;
  photoUrl?: string;
  positionTitle: string;
  source: string;
  stage: ApplicationStage | string;
  nextAction: string;
  nextActionKind?: KanbanNextActionKind;
  experienceYears?: number | null;
  matchScore: number;
  owner: KanbanOwner;
  appliedAt?: string | null;
  createdAt?: string | null;
  primaryRecruiterId?: string | null;
  fitSummary?: string;
};

export type CardStatusSignal = 'ready' | 'in_progress' | 'blocked';
export type KanbanNextActionKind = 'assign' | 'advance' | 'schedule' | 'offer' | 'hire' | 'view';

type ApplicationKanbanCardProps = {
  card: ApplicationKanbanCardModel;
  showStage?: boolean;
  signal?: CardStatusSignal;
  claiming?: boolean;
  onOpen: () => void;
  onAddNote: () => void;
  onMoveStage: () => void;
  onAssignToMe: () => void;
  onNextAction?: (kind: KanbanNextActionKind) => void;
  onDragStart: (event: DragEvent) => void;
  onSignalChange: (next: CardStatusSignal) => void;
};

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Recent';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Recent';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

function formatDisplayText(value: string): string {
  if (!value || value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nextSignal(signal: CardStatusSignal): CardStatusSignal {
  if (signal === 'in_progress') return 'ready';
  if (signal === 'ready') return 'blocked';
  return 'in_progress';
}

export function ApplicationKanbanCard({
  card,
  showStage = false,
  signal = 'in_progress',
  claiming = false,
  onOpen,
  onAddNote,
  onMoveStage,
  onAssignToMe,
  onNextAction,
  onDragStart,
  onSignalChange,
}: ApplicationKanbanCardProps) {
  const unassigned = !card.primaryRecruiterId || card.owner.name === 'Unassigned';
  const appliedAgo = formatRelativeTime(card.appliedAt || card.createdAt);
  const signalTitle =
    signal === 'ready'
      ? 'Status: Ready for next stage'
      : signal === 'blocked'
        ? 'Status: Blocked'
        : 'Status: In progress';
  const signalDotClass =
    signal === 'ready'
      ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700'
      : signal === 'blocked'
        ? 'bg-rose-500 ring-2 ring-rose-300 dark:ring-rose-700'
        : 'bg-amber-400 ring-2 ring-amber-200 dark:ring-amber-700';
  const signalLabel = signal === 'ready' ? 'Ready' : signal === 'blocked' ? 'Blocked' : 'In progress';
  const signalTextClass = signal === 'in_progress' ? 'text-slate-900' : 'text-white';

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      role="group"
      tabIndex={0}
      aria-label={`Open application for ${card.name}`}
      className="rf-application-kanban-card group relative flex cursor-grab select-none flex-col gap-2.5 rounded-xl border border-slate-200/85 bg-white p-[8px] shadow-2xs transition-all duration-150 hover:border-blue-400/80 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:cursor-grabbing dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {card.photoUrl ? (
            <img
              src={card.photoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300">
              {card.initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-tight text-slate-900 group-hover:text-blue-600 dark:text-white" title={card.name}>
              {formatDisplayText(card.name)}
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-slate-600 dark:text-slate-400">
              <span className="max-w-[120px] truncate">{card.applicationCode}</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="shrink-0">{appliedAgo}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSignalChange(nextSignal(signal));
            }}
            className={`inline-flex min-h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[10px] font-bold shadow-xs transition hover:brightness-95 ${signalDotClass}`}
            title={signalTitle}
            aria-label={signalTitle}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden="true" />
            <span className={signalTextClass}>{signalLabel}</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddNote();
            }}
            className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
            title="Quick note"
          >
            <Icon name="edit" size={12} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMoveStage();
            }}
            className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            title="Move stage"
          >
            <Icon name="more-horizontal" size={12} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Icon name="briefcase" size={11} className="shrink-0 text-slate-400" />
          <span className="truncate">{formatDisplayText(card.positionTitle)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            title={card.fitSummary || `Candidate fit ${card.matchScore}%`}
            className="inline-flex items-center rounded-md border border-blue-200/60 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300"
          >
            {card.matchScore}% fit
          </span>
          {showStage && (
            <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-300">
              {card.stage}
            </span>
          )}
        </div>
        {((card.source && card.source !== '—') || card.experienceYears) && (
          <p
            className="truncate text-[10.5px] text-slate-500 dark:text-slate-400"
            title={[card.source !== '—' ? card.source : '', card.experienceYears ? `${card.experienceYears} years experience` : ''].filter(Boolean).join(' · ')}
          >
            {[card.source !== '—' ? formatDisplayText(card.source) : '', card.experienceYears ? `${card.experienceYears} yrs experience` : ''].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800/80">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <Icon name="calendar" size={11} className="shrink-0 text-slate-400" />
          {onNextAction ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onNextAction(card.nextActionKind || 'view');
              }}
              className="truncate rounded-md text-left font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
            >
              {card.nextAction}
            </button>
          ) : (
            <span className="truncate font-medium">{card.nextAction}</span>
          )}
        </div>
        {unassigned ? (
          <button
            type="button"
            disabled={claiming}
            onClick={(event) => {
              event.stopPropagation();
              onAssignToMe();
            }}
            className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10.5px] font-bold text-blue-700 shadow-2xs transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60"
            title="Assign yourself as recruiter"
          >
            <Icon name="user-check" size={10} />
            <span>{claiming ? 'Claiming…' : 'Claim'}</span>
          </button>
        ) : (
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white shadow-2xs ${card.owner.color}`}
            title={`Assigned recruiter: ${card.owner.name}`}
          >
            {card.owner.initials}
          </div>
        )}
      </div>
    </article>
  );
}

export function mapFitSummary(breakdown?: CriteriaBreakdown): string | undefined {
  return breakdown?.summaryText;
}
