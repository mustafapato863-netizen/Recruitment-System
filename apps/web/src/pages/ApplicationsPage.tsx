import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi, patchApi, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type {
  Application,
  ApplicationStage,
  PaginatedResult,
  UpdateApplicationStageInput,
  Vacancy,
  VacancyDetailView,
} from '@recruitflow/contracts';
import { calculateCandidateFitScore, type CriteriaBreakdown } from '@recruitflow/validation';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { CandidateFitScorecard } from '../components/candidate/CandidateFitScorecard';
import { ApplicationKanbanCard, mapFitSummary } from '../components/candidate/ApplicationKanbanCard';
import { getNextActionPlan, type NextActionKind } from '../components/candidate/NextActionGuidanceBanner';
import { Drawer } from '../components/ui/Drawer';
import { CommentsThread } from '../components/ui/CommentsThread';
import { AddApplicationModal } from '../components/candidate/AddApplicationModal';
import { PageState } from '../components/ui/PageState';
import { QuickGuideTrigger } from '../quickguide';
import './PageEnhancementsV2.css';

interface KanbanCard {
  id: string;
  applicationCode: string;
  name: string;
  initials: string;
  photoUrl?: string;
  appliedText: string;
  owner: {
    name: string;
    initials: string;
    color: string;
  };
  nextAction: string;
  nextDue: string;
  nextDueTone: 'blue' | 'purple' | 'amber' | 'gray';
  lastActivity: string;
  lastActivityTime: string;
  stage: ApplicationStage;
  version: number;
  rawApplication: Application;
  positionTitle: string;
  source: string;
  matchScore: number;
  fitBreakdown?: CriteriaBreakdown;
  experienceYears?: number | null;
}

interface KanbanColumn {
  id: string;
  name: string;
  stageKey: ApplicationStage;
  count: number;
  subtext: string;
  cards: KanbanCard[];
}

interface ListRowCandidate {
  id: string;
  applicationCode: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  appliedAgo: string;
  positionTitle: string;
  department: string;
  location: string;
  currentStage: ApplicationStage;
  stageColor: string;
  ownerName: string;
  ownerAvatar: string;
  sla: string;
  slaSub: string;
  slaTone: 'amber' | 'red' | 'green';
  lastActivity: string;
  lastActivityTime: string;
  source: string;
  fitScore: number;
  fitBreakdown?: CriteriaBreakdown;
  nextAction: string;
  nextActionTime: string;
  nextActionIcon: string;
  rawApplication: Application;
}

export interface PipelineColumnDef {
  id: string;
  name: string;
  stageKey: ApplicationStage;
  matchedStages?: ApplicationStage[];
  accentBg: string;
  accentBorder: string;
  accentBar: string;
  slaTooltip: string;
  defaultFolded?: boolean;
  stepBadge?: string;
  subtext?: string;
}

export type PipelineStepMode = 'standard' | 'streamlined' | 'fast_track';

export type CardStatusSignal = 'ready' | 'in_progress' | 'blocked';

export const PIPELINE_COLUMNS: PipelineColumnDef[] = [
  {
    id: 'new',
    name: 'New Applied',
    stageKey: 'Applied',
    accentBg: 'bg-slate-500',
    accentBorder: 'border-slate-300 dark:border-slate-700',
    accentBar: 'bg-slate-500',
    slaTooltip: 'Intake: New applicant submissions awaiting initial review within 24h SLA.',
  },
  {
    id: 'screening',
    name: 'Screening',
    stageKey: 'Screening',
    accentBg: 'bg-teal-500',
    accentBorder: 'border-teal-300 dark:border-teal-700',
    accentBar: 'bg-teal-500',
    slaTooltip: 'Screening: CV qualification, credentials check & telephone screening within 48h SLA.',
  },
  {
    id: 'interview',
    name: 'Interview',
    stageKey: 'Interview',
    accentBg: 'bg-blue-600',
    accentBorder: 'border-blue-300 dark:border-blue-700',
    accentBar: 'bg-blue-600',
    slaTooltip: 'Interviews: Panel and technical evaluations with structured scorecards.',
  },
  {
    id: 'offer',
    name: 'Offer',
    stageKey: 'Offer',
    accentBg: 'bg-amber-500',
    accentBorder: 'border-amber-300 dark:border-amber-700',
    accentBar: 'bg-amber-500',
    slaTooltip: 'Offer: Executive & Finance approvals with Saudi Labor Law compensation breakdown.',
  },
  {
    id: 'pre_hire',
    name: 'Pre-Hire',
    stageKey: 'Pre-Hire',
    accentBg: 'bg-purple-600',
    accentBorder: 'border-purple-300 dark:border-purple-700',
    accentBar: 'bg-purple-600',
    slaTooltip: 'Pre-Hire: Mandatory SCFHS license registration, DataFlow verification & medical checks.',
  },
  {
    id: 'hired',
    name: 'Hired',
    stageKey: 'Joined',
    accentBg: 'bg-emerald-600',
    accentBorder: 'border-emerald-300 dark:border-emerald-700',
    accentBar: 'bg-emerald-600',
    slaTooltip: 'Joined: Official onboarding, contract commencement and employee file handover.',
    defaultFolded: true,
  },
];

export const STREAMLINED_COLUMNS: PipelineColumnDef[] = [
  {
    id: 'step_review',
    name: 'Review & Screening',
    stageKey: 'Screening',
    matchedStages: ['Applied', 'Screening'],
    accentBg: 'bg-teal-500',
    accentBorder: 'border-teal-300 dark:border-teal-700',
    accentBar: 'bg-teal-500',
    slaTooltip: 'Streamlined Step 1: New applications intake, CV qualification & screening.',
    stepBadge: 'Step 1 of 4',
    subtext: 'Intake & screening',
  },
  {
    id: 'step_interview',
    name: 'Interview & Assessment',
    stageKey: 'Interview',
    matchedStages: ['Interview'],
    accentBg: 'bg-blue-600',
    accentBorder: 'border-blue-300 dark:border-blue-700',
    accentBar: 'bg-blue-600',
    slaTooltip: 'Streamlined Step 2: Clinical panels, scoring rubrics & hiring committee interviews.',
    stepBadge: 'Step 2 of 4',
    subtext: 'Panel evaluations',
  },
  {
    id: 'step_offer',
    name: 'Offer & Compliance',
    stageKey: 'Offer',
    matchedStages: ['Offer', 'Pre-Hire'],
    accentBg: 'bg-amber-500',
    accentBorder: 'border-amber-300 dark:border-amber-700',
    accentBar: 'bg-amber-500',
    slaTooltip: 'Streamlined Step 3: Compensation offers, SCFHS registration & pre-hire clearance.',
    stepBadge: 'Step 3 of 4',
    subtext: 'Offer & pre-hire clearance',
  },
  {
    id: 'step_joined',
    name: 'Hired & Onboarded',
    stageKey: 'Joined',
    matchedStages: ['Joined'],
    accentBg: 'bg-emerald-600',
    accentBorder: 'border-emerald-300 dark:border-emerald-700',
    accentBar: 'bg-emerald-600',
    slaTooltip: 'Streamlined Step 4: Hospital contract signed and onboarding finalized.',
    stepBadge: 'Step 4 of 4',
    subtext: 'Finalized hires',
    defaultFolded: false,
  },
];

export const FAST_TRACK_COLUMNS: PipelineColumnDef[] = [
  {
    id: 'ft_intake',
    name: 'Intake & Sourcing',
    stageKey: 'Screening',
    matchedStages: ['Applied', 'Screening'],
    accentBg: 'bg-teal-500',
    accentBorder: 'border-teal-300 dark:border-teal-700',
    accentBar: 'bg-teal-500',
    slaTooltip: 'Fast-Track Step 1: Application intake and credential validation.',
    stepBadge: 'Step 1 of 3',
    subtext: 'Intake & screening',
  },
  {
    id: 'ft_interview',
    name: 'Interview & Decision',
    stageKey: 'Interview',
    matchedStages: ['Interview'],
    accentBg: 'bg-blue-600',
    accentBorder: 'border-blue-300 dark:border-blue-700',
    accentBar: 'bg-blue-600',
    slaTooltip: 'Fast-Track Step 2: Clinical panel assessment and decision.',
    stepBadge: 'Step 2 of 3',
    subtext: 'Panel evaluations',
  },
  {
    id: 'ft_hired',
    name: 'Offer & Placed',
    stageKey: 'Joined',
    matchedStages: ['Offer', 'Pre-Hire', 'Joined'],
    accentBg: 'bg-emerald-600',
    accentBorder: 'border-emerald-300 dark:border-emerald-700',
    accentBar: 'bg-emerald-600',
    slaTooltip: 'Fast-Track Step 3: Offer extended, signed and candidate placed.',
    stepBadge: 'Step 3 of 3',
    subtext: 'Placed candidates',
  },
];

export const ALL_PIPELINE_COLUMN_DEFS: PipelineColumnDef[] = [
  ...PIPELINE_COLUMNS,
  ...STREAMLINED_COLUMNS,
  ...FAST_TRACK_COLUMNS,
];

