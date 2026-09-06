import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { CandidateSplitDrawer } from '../components/candidate/CandidateSplitDrawer';
import { Drawer } from '../components/ui/Drawer';
import { CommentsThread } from '../components/ui/CommentsThread';
import { AddApplicationModal } from '../components/candidate/AddApplicationModal';
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
  const [searchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');
  const { user } = useAuth();

  const [currentVacancy, setCurrentVacancy] = useState<VacancyDetailView | null>(null);
  const [allVacancies, setAllVacancies] = useState<Vacancy[]>([]);
  const [quickNoteApp, setQuickNoteApp] = useState<{
    id: string;
    candidateName: string;
    appCode: string;
  } | null>(null);

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
      if (vacancyId) {
        const [res, vacRes] = await Promise.allSettled([
          getApi<PaginatedResult<Application>>(url),
          getApi<VacancyDetailView>(`/vacancies/${vacancyId}`),
        ]);
        const list = res.status === 'fulfilled' && res.value?.data ? res.value.data : [];
        setApiApplications(list);
        setBoardColumns(buildColumnsFromApplications(list));
        if (vacRes.status === 'fulfilled' && vacRes.value) {
          setCurrentVacancy(vacRes.value);
        }
      } else {
        setCurrentVacancy(null);
        const res = await getApi<PaginatedResult<Application>>(url);
        const list = res?.data || [];
        setApiApplications(list);
        setBoardColumns(buildColumnsFromApplications(list));
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
        }
      })
      .catch(() => {});
  }, []);

  const handleClaimApplication = async (cardId: string) => {
    if (!user?.id) {
      showToast('Please log in to claim this application', 'warning');
      return;
    }
    try {
      await patchApi(`/applications/${cardId}`, { primaryRecruiterId: user.id });
      const currentUserName = user.displayName || user.email || 'Current Recruiter';
      showToast('Application claimed! You are now the assigned recruiter.', 'success');
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
      showToast(err instanceof Error ? err.message : 'Failed to claim application', 'error');
    }
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

      if (!currentVacancy && selectedJob !== 'ALL' && app.positionTitle !== selectedJob) {
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
      if (!currentVacancy && selectedJob !== 'ALL') {
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
  }, [boardColumns, searchQuery, selectedJob, selectedStageFilter, selectedOwnerFilter, selectedSourceFilter, currentVacancy]);

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

      {/* Position Context Banner (E6.1) */}
      {currentVacancy && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-2xs">
                <Icon name="lock" size={10} />
                Position Pipeline
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {currentVacancy.vacancyCode}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {currentVacancy.status}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
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
              <select
                value={currentVacancy.id}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    navigate('/applications');
                  } else {
                    navigate(`/applications?vacancyId=${val}`);
                  }
                }}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Compare all candidates in this position pipeline"
            >
              <Icon name="grid-squares" size={12} />
              <span>Compare</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/vacancies/${currentVacancy.id}`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-xs cursor-pointer"
            >
              <Icon name="arrow-left" size={13} />
              <span>Back to Overview</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="View all applications across all vacancies"
            >
              <span>View All Positions</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pipeline Position Switcher Dropdown (E9.1) */}
        <div className="relative">
          <select
            value={vacancyId || 'ALL'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'ALL') {
                navigate('/applications');
              } else {
                navigate(`/applications?vacancyId=${val}`);
              }
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            title="Switch requisition pipeline"
          >
            <option value="ALL">🌐 All Positions (All Active Requisitions)</option>
            {allVacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vacancyCode} — {v.position?.title || v.title || 'Requisition'} ({v.joinedHeadcount ?? 0}/{v.approvedHeadcount ?? 1} joined)
              </option>
            ))}
            {currentVacancy && !allVacancies.some((v) => v.id === currentVacancy.id) && (
              <option value={currentVacancy.id}>
                {currentVacancy.vacancyCode} — {currentVacancy.position?.title || currentVacancy.title}
              </option>
            )}
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
                        {(!row.rawApplication.primaryRecruiterId || row.ownerName === 'Unassigned') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleClaimApplication(row.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                            title="1-Click Claim: Assign yourself as primary recruiter"
                          >
                            <Icon name="user-check" size={10} />
                            <span>Claim</span>
                          </button>
                        )}
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
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-400 font-mono">
                              <span>{card.applicationCode}</span>
                              {card.rawApplication.candidateId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/candidates/${card.rawApplication.candidateId}`);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                  title="Open Candidate 360 profile"
                                >
                                  <span>&bull; Profile</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {(!card.rawApplication.primaryRecruiterId || card.owner.name === 'Unassigned') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleClaimApplication(card.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                              title="1-Click Claim: Assign yourself as primary recruiter"
                            >
                              <Icon name="user-check" size={10} />
                              <span>Claim</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickNoteApp({
                                id: card.id,
                                candidateName: card.name,
                                appCode: card.applicationCode,
                              });
                            }}
                            className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md text-slate-400 hover:text-blue-600 cursor-pointer transition"
                            title="Quick note"
                          >
                            <Icon name="edit" size={13} />
                          </button>
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
      <AddApplicationModal
        isOpen={isAddCandidateOpen}
        onClose={() => setIsAddCandidateOpen(false)}
        preselectedVacancyId={currentVacancy?.id}
        preselectedVacancyTitle={currentVacancy?.position?.title || currentVacancy?.title || undefined}
        onSuccess={(_newApp) => {
          showToast('Candidate added to pipeline successfully', 'success');
          void loadApplications();
        }}
      />

      {/* Candidate Split Drawer */}
      {selectedDrawerApp && (
        <CandidateSplitDrawer
          application={selectedDrawerApp}
          isOpen={Boolean(selectedDrawerApp)}
          onClose={() => setSelectedDrawerApp(null)}
        />
      )}

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
    </div>
  );
}

export default ApplicationsPage;
