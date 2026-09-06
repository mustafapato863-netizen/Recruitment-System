import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { PageState } from '../components/ui/PageState';
import { QuickGuideTrigger } from '../quickguide';

interface CommandCenterPosition {
  id: string;
  title: string;
  vacancyCode: string;
  department: string;
  location: string;
  workType: string;
  status: 'Open' | 'On Hold' | 'Draft' | 'Closed';
  approvedHeadcount: number;
  joinedHeadcount: number;
  applicationsCount: number;
  needActionCount: number;
  slaPercent: number;
  isOverdue: boolean;
  recruiter: {
    name: string;
    initials: string;
  };
  primaryRecruiterId?: string;
  updatedAt?: string;
}

interface RawVacancyResponse {
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
  recruiter?: { displayName?: string; firstName?: string; lastName?: string; id?: string };
  primaryRecruiterId?: string;
  primaryRecruiterName?: string;
  assignments?: Array<{ user?: { displayName?: string; id?: string } }>;
  applicationsCount?: number;
  _count?: { applications?: number };
  needActionCount?: number;
  isOverdue?: boolean;
  slaPercent?: number;
  updatedAt?: string;
  status?: string;
}

interface InboxItem {
  id: string;
}

export function RecruitmentCommandCenter({ onToggleAnalytics }: { onToggleAnalytics?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [positions, setPositions] = useState<CommandCenterPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'On Hold' | 'Closed'>('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [onlyMyPositions, setOnlyMyPositions] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Pending inbox counters
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const canApprove = useMemo(() => {
    return Boolean(
      user?.permissions?.some((p) =>
        ['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'VACANCY_MANAGE'].includes(p)
      )
    );
  }, [user?.permissions]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.allSettled([
      getApi<RawVacancyResponse[] | { data: RawVacancyResponse[] }>('/vacancies'),
      canApprove ? getApi<InboxItem[]>('/vacancy-requests/inbox') : Promise.resolve([]),
      canApprove ? getApi<InboxItem[]>('/offers/approvals/inbox') : Promise.resolve([]),
      canApprove ? getApi<InboxItem[]>('/hiring/final-approvals') : Promise.resolve([]),
    ]).then(([vacRes, vrRes, offRes, hireRes]) => {
      if (!isMounted) return;

      if (vacRes.status === 'fulfilled') {
        const rawList = Array.isArray(vacRes.value) ? vacRes.value : vacRes.value?.data || [];
        const statusMap: Record<string, CommandCenterPosition['status']> = {
          Open: 'Open',
          'On Hold': 'On Hold',
          Draft: 'Draft',
          Closed: 'Closed',
        };

        const mapped: CommandCenterPosition[] = rawList.map((v) => {
          const recruiterName =
            v.recruiter?.displayName ||
            (v.recruiter ? `${v.recruiter.firstName || ''} ${v.recruiter.lastName || ''}`.trim() : null) ||
            v.primaryRecruiterName ||
            v.assignments?.[0]?.user?.displayName ||
            'Unassigned';

          const recruiterInitials =
            recruiterName === 'Unassigned'
              ? '—'
              : recruiterName
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || 'UN';

          return {
            id: v.id,
            vacancyCode: v.vacancyCode || `VAC-${v.id.slice(0, 6).toUpperCase()}`,
            title: v.title || v.position?.title || v.positionTitle || 'Requisition',
            department: v.department || v.position?.department || v.branch?.name || 'General',
            location: v.location || v.branch?.name || 'Riyadh Hospital',
            workType: v.workType || 'Full-time',
            status: (v.status && statusMap[v.status]) ? statusMap[v.status] : 'Open',
            approvedHeadcount: v.approvedHeadcount ?? 1,
            joinedHeadcount: v.joinedHeadcount ?? 0,
            applicationsCount: v.applicationsCount ?? v._count?.applications ?? 0,
            needActionCount: v.needActionCount ?? 0,
            isOverdue: Boolean(v.isOverdue),
            slaPercent: typeof v.slaPercent === 'number' ? v.slaPercent : 100,
            recruiter: {
              name: recruiterName,
              initials: recruiterInitials,
            },
            primaryRecruiterId: v.primaryRecruiterId || v.recruiter?.id || v.assignments?.[0]?.user?.id,
            updatedAt: v.updatedAt,
          };
        });

        setPositions(mapped);
      }

      let totalApprovals = 0;
      if (vrRes.status === 'fulfilled' && Array.isArray(vrRes.value)) totalApprovals += vrRes.value.length;
      if (offRes.status === 'fulfilled' && Array.isArray(offRes.value)) totalApprovals += offRes.value.length;
      if (hireRes.status === 'fulfilled' && Array.isArray(hireRes.value)) totalApprovals += hireRes.value.length;
      setPendingApprovalsCount(totalApprovals);

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [canApprove]);

  // Derived filters & metrics
  const departments = useMemo(() => {
    const set = new Set<string>();
    positions.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [positions]);

  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (selectedDept !== 'ALL' && p.department !== selectedDept) return false;
      if (onlyMyPositions && p.primaryRecruiterId && user?.id && p.primaryRecruiterId !== user.id) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesCode = p.vacancyCode.toLowerCase().includes(q);
        const matchesDept = p.department.toLowerCase().includes(q);
        const matchesRecruiter = p.recruiter.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesDept && !matchesRecruiter) return false;
      }

      return true;
    });
  }, [positions, statusFilter, selectedDept, onlyMyPositions, search, user?.id]);

  // Top KPIs
  const totalOpen = useMemo(() => positions.filter((p) => p.status === 'Open').length, [positions]);
  const totalInFlightCandidates = useMemo(
    () => positions.reduce((acc, p) => acc + (p.status === 'Open' ? p.applicationsCount : 0), 0),
    [positions]
  );
  const totalSlaAtRisk = useMemo(
    () => positions.filter((p) => p.status === 'Open' && (p.isOverdue || p.slaPercent < 80)).length,
    [positions]
  );

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Recruitment Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Live Operations
            </span>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Real-time requisition velocity, candidate pipeline throughput, and operational shortcuts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onToggleAnalytics && (
            <button
              type="button"
              onClick={onToggleAnalytics}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
            >
              <Icon name="report" size={13} className="text-purple-600 dark:text-purple-400" />
              <span>Analytics Dashboard</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/cv-intake')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="upload" size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Fast CV Intake</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/vacancy-requests/create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* ── Top Odoo Smart Stat Banner ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Open Positions */}
        <div
          onClick={() => setStatusFilter('Open')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Icon name="briefcase" size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Open Requisitions</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalOpen}</span>
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {positions.length} total across hospitals
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Metric 2: Pipeline Candidates */}
        <div
          onClick={() => navigate('/applications')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="users" size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Candidates</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalInFlightCandidates}</span>
              <span className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                In-flight pipeline &bull; Click to open
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Metric 3: Pending Approval Inboxes */}
        <div
          onClick={() => navigate('/inbox')}
          className={`rounded-2xl border p-4 shadow-xs transition cursor-pointer flex items-center justify-between group ${
            pendingApprovalsCount > 0
              ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 hover:border-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                pendingApprovalsCount > 0
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <Icon name="check-circle" size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Approval Inbox</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {pendingApprovalsCount}
              </span>
              <span className={`block text-[11px] font-semibold ${pendingApprovalsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                {pendingApprovalsCount > 0 ? 'Action required &bull; Review now' : 'All decisions cleared'}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Metric 4: SLA Health */}
        <div
          onClick={() => navigate('/reports')}
          className={`rounded-2xl border p-4 shadow-xs transition cursor-pointer flex items-center justify-between group ${
            totalSlaAtRisk > 0
              ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                totalSlaAtRisk > 0
                  ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <Icon name="clock" size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">SLA At-Risk</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalSlaAtRisk}</span>
              <span className={`block text-[11px] font-semibold ${totalSlaAtRisk > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {totalSlaAtRisk > 0 ? 'Attention needed' : '100% On-Track'}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* ── Toolbar: Search & View Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Status Tabs */}
          {(['ALL', 'Open', 'On Hold', 'Closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60'
              }`}
            >
              {st === 'ALL' ? 'All Requisitions' : st}
            </button>
          ))}

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="appearance-none bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-blue-500"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'All Departments' : d}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* My Positions Toggle */}
          <button
            type="button"
            onClick={() => setOnlyMyPositions((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              onlyMyPositions
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            My Assigned Positions
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Search positions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Odoo Card Grid"
            >
              <Icon name="grid-squares" size={13} />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Compact List"
            >
              <Icon name="list" size={13} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content: Cards Grid or Table ── */}
      {isLoading ? (
        <PageState kind="loading" title="Loading recruitment command center..." description="Fetching live requisitions and SLAs." />
      ) : filteredPositions.length === 0 ? (
        <PageState
          kind="empty"
          title="No matching requisitions"
          description="Try clearing your filters or search terms."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setStatusFilter('ALL');
            setSelectedDept('ALL');
            setOnlyMyPositions(false);
          }}
        />
      ) : viewMode === 'cards' ? (
        /* Odoo 3-Column Position Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPositions.map((pos) => {
            const fillRate = Math.min(100, Math.round((pos.joinedHeadcount / Math.max(1, pos.approvedHeadcount)) * 100));

            return (
              <div
                key={pos.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition flex flex-col justify-between space-y-4 group relative"
              >
                <div>
                  {/* Top Bar: Code, Status & SLA */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {pos.vacancyCode}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {pos.needActionCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                          {pos.needActionCount} Action Needed
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                          pos.status === 'Open'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                            : pos.status === 'On Hold'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {pos.status}
                      </span>
                    </div>
                  </div>

                  {/* Title & Department */}
                  <div className="mt-3">
                    <h2
                      onClick={() => navigate(`/vacancies/${pos.id}`)}
                      className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition cursor-pointer line-clamp-1"
                      title={pos.title}
                    >
                      {pos.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {pos.department} &bull; {pos.location}
                    </p>
                  </div>

                  {/* Headcount Progress Bar */}
                  <div className="mt-4 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Headcount Filled</span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                        {pos.joinedHeadcount} / {pos.approvedHeadcount} ({fillRate}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          fillRate >= 100
                            ? 'bg-emerald-500'
                            : fillRate > 50
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(5, fillRate)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer: Recruiter & 1-Click Pipeline Button */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  {/* Recruiter Avatar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">
                      {pos.recruiter.initials}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[90px] truncate" title={pos.recruiter.name}>
                      {pos.recruiter.name}
                    </span>
                  </div>

                  {/* 1-Click Pipeline Jump Button */}
                  <button
                    type="button"
                    onClick={() => navigate(`/applications?vacancyId=${pos.id}`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white rounded-xl text-xs font-extrabold transition shadow-2xs cursor-pointer border border-blue-200 dark:border-blue-900 group-hover:bg-blue-600 group-hover:text-white"
                  >
                    <span>{pos.applicationsCount} Applications</span>
                    <Icon name="chevron-right" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact List View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10.5px] bg-slate-50/50 dark:bg-slate-800/20">
                  <th className="py-3 px-4 text-left">Code</th>
                  <th className="py-3 px-4 text-left">Position Title</th>
                  <th className="py-3 px-4 text-left">Department</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Recruiter</th>
                  <th className="py-3 px-4 text-left">Headcount</th>
                  <th className="py-3 px-4 text-left">Applications</th>
                  <th className="py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPositions.map((pos) => (
                  <tr
                    key={pos.id}
                    onClick={() => navigate(`/applications?vacancyId=${pos.id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{pos.vacancyCode}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white hover:text-blue-600">
                      {pos.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">{pos.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                        {pos.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-200">{pos.recruiter.name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {pos.joinedHeadcount} / {pos.approvedHeadcount}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">
                        {pos.applicationsCount} active
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/applications?vacancyId=${pos.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition"
                      >
                        <span>Pipeline</span>
                        <Icon name="chevron-right" size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecruitmentCommandCenter;