export function getActiveColumnDefs(mode: PipelineStepMode): PipelineColumnDef[] {
  if (mode === 'streamlined') return STREAMLINED_COLUMNS;
  if (mode === 'fast_track') return FAST_TRACK_COLUMNS;
  return PIPELINE_COLUMNS;
}

export function normalizeStageParam(param: string | null | undefined): string {
  if (!param) return 'ALL';
  const clean = param.trim().toLowerCase();
  if (clean === 'all') return 'ALL';
  if (clean === 'joined' || clean === 'hired') return 'hired';
  if (clean === 'applied' || clean === 'new') return 'new';
  if (clean === 'screening') return 'screening';
  if (clean === 'interview' || clean === 'interviews') return 'interview';
  if (clean === 'offer' || clean === 'offers') return 'offer';
  if (clean === 'pre-hire' || clean === 'pre_hire' || clean === 'prehire') return 'pre_hire';

  const match = ALL_PIPELINE_COLUMN_DEFS.find(
    (c) => c.id.toLowerCase() === clean || c.stageKey.toLowerCase() === clean
  );
  return match ? match.id : 'ALL';
}

function getInitials(name?: string | null): string {
  if (!name) return 'UN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

const APPLICATION_PAGE_SIZE = 100;

/**
 * The pipeline needs a complete working set for Kanban columns, while the API
 * remains safely paginated. Fetch pages until the server-reported total is
 * covered instead of silently dropping records after the first 100.
 */
async function fetchAllApplicationPages(query: Record<string, string> = {}) {
  const applications: Application[] = [];
  let page = 1;
  let total: number;

  do {
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    params.set('pageSize', String(APPLICATION_PAGE_SIZE));
    const response = await getApi<PaginatedResult<Application>>(`/applications?${params.toString()}`);
    applications.push(...(response.data || []));
    total = response.total ?? applications.length;
    page += 1;
    if ((response.data || []).length === 0) break;
  } while (applications.length < total);

  return { data: applications, total };
}

function getStageBadgeColor(stage: string): string {
  switch (stage) {
    case 'Applied':
      return 'slate';
    case 'Screening':
      return 'green';
    case 'Interview':
      return 'blue';
    case 'Offer':
      return 'orange';
    case 'Pre-Hire':
      return 'purple';
    case 'Joined':
      return 'emerald';
    case 'Rejected':
      return 'red';
    case 'Withdrawn':
      return 'gray';
    default:
      return 'blue';
  }
}

function mapApplicationToKanbanCard(
  a: Application,
  colStageKey: ApplicationStage,
  colId: string,
  targetVacancy?: Vacancy | VacancyDetailView | null,
): KanbanCard {
  const candidateName = a.candidate
    ? `${a.candidate.firstName} ${a.candidate.lastName}`.trim()
    : a.candidateId
    ? `Candidate ${a.candidateId.slice(0, 8)}`
    : 'Candidate';
  const initials = getInitials(candidateName);
  const ownerName = a.primaryRecruiterName || a.taskOwnerName || 'Unassigned';
  const ownerInitials = getInitials(ownerName);
  const appliedDate = a.appliedAt || a.createdAt;
  const appliedText = appliedDate ? `Applied ${formatRelativeTime(appliedDate)}` : 'Applied recently';
  const appCode = a.applicationCode || (a.id.startsWith('APP-') ? a.id : `APP-${a.id.slice(0, 8).toUpperCase()}`);

  const positionTitle = a.positionTitle || a.candidate?.currentTitle || 'Position not specified';
  const source = a.source || a.candidate?.source || 'Source not recorded';
  const experienceYears = a.candidate?.experienceYears;

  const fitBreakdown = calculateCandidateFitScore(
    {
      skills: a.candidate?.skills,
      experienceYears: a.candidate?.experienceYears,
      location: a.candidate?.location,
      certifications: a.candidate?.certifications,
      currentTitle: a.candidate?.currentTitle,
      summary: a.candidate?.summary || (a.candidate?.metadata as Record<string, unknown> | undefined)?.summary as string | undefined,
      workHistory: (a.candidate?.metadata as Record<string, unknown> | undefined)?.workHistory as Parameters<typeof calculateCandidateFitScore>[0]['workHistory'],
      educationHistory: (a.candidate?.metadata as Record<string, unknown> | undefined)?.educationHistory as Parameters<typeof calculateCandidateFitScore>[0]['educationHistory'],
      projectHistory: (a.candidate?.metadata as Record<string, unknown> | undefined)?.projectHistory as Parameters<typeof calculateCandidateFitScore>[0]['projectHistory'],
      evidenceChunks: (a.candidate?.metadata as Record<string, unknown> | undefined)?.evidenceChunks as Parameters<typeof calculateCandidateFitScore>[0]['evidenceChunks'],
      responsibilities: (a.candidate?.metadata as Record<string, unknown> | undefined)?.responsibilities as Parameters<typeof calculateCandidateFitScore>[0]['responsibilities'],
    },
    {
      requiredSkills: targetVacancy?.requiredSkills,
      minExperienceYears: targetVacancy?.minExperienceYears,
      location: targetVacancy?.location,
      qualifications: targetVacancy?.qualifications,
    },
  );
  const matchScore = fitBreakdown.score;

  let nextAction = 'Review Profile';
  if (colId === 'screening') nextAction = 'Review Application';
  else if (colId === 'interview') nextAction = 'Interview Evaluation';
  else if (colId === 'offer') nextAction = 'Draft Offer';
  else if (colId === 'pre_hire') nextAction = 'Onboarding Checks';
  else if (colId === 'hired') nextAction = 'Joined Team';

  return {
    id: a.id,
    applicationCode: appCode,
    name: candidateName,
    initials,
    photoUrl: (a.candidate as { avatarUrl?: string } | undefined)?.avatarUrl || undefined,
    appliedText,
    owner: {
      name: ownerName,
      initials: ownerInitials,
      color: 'bg-teal-800',
    },
    nextAction,
    nextDueTone: a.nextFollowUpAt ? 'amber' : 'gray',
    lastActivity: a.lastActivityLabel || 'Application updated',
    lastActivityTime: a.lastActivityAt ? formatRelativeTime(a.lastActivityAt) : 'Recently',
    nextDue: a.nextFollowUpAt ? formatRelativeTime(a.nextFollowUpAt) : 'No follow-up scheduled',
    stage: a.stage || colStageKey,
    version: a.version ?? 1,
    rawApplication: a,
    positionTitle,
    source,
    matchScore,
    fitBreakdown,
    experienceYears,
  };
}

const REJECTION_REASONS = [
  'Missing Required SCFHS Medical License / Registration',
  'Insufficient Clinical / Specialized Experience',
  'Salary Expectations Exceed Approved Budget',
  'Failed Technical / Clinical Interview Assessment',
  'Candidate Withdrew / Relocation Issue',
  'Better Qualified Candidate Selected',
  'Other / Custom Reason',
];

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');
  const { user } = useAuth();

  const [currentVacancy, setCurrentVacancy] = useState<VacancyDetailView | null>(null);
  const currentVacancyRef = useRef<VacancyDetailView | null>(currentVacancy);
  currentVacancyRef.current = currentVacancy;

  const [allVacancies, setAllVacancies] = useState<Vacancy[]>([]);
  const allVacanciesRef = useRef<Vacancy[]>(allVacancies);
  allVacanciesRef.current = allVacancies;

  const vacancyMap = useMemo(() => new Map(allVacancies.map((v) => [v.id, v])), [allVacancies]);
  const vacancyMapRef = useRef(vacancyMap);
  vacancyMapRef.current = vacancyMap;
  const [quickNoteApp, setQuickNoteApp] = useState<{
    id: string;
    candidateName: string;
    appCode: string;
  } | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [apiApplications, setApiApplications] = useState<Application[]>([]);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState('ALL');
  const initialStage = useMemo(() => normalizeStageParam(searchParams.get('stage')), [searchParams]);
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>(initialStage);
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);

  // Rejection & Refusal Reason Modal State (E9.4)
  const [rejectionModalData, setRejectionModalData] = useState<{
    cardId: string;
    cardName: string;
    sourceColId: string;
    targetColId: string;
    card: KanbanCard;
    previousColumns: KanbanColumn[];
  } | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(REJECTION_REASONS[0]);
  const [customReasonNote, setCustomReasonNote] = useState<string>('');

  // Headcount Fulfillment & Auto-Closure Handshake Modal State (E9.3)
  const [headcountConfirmData, setHeadcountConfirmData] = useState<{
    cardId: string;
    sourceColId: string;
    targetColId: string;
    card: KanbanCard;
    previousColumns: KanbanColumn[];
  } | null>(null);

  // Pipeline Step Customization (Fewer Steps with Same Effect)
  const [pipelineMode, setPipelineMode] = useState<PipelineStepMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rf_pipeline_step_mode') as PipelineStepMode;
      if (saved && (saved === 'standard' || saved === 'streamlined' || saved === 'fast_track')) {
        return saved;
      }
    }
    return 'streamlined';
  });
  const pipelineModeRef = useRef<PipelineStepMode>(pipelineMode);
  pipelineModeRef.current = pipelineMode;
  const [isCustomizeStepsOpen, setIsCustomizeStepsOpen] = useState(false);

  // Mutable Kanban board state with live drag-and-drop
  const [boardColumns, setBoardColumns] = useState<KanbanColumn[]>(() => {
    const initialMode =
      typeof window !== 'undefined'
        ? ((localStorage.getItem('rf_pipeline_step_mode') as PipelineStepMode) || 'streamlined')
        : 'streamlined';
    const defs = getActiveColumnDefs(initialMode);
    return defs.map((col) => ({
      id: col.id,
      name: col.name,
      stageKey: col.stageKey,
      count: 0,
      subtext: '0 candidates',
      cards: [],
    }));
  });
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; sourceColId: string } | null>(null);
  const [activeDropColId, setActiveDropColId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' | 'info' } | null>(null);

  // Card Status Signals State (Phase A3: Ready / In Progress / Blocked)
  const [cardSignals, setCardSignals] = useState<Record<string, CardStatusSignal>>(() => {
    const map: Record<string, CardStatusSignal> = {};
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('rf_signal_')) {
            const appId = k.replace('rf_signal_', '');
            const val = localStorage.getItem(k) as CardStatusSignal;
            if (val) map[appId] = val;
          }
        }
      } catch {
        // ignore
      }
    }
    return map;
  });

  const setCardSignalValue = useCallback((cardId: string, next: CardStatusSignal) => {
    setCardSignals((prev) => {
      try {
        localStorage.setItem(`rf_signal_${cardId}`, next);
      } catch {
        // ignore
      }
      return { ...prev, [cardId]: next };
    });
  }, []);

  // Folded Terminal Stages State (Phase A3: Folded Joined / Hired Column)
  // Ensure that if URL has stage filter e.g. Joined, that column is NOT folded!
  const [foldedColumns, setFoldedColumns] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    const currentUrlStage = normalizeStageParam(searchParams.get('stage'));
    ALL_PIPELINE_COLUMN_DEFS.forEach((col) => {
      if (col.defaultFolded && col.id !== currentUrlStage) {
        defaults[col.id] = true;
      }
    });
    return defaults;
  });

  // Whenever a stage filter is activated, make sure its column is unfolded
  useEffect(() => {
    if (selectedStageFilter !== 'ALL') {
      setFoldedColumns((prev) => {
        if (prev[selectedStageFilter]) {
          return { ...prev, [selectedStageFilter]: false };
        }
        return prev;
      });
    }
  }, [selectedStageFilter]);

  // Sync state when URL query params change externally
  useEffect(() => {
    const urlStage = normalizeStageParam(searchParams.get('stage'));
    setSelectedStageFilter(urlStage);
  }, [searchParams]);

  const handleStageFilterChange = useCallback(
    (newStageId: string) => {
      setSelectedStageFilter(newStageId);
      setListPage(1);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newStageId === 'ALL') {
            next.delete('stage');
          } else {
            const col = ALL_PIPELINE_COLUMN_DEFS.find((c) => c.id === newStageId);
            next.set('stage', col ? col.stageKey : newStageId);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleVacancyChange = useCallback(
    (newVacancyId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newVacancyId === 'ALL') {
          next.delete('vacancyId');
        } else {
          next.set('vacancyId', newVacancyId);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const toggleColumnFold = useCallback((colId: string) => {
    setFoldedColumns((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  }, []);

  // Vacancy persistence (Phase A1)
  useEffect(() => {
    if (vacancyId) {
      try {
        localStorage.setItem('rf_last_vacancy_id', vacancyId);
      } catch {
        // ignore
      }
    }
  }, [vacancyId]);

  // List view state
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('ALL');
  const [listPage, setListPage] = useState(1);

  // Bulk actions state
  const [isBulkStageModalOpen, setIsBulkStageModalOpen] = useState(false);
  const [bulkTargetStage, setBulkTargetStage] = useState<ApplicationStage>('Screening');
  const [isBulkStageMoving, setIsBulkStageMoving] = useState(false);

  const showToast = useCallback((message: string, tone: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  const handleBulkStageConfirm = async () => {
    if (selectedListIds.length === 0 || !bulkTargetStage) return;
    setIsBulkStageMoving(true);
    let successCount = 0;
    for (const appId of selectedListIds) {
      const app = apiApplications.find((a) => a.id === appId);
      if (!app) continue;
      try {
        await patchApi(`/applications/${appId}/stage`, {
          stage: bulkTargetStage,
          expectedStage: app.stage,
          expectedVersion: app.version ?? 1,
          reason: `Bulk stage transition to ${bulkTargetStage}`,
        });
        successCount++;
      } catch {
        // Continue next
      }
    }
    setIsBulkStageMoving(false);
    setIsBulkStageModalOpen(false);
    setSelectedListIds([]);
    showToast(`✓ Successfully moved ${successCount} candidates to ${bulkTargetStage}`, 'success');
    void loadApplications();
  };

  const handleExportSelected = () => {
    const selectedApps = apiApplications.filter((a) => selectedListIds.includes(a.id));
    if (selectedApps.length === 0) return;
    const rows = selectedApps.map((a) => ({
      ID: a.applicationCode || a.id,
      Candidate: a.candidate ? `${a.candidate.firstName} ${a.candidate.lastName}` : 'Candidate',
      Email: a.candidate?.email || '',
      Phone: a.candidate?.phone || '',
      Position: a.positionTitle || '',
      Stage: a.stage,
      Applied: a.appliedAt || a.createdAt,
    }));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Candidate,Email,Phone,Position,Stage,Applied']
        .concat(
          rows.map((r) =>
            `"${r.ID}","${r.Candidate}","${r.Email}","${r.Phone}","${r.Position}","${r.Stage}","${r.Applied}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `applications_selected_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`✓ Exported ${selectedApps.length} applications to CSV`, 'success');
  };

  const buildColumnsFromApplications = useCallback(
    (
      apps: Application[],
      mode?: PipelineStepMode,
      explicitVacancy?: VacancyDetailView | null,
      explicitMap?: Map<string, Vacancy>,
    ): KanbanColumn[] => {
      const activeDefs = getActiveColumnDefs(mode || pipelineModeRef.current);
      const vacMap = explicitMap || vacancyMapRef.current;
      const curVac = explicitVacancy !== undefined ? explicitVacancy : currentVacancyRef.current;
      return activeDefs.map((col) => {
        const matchedApps = apps.filter((a) => {
          const cardStage = (a.stage || 'Applied') as ApplicationStage;
          if (col.matchedStages && col.matchedStages.length > 0) {
            return col.matchedStages.includes(cardStage);
          }
          if (col.stageKey === 'Joined') return cardStage === 'Joined';
          if (col.stageKey === 'Applied') return cardStage === 'Applied';
          return cardStage === col.stageKey;
        });

        const cards = matchedApps.map((a) => {
          const targetVacancy = (a.vacancyId ? vacMap.get(a.vacancyId) : null) || curVac;
          return mapApplicationToKanbanCard(a, col.stageKey, col.id, targetVacancy);
        });
        return {
          id: col.id,
          name: col.name,
          stageKey: col.stageKey,
          count: cards.length,
          subtext: `${cards.length} candidate${cards.length === 1 ? '' : 's'}`,
          cards,
        };
      });
    },
    [],
  );

  const handlePipelineModeChange = (newMode: PipelineStepMode) => {
    setPipelineMode(newMode);
    pipelineModeRef.current = newMode;
    try {
      localStorage.setItem('rf_pipeline_step_mode', newMode);
    } catch {
      // Browser storage can be disabled; the selected mode remains in memory.
    }
    setBoardColumns(buildColumnsFromApplications(apiApplications, newMode));
    const label =
      newMode === 'streamlined'
        ? 'Streamlined (4 Steps)'
        : newMode === 'fast_track'
        ? 'Fast-Track (3 Steps)'
        : 'Standard (6 Stages)';
    showToast(`✓ Switched pipeline view to ${label}`, 'info');
  };

  const loadApplications = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      if (vacancyId) {
        let resolvedVacancyId = vacancyId;
        let matchedVacancy: Vacancy | null = null;

        // Check if vacancyId is not a UUID (e.g. VAC-SGH-CSR-LEAD code or slug)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vacancyId);
        if (!isUuid) {
          let list = allVacanciesRef.current;
          if (!list.length) {
            try {
              const res = await getApi<Vacancy[]>('/vacancies');
              if (Array.isArray(res)) {
                list = res;
                setAllVacancies(res);
                allVacanciesRef.current = res;
              }
            } catch {
              // ignore
            }
          }
          const found = list.find(
            (v) =>
              v.vacancyCode?.toLowerCase() === vacancyId.toLowerCase() ||
              v.id.toLowerCase() === vacancyId.toLowerCase()
          );
          if (found) {
            resolvedVacancyId = found.id;
            matchedVacancy = found;
          }
        }

        const [res, vacRes] = await Promise.allSettled([
          fetchAllApplicationPages({ vacancyId: resolvedVacancyId }),
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedVacancyId)
            ? getApi<VacancyDetailView>(`/vacancies/${resolvedVacancyId}`)
            : Promise.reject(new Error('Invalid vacancy identifier')),
        ]);

        const list = res.status === 'fulfilled' && res.value?.data ? res.value.data : [];
        const total = res.status === 'fulfilled' ? res.value.total : list.length;
        let targetVac: VacancyDetailView | null = null;

        if (vacRes.status === 'fulfilled' && vacRes.value) {
          targetVac = vacRes.value;
        } else if (matchedVacancy) {
          targetVac = {
            id: matchedVacancy.id,
            vacancyCode: matchedVacancy.vacancyCode,
            title: matchedVacancy.title,
            status: matchedVacancy.status,
            approvedHeadcount: matchedVacancy.approvedHeadcount,
            joinedHeadcount: matchedVacancy.joinedHeadcount,
            department: matchedVacancy.department,
            createdAt: matchedVacancy.createdAt,
            updatedAt: matchedVacancy.updatedAt,
          } as VacancyDetailView;
        }

        setCurrentVacancy(targetVac);
        currentVacancyRef.current = targetVac;
        setApiApplications(list);
        setApplicationsTotal(total);
        setBoardColumns(buildColumnsFromApplications(list, pipelineModeRef.current, targetVac));
      } else {
        setCurrentVacancy(null);
        currentVacancyRef.current = null;
        const res = await fetchAllApplicationPages();
        const list = res?.data || [];
        setApiApplications(list);
        setApplicationsTotal(res.total ?? list.length);
        setBoardColumns(buildColumnsFromApplications(list, pipelineModeRef.current, null));
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  }, [vacancyId, buildColumnsFromApplications]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    void getApi<Vacancy[]>('/vacancies')
      .then((res) => {
        if (Array.isArray(res)) {
          setAllVacancies(res);
          allVacanciesRef.current = res;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (apiApplications.length > 0) {
      setBoardColumns(buildColumnsFromApplications(apiApplications));
    }
  }, [allVacancies, buildColumnsFromApplications]);

  const handleClaimApplication = async (cardId: string) => {
    if (!user?.id) {
      showToast('Please log in to claim this application', 'warning');
      return;
    }
    setClaimingId(cardId);
    try {
      await patchApi(`/applications/${cardId}`, { primaryRecruiterId: user.id });
      const currentUserName = user.displayName || user.email || 'Current Recruiter';
      showToast('You are now the assigned recruiter.', 'success');
      setBoardColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) =>
            c.id === cardId
              ? {
                  ...c,
                  owner: {
                    name: currentUserName,
                    initials: getInitials(currentUserName),
                    color: 'bg-blue-600',
                  },
                  rawApplication: {
                    ...c.rawApplication,
                    primaryRecruiterId: user.id,
                    primaryRecruiterName: currentUserName,
                  },
                }
              : c
          ),
        }))
      );
      setApiApplications((prev) =>
        prev.map((a) =>
          a.id === cardId
            ? {
                ...a,
                primaryRecruiterId: user.id,
                primaryRecruiterName: currentUserName,
              }
            : a
        )
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to assign application', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const handleNextAction = (applicationId: string, kind: NextActionKind) => {
    if (kind === 'assign') {
      void handleClaimApplication(applicationId);
      return;
    }
    if (kind === 'offer') {
      navigate(`/offers/create?applicationId=${applicationId}`);
      return;
    }
    navigate(`/applications/${applicationId}`);
  };

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>();
    apiApplications.forEach((a) => {
      const name = a.primaryRecruiterName || a.taskOwnerName;
      if (name) owners.add(name);
    });
    return Array.from(owners).sort();
  }, [apiApplications]);

  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    apiApplications.forEach((a) => {
      const s = a.source || a.candidate?.source;
      if (s) sources.add(s);
    });
    return Array.from(sources).sort();
  }, [apiApplications]);

  const resetFilters = useCallback(() => {
    setSelectedJob('ALL');
    setSelectedStageFilter('ALL');
    setSelectedOwnerFilter('ALL');
    setSelectedSourceFilter('ALL');
    setSearchQuery('');
    setListPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('stage');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // Filtered applications for list view
  const filteredApplications = useMemo(() => {
    return apiApplications.filter((app) => {
      const candidateName = app.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`.toLowerCase()
        : '';
      const code = (app.applicationCode || app.id).toLowerCase();
      const title = (app.positionTitle || '').toLowerCase();
      const owner = (app.primaryRecruiterName || app.taskOwnerName || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      if (q && !candidateName.includes(q) && !code.includes(q) && !title.includes(q) && !owner.includes(q)) {
        return false;
      }

      if (!currentVacancy && selectedJob !== 'ALL' && app.positionTitle !== selectedJob) {
        return false;
      }

      if (selectedStageFilter !== 'ALL') {
        const col = ALL_PIPELINE_COLUMN_DEFS.find((c) => c.id === selectedStageFilter);
        if (col?.matchedStages && col.matchedStages.length > 0) {
          const appStage = (app.stage || 'Applied') as ApplicationStage;
          if (!col.matchedStages.includes(appStage)) {
            return false;
          }
        } else {
          const targetKey = col ? col.stageKey : selectedStageFilter;
          if (app.stage?.toLowerCase() !== targetKey.toLowerCase()) {
            return false;
          }
        }
      }

      if (selectedOwnerFilter !== 'ALL') {
        const appOwner = app.primaryRecruiterName || app.taskOwnerName;
        if (appOwner !== selectedOwnerFilter) {
          return false;
        }
      }

      if (selectedSourceFilter !== 'ALL') {
        const appSource = app.source || app.candidate?.source;
        if (appSource !== selectedSourceFilter) {
          return false;
        }
      }

      return true;
    });
  }, [apiApplications, searchQuery, selectedJob, selectedStageFilter, selectedOwnerFilter, selectedSourceFilter]);

  // List rows derived from filtered applications
  const listRows = useMemo<ListRowCandidate[]>(() => {
    return filteredApplications.map((app) => {
      const candidateName = app.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
        : app.candidateId
        ? `Candidate ${app.candidateId.slice(0, 8)}`
        : 'Candidate';
      const initials = getInitials(candidateName);
      const appCode =
        app.applicationCode || (app.id.startsWith('APP-') ? app.id : `APP-${app.id.slice(0, 8).toUpperCase()}`);
      const ownerName = app.primaryRecruiterName || app.taskOwnerName || 'Unassigned';
      const ownerAvatar = getInitials(ownerName);
      const appliedAgo =
        app.appliedAt || app.createdAt
          ? `Applied ${formatRelativeTime(app.appliedAt || app.createdAt)}`
          : 'Applied recently';
      const currentStage = app.stage || 'Applied';
      const location = app.candidate?.location || '—';
      const source = app.source || app.candidate?.source || '—';
      const positionTitle = app.positionTitle || 'No position specified';

      const unassigned = !app.primaryRecruiterId || ownerName === 'Unassigned';
      const nextPlan = getNextActionPlan(currentStage, unassigned);

      const targetVacancy = (app.vacancyId ? vacancyMap.get(app.vacancyId) : null) || currentVacancy;
      const fitBreakdown = calculateCandidateFitScore(
        {
          skills: app.candidate?.skills,
          experienceYears: app.candidate?.experienceYears,
          location: app.candidate?.location,
          certifications: app.candidate?.certifications,
          currentTitle: app.candidate?.currentTitle,
          summary: app.candidate?.summary || (app.candidate?.metadata as Record<string, unknown> | undefined)?.summary as string | undefined,
          workHistory: (app.candidate?.metadata as Record<string, unknown> | undefined)?.workHistory as Parameters<typeof calculateCandidateFitScore>[0]['workHistory'],
          educationHistory: (app.candidate?.metadata as Record<string, unknown> | undefined)?.educationHistory as Parameters<typeof calculateCandidateFitScore>[0]['educationHistory'],
          projectHistory: (app.candidate?.metadata as Record<string, unknown> | undefined)?.projectHistory as Parameters<typeof calculateCandidateFitScore>[0]['projectHistory'],
          evidenceChunks: (app.candidate?.metadata as Record<string, unknown> | undefined)?.evidenceChunks as Parameters<typeof calculateCandidateFitScore>[0]['evidenceChunks'],
          responsibilities: (app.candidate?.metadata as Record<string, unknown> | undefined)?.responsibilities as Parameters<typeof calculateCandidateFitScore>[0]['responsibilities'],
        },
        {
          requiredSkills: targetVacancy?.requiredSkills,
          minExperienceYears: targetVacancy?.minExperienceYears,
          location: targetVacancy?.location,
          qualifications: targetVacancy?.qualifications,
        },
      );

      return {
        id: app.id,
        applicationCode: appCode,
        name: candidateName,
        initials,
        avatarUrl: (app.candidate as { avatarUrl?: string } | undefined)?.avatarUrl || undefined,
        appliedAgo,
        positionTitle,
        department: '—',
        location,
        currentStage,
        stageColor: getStageBadgeColor(currentStage),
        ownerName,
        ownerAvatar,
        sla: 'Not measured',
        slaSub: 'No SLA data',
        slaTone: 'amber',
        lastActivity: app.lastActivityLabel || 'Application updated',
        lastActivityTime: app.lastActivityAt ? formatRelativeTime(app.lastActivityAt) : 'Recently',
        source,
        fitScore: fitBreakdown.score,
        fitBreakdown,
        nextAction: nextPlan.label,
        nextActionTime: nextPlan.hint,
        nextActionIcon: nextPlan.icon,
        rawApplication: app,
      };
    });
  }, [filteredApplications, vacancyMap, currentVacancy]);

  const pageSize = 10;
  const paginatedList = useMemo(() => {
    return listRows.slice((listPage - 1) * pageSize, listPage * pageSize);
  }, [listRows, listPage]);

  const handleExportCsv = () => {
    const headers = ['ID', 'Candidate Name', 'Job Position', 'Stage', 'Owner', 'Location', 'Source', 'Applied'];
    const rows = listRows.map((r) => [
      r.applicationCode,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.positionTitle.replace(/"/g, '""')}"`,
      `"${r.currentStage}"`,
      `"${r.ownerName.replace(/"/g, '""')}"`,
      `"${r.location.replace(/"/g, '""')}"`,
      `"${r.source.replace(/"/g, '""')}"`,
      `"${r.appliedAgo}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `applications-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Applications exported to CSV successfully!', 'success');
  };

  // Filtered Kanban columns
  const columns = useMemo(() => {
    return boardColumns.map((col) => {
      let cards = col.cards;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        cards = cards.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.applicationCode.toLowerCase().includes(q) ||
            c.owner.name.toLowerCase().includes(q) ||
            c.nextAction.toLowerCase().includes(q)
        );
      }
      if (!currentVacancy && selectedJob !== 'ALL') {
        cards = cards.filter((c) => c.rawApplication.positionTitle === selectedJob);
      }
      if (selectedStageFilter !== 'ALL') {
        const activeDefs = getActiveColumnDefs(pipelineMode);
        const activeColDef = activeDefs.find((c) => c.id === col.id);
        const filterDef = ALL_PIPELINE_COLUMN_DEFS.find((c) => c.id === selectedStageFilter);
        const matchesCol =
          col.id === selectedStageFilter ||
          col.stageKey.toLowerCase() === selectedStageFilter.toLowerCase() ||
          Boolean(activeColDef?.matchedStages?.some((st) => st.toLowerCase() === selectedStageFilter.toLowerCase())) ||
          Boolean(filterDef?.matchedStages?.some((st) => st.toLowerCase() === col.stageKey.toLowerCase()));
        if (!matchesCol) {
          cards = [];
        }
      }
      if (selectedOwnerFilter !== 'ALL') {
        cards = cards.filter((c) => {
          const o = c.rawApplication.primaryRecruiterName || c.rawApplication.taskOwnerName;
          return o === selectedOwnerFilter;
        });
      }
      if (selectedSourceFilter !== 'ALL') {
        cards = cards.filter((c) => {
          const s = c.rawApplication.source || c.rawApplication.candidate?.source;
          return s === selectedSourceFilter;
        });
      }
      return {
        ...col,
        cards,
        count: cards.length,
      };
    });
  }, [boardColumns, searchQuery, selectedJob, selectedStageFilter, selectedOwnerFilter, selectedSourceFilter, currentVacancy]);

  // Drag & Drop Handlers with Optimistic Locking
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceColId: string) => {
    setDraggedCard({ cardId, sourceColId });
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId, sourceColId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColId !== colId) {
      setActiveDropColId(colId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, colId: string) => {
    if (activeDropColId === colId) {
      setActiveDropColId(null);
    }
  };

  const executeStageMove = async (
    cardId: string,
    targetColId: string,
    sourceColId: string,
    card: KanbanCard,
    previousColumns: KanbanColumn[],
    customReason?: string
  ) => {
    const targetCol = boardColumns.find((c) => c.id === targetColId);
    if (!targetCol) return;
    const targetStage = targetCol.stageKey;

    const updatedCard: KanbanCard = {
      ...card,
      stage: targetStage,
    };

    // Optimistic UI move
    setBoardColumns((prev) => {
      return prev.map((col) => {
        if (col.id === sourceColId) {
          const newCards = col.cards.filter((c) => c.id !== cardId);
          return {
            ...col,
            count: newCards.length,
            subtext: `${newCards.length} candidate${newCards.length === 1 ? '' : 's'}`,
            cards: newCards,
          };
        }
        if (col.id === targetColId) {
          const newCards = [updatedCard, ...col.cards.filter((c) => c.id !== cardId)];
          return {
            ...col,
            count: newCards.length,
            subtext: `${newCards.length} candidate${newCards.length === 1 ? '' : 's'}`,
            cards: newCards,
          };
        }
        return col;
      });
    });

    try {
      // Check card version field; use it (fallback: GET /applications/:id first)
      let expectedVersion = card.version;
      let expectedStage = card.stage || sourceColId;

      if (typeof expectedVersion !== 'number' || !expectedStage) {
        try {
          const currentApp = await getApi<Application>(`/applications/${cardId}`);
          if (currentApp) {
            expectedVersion = currentApp.version;
            expectedStage = currentApp.stage;
          }
        } catch {
          // fallback
        }
      }

      const payload: UpdateApplicationStageInput = {
        stage: targetStage,
        expectedStage: (expectedStage as ApplicationStage) || 'Applied',
        expectedVersion: typeof expectedVersion === 'number' ? expectedVersion : 1,
        reason: customReason || `Moved to ${targetCol.name} via Kanban`,
      };

      const updated = await patchApi<Application>(`/applications/${cardId}/stage`, payload);
      const newVersion = updated?.version ?? (typeof expectedVersion === 'number' ? expectedVersion + 1 : 2);

      // Update card version in state
      setBoardColumns((prev) => {
        return prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => (c.id === cardId ? { ...c, version: newVersion, stage: targetStage } : c)),
        }));
      });

      // Synchronized Headcount increment & auto-closure handshake (E9.3)
      if (targetStage === 'Joined' && currentVacancy) {
        setCurrentVacancy((prev) => {
          if (!prev) return prev;
          const newJoined = (prev.joinedHeadcount ?? 0) + 1;
          const isClosed = newJoined >= (prev.approvedHeadcount ?? 1);
          return {
            ...prev,
            joinedHeadcount: newJoined,
            status: isClosed ? 'Filled' : prev.status,
          };
        });
      }

      showToast(`Moved ${card.name} to ${targetCol.name}`, 'success');
    } catch (err: unknown) {
      const isConflict =
        (err instanceof ApiError && (err.statusCode === 409 || err.code === 'CONFLICT')) ||
        (Boolean(err) &&
          typeof err === 'object' &&
          ((err as { statusCode?: number }).statusCode === 409 ||
            (err as { status?: number }).status === 409 ||
            (err as { code?: string }).code === 'CONFLICT'));

      if (isConflict) {
        showToast('This application was updated by someone else. Reloading pipeline...', 'warning');
        void loadApplications();
      } else {
        // Revert on other errors + error toast
        setBoardColumns(previousColumns);
        const errorMsg =
          err instanceof ApiError && err.message
            ? err.message
            : err instanceof Error && err.message
            ? err.message
            : 'Failed to update stage. Reverting move.';
        showToast(errorMsg, 'error');
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setActiveDropColId(null);

    if (!draggedCard || draggedCard.sourceColId === targetColId) {
      setDraggedCard(null);
      return;
    }

    const { cardId, sourceColId } = draggedCard;
    setDraggedCard(null);

    const sourceCol = boardColumns.find((c) => c.id === sourceColId);
    const targetCol = boardColumns.find((c) => c.id === targetColId);
    if (!sourceCol || !targetCol) return;

    const card = sourceCol.cards.find((c) => c.id === cardId);
    if (!card) return;

    const previousColumns = boardColumns;
    const targetStage = targetCol.stageKey;

    // E9.4: Rejection & Refusal Reason Modal
    if (targetStage === 'Rejected') {
      setRejectionModalData({
        cardId,
        cardName: card.name,
        sourceColId,
        targetColId,
        card,
        previousColumns,
      });
      return;
    }

    // E9.3: Headcount limit and auto-closure check
    if (targetStage === 'Joined' && currentVacancy) {
      const joined = currentVacancy.joinedHeadcount ?? 0;
      const approved = currentVacancy.approvedHeadcount ?? 1;
      if (joined >= approved) {
        showToast(
          `Requisition headcount is already full (${joined}/${approved}). Cannot mark additional candidate as Joined.`,
          'error'
        );
        return;
      }
      if (joined + 1 === approved) {
        setHeadcountConfirmData({
          cardId,
          sourceColId,
          targetColId,
          card,
          previousColumns,
        });
        return;
      }
    }

    await executeStageMove(cardId, targetColId, sourceColId, card, previousColumns);
  };

  const toggleSelectAllList = () => {
    if (selectedListIds.length === paginatedList.length && paginatedList.length > 0) {
      setSelectedListIds([]);
    } else {
      setSelectedListIds(paginatedList.map((r) => r.id));
    }
  };

  const pipelineMetrics = useMemo(() => {
    const total = applicationsTotal || apiApplications.length;
    const inReview = apiApplications.filter((a) => a.stage === 'Screening' || a.stage === 'Interview').length;
    const inOffer = apiApplications.filter((a) => a.stage === 'Offer' || a.stage === 'Pre-Hire').length;
    const readySignals = Object.values(cardSignals).filter((s) => s === 'ready').length;
    return { total, inReview, inOffer, readySignals };
  }, [apiApplications, applicationsTotal, cardSignals]);

  return (
    <div className="flex w-full flex-col lg:h-[calc(100vh-80px)] p-3 sm:px-4 lg:px-5 py-3 mx-auto gap-3 max-w-[1880px] lg:overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="rf-page-title">
              Applications
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs">
              {applicationsTotal || apiApplications.length} Candidates
            </span>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Pipeline, search, and next actions for every candidate.
          </p>
        </div>

        <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-10 items-center justify-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddCandidateOpen(true)}
            className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-500/25 cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => handleStageFilterChange('ALL')}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            selectedStageFilter === 'ALL'
              ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          All
          <span className="text-slate-900 dark:text-white">{pipelineMetrics.total}</span>
        </button>
        <button
          type="button"
          onClick={() => handleStageFilterChange(selectedStageFilter === 'screening' ? 'ALL' : 'screening')}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            selectedStageFilter === 'screening' || selectedStageFilter === 'interview'
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          In review
          <span className="text-slate-900 dark:text-white">{pipelineMetrics.inReview}</span>
        </button>
        <button
          type="button"
          onClick={() => handleStageFilterChange(selectedStageFilter === 'offer' ? 'ALL' : 'offer')}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            selectedStageFilter === 'offer' || selectedStageFilter === 'pre_hire'
              ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Offer
          <span className="text-slate-900 dark:text-white">{pipelineMetrics.inOffer}</span>
        </button>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Ready
          <span className="text-slate-900 dark:text-white">{pipelineMetrics.readySignals}</span>
        </span>
      </div>

      {/* Position Context Banner (E6.1) */}
      {currentVacancy && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-blue-600 text-white shadow-2xs">
                <Icon name="lock" size={10} />
                Position Pipeline
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {currentVacancy.vacancyCode}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {currentVacancy.status}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
              {currentVacancy.position?.title || currentVacancy.title || 'Job Position'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {(currentVacancy as unknown as { department?: string })?.department || currentVacancy.branch?.name || 'Department'} &bull;{' '}
              Headcount:{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {currentVacancy.joinedHeadcount ?? 0}
              </span>{' '}
              joined /{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {currentVacancy.approvedHeadcount || 1}
              </span>{' '}
              approved &bull;{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {apiApplications.length} active candidates
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Quick Switcher inside banner */}
            <div className="relative">
              <select aria-label="Requisition"
                value={currentVacancy.id}
                onChange={(e) => handleVacancyChange(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 pr-7 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                title="Switch to another requisition pipeline"
              >
                <option value={currentVacancy.id}>
                  📍 {currentVacancy.position?.title || currentVacancy.title} (Current)
                </option>
                <option value="ALL">🌐 Switch to: All Positions</option>
                {allVacancies
                  .filter((v) => v.id !== currentVacancy.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      Switch to: {v.vacancyCode} — {v.position?.title || v.title} ({v.joinedHeadcount ?? 0}/{v.approvedHeadcount ?? 1})
                    </option>
                  ))}
              </select>
              <Icon
                name="chevron-down"
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
            <button
              type="button"
              onClick={() => navigate(`/candidates/compare?vacancyId=${currentVacancy.id}`)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Compare all candidates in this position pipeline"
            >
              <Icon name="grid-squares" size={12} />
              <span>Compare</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/vacancies/${currentVacancy.id}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-xs cursor-pointer"
            >
              <Icon name="arrow-left" size={13} />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => handleVacancyChange('ALL')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="View all applications across all vacancies"
            >
              <span>All Positions</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {!currentVacancy && (
          <div className="relative">
            <select
              aria-label="Requisition"
              value={vacancyId || 'ALL'}
              onChange={(e) => handleVacancyChange(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All requisitions</option>
              {allVacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vacancyCode} — {v.position?.title || v.title || 'Requisition'}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setListPage(1);
            }}
            placeholder="Search name, code, or role"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear search">
              <Icon name="close" size={12} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
            isMoreFiltersOpen || selectedStageFilter !== 'ALL' || selectedOwnerFilter !== 'ALL' || selectedSourceFilter !== 'ALL'
              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          <Icon name="filter" size={12} />
          Filters
          {(selectedStageFilter !== 'ALL' ? 1 : 0) + (selectedOwnerFilter !== 'ALL' ? 1 : 0) + (selectedSourceFilter !== 'ALL' ? 1 : 0) > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {(selectedStageFilter !== 'ALL' ? 1 : 0) + (selectedOwnerFilter !== 'ALL' ? 1 : 0) + (selectedSourceFilter !== 'ALL' ? 1 : 0)}
            </span>
          )}
        </button>

        {(selectedJob !== 'ALL' ||
          selectedStageFilter !== 'ALL' ||
          selectedOwnerFilter !== 'ALL' ||
          selectedSourceFilter !== 'ALL' ||
          searchQuery.trim() !== '') && (
          <button type="button" onClick={resetFilters} className="text-xs font-semibold text-slate-500 hover:text-rose-600">
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${viewMode === 'list' ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${viewMode === 'board' ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
          >
            Board
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCustomizeStepsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            title="Pipeline columns"
          >
            <span>
              {pipelineMode === 'streamlined' ? '4 steps' : pipelineMode === 'fast_track' ? '3 steps' : '6 steps'}
            </span>
            <Icon name="chevron-down" size={11} className="text-slate-400" />
          </button>

          {/* Customization Dropdown Popover */}
          {isCustomizeStepsOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 space-y-3"
              role="dialog"
              aria-label="Customize Pipeline Steps"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Pipeline columns</span>
                <button
                  type="button"
                  onClick={() => setIsCustomizeStepsOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="px-1 text-[11px] font-semibold text-slate-400">Choose how many columns to show</span>

                {/* 1. Streamlined (4 Steps) */}
                <button
                  type="button"
                  onClick={() => {
                    handlePipelineModeChange('streamlined');
                    setIsCustomizeStepsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-start gap-2.5 ${
                    pipelineMode === 'streamlined'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">
                    4
                  </div>
                  <div>
                    <strong className="block font-bold">Streamlined (4 Steps)</strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-snug">
                      Review & Screen &rarr; Interview &rarr; Offer & Clearance &rarr; Hired
                    </span>
                    <span className="inline-block text-[9.5px] font-black uppercase text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      Zero Scroll &bull; Fits Standard Displays
                    </span>
                  </div>
                </button>

                {/* 2. Fast-Track (3 Steps) */}
                <button
                  type="button"
                  onClick={() => {
                    handlePipelineModeChange('fast_track');
                    setIsCustomizeStepsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-start gap-2.5 ${
                    pipelineMode === 'fast_track'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">
                    3
                  </div>
                  <div>
                    <strong className="block font-bold">Fast-Track (3 Steps)</strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-snug">
                      Intake &rarr; Interview & Decision &rarr; Offer & Placed
                    </span>
                    <span className="inline-block text-[9.5px] font-black uppercase text-blue-600 dark:text-sky-400 mt-1 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                      Express Clinical Hiring
                    </span>
                  </div>
                </button>

                {/* 3. Standard (6 Stages) */}
                <button
                  type="button"
                  onClick={() => {
                    handlePipelineModeChange('standard');
                    setIsCustomizeStepsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-start gap-2.5 ${
                    pipelineMode === 'standard'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-black">
                    6
                  </div>
                  <div>
                    <strong className="block font-bold">Standard (6 Stages)</strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-snug">
                      New &bull; Screening &bull; Interview &bull; Offer &bull; Pre-Hire &bull; Hired
                    </span>
                    <span className="inline-block text-[9.5px] text-slate-400 mt-1">
                      Full multi-stage clinical pipeline
                    </span>
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Drag/drop works identically</span>
                <button
                  type="button"
                  onClick={() => {
                    setFoldedColumns({});
                    showToast('Unfolded all columns', 'info');
                  }}
                  className="text-blue-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                >
                  Unfold All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Secondary Filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <label className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Stage</span>
            <select
              aria-label="Application stage"
              value={selectedStageFilter}
              onChange={(e) => handleStageFilterChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="ALL">All stages</option>
              {getActiveColumnDefs(pipelineMode).map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Owner</span>
            <select
              aria-label="Application owner"
              value={selectedOwnerFilter}
              onChange={(e) => {
                setSelectedOwnerFilter(e.target.value);
                setListPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="ALL">Anyone</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-500">Source</span>
            {['ALL', ...sourceOptions].map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => {
                  setSelectedSourceFilter(src);
                  setListPage(1);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  selectedSourceFilter === src
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {src === 'ALL' ? 'All' : src}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border animate-fade-in ${
            toast.tone === 'warning'
              ? 'bg-amber-950/90 text-amber-200 border-amber-800'
              : toast.tone === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.tone === 'warning' && <Icon name="alert-triangle" size={14} className="text-amber-400" />}
          {toast.tone === 'error' && <Icon name="alert-circle" size={14} className="text-rose-400" />}
          {toast.tone === 'success' && <Icon name="check" size={14} className="text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading ? (
        <PageState
          kind="loading"
          title="Loading applications..."
          description="Fetching candidates across recruitment stages."
        />
      ) : loadError ? (
        <PageState
          kind="error"
          title="Failed to load applications"
          description={loadError}
          actionLabel="Retry"
          onAction={() => void loadApplications()}
        />
      ) : viewMode === 'list' ? (
        /* ─────────────────── View Mode: List View ─────────────────── */
        <div className="flex flex-col gap-3">
          {/* Empty state banner for list view */}
          {filteredApplications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center px-6">
              <span className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shadow-xs">
                <Icon name="inbox" size={28} className="text-blue-400" />
              </span>
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  {apiApplications.length === 0 ? 'No applications yet' : 'No matching applications'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {apiApplications.length === 0
                    ? 'There are no candidate applications in this recruitment pipeline.'
                    : 'No candidate applications matched your active search or filter criteria.'}
                </p>
              </div>
              {(selectedStageFilter !== 'ALL' || searchQuery || selectedOwnerFilter !== 'ALL' || selectedSourceFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Icon name="close" size={12} />
                  <span>Reset filters</span>
                </button>
              )}
              {apiApplications.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddCandidateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#0084ce] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Icon name="plus" size={12} />
                  <span>Add First Application</span>
                </button>
              )}
            </div>
          )}

          {filteredApplications.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-semibold text-[11px] bg-slate-50/50 dark:bg-slate-800/20">
                  <th className="py-3 px-4 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedListIds.length > 0 && selectedListIds.length === paginatedList.length}
                      onChange={toggleSelectAllList}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 text-left">Candidate</th>
                  <th className="py-3 px-3 text-left">Position</th>
                  <th className="py-3 px-3 text-left">Stage</th>
                  <th className="py-3 px-3 text-left">Owner</th>
                  <th className="py-3 px-3 text-left">Fit</th>
                  <th className="py-3 px-3 text-left">Next action</th>
                  <th className="py-3 pr-4 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedList.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/applications/${row.id}`)}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer ${
                      selectedListIds.includes(row.id) ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedListIds.includes(row.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedListIds((prev) => [...prev, row.id]);
                          } else {
                            setSelectedListIds((prev) => prev.filter((id) => id !== row.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Candidate */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        {row.avatarUrl ? (
                          <img
                            src={row.avatarUrl}
                            alt={row.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center shrink-0">
                            {row.initials}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block hover:text-blue-600 transition">
                            {row.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {row.applicationCode} &bull; {row.appliedAgo}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-slate-900 dark:text-white block">{row.positionTitle}</span>
                      <span className="text-[10px] text-slate-400">{row.location}</span>
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          row.stageColor === 'green'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : row.stageColor === 'purple'
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : row.stageColor === 'orange'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : row.stageColor === 'emerald'
                            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {row.currentStage}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-3">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{row.ownerName}</span>
                    </td>

                    {/* Fit Score */}
                    <td className="py-3.5 px-3">
                      <CandidateFitScorecard
                        breakdown={row.fitBreakdown}
                        candidate={row.rawApplication.candidate}
                        variant="badge"
                      />
                    </td>

                    {/* Next Action */}
                    <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={row.nextAction === 'Assign to me' && claimingId === row.id}
                        onClick={() => {
                          const unassigned = !row.rawApplication.primaryRecruiterId || row.ownerName === 'Unassigned';
                          const plan = getNextActionPlan(row.currentStage, unassigned);
                          handleNextAction(row.id, plan.kind);
                        }}
                        className="inline-flex min-h-7 items-center rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {row.nextAction === 'Assign to me' && claimingId === row.id ? 'Assigning…' : row.nextAction}
                      </button>
                    </td>

                    <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuickNoteApp({
                              id: row.id,
                              candidateName: row.name,
                              appCode: row.applicationCode,
                            })
                          }
                          className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          title="Quick note"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/applications/${row.id}`)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          title="View application details"
                        >
                          <Icon name="more-horizontal" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* List Footer */}
          <div className="p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            <span>
              Showing {(listPage - 1) * pageSize + 1} to {Math.min(listPage * pageSize, listRows.length)} of{' '}
              {listRows.length} applications
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  disabled={listPage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: Math.min(5, Math.ceil(listRows.length / pageSize) || 1) }, (_, i) => i + 1).map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setListPage(pageNumber)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                        listPage === pageNumber
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setListPage((p) => Math.min(Math.ceil(listRows.length / pageSize) || 1, p + 1))}
                  disabled={listPage >= Math.ceil(listRows.length / pageSize)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
          )}
        </div>
      ) : (
        /* View Mode: Kanban Board with Viewport-Fitted Columns & Independent Scrolling */
        <div className="flex-1 min-h-0 overflow-x-auto pb-1 pt-0.5 rf-scrollbar rounded-2xl">
          <div
            className={`flex gap-3.5 items-stretch h-full pb-1 ${
              pipelineMode === 'standard'
                ? 'min-w-[1760px]'
                : pipelineMode === 'streamlined'
                ? 'w-full min-w-[1060px] xl:min-w-0'
                : 'w-full min-w-[820px] xl:min-w-0'
            }`}
          >
            {columns.map((column) => {
              const activeDefs = getActiveColumnDefs(pipelineMode);
              const colDef =
                activeDefs.find((p) => p.id === column.id) ||
                ALL_PIPELINE_COLUMN_DEFS.find((p) => p.id === column.id);
              const isFolded = Boolean(foldedColumns[column.id]);

              if (isFolded) {
                return (
                  <div
                    key={column.id}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={(e) => handleDragLeave(e, column.id)}
                    onDrop={(e) => void handleDrop(e, column.id)}
                    onClick={() => toggleColumnFold(column.id)}
                    className={`w-14 min-w-14 shrink-0 bg-slate-50/90 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-2xl border transition-all p-2.5 flex flex-col items-center justify-between cursor-pointer group select-none h-full shadow-2xs ${
                      activeDropColId === column.id
                        ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20 bg-blue-50/20'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                    title={`Click to expand ${column.name} (${column.count} candidates)`}
                  >
                    <div className="flex flex-col items-center gap-2 pt-1 w-full">
                      <span className={`w-2.5 h-2.5 rounded-full ${colDef?.accentBg || 'bg-blue-600'}`} />
                      <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center">
                        {column.count}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleColumnFold(column.id);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-md hover:bg-slate-200/50 cursor-pointer"
                        aria-label={`Expand ${column.name}`}
                        title="Expand column"
                      >
                        <Icon name="chevron-right" size={13} />
                      </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center py-6">
                      <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-black tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase">
                        {column.name}
                      </span>
                    </div>

                    <div className="pb-1 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      <Icon name="folder-kanban" size={14} />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={(e) => handleDragLeave(e, column.id)}
                  onDrop={(e) => void handleDrop(e, column.id)}
                  className={`${
                    pipelineMode === 'standard'
                      ? 'w-[296px] min-w-[296px] shrink-0'
                      : 'flex-1 min-w-[250px] max-w-full'
                  } bg-slate-50/85 dark:bg-slate-900/65 rounded-2xl border transition-all p-3 flex flex-col h-full overflow-hidden shadow-2xs ${
                    activeDropColId === column.id
                      ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20 bg-blue-50/20'
                      : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  {/* Pinned Column Header */}
                  <div className="shrink-0 space-y-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/60">
                    {/* Stage Accent Bar (Phase A3) */}
                    <div className={`h-1.5 w-full rounded-full ${colDef?.accentBar || 'bg-blue-600'}`} />

                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{column.name}</h2>
                        <span className="w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-black flex items-center justify-center shrink-0">
                          {column.count}
                        </span>
                        {colDef?.stepBadge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 hidden sm:inline-block">
                            {colDef.stepBadge}
                          </span>
                        )}
                        {colDef?.slaTooltip && (
                          <span
                            title={colDef.slaTooltip}
                            className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                          >
                            <Icon name="info" size={12} />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleColumnFold(column.id)}
                          className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md cursor-pointer transition text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Fold column (save space)"
                        >
                          <Icon name="chevron-left" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddCandidateOpen(true)}
                          className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md cursor-pointer transition"
                          title="Add candidate"
                        >
                          <Icon name="plus" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            showToast(`Stage: ${column.name} (${column.count} candidates)`, 'info');
                          }}
                          className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md cursor-pointer transition"
                          title="Column options"
                        >
                          <Icon name="more-horizontal" size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Independently Scrollable Candidate Cards Container */}
                  <div className="flex-1 overflow-y-auto rf-scrollbar min-h-0 space-y-2.5 p-0.5 pt-2 pr-1.5">
                    {column.cards.map((card) => (
                      <ApplicationKanbanCard
                        key={card.id}
                        card={{
                          id: card.id,
                          applicationCode: card.applicationCode,
                          name: card.name,
                          initials: card.initials,
                          photoUrl: card.photoUrl,
                          positionTitle: card.positionTitle,
                          source: card.source,
                          stage: card.stage,
                          nextAction: card.nextAction,
                          experienceYears: card.experienceYears,
                          matchScore: card.matchScore,
                          owner: card.owner,
                          appliedAt: card.rawApplication.appliedAt || card.rawApplication.createdAt,
                          createdAt: card.rawApplication.createdAt,
                          primaryRecruiterId: card.rawApplication.primaryRecruiterId,
                          fitSummary: mapFitSummary(card.fitBreakdown),
                        }}
                        showStage={pipelineMode !== 'standard'}
                        signal={cardSignals[card.id] || 'in_progress'}
                        claiming={claimingId === card.id}
                        onOpen={() => navigate(`/applications/${card.id}`)}
                        onAddNote={() =>
                          setQuickNoteApp({
                            id: card.id,
                            candidateName: card.name,
                            appCode: card.applicationCode,
                          })
                        }
                        onMoveStage={() => navigate(`/applications/${card.id}`)}
                        onAssignToMe={() => void handleClaimApplication(card.id)}
                        onNextAction={(kind) => handleNextAction(card.id, kind)}
                        onDragStart={(event) => handleDragStart(event, card.id, column.id)}
                        onSignalChange={(next) => setCardSignalValue(card.id, next)}
                      />
                    ))}

                    {column.cards.length === 0 && (
                      <div className="h-28 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-1 text-xs text-slate-400 font-medium">
                        <Icon name="inbox" size={16} className="text-slate-300 dark:text-slate-700" />
                        <span>Drop candidate here</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      <AddApplicationModal
        isOpen={isAddCandidateOpen}
        onClose={() => setIsAddCandidateOpen(false)}
        preselectedVacancyId={currentVacancy?.id}
        preselectedVacancyTitle={currentVacancy?.position?.title || currentVacancy?.title || undefined}
        onSuccess={() => {
          showToast('Candidate added to pipeline successfully', 'success');
          void loadApplications();
        }}
      />


      {/* Quick Note Drawer (E6.2) */}
      <Drawer
        isOpen={Boolean(quickNoteApp)}
        onClose={() => setQuickNoteApp(null)}
        title={quickNoteApp ? `Notes — ${quickNoteApp.candidateName}` : 'Candidate Notes'}
        subtitle={quickNoteApp ? `Application ${quickNoteApp.appCode}` : undefined}
        width="standard"
      >
        {quickNoteApp && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Logged against application:
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {quickNoteApp.appCode}
              </span>
            </div>
            <CommentsThread
              entityType="application"
              entityId={quickNoteApp.id}
              onPostComment={() => {
                showToast('Note added to timeline', 'success');
              }}
            />
          </div>
        )}
      </Drawer>

      {/* Refusal / Rejection Reason Taxonomy Modal (E9.4) */}
      <Modal
        isOpen={Boolean(rejectionModalData)}
        onClose={() => {
          setRejectionModalData(null);
          setCustomReasonNote('');
        }}
        title="Candidate Refusal / Rejection Reason"
        maxWidthClass="max-w-md"
      >
        {rejectionModalData && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <Icon name="alert-circle" size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-900 dark:text-red-200 block">
                  Moving {rejectionModalData.cardName} to Rejected
                </span>
                <span className="text-red-700 dark:text-red-400 text-[11px] block mt-0.5">
                  Select a structured refusal reason for audit compliance and candidate reporting.
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
                Refusal Reason Category <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto rf-scrollbar pr-1">
                {REJECTION_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition cursor-pointer ${
                      selectedReason === r
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="refusalReason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11.5px] leading-tight">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Additional Notes / Feedback (Optional)
              </label>
              <textarea
                value={customReasonNote}
                onChange={(e) => setCustomReasonNote(e.target.value)}
                rows={2}
                placeholder="Specific interview feedback, missing certification details, etc."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRejectionModalData(null);
                  setCustomReasonNote('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { cardId, targetColId, sourceColId, card, previousColumns } = rejectionModalData;
                  const finalReason = customReasonNote
                    ? `${selectedReason}: ${customReasonNote}`
                    : selectedReason;
                  void executeStageMove(cardId, targetColId, sourceColId, card, previousColumns, finalReason);
                  setRejectionModalData(null);
                  setCustomReasonNote('');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Headcount Fulfillment & Auto-Closure Confirmation Modal (E9.3) */}
      <Modal
        isOpen={Boolean(headcountConfirmData)}
        onClose={() => setHeadcountConfirmData(null)}
        title="Headcount Target Reached — Auto-Closure Handshake"
        maxWidthClass="max-w-md"
      >
        {headcountConfirmData && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
              <Icon name="check-circle" size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  Requisition Headcount Will Be Fulfilled
                </span>
                <span className="text-amber-700 dark:text-amber-400 text-[11px] block mt-0.5">
                  Marking this candidate as Joined will achieve {(currentVacancy?.joinedHeadcount ?? 0) + 1} of{' '}
                  {currentVacancy?.approvedHeadcount ?? 1} approved positions.
                </span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300">
              In accordance with recruitment policy, vacancy{' '}
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {currentVacancy?.vacancyCode}
              </span>{' '}
              will automatically transition to <span className="font-bold text-emerald-600">Closed</span> upon confirmation.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setHeadcountConfirmData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { cardId, targetColId, sourceColId, card, previousColumns } = headcountConfirmData;
                  void executeStageMove(cardId, targetColId, sourceColId, card, previousColumns);
                  setHeadcountConfirmData(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Confirm &amp; Close Requisition
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Floating Bulk Actions Bar ── */}
      {selectedListIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white backdrop-blur-md shadow-2xl border border-slate-700/80 animate-fade-in text-xs font-medium">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-5 h-5 rounded-full bg-[#0084ce] text-white font-bold flex items-center justify-center text-[11px]">
              {selectedListIds.length}
            </span>
            <span className="font-bold text-slate-200">
              Selected
            </span>
          </div>

          {/* Fast Bulk Stage Advance */}
          <button
            type="button"
            onClick={() => setIsBulkStageModalOpen(true)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-110 text-white font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="pipeline" size={13} />
            <span>Move Stage</span>
          </button>

          {/* Compare in Matrix */}
          {selectedListIds.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                const candIds = selectedListIds
                  .map((appId) => apiApplications.find((a) => a.id === appId)?.candidateId)
                  .filter(Boolean)
                  .join(',');
                if (candIds) {
                  navigate(`/candidates/compare?ids=${encodeURIComponent(candIds)}`);
                } else {
                  showToast('Unable to extract candidate profiles for comparison', 'error');
                }
              }}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-xs cursor-pointer"
              title="Compare candidates side-by-side in matrix"
            >
              <Icon name="filter" size={13} />
              <span>Compare ({selectedListIds.length})</span>
            </button>
          )}

          {/* Export Selected */}
          <button
            type="button"
            onClick={handleExportSelected}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition cursor-pointer"
            title="Download CSV of selected applications"
          >
            <Icon name="download" size={13} />
            <span>Export CSV</span>
          </button>

          {/* Clear selection */}
          <button
            type="button"
            onClick={() => setSelectedListIds([])}
            className="h-8 px-2 text-slate-400 hover:text-white transition cursor-pointer"
            title="Deselect all"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* ── Bulk Stage Transition Modal ── */}
      <Modal
        isOpen={isBulkStageModalOpen}
        onClose={() => !isBulkStageMoving && setIsBulkStageModalOpen(false)}
        title={`Bulk Stage Move (${selectedListIds.length} candidates)`}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Select the new pipeline stage for the <strong className="text-slate-900 dark:text-white">{selectedListIds.length}</strong> selected candidate applications:
          </p>

          <div className="space-y-2">
            <label className="font-bold block text-slate-700 dark:text-slate-300">Target Stage</label>
            <select aria-label="Target stage"
              value={bulkTargetStage}
              onChange={(e) => setBulkTargetStage(e.target.value as ApplicationStage)}
              disabled={isBulkStageMoving}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Applied">Applied</option>
              <option value="Screening">Screening</option>
              <option value="Interview">Interview</option>
              <option value="Offer">Offer</option>
              <option value="Pre-Hire">Pre-Hire</option>
              <option value="Joined">Joined</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-900/50 flex items-start gap-2.5">
            <Icon name="info" size={15} className="text-[#0084ce] shrink-0 mt-0.5" />
            <span className="text-[11px] text-sky-900 dark:text-sky-200">
              Each application will advance with optimistic version checking. Any application with a conflict will be preserved and refreshed.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsBulkStageModalOpen(false)}
              disabled={isBulkStageMoving}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStageConfirm()}
              disabled={isBulkStageMoving}
              className="px-4 py-1.5 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-105 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isBulkStageMoving ? 'Advancing Candidates...' : `Move to ${bulkTargetStage}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ApplicationsPage;
