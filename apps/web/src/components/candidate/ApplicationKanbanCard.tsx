import { useEffect, useRef, useState, type DragEvent } from 'react';
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
  experienceYears?: number | null;
  matchScore: number;
  owner: KanbanOwner;
  appliedAt?: string | null;
  createdAt?: string | null;
  primaryRecruiterId?: string | null;
  fitSummary?: string;
};

export type CardStatusSignal = 'ready' | 'in_progress' | 'blocked';

type ApplicationKanbanCardProps = {
  card: ApplicationKanbanCardModel;
  showStage?: boolean;
  signal?: CardStatusSignal;
  claiming?: boolean;
  onOpen: () => void;
  onAddNote: () => void;
  onMoveStage: () => void;
  onAssignToMe: () => void;
  onDragStart: (event: DragEvent) => void;
  onSignalChange: (next: CardStatusSignal) => void;
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bApi\b/g, 'API');
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'recently';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'recently';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

function fitTone(score: number) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (score >= 60) return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
  return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function prettySource(source: string): string {
  if (!source || source === '—') return '';
  return titleCase(source.replace(/_/g, ' '));
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
  onDragStart,
  onSignalChange,
}: ApplicationKanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unassigned = !card.primaryRecruiterId || card.owner.name === 'Unassigned';
  const appliedAgo = formatRelativeTime(card.appliedAt || card.createdAt);
  const sourceLabel = prettySource(card.source);
  const years = card.experienceYears;

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <article
      className="group relative flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          draggable
          aria-label="Drag to move stage"
          title="Drag to move stage"
          onDragStart={(event) => {
            event.stopPropagation();
            onDragStart(event);
          }}
          onClick={(event) => event.stopPropagation()}
          className="mt-1 shrink-0 rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-800"
        >
          <Icon name="grip" size={14} />
        </button>

        {card.photoUrl ? (
          <img
            src={card.photoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {card.initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="min-w-0 text-left"
            >
              <span className="block truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                {titleCase(card.name)}
              </span>
              <span className="mt-0.5 block truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                {titleCase(card.positionTitle || 'Open role')}
              </span>
            </button>

            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Card actions"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <Icon name="more-horizontal" size={16} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); onAddNote(); }}>
                    Add note
                  </button>
                  <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); onMoveStage(); }}>
                    Move stage
                  </button>
                  {unassigned && (
                    <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); onAssignToMe(); }}>
                      Assign recruiter
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
                  {([
                    ['in_progress', 'In progress'],
                    ['ready', 'Ready'],
                    ['blocked', 'Blocked'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      className={`block w-full px-3 py-2 text-left text-xs ${signal === value ? 'font-bold text-blue-700 dark:text-blue-300' : 'font-medium text-slate-700 dark:text-slate-200'} hover:bg-slate-50 dark:hover:bg-slate-800`}
                      onClick={() => {
                        setMenuOpen(false);
                        onSignalChange(value);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {card.applicationCode} · Applied {appliedAgo}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-7">
        <span
          title={card.fitSummary || `Candidate fit ${card.matchScore}%`}
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${fitTone(card.matchScore)}`}
        >
          {card.matchScore}% fit
        </span>
        {showStage && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{card.stage}</span>
        )}
        {sourceLabel && (
          <span className="text-[11px] text-slate-600 dark:text-slate-300">{sourceLabel}</span>
        )}
        {typeof years === 'number' && years > 0 && (
          <span className="text-[11px] text-slate-600 dark:text-slate-300">
            {years} yrs experience
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <div className="min-w-0">
          {unassigned ? (
            <span className="text-[11px] text-slate-500">Unassigned</span>
          ) : (
            <span className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200" title={card.owner.name}>
              {card.owner.name}
            </span>
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
            className="inline-flex min-h-7 items-center rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {claiming ? 'Assigning…' : 'Assign to me'}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex min-h-8 items-center justify-between rounded-lg px-0 text-left text-[12px] font-semibold text-blue-700 hover:underline dark:text-blue-300"
      >
        Review application
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

export function mapFitSummary(breakdown?: CriteriaBreakdown): string | undefined {
  return breakdown?.summaryText;
}
