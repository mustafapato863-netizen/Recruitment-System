import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';

interface JobPositionRow {
  id: string;
  title: string;
  location: string;
  workType: 'Hybrid' | 'On-site' | 'Remote';
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
}

const DEFAULT_JOB_POSITIONS: JobPositionRow[] = [
  {
    id: 'job-1',
    title: 'Senior Frontend Engineer',
    location: 'Cairo, Egypt',
    workType: 'Hybrid',
    department: 'Engineering',
    recruiter: { initials: 'SA', name: 'Sarah Ahmed' },
    applicationsCount: 48,
    needActionCount: 5,
    slaPercent: 85,
    slaStatus: 'on track',
    lastActivity: 'Today, 10:30 AM',
    status: 'Open',
  },
  {
    id: 'job-2',
    title: 'Registered Nurse – ICU',
    location: 'Jeddah, KSA',
    workType: 'On-site',
    department: 'Clinical Operations',
    recruiter: { initials: 'MS', name: 'Mona Saleh' },
    applicationsCount: 43,
    needActionCount: 4,
    isOverdue: true,
    slaPercent: 62,
    slaStatus: 'at risk',
    lastActivity: 'Yesterday, 4:15 PM',
    status: 'Open',
  },
  {
    id: 'job-3',
    title: 'Product Manager',
    location: 'Riyadh, KSA',
    workType: 'Hybrid',
    department: 'Digital Health',
    recruiter: { initials: 'OF', name: 'Omar Farouk' },
    applicationsCount: 23,
    needActionCount: 3,
    slaPercent: 90,
    slaStatus: 'on track',
    lastActivity: 'Today, 9:20 AM',
    status: 'Open',
  },
  {
    id: 'job-4',
    title: 'Data Analyst',
    location: 'Cairo, Egypt',
    workType: 'Hybrid',
    department: 'Strategy & Analytics',
    recruiter: { initials: 'SM', name: 'Sara Mohamed' },
    applicationsCount: 17,
    needActionCount: 2,
    slaPercent: 75,
    slaStatus: 'on track',
    lastActivity: 'Today, 8:45 AM',
    status: 'Open',
  },
  {
    id: 'job-5',
    title: 'Radiology Technologist',
    location: 'Dammam, KSA',
    workType: 'On-site',
    department: 'Imaging',
    recruiter: { initials: 'AM', name: 'Ahmed Mostafa' },
    applicationsCount: 10,
    needActionCount: 1,
    slaPercent: 80,
    slaStatus: 'on track',
    lastActivity: 'Yesterday, 3:10 PM',
    status: 'On Hold',
  },
  {
    id: 'job-6',
    title: 'Backend Engineer',
    location: 'Riyadh, KSA',
    workType: 'Hybrid',
    department: 'Engineering',
    recruiter: { initials: 'SA', name: 'Sarah Ahmed' },
    applicationsCount: 31,
    needActionCount: 1,
    isOverdue: true,
    slaPercent: 58,
    slaStatus: 'at risk',
    lastActivity: '2 days ago',
    status: 'Open',
  },
  {
    id: 'job-7',
    title: 'HR Business Partner',
    location: 'Riyadh, KSA',
    workType: 'On-site',
    department: 'People & Culture',
    recruiter: { initials: 'LH', name: 'Lina Hassan' },
    applicationsCount: 6,
    needActionCount: 0,
    slaPercent: 95,
    slaStatus: 'on track',
    lastActivity: '3 days ago',
    status: 'Draft',
  },
  {
    id: 'job-8',
    title: 'UX Designer',
    location: 'Cairo, Egypt',
    workType: 'Hybrid',
    department: 'Digital Health',
    recruiter: { initials: 'YA', name: 'Yousef Ahmed' },
    applicationsCount: 12,
    needActionCount: 0,
    slaPercent: 70,
    slaStatus: 'on track',
    lastActivity: '4 days ago',
    status: 'Closed',
  },
  {
    id: 'job-9',
    title: 'DevOps Engineer',
    location: 'Jeddah, KSA',
    workType: 'Hybrid',
    department: 'Engineering',
    recruiter: { initials: 'HM', name: 'Heba Mohamed' },
    applicationsCount: 8,
    needActionCount: 0,
    slaPercent: 65,
    slaStatus: 'at risk',
    lastActivity: '5 days ago',
    status: 'Closed',
  },
  {
    id: 'job-10',
    title: 'Medical Coder',
    location: 'Riyadh, KSA',
    workType: 'On-site',
    department: 'Clinical Operations',
    recruiter: { initials: 'NF', name: 'Noha Farouk' },
    applicationsCount: 6,
    needActionCount: 0,
    slaPercent: 100,
    slaStatus: 'on track',
    lastActivity: '1 week ago',
    status: 'Closed',
  },
];

