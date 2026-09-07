import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { downloadApi, getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Alert } from '../components/ui';
import { PageState } from '../components/ui/PageState';
import { QuickGuideTrigger } from '../quickguide';
import { saveBlob } from '../utils/download';
import { EditPositionRequirementsModal } from '../components/vacancy/EditPositionRequirementsModal';

interface JobPositionRow {
  id: string;
  title: string;
  location: string;
  workType: string;
  department: string;
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
  status: 'Open' | 'On Hold' | 'Draft' | 'Closed';
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
  branch?: { name?: string; city?: string };
  workType?: string;
  department?: string;
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'On Hold' | 'Closed'>('ALL');
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
    setIsLoading(true);
    getApi<RawVacancyResponseItem[] | { data: RawVacancyResponseItem[] }>('/vacancies')
      .then((res) => {
        const rawList = Array.isArray(res) ? res : res?.data || [];
        const statusMap: Record<string, JobPositionRow['status']> = {
          Open: 'Open',
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
            location: v.location || v.branch?.name || 'SGH Riyadh Hospital',
            workType: v.workType || 'Full-Time',
            department: v.department || v.position?.department || 'Clinical Services',
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
      })
      .catch(() => {
        setApiVacancies([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

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
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-5">
      {/* ── Page Header: Title & Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Job Positions &amp; Requirements
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Clinical position specifications, structured skills benchmarks, and active hospital recruitment requisitions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer disabled:opacity-50"
            aria-label="Export vacancies to Excel"
            title="Export vacancies as XLSX workbook"
          >
            <Icon name={isExporting ? 'refresh-cw' : 'download'} size={14} className={`text-emerald-600 dark:text-emerald-400 ${isExporting ? 'animate-spin' : ''}`} />
            <span>{isExporting ? 'Exporting...' : 'Export XLSX'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="upload" size={14} className="text-slate-500" />
            <span>Import applicants</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/vacancy-requests/create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Submit a new budgeted headcount request for executive approval"
          >
            <Icon name="plus" size={14} />
            <span>New Vacancy Requisition</span>
          </button>
        </div>
      </div>

      {exportError && (
        <Alert tone="danger" title="Export failed">
          {exportError}
        </Alert>
      )}

      {/* ── Top-Level View Switcher: Full Positions Directory vs Active Requisitions ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSection('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeSection === 'catalog'
              ? 'bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <Icon name="briefcase" size={14} />
          <span>Full Positions &amp; Requirements Directory</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeSection === 'catalog' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            {uniqueCatalogPositions.length} Active in DB
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('requisitions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeSection === 'requisitions'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <Icon name="file-text" size={14} />
          <span>Requisition Vacancies (Work Queue)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeSection === 'requisitions' ? 'bg-white/20 dark:bg-black/20 text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            {openCount} Open
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: FULL POSITIONS & REQUIREMENTS DIRECTORY (DB CATALOG)
         ───────────────────────────────────────────────────────────── */}
      {activeSection === 'catalog' && (
        <div className="space-y-5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Total DB Positions
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {uniqueCatalogPositions.length}
                </span>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                  Configured
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Clinical &amp; Tech Skills
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-teal-600 dark:text-teal-400">
                  {totalCatalogSkills}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Catalogued
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Hospital Facilities
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
                  {locations.filter((l) => l !== 'ALL').length || 4}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  KSA / UAE
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/80 dark:from-teal-950/40 dark:via-slate-900 dark:to-emerald-950/40 border border-teal-500/30 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 to-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 block mb-1">
                Matching Ready
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-300">
                  100%
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Specs Active
                </span>
              </div>
            </div>
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
                placeholder="Search by position title, code, skills, or location..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-2">
              <select
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
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
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
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No positions matched your filters
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing search terms or selecting a different department.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCatalogPositions.map((pos) => (
                <div
                  key={pos.id}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 transition-all duration-200 shadow-xs hover:shadow-lg overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#0084ce] before:via-[#00a3e0] before:to-[#00a859] before:opacity-0 group-hover:before:opacity-100 before:transition-opacity"
                >
                  <div className="space-y-3">
                    {/* Top: Code badge, Title, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {pos.positionCode || 'POS'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60">
                            {pos.department}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                          {pos.title}
                        </h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                        {pos.status}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 text-[11px]">
                        ⏱️ {pos.minExperienceYears ?? 3}+ Yrs Min Exp
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 text-[11px]">
                        📍 {pos.location}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pos.vacancyCode}
                      </span>
                    </div>

                    {/* Required Skills Chips */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Required Clinical &amp; Technical Skills ({pos.requiredSkills.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {pos.requiredSkills.slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 dark:bg-slate-800 text-sky-900 dark:text-sky-200 border border-sky-200/80 dark:border-slate-700 shadow-2xs"
                          >
                            {skill}
                          </span>
                        ))}
                        {pos.requiredSkills.length > 6 && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 self-center px-1">
                            +{pos.requiredSkills.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Qualifications / Licensure preview */}
                    {pos.qualifications && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic pt-1.5 border-t border-slate-100 dark:border-slate-800/70">
                        🛡️ {pos.qualifications}
                      </p>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setEditingPosition(pos)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                      title="Edit position skills, experience, location, and qualifications"
                    >
                      <Icon name="edit" size={12} />
                      <span>Edit Specs</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/sourcing-match?vacancyId=${pos.id}`)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-110 text-white shadow-sm hover:shadow-md transition cursor-pointer"
                      title="Match and rank all candidates in the bench against this position"
                    >
                      <Icon name="sparkles" size={13} />
                      <span>⚡ Instant Match</span>
                    </button>
                  </div>
                </div>
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
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <select
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
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
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
                  className="w-full h-9 pl-3.5 pr-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
                <Icon name="search" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="Cards View"
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
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
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
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
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
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
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
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
          <div className="flex items-center gap-2 pt-1 overflow-x-auto rf-scrollbar">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-extrabold'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 font-medium'
              }`}
            >
              All positions &bull; {allCount}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('Open');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'Open'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-extrabold'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 font-medium'
              }`}
            >
              Open &bull; {openCount}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('On Hold');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
                statusFilter === 'On Hold'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-extrabold'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 font-medium'
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
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-extrabold'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 font-medium'
              }`}
            >
              Closed &bull; {closedCount}
            </button>
          </div>

          {/* Cards / Table View */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                    {paginatedPositions.map((pos) => (
                      <div
                        key={pos.id}
                        onClick={() => navigate(`/vacancies/${pos.id}`)}
                        className="group flex flex-col justify-between p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-900"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {pos.vacancyCode}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                pos.status === 'Open'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : pos.status === 'On Hold'
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {pos.status}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                              {pos.title}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {pos.department} &bull; {pos.location}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Applicants</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{pos.applicationsCount}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Headcount</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{pos.joinedHeadcount}/{pos.approvedHeadcount}</span>
                            </div>
                            <div className="ml-auto text-right">
                              <span className="text-[10px] text-slate-400 block font-semibold">Owner</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{pos.recruiter.name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sourcing-match?vacancyId=${pos.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold hover:underline"
                          >
                            <Icon name="sparkles" size={12} />
                            <span>⚡ Match Sourcing</span>
                          </button>
                          <span className="text-slate-400 text-[11px] group-hover:text-blue-600">
                            View details &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
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
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  pos.status === 'Open'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-amber-50 text-amber-600'
                                }`}
                              >
                                {pos.status}
                              </span>
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
                              <button
                                type="button"
                                onClick={() => navigate(`/sourcing-match?vacancyId=${pos.id}`)}
                                className="px-2 py-1 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold hover:bg-teal-100 text-[11px] transition"
                              >
                                ⚡ Match
                              </button>
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
          onClose={() => setEditingPosition(null)}
          vacancyId={editingPosition.id}
          positionTitle={editingPosition.title}
          positionCode={editingPosition.positionCode || editingPosition.vacancyCode}
          initialSkills={editingPosition.requiredSkills}
          initialMinExp={editingPosition.minExperienceYears}
          initialLocation={editingPosition.location}
          initialDepartment={editingPosition.department}
          initialQualifications={editingPosition.qualifications}
          initialJobSummary={editingPosition.jobSummary}
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
          <p className="text-xs text-slate-500">
            Upload candidate resumes (.pdf, .docx) or a CSV/XLSX file to automatically parse and link candidates to job positions.
          </p>

          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
            <Icon name="upload" size={24} className="mx-auto text-slate-400" />
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Drag &amp; drop files here or browse
            </span>
            <span className="block text-[11px] text-slate-400">
              Supports bulk CV upload up to 50 files
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
    </div>
  );
}

export default VacantListPage;
