import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { downloadApi, getApi, postApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { isTeamLeaderOrAdmin } from '../auth/workspacePersona';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Alert } from '../components/ui';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { PageState } from '../components/ui/PageState';
import { saveBlob } from '../utils/download';
import { EditPositionRequirementsModal } from '../components/vacancy/EditPositionRequirementsModal';
import { ImportJobDescriptionModal } from '../components/vacancy/ImportJobDescriptionModal';
import {
  VacancyCard,
  VacancyCardEducation,
  VacancyCardHeadcountProgress,
  VacancyCardMeta,
  VacancyCardMetrics,
  VacancyCardSkills,
} from '../components/vacancy/VacancyCard';
import { getVacancyBlockingReasons } from '../utils/vacancyActivation';

interface JobPositionRow {
  id: string;
  title: string;
  location: string;
  branchId?: string;
  workType: string;
  department: string;
  primaryRecruiterId?: string;
  recruiter: {
    initials: string;
    name: string;
    avatarColor?: string;
  };
  applicationsCount: number;
  needActionCount: number;
  isOverdue?: boolean;
  slaPercent: number;
  slaStatus: 'on track' | 'at risk';
  lastActivity: string;
  status: 'Open' | 'Pending Activation' | 'On Hold' | 'Draft' | 'Closed';
  vacancyCode: string;
  approvedHeadcount: number;
  joinedHeadcount: number;
  positionId?: string;
  positionCode?: string;
  requiredSkills: string[];
  minExperienceYears: number | null;
  qualifications?: string | null;
  jobSummary?: string | null;
}

interface RawVacancyResponseItem {
  id: string;
  title?: string;
  vacancyCode?: string;
  approvedHeadcount?: number;
  joinedHeadcount?: number;
  positionId?: string;
  position?: { id?: string; code?: string; title?: string; department?: string; description?: string };
  positionTitle?: string;
  location?: string;
  branchId?: string;
  branch?: { id?: string; name?: string; city?: string };
  workType?: string;
  department?: string;
  primaryRecruiterId?: string;
  requiredSkills?: string[];
  minExperienceYears?: number | null;
  qualifications?: string | null;
  jobSummary?: string | null;
  recruiter?: { displayName?: string; firstName?: string; lastName?: string };
  primaryRecruiterName?: string;
  assignments?: Array<{ user?: { displayName?: string } }>;
  applicationsCount?: number;
  _count?: { applications?: number };
  needActionCount?: number;
  isOverdue?: boolean;
  slaPercent?: number;
  updatedAt?: string;
  status?: string;
}