export function VacantListPage() {
  const navigate = useNavigate();
  const [apiVacancies, setApiVacancies] = useState<JobPositionRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'On Hold' | 'Closed'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    getApi<any>('/vacancies')
      .then((res) => {
        const rawList = Array.isArray(res) ? res : res?.data || [];
        if (rawList.length > 0) {
          const mapped: JobPositionRow[] = rawList.map((v: any, idx: number) => {
            const recruiterName = v.recruiter ? `${v.recruiter.firstName || ''} ${v.recruiter.lastName || ''}`.trim() : (v.primaryRecruiterName || 'Sarah Ahmed');
            const initials = recruiterName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'SA';
            return {
              id: v.id,
              title: v.positionTitle || v.title || `Hospital Role ${idx + 1}`,
              location: v.branch?.name || v.location || (idx % 2 === 0 ? 'Jeddah, KSA' : 'Riyadh, KSA'),
              workType: (v.workType as any) || (idx % 3 === 0 ? 'Hybrid' : 'On-site'),
              department: v.department || (idx % 2 === 0 ? 'Clinical Operations' : 'Nursing'),
              recruiter: {
                initials,
                name: recruiterName,
              },
              applicationsCount: v.applicationsCount ?? v._count?.applications ?? (idx * 6 + 14),
              needActionCount: v.needActionCount ?? (idx % 3 + 1),
              isOverdue: idx % 4 === 1,
              slaPercent: 70 + (idx * 5) % 30,
              slaStatus: (idx % 4 === 1 ? 'at risk' : 'on track') as any,
              lastActivity: v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : 'Today',
              status: (v.status as any) || 'Open',
            };
          });
          setApiVacancies(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const positions = apiVacancies.length > 0 ? apiVacancies : DEFAULT_JOB_POSITIONS;

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

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPositions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPositions.map((p) => p.id));
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
              onChange={(e) => setSelectedDept(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Clinical Operations">Clinical Operations</option>
              <option value="Digital Health">Digital Health</option>
              <option value="Strategy & Analytics">Strategy & Analytics</option>
              <option value="Imaging">Imaging</option>
              <option value="People & Culture">People & Culture</option>
            </select>
            <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Locations</option>
              <option value="Cairo">Cairo, Egypt</option>
              <option value="Riyadh">Riyadh, KSA</option>
              <option value="Jeddah">Jeddah, KSA</option>
              <option value="Dammam">Dammam, KSA</option>
            </select>
            <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Owners</option>
              <option value="Sarah Ahmed">Sarah Ahmed</option>
              <option value="Mona Saleh">Mona Saleh</option>
              <option value="Omar Farouk">Omar Farouk</option>
              <option value="Sara Mohamed">Sara Mohamed</option>
              <option value="Ahmed Mostafa">Ahmed Mostafa</option>
              <option value="Lina Hassan">Lina Hassan</option>
            </select>
            <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="filter" size={13} className="text-slate-500" />
            <span>More filters</span>
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <input
            type="text"
            placeholder="Search positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-3.5 pr-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
          <Icon name="search" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* ── Filters Row 2: Status Pill Tabs ── */}
      <div className="flex items-center gap-2 pt-1 overflow-x-auto rf-scrollbar">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
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
          onClick={() => setStatusFilter('Open')}
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
          onClick={() => setStatusFilter('On Hold')}
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
          onClick={() => setStatusFilter('Closed')}
          className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer shrink-0 ${
            statusFilter === 'Closed'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-extrabold'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 font-medium'
          }`}
        >
          Closed &bull; {closedCount}
        </button>
      </div>

      {/* ── Main Data Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto rf-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredPositions.length && filteredPositions.length > 0}
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
              {filteredPositions.map((row) => {
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
                        {row.location} &bull; {row.workType}
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
                              : row.needActionCount >= 3
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900'
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
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="More actions"
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
            Showing 1 to {Math.min(filteredPositions.length, pageSize)} of {allCount} positions
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
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${
                  currentPage === 1
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                1
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(2)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${
                  currentPage === 2
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                2
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 cursor-pointer"
              >
                &rsaquo;
              </button>
            </div>

            <div className="relative">
              <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 pr-6 text-xs font-medium text-slate-600 focus:outline-none cursor-pointer">
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
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
