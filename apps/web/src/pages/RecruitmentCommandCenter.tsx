import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import {
  VacancyCard,
  VacancyCardHeadcountProgress,
  VacancyCardMeta,
  VacancyCardMetrics,
} from '../components/vacancy/VacancyCard';
import { PageState } from '../components/ui/PageState';
import { QuickGuideTrigger } from '../quickguide';
import { MyTargetsWidget } from '../components/MyTargetsWidget';

interface CommandCenterPosition {
  id: string;
  title: string;
  vacancyCode: string;
  department: string;
  location: string;
  workType: string;
  status: 'Open' | 'On Hold' | 'Draft' | 'Closed' | 'Pending Activation' | 'Partially Filled' | 'Filled' | 'Cancelled';
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

function getPositionNextAction(pos: CommandCenterPosition) {
  if (pos.recruiter.name === 'Unassigned') {
    return { label: 'Assign recruiter', hint: 'No owner yet', to: `/vacancies/${pos.id}` };
  }
  if (pos.needActionCount > 0) {
    return {
      label: pos.needActionCount === 1 ? 'Review 1 candidate' : `Review ${pos.needActionCount} candidates`,
      hint: 'Waiting on a recruiter decision',
      to: `/applications?vacancyId=${pos.id}`,
    };
  }
  if (pos.applicationsCount === 0 && pos.status === 'Open') {
    return { label: 'Add candidates', hint: 'No applicants yet', to: '/cv-intake' };
  }
  if (pos.isOverdue) {
    return { label: 'Review overdue job', hint: 'SLA is at risk', to: `/vacancies/${pos.id}` };
  }
  return {
    label: 'Open pipeline',
    hint: `${pos.applicationsCount} candidate${pos.applicationsCount === 1 ? '' : 's'}`,
    to: `/applications?vacancyId=${pos.id}`,
  };
}

function positionUrgency(pos: CommandCenterPosition) {
  if (pos.recruiter.name === 'Unassigned') return 0;
  if (pos.needActionCount > 0) return 1;
  if (pos.isOverdue) return 2;
  if (pos.applicationsCount === 0) return 3;
  return 4;
}


export function RecruitmentCommandCenter({ onToggleAnalytics }: { onToggleAnalytics?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [positions, setPositions] = useState<CommandCenterPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'On Hold' | 'Closed'>('Open');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [onlyMyPositions, setOnlyMyPositions] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [onlyNeedAction, setOnlyNeedAction] = useState(false);

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
          'Pending Activation': 'Pending Activation',
          'Partially Filled': 'Partially Filled',
          Filled: 'Filled',
          Cancelled: 'Cancelled',
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
            location: v.location || v.branch?.name || '—',
            workType: v.workType || 'Full-time',
            status: (v.status && statusMap[v.status]) ? statusMap[v.status] : 'Pending Activation',
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
      if (onlyNeedAction && !(p.needActionCount > 0 || p.recruiter.name === 'Unassigned' || p.isOverdue)) return false;
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
    }).sort((a, b) => positionUrgency(a) - positionUrgency(b) || a.title.localeCompare(b.title));
  }, [positions, statusFilter, selectedDept, onlyMyPositions, onlyNeedAction, search, user?.id]);

  const needActionJobs = useMemo(
    () => positions.filter((p) => p.status === 'Open' && (p.needActionCount > 0 || p.recruiter.name === 'Unassigned' || p.isOverdue)).length,
    [positions],
  );

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
    <div className="flex w-full flex-col p-3 sm:p-4 lg:p-5 max-w-[1720px] mx-auto space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="rf-page-title">
              Command Center
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Open requisitions, pipeline, and next actions.
          </p>
        </div>

        <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5">
          {onToggleAnalytics && (
            <button
              type="button"
              onClick={onToggleAnalytics}
              className="inline-flex min-h-10 items-center justify-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
            >
              <Icon name="report" size={13} className="text-purple-600 dark:text-purple-400" />
              <span>Analytics</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/cv-intake')}
            className="inline-flex min-h-10 items-center justify-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="upload" size={13} className="text-emerald-700 dark:text-emerald-400" />
            <span>CV intake</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/vacancy-requests/create')}
              className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              aria-label="Create new requisition"
          >
            <Icon name="plus" size={14} />
            <span>New job</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setOnlyNeedAction(false); setStatusFilter('Open'); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${!onlyNeedAction && statusFilter === 'Open' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Open
          <span className="text-slate-900 dark:text-white">{totalOpen}</span>
        </button>
        <button type="button" onClick={() => { setOnlyNeedAction(true); setStatusFilter('Open'); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${onlyNeedAction ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Need action
          <span className="text-slate-900 dark:text-white">{needActionJobs}</span>
        </button>
        <button type="button" onClick={() => navigate('/applications')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Candidates
          <span className="text-slate-900 dark:text-white">{totalInFlightCandidates}</span>
        </button>
        <button type="button" onClick={() => navigate('/approval-inbox')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Approvals
          <span className="text-slate-900 dark:text-white">{pendingApprovalsCount}</span>
        </button>
        <button type="button" onClick={() => navigate('/reports')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          SLA at risk
          <span className="text-slate-900 dark:text-white">{totalSlaAtRisk}</span>
        </button>
      </div>

      {/* ── My Activity Targets Widget (Recruiter View) ── */}
      <MyTargetsWidget />

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
              {st === 'ALL' ? 'All' : st}
            </button>
          ))}

          {/* Department Filter */}
          <div className="relative">
            <select aria-label="Department"
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
            <Icon name="chevron-down" size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none" />
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
            Mine
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Search requisition or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
              title="SGH Card Grid"
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
                  : 'text-slate-700 hover:text-slate-900'
              }`}
              title="Compact List"
              aria-label="Compact list view"
            >
              <Icon name="list" size={13} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content: Cards Grid or Table ── */}
      {isLoading ? (
        <PageState kind="loading" title="Loading jobs" description="Fetching open requisitions." />
      ) : filteredPositions.length === 0 ? (
        <PageState
          kind="empty"
          title="No jobs"
          description="Try another filter or search."
          actionLabel="Reset"
          onAction={() => {
            setSearch('');
            setStatusFilter('ALL');
            setSelectedDept('ALL');
            setOnlyMyPositions(false);
            setOnlyNeedAction(false);
          }}
        />
      ) : viewMode === 'cards' ? (
        /* RecruitFlow 3-Column Position Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPositions.map((pos) => {
            const nextAction = getPositionNextAction(pos);

            return (
              <VacancyCard
                key={pos.id}
                vacancy={pos}
                onOpen={() => navigate(`/vacancies/${pos.id}`)}
                className="min-h-[280px] justify-between"
                footer={(
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{nextAction.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(nextAction.to);
                      }}
                      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                    >
                      {nextAction.label}
                      <Icon name="arrow-right" size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              >
                <div className="mt-1 space-y-4">
                  <VacancyCardMeta location={pos.location} workType={pos.workType} />
                  <VacancyCardMetrics items={[
                    { key: 'applicants', label: 'Applicants', value: pos.applicationsCount, icon: 'users' },
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
                </div>
              </VacancyCard>
            );
          })}
        </div>
      ) : (
        /* Compact List View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[10.5px] bg-slate-50/50 dark:bg-slate-800/20">
                  <th className="py-3 px-4 text-left">Code</th>
                  <th className="py-3 px-4 text-left">Position Title</th>
                  <th className="py-3 px-4 text-left">Department</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Recruiter</th>
                  <th className="py-3 px-4 text-left">Headcount</th>
                  <th className="py-3 px-4 text-left">Applications</th>
                  <th className="py-3 pr-4 text-right">Next</th>
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
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        {pos.applicationsCount} active
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(getPositionNextAction(pos).to)}
                        className="inline-flex min-h-7 items-center rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                      >
                        {getPositionNextAction(pos).label}
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
