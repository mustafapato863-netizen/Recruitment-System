import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { PageState } from '../components/ui/PageState';

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
}

interface RawVacancyResponseItem {
  id: string;
  title?: string;
  vacancyCode?: string;
  approvedHeadcount?: number;
  joinedHeadcount?: number;
  position?: { title?: string; department?: string };
  positionTitle?: string;
  location?: string;
  branch?: { name?: string };
  workType?: string;
  department?: string;
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
  const [apiVacancies, setApiVacancies] = useState<JobPositionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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
            location: v.location || v.branch?.name || '—',
            workType: v.workType || '—',
            department: v.department || v.position?.department || v.branch?.name || '—',
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

  // Filtered positions
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

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-5">
      {/* ── Page Header: Title & Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Job Positions
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Manage all job positions, track hiring needs, and monitor progress.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
          >
            <Icon name="plus" size={14} />
            <span>Create Job Position</span>
          </button>
        </div>
      </div>

      {/* ── Filters Row 1: Dropdowns + Search ── */}
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

      {/* ── Expandable Secondary Filters ── */}
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

      {/* ── Filters Row 2: Status Pill Tabs ── */}
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
          On hold &bull; {onHoldCount}
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

      {/* ── Main Data Table or Empty State ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <PageState kind="loading" title="Loading job positions..." description="Fetching current requisitions." />
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="p-8">
            <PageState
              kind="empty"
              title={
                search || selectedDept !== 'ALL' || selectedLocation !== 'ALL' || selectedOwner !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No matching job positions'
                  : 'No job positions found'
              }
              description={
                search || selectedDept !== 'ALL' || selectedLocation !== 'ALL' || selectedOwner !== 'ALL' || statusFilter !== 'ALL'
                  ? 'Try adjusting your filters or search query.'
                  : 'No job requisitions are currently registered in your organization.'
              }
              actionLabel={
                search || selectedDept !== 'ALL' || selectedLocation !== 'ALL' || selectedOwner !== 'ALL' || statusFilter !== 'ALL'
                  ? 'Reset filters'
                  : 'Create Job Position'
              }
              onAction={
                search || selectedDept !== 'ALL' || selectedLocation !== 'ALL' || selectedOwner !== 'ALL' || statusFilter !== 'ALL'
                  ? () => {
                      setSearch('');
                      setSelectedDept('ALL');
                      setSelectedLocation('ALL');
                      setSelectedOwner('ALL');
                      setStatusFilter('ALL');
                    }
                  : () => navigate('/vacancy-requests/create')
              }
            />
          </div>
        ) : viewMode === 'cards' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 bg-slate-50/40 dark:bg-slate-950/20">
              {paginatedPositions.map((row) => (
                <div
                  key={row.id}
                  className="group relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    {/* Top meta: Code + Status Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {row.vacancyCode}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          row.status === 'Open'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                            : row.status === 'On Hold'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>

                    {/* Position Title */}
                    <h3
                      onClick={() => navigate(`/vacancies/${row.id}`)}
                      className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition cursor-pointer line-clamp-1"
                      title={row.title}
                    >
                      {row.title}
                    </h3>

                    {/* Department & Location */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{row.department}</span>
                      <span>&bull;</span>
                      <span>{row.location}</span>
                      {row.workType && row.workType !== '—' && (
                        <>
                          <span>&bull;</span>
                          <span className="capitalize">{row.workType}</span>
                        </>
                      )}
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-100 dark:border-slate-800/80 mb-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl px-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Headcount</div>
                        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                          {row.joinedHeadcount} / {row.approvedHeadcount} <span className="text-[11px] font-normal text-slate-400">filled</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Performance</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                            {row.slaPercent}%
                          </div>
                          <span className={`w-2 h-2 rounded-full ${row.isOverdue ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        </div>
                      </div>
                    </div>

                    {/* Recruiter / Owner */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center border border-blue-200 dark:border-blue-900">
                          {row.recruiter.initials}
                        </span>
                        <span className="font-medium truncate max-w-[140px] text-slate-700 dark:text-slate-300">
                          {row.recruiter.name}
                        </span>
                      </div>
                      {row.needActionCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                          {row.needActionCount} action{row.needActionCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/applications?vacancyId=${row.id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer border border-blue-200/60 dark:border-blue-800/60"
                    >
                      <Icon name="users" size={13} />
                      <span>{row.applicationsCount} Applications ↗</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/vacancies/${row.id}`)}
                      title="View Requisition Overview"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    >
                      <Icon name="chevron-right" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="overflow-x-auto rf-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedPositions.length && paginatedPositions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 font-bold">Job Position</th>
                    <th className="py-3 px-4 font-bold">Department</th>
                    <th className="py-3 px-4 font-bold">Recruiter / Owner</th>
                    <th className="py-3 px-4 font-bold">Applications</th>
                    <th className="py-3 px-4 font-bold">Need Action</th>
                    <th className="py-3 px-4 font-bold">SLA</th>
                    <th className="py-3 px-4 font-bold">Last Activity</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 w-10 text-right">
                      <Icon name="settings" size={14} className="text-slate-400 inline" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {paginatedPositions.map((row) => {
                    const isSelected = selectedIds.includes(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer ${
                          isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => navigate(`/vacancies/${row.id}`)}
                      >
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Job Position Title & Location */}
                        <td className="py-3.5 px-4 min-w-[220px]">
                          <span className="block font-bold text-slate-900 dark:text-white hover:text-blue-600 transition">
                            {row.title}
                          </span>
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {row.location} {row.workType !== '—' && `• ${row.workType}`}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                          {row.department}
                        </td>

                        {/* Recruiter / Owner */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                              {row.recruiter.initials}
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {row.recruiter.name}
                            </span>
                          </div>
                        </td>

                        {/* Applications */}
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                          {row.applicationsCount}
                        </td>

                        {/* Need Action */}
                        <td className="py-3.5 px-4">
                          {row.needActionCount > 0 ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-block border ${
                                row.isOverdue
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                              }`}
                            >
                              {row.isOverdue ? `${row.needActionCount} overdue` : `${row.needActionCount} need action`}
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>

                        {/* SLA */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold ${
                              row.slaStatus === 'on track'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {row.slaPercent}% {row.slaStatus}
                          </span>
                        </td>

                        {/* Last Activity */}
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                          {row.lastActivity}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-block border ${
                              row.status === 'Open'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : row.status === 'On Hold'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>

                        {/* Actions Menu */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/vacancies/${row.id}`)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="View position details & pipeline"
                          >
                            <Icon name="more-horizontal" size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Table Footer: Pagination ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <div>
                Showing {filteredPositions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredPositions.length)} of {allCount} positions
              </div>

              <div className="flex items-center gap-3">
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
            </div>
          </>
        )}
      </div>

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
