import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi, patchApi, ApiError } from '../api/client';
import type { Application, ApplicationStage, PaginatedResult, UpdateApplicationStageInput } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { CandidateSplitDrawer } from '../components/candidate/CandidateSplitDrawer';
import { Modal } from '../components/Modal';
import { PageState } from '../components/ui/PageState';
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
  nextAction: string;
  nextActionTime: string;
  nextActionIcon: string;
  rawApplication: Application;
}

const PIPELINE_COLUMNS: { id: string; name: string; stageKey: ApplicationStage }[] = [
  { id: 'new', name: 'New Applied', stageKey: 'Applied' },
  { id: 'screening', name: 'Screening', stageKey: 'Screening' },
  { id: 'interview', name: 'Interview', stageKey: 'Interview' },
  { id: 'offer', name: 'Offer', stageKey: 'Offer' },
  { id: 'pre_hire', name: 'Pre-Hire', stageKey: 'Pre-Hire' },
  { id: 'hired', name: 'Hired', stageKey: 'Joined' },
];

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

function mapApplicationToKanbanCard(a: Application, colStageKey: ApplicationStage, colId: string): KanbanCard {
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
      color: 'bg-teal-600',
    },
    nextAction,
    nextDue: 'Scheduled',
    nextDueTone: 'blue',
    lastActivity: 'Stage updated',
    lastActivityTime: a.updatedAt ? formatRelativeTime(a.updatedAt) : 'Recently',
    stage: a.stage || colStageKey,
    version: a.version ?? 1,
    rawApplication: a,
  };
}

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');

  const [apiApplications, setApiApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedDrawerApp, setSelectedDrawerApp] = useState<Application | null>(null);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);

  // Mutable Kanban board state with live drag-and-drop
  const [boardColumns, setBoardColumns] = useState<KanbanColumn[]>(() =>
    PIPELINE_COLUMNS.map((col) => ({
      id: col.id,
      name: col.name,
      stageKey: col.stageKey,
      count: 0,
      subtext: '0 candidates',
      cards: [],
    }))
  );
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; sourceColId: string } | null>(null);
  const [activeDropColId, setActiveDropColId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' | 'info' } | null>(null);

  // List view state
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('ALL');
  const [listPage, setListPage] = useState(1);

  const showToast = useCallback((message: string, tone: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  const buildColumnsFromApplications = useCallback((apps: Application[]): KanbanColumn[] => {
    return PIPELINE_COLUMNS.map((col) => {
      const matchedApps = apps.filter((a) => {
        if (col.stageKey === 'Joined') return a.stage === 'Joined';
        if (col.stageKey === 'Applied') return a.stage === 'Applied' || !a.stage;
        return a.stage === col.stageKey;
      });

      const cards = matchedApps.map((a) => mapApplicationToKanbanCard(a, col.stageKey, col.id));
      return {
        id: col.id,
        name: col.name,
        stageKey: col.stageKey,
        count: cards.length,
        subtext: `${cards.length} candidate${cards.length === 1 ? '' : 's'}`,
        cards,
      };
    });
  }, []);

  const loadApplications = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const url = vacancyId
      ? `/applications?vacancyId=${vacancyId}&page=1&pageSize=100`
      : '/applications?page=1&pageSize=100';

    try {
      const res = await getApi<PaginatedResult<Application>>(url);
      const list = res?.data || [];
      setApiApplications(list);
      setBoardColumns(buildColumnsFromApplications(list));
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  }, [vacancyId, buildColumnsFromApplications]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  // Derived options for filters from live data
  const jobOptions = useMemo(() => {
    const titles = new Set<string>();
    apiApplications.forEach((a) => {
      if (a.positionTitle) titles.add(a.positionTitle);
    });
    return Array.from(titles).sort();
  }, [apiApplications]);

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
  }, []);

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

      if (selectedJob !== 'ALL' && app.positionTitle !== selectedJob) {
        return false;
      }

      if (selectedStageFilter !== 'ALL') {
        const col = PIPELINE_COLUMNS.find((c) => c.id === selectedStageFilter);
        const targetKey = col ? col.stageKey : selectedStageFilter;
        if (app.stage?.toLowerCase() !== targetKey.toLowerCase()) {
          return false;
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

      let nextAction = 'Review Profile';
      if (currentStage === 'Screening') nextAction = 'Review Application';
      else if (currentStage === 'Interview') nextAction = 'Interview Evaluation';
      else if (currentStage === 'Offer') nextAction = 'Prepare Offer';
      else if (currentStage === 'Pre-Hire') nextAction = 'Onboarding';
      else if (currentStage === 'Joined') nextAction = 'Onboarded';

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
        sla: 'On track',
        slaSub: 'Standard SLA',
        slaTone: 'green',
        lastActivity: 'Stage updated',
        lastActivityTime: app.updatedAt ? formatRelativeTime(app.updatedAt) : 'Recently',
        source,
        fitScore: 80,
        nextAction,
        nextActionTime: 'Scheduled',
        nextActionIcon: 'calendar',
        rawApplication: app,
      };
    });
  }, [filteredApplications]);

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
      if (selectedJob !== 'ALL') {
        cards = cards.filter((c) => c.rawApplication.positionTitle === selectedJob);
      }
      if (
        selectedStageFilter !== 'ALL' &&
        col.id !== selectedStageFilter &&
        col.stageKey.toLowerCase() !== selectedStageFilter.toLowerCase()
      ) {
        cards = [];
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
  }, [boardColumns, searchQuery, selectedJob, selectedStageFilter, selectedOwnerFilter, selectedSourceFilter]);

  const handleCardClick = (cardId: string) => {
    navigate(`/applications/${cardId}`);
  };

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

    // Snapshot for revert on non-409 error
    const previousColumns = boardColumns;

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
          const newCards = [updatedCard, ...col.cards];
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
      let expectedStage = card.stage || sourceCol.stageKey;

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
        reason: `Moved to ${targetCol.name} via Kanban`,
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

  const getDueBadgeStyle = (tone: 'blue' | 'purple' | 'amber' | 'gray') => {
    switch (tone) {
      case 'blue':
        return 'text-blue-600 dark:text-blue-400 font-bold';
      case 'purple':
        return 'text-purple-600 dark:text-purple-400 font-bold';
      case 'amber':
        return 'text-amber-600 dark:text-amber-400 font-bold';
      case 'gray':
      default:
        return 'text-slate-400 font-medium';
    }
  };

  const toggleSelectAllList = () => {
    if (selectedListIds.length === paginatedList.length && paginatedList.length > 0) {
      setSelectedListIds([]);
    } else {
      setSelectedListIds(paginatedList.map((r) => r.id));
    }
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Applications
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Manage candidate pipeline across recruitment stages.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddCandidateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* All Positions dropdown */}
        <div className="relative">
          <select
            value={selectedJob}
            onChange={(e) => {
              setSelectedJob(e.target.value);
              setListPage(1);
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Positions</option>
            {jobOptions.map((job) => (
              <option key={job} value={job}>
                {job}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* All Stages dropdown */}
        <div className="relative">
          <select
            value={selectedStageFilter}
            onChange={(e) => {
              setSelectedStageFilter(e.target.value);
              setListPage(1);
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Stages</option>
            {PIPELINE_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* All Owners dropdown */}
        <div className="relative">
          <select
            value={selectedOwnerFilter}
            onChange={(e) => {
              setSelectedOwnerFilter(e.target.value);
              setListPage(1);
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* More filters */}
        <button
          type="button"
          onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer ${
            isMoreFiltersOpen || selectedSourceFilter !== 'ALL'
              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon name="filter" size={13} className="text-slate-400" />
          <span>{isMoreFiltersOpen ? 'Hide Filters' : 'More Filters'}</span>
        </button>

        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px]">
          <Icon
            name="search"
            size={13}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setListPage(1);
            }}
            placeholder="Search applications..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        {/* List / Board Toggle */}
        <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'list'
                ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="menu" size={13} />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'board'
                ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="layout" size={13} />
            <span>Kanban View</span>
          </button>
        </div>
      </div>

      {/* Expandable Secondary Filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-500">Source:</span>
          {['ALL', ...sourceOptions].map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setSelectedSourceFilter(src);
                setListPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                selectedSourceFilter === src
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {src === 'ALL' ? 'All Sources' : src}
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset Filters
          </button>
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
      ) : apiApplications.length === 0 ? (
        <PageState
          kind="empty"
          title="No applications yet"
          description="There are no candidate applications in this recruitment pipeline."
        />
      ) : filteredApplications.length === 0 ? (
        <PageState
          kind="empty"
          title="No matching applications"
          description="No candidate applications matched your active search or filter criteria."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : viewMode === 'list' ? (
        /* View Mode: List View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10.5px] bg-slate-50/50 dark:bg-slate-800/20">
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
                  <th className="py-3 px-3 text-left">Location</th>
                  <th className="py-3 px-3 text-left">Stage</th>
                  <th className="py-3 px-3 text-left">Owner</th>
                  <th className="py-3 px-3 text-left">SLA</th>
                  <th className="py-3 px-3 text-left">Last Activity</th>
                  <th className="py-3 px-3 text-left">Source</th>
                  <th className="py-3 px-3 text-left">Fit Score</th>
                  <th className="py-3 px-3 text-left">Next Action</th>
                  <th className="py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedList.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedDrawerApp(row.rawApplication)}
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
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-3">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{row.location}</span>
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
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                          {row.ownerAvatar}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{row.ownerName}</span>
                      </div>
                    </td>

                    {/* SLA */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="block font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {row.sla}
                        </span>
                        <span className="block text-[10px] text-slate-400">{row.slaSub}</span>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="block font-bold text-slate-800 dark:text-slate-200">{row.lastActivity}</span>
                        <span className="block text-[10.5px] text-slate-400">{row.lastActivityTime}</span>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-3">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{row.source}</span>
                    </td>

                    {/* Fit Score */}
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {row.fitScore}%
                      </span>
                    </td>

                    {/* Next Action */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="block font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          {row.nextAction}
                        </span>
                        <span className="block text-[10px] text-slate-400">{row.nextActionTime}</span>
                      </div>
                    </td>

                    <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/applications/${row.id}`)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition cursor-pointer"
                        title="View application details"
                      >
                        <Icon name="more-horizontal" size={14} />
                      </button>
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
      ) : (
        /* View Mode: Kanban Board with Live Drag-and-Drop */
        <div className="overflow-x-auto pb-4 pt-1">
          <div className="flex gap-4 items-start min-w-[1720px]">
            {columns.map((column) => (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={(e) => handleDragLeave(e, column.id)}
                onDrop={(e) => void handleDrop(e, column.id)}
                className={`w-[280px] min-w-[280px] shrink-0 bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border transition-all p-3 flex flex-col space-y-3 ${
                  activeDropColId === column.id
                    ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20 bg-blue-50/20'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <h2 className="text-xs font-extrabold text-slate-900 dark:text-white">{column.name}</h2>
                    <span className="w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-black flex items-center justify-center">
                      {column.count}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
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

                {/* Candidate Cards in Column */}
                <div className="space-y-3 min-h-[400px]">
                  {column.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id, column.id)}
                      onClick={() => handleCardClick(card.id)}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition cursor-grab active:cursor-grabbing group space-y-3"
                    >
                      {/* Card Top: Candidate Avatar, Name, Applied date & Menu */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {card.photoUrl ? (
                            <img
                              src={card.photoUrl}
                              alt={card.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
                              {card.initials}
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition block leading-tight">
                              {card.name}
                            </span>
                            <span className="text-[10.5px] text-slate-400 block mt-0.5 font-mono">
                              {card.applicationCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div
                            className={`w-5 h-5 rounded-full ${card.owner.color} text-white text-[9px] font-extrabold flex items-center justify-center shadow-2xs`}
                            title={`Owner: ${card.owner.name}`}
                          >
                            {card.owner.initials}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/applications/${card.id}/transition`);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Move stage"
                          >
                            <Icon name="more-horizontal" size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Middle: Next Action & Due label */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate pr-2">
                          <span className="font-semibold text-slate-400">Next:</span>
                          <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                            {card.nextAction}
                          </span>
                        </div>
                        <span className={`shrink-0 ${getDueBadgeStyle(card.nextDueTone)}`}>{card.nextDue}</span>
                      </div>

                      {/* Bottom: Last activity */}
                      <div className="text-[10.5px] text-slate-400 flex items-center justify-between pt-0.5">
                        <span className="truncate">Last: {card.lastActivity}</span>
                        <span className="shrink-0 text-slate-400">{card.lastActivityTime}</span>
                      </div>
                    </div>
                  ))}

                  {column.cards.length === 0 && (
                    <div className="h-28 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400">
                      Drop candidate here
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      <Modal
        isOpen={isAddCandidateOpen}
        onClose={() => setIsAddCandidateOpen(false)}
        title="Add Candidate to Pipeline"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold block mb-1">Candidate Full Name</label>
            <input
              type="text"
              placeholder="e.g. Full Name"
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold block mb-1">Email Address</label>
            <input
              type="email"
              placeholder="candidate@example.com"
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsAddCandidateOpen(false)}
              className="px-3 py-1.5 text-slate-500 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsAddCandidateOpen(false)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Add to New Stage
            </button>
          </div>
        </div>
      </Modal>

      {/* Candidate Split Drawer */}
      {selectedDrawerApp && (
        <CandidateSplitDrawer
          application={selectedDrawerApp}
          isOpen={Boolean(selectedDrawerApp)}
          onClose={() => setSelectedDrawerApp(null)}
        />
      )}
    </div>
  );
}

export default ApplicationsPage;