export function VacantListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdministrator = useMemo(() => {
    return Boolean(
      user?.roles?.some((r) => ['ADMINISTRATOR', 'ADMIN'].includes(r.code) || r.name?.toLowerCase() === 'administrator'),
    );
  }, [user?.roles]);

  const canAssignInitial = useMemo(() => {
    return isAdministrator || (isTeamLeaderOrAdmin(user) && Boolean(
      user?.permissions?.some((p) => ['VACANCY_ASSIGN', 'VACANCY_MANAGE'].includes(p)),
    ));
  }, [isAdministrator, user]);

  const canReassignRecruiter = useMemo(() => {
    return isAdministrator || (isTeamLeaderOrAdmin(user) && Boolean(
      user?.permissions?.includes('VACANCY_REASSIGN'),
    ));
  }, [isAdministrator, user]);

  // Active section tab: 'catalog' (Full Positions & Requirements Directory) vs 'requisitions' (Work Queue)
  const activeSection = searchParams.get('tab') === 'requisitions' ? 'requisitions' : 'catalog';
  const setActiveSection = (tab: 'catalog' | 'requisitions') => {
    setSearchParams(tab === 'catalog' ? {} : { tab: 'requisitions' });
  };

  const [apiVacancies, setApiVacancies] = useState<JobPositionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filters for Requisitions
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'Pending Activation' | 'On Hold' | 'Closed'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Filters for Positions Catalog
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDept, setCatalogDept] = useState('ALL');
  const [catalogExpFilter, setCatalogExpFilter] = useState<'ALL' | 'junior' | 'mid' | 'senior'>('ALL');

  // Edit Position Requirements Modal
  const [editingPosition, setEditingPosition] = useState<JobPositionRow | null>(null);
  const [editingFocusSection, setEditingFocusSection] = useState<'jobSummary' | 'skills' | 'department' | 'location' | undefined>(undefined);

  const openSetupForPosition = (pos: JobPositionRow, preferredSection?: 'jobSummary' | 'skills' | 'department' | 'location') => {
    let section = preferredSection;
    if (!section) {
      const reasons = getVacancyBlockingReasons(pos);
      const firstIssue = reasons.find((r) => !r.isRecruiterAction);
      if (firstIssue) {
        if (firstIssue.key === 'jobSummary') section = 'jobSummary';
        else if (firstIssue.key === 'skills') section = 'skills';
        else if (firstIssue.key === 'department') section = 'department';
        else if (firstIssue.key === 'location') section = 'location';
      }
    }
    setEditingFocusSection(section);
    setEditingPosition(pos);
  };

  // Direct Assign Recruiter Modal on Card
  const [assigningVacancy, setAssigningVacancy] = useState<JobPositionRow | null>(null);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const applicantFileInputRef = useRef<HTMLInputElement>(null);
  const pageActionsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeActionsOnOutsideClick = (event: PointerEvent) => {
      if (!pageActionsRef.current?.contains(event.target as Node)) {
        pageActionsRef.current?.removeAttribute('open');
      }
    };
    document.addEventListener('pointerdown', closeActionsOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeActionsOnOutsideClick);
  }, []);

  // JD Ingestion & Master Data Auto-Sync Modal
  const [isJdModalOpen, setIsJdModalOpen] = useState(false);
  const [jdTargetVacancy, setJdTargetVacancy] = useState<{
    id: string;
    title: string;
    department?: string;
    location?: string;
    status?: string;
  } | null>(null);

  const openAssignModal = (pos: JobPositionRow) => {
    setAssigningVacancy(pos);
    const existingRecruiter = recruiters.find(
      (r) => r.id === pos.primaryRecruiterId || r.name.toLowerCase() === pos.recruiter.name.toLowerCase()
    );
    setSelectedRecruiterId(existingRecruiter?.id || pos.primaryRecruiterId || '');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await downloadApi('/vacancies/export.xlsx');
      saveBlob(blob, `vacancies-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      setExportError('Failed to export vacancies to Excel. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchRecruiters = async () => {
      try {
        const res = await getApi<Array<{ id: string; displayName?: string; name?: string }>>('/users/interviewers');
        if (isMounted && Array.isArray(res) && res.length > 0) {
          setRecruiters(res.map((r) => ({ id: r.id, name: r.displayName || r.name || 'Recruiter' })));
          return;
        }
      } catch {
        // Fallback to /users?role=RECRUITER
      }
      try {
        const res = await getApi<Array<{ id: string; displayName?: string; name?: string }>>('/users?role=RECRUITER');
        if (isMounted && Array.isArray(res) && res.length > 0) {
          setRecruiters(res.map((r) => ({ id: r.id, name: r.displayName || r.name || 'Recruiter' })));
        }
      } catch {
        // ignore
      }
    };
    void fetchRecruiters();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadVacancies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getApi<RawVacancyResponseItem[] | { data: RawVacancyResponseItem[] }>('/vacancies');
      const rawList = Array.isArray(res) ? res : res?.data || [];
      const statusMap: Record<string, JobPositionRow['status']> = {
        Open: 'Open',
        'Pending Activation': 'Pending Activation',
        'On Hold': 'On Hold',
        Draft: 'Draft',
        Closed: 'Closed',
      };
      const mapped: JobPositionRow[] = rawList.map((v: RawVacancyResponseItem) => {
        const recruiterName =
          v.recruiter?.displayName ||
          (v.recruiter ? `${v.recruiter.firstName || ''} ${v.recruiter.lastName || ''}`.trim() : null) ||
          v.primaryRecruiterName ||
          (v.assignments?.[0]?.user?.displayName) ||
          'Unassigned';
        const initials =
          recruiterName === 'Unassigned'
            ? '—'
            : recruiterName
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase() || 'UN';

        return {
          id: v.id,
          vacancyCode: v.vacancyCode || `VAC-${v.id.slice(0, 6).toUpperCase()}`,
          approvedHeadcount: v.approvedHeadcount ?? 1,
          joinedHeadcount: v.joinedHeadcount ?? 0,
          title: v.title || v.position?.title || v.positionTitle || 'No position',
          location: (/offshore/i.test(v.location || '') ? 'Cairo' : (v.location || v.branch?.name || 'Cairo')),
          branchId: v.branchId || v.branch?.id,
          workType: v.workType || 'Full-Time',
          department: v.department || v.position?.department || 'Clinical Services',
          primaryRecruiterId: v.primaryRecruiterId || (recruiterName !== 'Unassigned' ? 'assigned' : undefined),
          recruiter: {
            initials,
            name: recruiterName,
          },
          applicationsCount: v.applicationsCount ?? v._count?.applications ?? 0,
          needActionCount: v.needActionCount ?? 0,
          isOverdue: Boolean(v.isOverdue),
          slaPercent: typeof v.slaPercent === 'number' ? v.slaPercent : 100,
          slaStatus: (v.isOverdue ? 'at risk' : 'on track') as 'at risk' | 'on track',
          lastActivity: v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : '—',
          status: (v.status && statusMap[v.status]) ? statusMap[v.status] : 'Open',
          positionId: v.positionId || v.position?.id,
          positionCode: v.position?.code || v.vacancyCode?.replace('VAC-SGH-', '') || 'POS',
          requiredSkills: v.requiredSkills || [],
          minExperienceYears: v.minExperienceYears ?? null,
          qualifications: v.qualifications,
          jobSummary: v.jobSummary,
        };
      });
      setApiVacancies(mapped);
    } catch {
      setApiVacancies([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVacancies();
  }, [loadVacancies]);

  const handleAssignSubmit = async () => {
    if (!assigningVacancy || !selectedRecruiterId) return;
    setIsSubmittingAssign(true);
    const vacancyTitle = assigningVacancy.title;
    const selectedRecruiter = recruiters.find((r) => r.id === selectedRecruiterId);
    const recruiterName = selectedRecruiter?.name || 'Recruiter';

    try {
      const updated = await postApi<{ status?: string }>(`/vacancies/${assigningVacancy.id}/assignments`, {
        userId: selectedRecruiterId,
        roleCode: 'RECRUITER',
        assignmentKind: 'PRIMARY',
      });

      const isActivation = assigningVacancy.status === 'Pending Activation';
      const willBeOpen =
        isActivation &&
        (updated?.status === 'Open' || Boolean(assigningVacancy.jobSummary?.trim()));
      const nextStatus = willBeOpen ? 'Open' : assigningVacancy.status;

      setApiVacancies((prev) =>
        prev.map((item) =>
          item.id === assigningVacancy.id
            ? {
                ...item,
                status: nextStatus,
                primaryRecruiterId: selectedRecruiterId,
                recruiter: {
                  ...item.recruiter,
                  name: recruiterName,
                  initials:
                    recruiterName
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'RC',
                },
              }
            : item,
        ),
      );

      if (willBeOpen) {
        showToast(`Position "${vacancyTitle}" is now open and ready for candidates.`);
      } else {
        showToast(`Recruiter ${recruiterName} assigned to "${vacancyTitle}".`);
      }

      setAssigningVacancy(null);
      setSelectedRecruiterId('');
      void loadVacancies();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to assign recruiter');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const positions = apiVacancies;

  // Filter options derived dynamically from live vacancy records
  const departments = useMemo(() => {
    const set = new Set(positions.map((p) => p.department).filter((d) => d && d !== '—'));
    return ['ALL', ...Array.from(set)];
  }, [positions]);

  const locations = useMemo(() => {
    const set = new Set(positions.map((p) => p.location).filter((l) => l && l !== '—'));
    return ['ALL', ...Array.from(set)];
  }, [positions]);

  const owners = useMemo(() => {
    const set = new Set(positions.map((p) => p.recruiter.name).filter((o) => o && o !== 'Unassigned'));
    return ['ALL', ...Array.from(set)];
  }, [positions]);

  // Deduplicate positions for the Master Specification Catalog (1 pristine card per DB position)
  const uniqueCatalogPositions = useMemo(() => {
    const map = new Map<string, JobPositionRow>();
    positions.forEach((p) => {
      const key = p.positionCode || p.positionId || p.title;
      const existing = map.get(key);
      if (!existing || p.requiredSkills.length > existing.requiredSkills.length) {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [positions]);

  // Catalog filtered positions
  const filteredCatalogPositions = useMemo(() => {
    return uniqueCatalogPositions.filter((pos) => {
      const q = catalogSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        pos.title.toLowerCase().includes(q) ||
        (pos.positionCode || '').toLowerCase().includes(q) ||
        pos.location.toLowerCase().includes(q) ||
        pos.department.toLowerCase().includes(q) ||
        pos.requiredSkills.some((s) => s.toLowerCase().includes(q));

      const matchDept = catalogDept === 'ALL' || pos.department === catalogDept;

      let matchExp = true;
      const exp = pos.minExperienceYears ?? 0;
      if (catalogExpFilter === 'junior') matchExp = exp <= 3;
      else if (catalogExpFilter === 'mid') matchExp = exp >= 4 && exp <= 6;
      else if (catalogExpFilter === 'senior') matchExp = exp >= 7;

      return matchSearch && matchDept && matchExp;
    });
  }, [uniqueCatalogPositions, catalogSearch, catalogDept, catalogExpFilter]);

  // Filtered positions for Requisitions tab
  const filteredPositions = useMemo(() => {
    return positions.filter((pos) => {
      const matchSearch =
        !search ||
        pos.title.toLowerCase().includes(search.toLowerCase()) ||
        pos.location.toLowerCase().includes(search.toLowerCase()) ||
        pos.department.toLowerCase().includes(search.toLowerCase()) ||
        pos.recruiter.name.toLowerCase().includes(search.toLowerCase());

      const matchDept = selectedDept === 'ALL' || pos.department === selectedDept;
      const matchLocation = selectedLocation === 'ALL' || pos.location.includes(selectedLocation);
      const matchOwner = selectedOwner === 'ALL' || pos.recruiter.name === selectedOwner;
      const matchStatus = statusFilter === 'ALL' || pos.status === statusFilter;

      return matchSearch && matchDept && matchLocation && matchOwner && matchStatus;
    });
  }, [positions, search, selectedDept, selectedLocation, selectedOwner, statusFilter]);

  // Counts for pill tabs
  const allCount = positions.length;
  const openCount = positions.filter((p) => p.status === 'Open').length;
  const pendingActivationCount = positions.filter((p) => p.status === 'Pending Activation').length;
  const onHoldCount = positions.filter((p) => p.status === 'On Hold').length;
  const closedCount = positions.filter((p) => p.status === 'Closed').length;

  const totalCatalogSkills = useMemo(() => {
    const set = new Set<string>();
    uniqueCatalogPositions.forEach((p) => p.requiredSkills.forEach((s) => set.add(s.toLowerCase())));
    return set.size;
  }, [uniqueCatalogPositions]);

  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPositions.slice(start, start + pageSize);
  }, [filteredPositions, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPositions.length / pageSize));

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedPositions.length && paginatedPositions.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedPositions.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handlePositionRequirementsSaved = (updated: {
    requiredSkills: string[];
    minExperienceYears: number | null;
    location: string;
    department: string;
    qualifications?: string | null;
    jobSummary?: string | null;
  }) => {
    if (!editingPosition) return;
    setApiVacancies((prev) =>
      prev.map((v) =>
        v.id === editingPosition.id
          ? {
              ...v,
              requiredSkills: updated.requiredSkills,
              minExperienceYears: updated.minExperienceYears,
              location: updated.location,
              department: updated.department,
              qualifications: updated.qualifications ?? v.qualifications,
              jobSummary: updated.jobSummary ?? v.jobSummary,
            }
          : v
      )
    );
    setEditingPosition(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col space-y-6 rounded-[28px] bg-slate-50/55 p-4 sm:p-6 lg:p-7 dark:bg-slate-950/20">
      {/* ── Page Header: Title & Action Buttons ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-rf-ink tracking-tight">
            Job Positions &amp; Requirements
          </h1>
          <p className="mt-1 text-sm text-rf-ink-muted">
            Manage position requirements and recruitment requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/vacancy-requests/create')}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-rf-action px-4 text-sm font-bold text-rf-on-action transition hover:bg-rf-action-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-action"
          title="Submit a new budgeted headcount request for executive approval"
        >
          <Icon name="plus" size={16} />
          <span>New requisition</span>
        </button>
      </div>

      {exportError && (
        <Alert tone="danger" title="Export failed">
          {exportError}
        </Alert>
      )}

      {/* ── Top-Level View Switcher: Full Positions Directory vs Active Requisitions ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200/80 dark:border-slate-800">
        <nav aria-label="Position views" className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSection('catalog')}
            aria-current={activeSection === 'catalog' ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rf-action ${
              activeSection === 'catalog'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>Position directory</span>
            <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {uniqueCatalogPositions.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('requisitions')}
            aria-current={activeSection === 'requisitions' ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rf-action ${
              activeSection === 'requisitions'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>Requisitions</span>
            <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {openCount}
            </span>
          </button>
        </nav>

        <details
          ref={pageActionsRef}
          className="relative ml-auto self-center pb-1"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              pageActionsRef.current?.removeAttribute('open');
              pageActionsRef.current?.querySelector('summary')?.focus();
            }
          }}
        >
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-500 marker:hidden hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
            More actions
            <Icon name="chevron-down" size={14} />
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-rf-border bg-rf-surface p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => {
                pageActionsRef.current?.removeAttribute('open');
                setJdTargetVacancy(null);
                setIsJdModalOpen(true);
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-rf-ink hover:bg-rf-surface-hover focus-visible:outline-2 focus-visible:outline-rf-action"
            >
              <Icon name="file-text" size={16} /> Upload job description
            </button>
            <button
              type="button"
              onClick={() => {
                pageActionsRef.current?.removeAttribute('open');
                setIsImportModalOpen(true);
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-rf-ink hover:bg-rf-surface-hover focus-visible:outline-2 focus-visible:outline-rf-action"
            >
              <Icon name="upload" size={16} /> Import applicants
            </button>
            <button
              type="button"
              onClick={() => {
                pageActionsRef.current?.removeAttribute('open');
                void handleExportExcel();
              }}
              disabled={isExporting}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-rf-ink hover:bg-rf-surface-hover focus-visible:outline-2 focus-visible:outline-rf-action disabled:opacity-50"
            >
              <Icon name={isExporting ? 'refresh-cw' : 'download'} size={16} className={isExporting ? 'animate-spin' : ''} /> {isExporting ? 'Exporting...' : 'Export XLSX'}
            </button>
          </div>
        </details>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: FULL POSITIONS & REQUIREMENTS DIRECTORY (DB CATALOG)
         ───────────────────────────────────────────────────────────── */}
      {activeSection === 'catalog' && (
        <div className="space-y-5">
          <h2 className="sr-only">Positions directory</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Positions
              <span className="text-slate-900 dark:text-white">{uniqueCatalogPositions.length}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Skills in catalog
              <span className="text-slate-900 dark:text-white">{totalCatalogSkills}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Locations
              <span className="text-slate-900 dark:text-white">{locations.filter((l) => l !== 'ALL').length}</span>
            </span>
          </div>

          {/* Controls: Search, Department Chips & Exp Filter */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Icon name="search" size={15} />
              </div>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search title, code, or skill"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter positions by department"
                value={catalogDept}
                onChange={(e) => setCatalogDept(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">All Departments ({positions.length})</option>
                {departments.filter((d) => d !== 'ALL').map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              {/* Experience Filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCatalogExpFilter('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    catalogExpFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Exp
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogExpFilter('junior')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    catalogExpFilter === 'junior'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  1-3 Yrs
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogExpFilter('mid')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    catalogExpFilter === 'mid'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  4-6 Yrs
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogExpFilter('senior')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    catalogExpFilter === 'senior'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  7+ Yrs
                </button>
              </div>
            </div>
          </div>

          {/* Positions Directory Cards Grid */}
          {isLoading ? (
            <PageState kind="loading" title="Loading full positions catalog from database..." />
          ) : filteredCatalogPositions.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Icon name="search" size={24} className="mx-auto text-slate-400 mb-2" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No positions matched your filters
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing search terms or selecting a different department.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredCatalogPositions.map((pos) => (
                <VacancyCard
                  key={pos.id}
                  vacancy={pos}
                  className="min-h-[320px] hover:-translate-y-0.5"
                  footer={(
                    <div className="flex flex-col-reverse gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between">
                      <button
                        type="button"
                        onClick={() => openSetupForPosition(pos)}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
                      >
                        <Icon name="edit" size={16} />
                        Edit specs
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/sourcing-match?vacancyId=${pos.id}`)}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                      >
                        <Icon name="users" size={16} />
                        Match candidates
                        <Icon name="arrow-right" size={16} />
                      </button>
                    </div>
                  )}
                >
                  <div className="mt-4 flex flex-1 flex-col gap-4">
                    <VacancyCardMeta
                      location={pos.location}
                      experienceLabel={`${pos.minExperienceYears ?? 3}+ years experience`}
                    />
                    <VacancyCardSkills vacancy={pos} skills={pos.requiredSkills} maxVisible={4} showWhenEmpty />
                    <VacancyCardEducation qualifications={pos.qualifications} />
                  </div>
                </VacancyCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 2: ACTIVE REQUISITION VACANCIES (EXISTING WORK QUEUE)
         ───────────────────────────────────────────────────────────── */}
      {activeSection === 'requisitions' && (
        <>
          {/* Filters Row 1: Dropdowns + Search */}
          <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <select
                  aria-label="Filter requisitions by department"
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="ALL">All Departments</option>
                  {departments.filter((d) => d !== 'ALL').map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  aria-label="Filter requisitions by location"
                  value={selectedLocation}
                  onChange={(e) => {
                    setSelectedLocation(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="ALL">All Locations</option>
                  {locations.filter((l) => l !== 'ALL').map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  aria-label="Filter requisitions by owner"
                  value={selectedOwner}
                  onChange={(e) => {
                    setSelectedOwner(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="ALL">All Owners</option>
                  {owners.filter((o) => o !== 'ALL').map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
                <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer ${
                  isMoreFiltersOpen || selectedLocation !== 'ALL'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon name="filter" size={13} className="text-slate-500" />
                <span>{isMoreFiltersOpen ? 'Hide filters' : 'More filters'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  placeholder="Search positions..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-3.5 pr-9 text-xs font-medium text-slate-900 shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
                <Icon name="search" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="Cards View"
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="grid-squares" size={14} />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="list" size={14} />
                  <span className="hidden sm:inline">Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Expandable Secondary Filters */}
          {isMoreFiltersOpen && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-100/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
              <span className="font-bold text-slate-500">Location:</span>
              {locations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setSelectedLocation(loc);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    selectedLocation === loc
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  {loc === 'ALL' ? 'All Locations' : loc}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSelectedDept('ALL');
                  setSelectedLocation('ALL');
                  setSelectedOwner('ALL');
                  setSearch('');
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Reset all
              </button>
            </div>
          )}

          {/* Status Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/65 p-1.5 rf-scrollbar dark:border-slate-800 dark:bg-slate-900/65">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'ALL'
                ? 'bg-sky-600 text-white border border-sky-600 font-extrabold shadow-sm'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              All · {allCount}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('Open');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'Open'
                ? 'bg-emerald-600 text-white border border-emerald-600 font-extrabold shadow-sm'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              Open &bull; {openCount}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('Pending Activation');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'Pending Activation'
                ? 'bg-amber-500 text-white border border-amber-500 font-extrabold shadow-sm'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              Pending Activation &bull; {pendingActivationCount}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('On Hold');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'On Hold'
                ? 'bg-slate-700 text-white border border-slate-700 font-extrabold shadow-sm dark:bg-slate-600 dark:border-slate-600'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              On Hold &bull; {onHoldCount}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('Closed');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'Closed'
                ? 'bg-slate-700 text-white border border-slate-700 font-extrabold shadow-sm dark:bg-slate-600 dark:border-slate-600'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              Closed &bull; {closedCount}
            </button>
          </div>

          {/* Cards / Table View */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
            {isLoading ? (
              <div className="p-8 text-center">
                <PageState kind="loading" title="Loading job positions..." />
              </div>
            ) : filteredPositions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Icon name="briefcase" size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No positions found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adjusting your filters or search keywords.
                </p>
              </div>
            ) : (
              <>
                {viewMode === 'cards' ? (
                  <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
                    {paginatedPositions.map((pos) => {
                      const statusEdgeClass = pos.status === 'Open'
                        ? 'border-l-4 border-l-emerald-500'
                        : pos.status === 'Pending Activation'
                          ? 'border-l-4 border-l-amber-500'
                          : pos.status === 'On Hold'
                            ? 'border-l-4 border-l-slate-400'
                            : 'border-l-4 border-l-slate-300 dark:border-l-slate-600';

                      return (
                        <VacancyCard
                          key={pos.id}
                          vacancy={pos}
                          onOpen={() => navigate(`/vacancies/${pos.id}`)}
                          className={`min-h-[340px] hover:-translate-y-0.5 motion-reduce:transform-none ${statusEdgeClass}`}
                          footer={(
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/sourcing-match?vacancyId=${pos.id}`);
                                }}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40"
                              >
                                <Icon name="sparkles" size={15} />
                                Match sourcing
                              </button>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {pos.recruiter.name === 'Unassigned'
                                  ? canAssignInitial && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openAssignModal(pos);
                                        }}
                                      >
                                        Assign recruiter
                                      </Button>
                                    )
                                  : canReassignRecruiter && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openAssignModal(pos);
                                        }}
                                      >
                                        Reassign
                                      </Button>
                                    )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(`/vacancies/${pos.id}`);
                                  }}
                                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                                >
                                  View details
                                  <Icon name="arrow-right" size={15} />
                                </button>
                              </div>
                            </div>
                          )}
                        >
                          <div className="mt-4 space-y-4">
                            <VacancyCardMeta
                              location={pos.location}
                              experienceLabel={pos.minExperienceYears != null ? `${pos.minExperienceYears}+ years experience` : 'Experience not specified'}
                            />
                            <VacancyCardMetrics items={[
                              { key: 'applicants', label: 'Applicants', value: pos.applicationsCount, icon: 'users' },
                              { key: 'headcount', label: 'Headcount', value: `${pos.joinedHeadcount}/${pos.approvedHeadcount}`, icon: 'briefcase' },
                              {
                                key: 'owner',
                                label: 'Owner',
                                value: (
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                      {pos.recruiter.initials || '—'}
                                    </span>
                                    <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{pos.recruiter.name}</span>
                                  </span>
                                ),
                                icon: 'user',
                              },
                            ]} />
                            <VacancyCardHeadcountProgress filled={pos.joinedHeadcount} target={pos.approvedHeadcount} />
                            <VacancyCardSkills vacancy={pos} skills={pos.requiredSkills} maxVisible={3} />
                            {pos.qualifications && <VacancyCardEducation qualifications={pos.qualifications} />}
                          </div>

                          {pos.status === 'Pending Activation' && (() => {
                            const blockingReasons = getVacancyBlockingReasons(pos);
                            return (
                              <div
                                className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/40"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2 font-bold text-amber-900 dark:text-amber-300">
                                  <span className="flex items-center gap-1.5">
                                    <Icon name="alert-triangle" size={14} className="text-amber-600 dark:text-amber-400" />
                                    <span>Pending activation ({blockingReasons.length})</span>
                                  </span>
                                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Action needed</span>
                                </div>
                                <div className="space-y-1.5">
                                  {blockingReasons.map((reason) => (
                                    <div key={reason.key} className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
                                      <span className="min-w-0 truncate">{reason.label}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (reason.isRecruiterAction) {
                                            openAssignModal(pos);
                                          } else {
                                            openSetupForPosition(
                                              pos,
                                              reason.key === 'recruiter' ? undefined : (reason.key as 'jobSummary' | 'skills' | 'department' | 'location')
                                            );
                                          }
                                        }}
                                        className="inline-flex min-h-8 shrink-0 items-center rounded-lg px-2 text-[11px] font-bold text-blue-700 hover:bg-white/70 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-slate-900/50"
                                      >
                                        {reason.actionLabel} <span aria-hidden="true" className="ml-1">→</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/70 pt-2 dark:border-amber-900/40">
                                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Have an official job description?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setJdTargetVacancy({
                                        id: pos.id,
                                        title: pos.title,
                                        department: pos.department,
                                        location: pos.location,
                                        status: pos.status,
                                      });
                                      setIsJdModalOpen(true);
                                    }}
                                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-teal-800 hover:bg-white/70 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-teal-300 dark:hover:bg-slate-900/50"
                                  >
                                    <Icon name="file-text" size={13} />
                                    <span>Fill from JD</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                        </VacancyCard>
                      );
                    })}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-bold">
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === paginatedPositions.length && paginatedPositions.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded border-slate-300 cursor-pointer"
                            />
                          </th>
                          <th className="p-3 font-bold">Code</th>
                          <th className="p-3 font-bold">Position Title</th>
                          <th className="p-3 font-bold">Department</th>
                          <th className="p-3 font-bold">Location</th>
                          <th className="p-3 font-bold">Status</th>
                          <th className="p-3 font-bold">Applicants</th>
                          <th className="p-3 font-bold">Headcount</th>
                          <th className="p-3 font-bold">Owner</th>
                          <th className="p-3 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paginatedPositions.map((pos) => (
                          <tr
                            key={pos.id}
                            onClick={() => navigate(`/vacancies/${pos.id}`)}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(pos.id)}
                                onChange={() => toggleSelect(pos.id)}
                                className="rounded border-slate-300 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                              {pos.vacancyCode}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {pos.title}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {pos.department}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {pos.location}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  pos.status === 'Open'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : pos.status === 'Pending Activation'
                                    ? 'bg-amber-50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                    : 'bg-amber-50 text-amber-600'
                                }`}
                              >
                                {pos.status}
                              </span>
                              {pos.status === 'Pending Activation' && (() => {
                                const reasons = getVacancyBlockingReasons(pos);
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (reasons.some((r) => r.isRecruiterAction)) {
                                        openAssignModal(pos);
                                      } else {
                                        openSetupForPosition(pos);
                                      }
                                    }}
                                    className="block text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold hover:underline cursor-pointer text-left"
                                    title={reasons.map((r) => r.label).join(', ')}
                                  >
                                    {reasons.length} issue(s)
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                              {pos.applicationsCount}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {pos.joinedHeadcount}/{pos.approvedHeadcount}
                            </td>
                            <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                              {pos.recruiter.name}
                            </td>
                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {pos.status === 'Pending Activation' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openSetupForPosition(pos)}
                                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition cursor-pointer"
                                      title="Complete requirements setup"
                                    >
                                      Setup
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setJdTargetVacancy({
                                          id: pos.id,
                                          title: pos.title,
                                          department: pos.department,
                                          location: pos.location,
                                          status: pos.status,
                                        });
                                        setIsJdModalOpen(true);
                                      }}
                                      className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 font-bold text-[11px] transition cursor-pointer"
                                      title="Auto-fill requirements from JD document"
                                    >
                                      📄 JD
                                    </button>
                                  </>
                                )}
                                {pos.recruiter.name === 'Unassigned'
                                  ? canAssignInitial && (
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => openAssignModal(pos)}
                                      >
                                        Assign recruiter
                                      </Button>
                                    )
                                  : canReassignRecruiter && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => openAssignModal(pos)}
                                      >
                                        Reassign
                                      </Button>
                                    )}
                                <button
                                  type="button"
                                  onClick={() => navigate(`/sourcing-match?vacancyId=${pos.id}`)}
                                  className="px-2 py-1 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold hover:bg-teal-100 text-[11px] transition cursor-pointer"
                                >
                                  ⚡ Match
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  <div>
                    Showing {filteredPositions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, filteredPositions.length)} of {allCount} positions
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer"
                    >
                      &lsaquo;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCurrentPage(num)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${
                          currentPage === num
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer"
                    >
                      &rsaquo;
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Edit Position Requirements Modal ── */}
      {editingPosition && (
        <EditPositionRequirementsModal
          isOpen={Boolean(editingPosition)}
          onClose={() => {
            setEditingPosition(null);
            setEditingFocusSection(undefined);
          }}
          vacancyId={editingPosition.id}
          positionTitle={editingPosition.title}
          positionCode={editingPosition.positionCode || editingPosition.vacancyCode}
          initialSkills={editingPosition.requiredSkills}
          initialMinExp={editingPosition.minExperienceYears}
          initialLocation={editingPosition.location}
          initialDepartment={editingPosition.department}
          initialQualifications={editingPosition.qualifications}
          initialJobSummary={editingPosition.jobSummary}
          initialFocusSection={editingFocusSection}
          onSaved={handlePositionRequirementsSaved}
        />
      )}

      {/* ── Import Applicants Modal ── */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Applicants"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          {/* Quick link if user intended to upload a Job Description */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-teal-900 dark:text-teal-200 block text-xs">Uploading a Job Description (JD)?</span>
              <span className="text-[11px] text-teal-700 dark:text-teal-300">Extract skills &amp; sync Master Data for requisitions</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                setJdTargetVacancy(null);
                setIsJdModalOpen(true);
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition"
            >
              📄 Upload JD File &rarr;
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Upload candidate resumes (.pdf, .docx) or a CSV/XLSX file to automatically parse and link candidates to job positions.
          </p>

          <div
            onClick={() => applicantFileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-all hover:bg-blue-50/20 group"
          >
            <input
              ref={applicantFileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.csv"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setIsImportModalOpen(false);
                  navigate('/cv-intake');
                }
              }}
            />
            <Icon name="upload" size={24} className="mx-auto text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600">
              Drag &amp; drop files here or browse from computer
            </span>
            <span className="block text-[11px] text-slate-400">
              Supports bulk CV upload up to 50 files (.pdf, .docx, .xlsx)
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                navigate('/cv-intake');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
            >
              Proceed to Intake Parser
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Assign Recruiter Modal ── */}
      <Modal
        isOpen={Boolean(assigningVacancy)}
        onClose={() => {
          setAssigningVacancy(null);
          setSelectedRecruiterId('');
        }}
        title={
          assigningVacancy?.recruiter.name && assigningVacancy.recruiter.name !== 'Unassigned'
            ? 'Reassign Recruiter'
            : 'Assign Recruiter & Activate Vacancy'
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Vacancy:</span>
              <span className="font-bold text-slate-900 dark:text-white">{assigningVacancy?.title}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Department:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{assigningVacancy?.department}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Status:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">{assigningVacancy?.status}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Current Recruiter:</span>
              <span className="font-bold text-slate-900 dark:text-white">{assigningVacancy?.recruiter.name}</span>
            </div>
          </div>

          {/* Reassignment Status Notice */}
          {(() => {
            const isReassign = Boolean(
              assigningVacancy?.recruiter.name && assigningVacancy.recruiter.name !== 'Unassigned'
            );
            const selectedRecruiter = recruiters.find((r) => r.id === selectedRecruiterId);
            if (isReassign && selectedRecruiter && selectedRecruiter.name !== assigningVacancy?.recruiter.name) {
              return (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                  <span className="text-base leading-none">🔄</span>
                  <div>
                    <span className="font-bold block">Reassigning Position</span>
                    <span className="text-[11px] block mt-0.5">
                      Responsibility for <b>{assigningVacancy?.title}</b> will transfer from{' '}
                      <b>{assigningVacancy?.recruiter.name}</b> to <b>{selectedRecruiter.name}</b>.
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Recruiter
            </label>
            {recruiters.length === 0 ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <Icon name="alert-circle" size={16} className="text-rose-500 shrink-0" />
                <span>No recruiters available. Please ensure recruiter accounts are configured in Master Data / User Roles.</span>
              </div>
            ) : (
              <Select
                aria-label="Select recruiter"
                value={selectedRecruiterId}
                onChange={(e) => setSelectedRecruiterId(e.target.value)}
                disabled={isSubmittingAssign}
              >
                <option value="">Select recruiter...</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => {
                setAssigningVacancy(null);
                setSelectedRecruiterId('');
              }}
              disabled={isSubmittingAssign}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignSubmit}
              disabled={!selectedRecruiterId || recruiters.length === 0 || isSubmittingAssign}
              loading={isSubmittingAssign}
              loadingLabel="Assigning..."
            >
              {assigningVacancy?.recruiter.name && assigningVacancy.recruiter.name !== 'Unassigned'
                ? 'Reassign Position'
                : 'Assign & Open'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Import Job Description & Auto-Sync Modal ── */}
      <ImportJobDescriptionModal
        isOpen={isJdModalOpen}
        onClose={() => {
          setIsJdModalOpen(false);
          setJdTargetVacancy(null);
        }}
        targetVacancy={jdTargetVacancy}
        availableVacancies={positions.map((p) => ({
          id: p.id,
          title: p.title,
          department: p.department,
          location: p.location,
          status: p.status,
        }))}
        onSuccess={(result) => {
          if (result.vacancyRequestId) {
            showToast('Job Description imported into a draft requisition');
            navigate(`/vacancy-requests/${result.vacancyRequestId}`);
            return;
          }
          showToast('Job Description ingested and Master Data synchronized successfully');
          void loadVacancies();
        }}
      />

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default VacantListPage;
