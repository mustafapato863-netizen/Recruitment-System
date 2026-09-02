import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Application, ApplicationStage, PaginatedResult, Vacancy } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { CandidateSplitDrawer } from '../components/candidate/CandidateSplitDrawer';

const KANBAN_STAGES: { id: ApplicationStage; label: string; countFallback: number }[] = [
  { id: 'Applied', label: 'New', countFallback: 25 },
  { id: 'Screening', label: 'Screened', countFallback: 30 },
  { id: 'Interview', label: 'Interview', countFallback: 18 },
  { id: 'Offer', label: 'Offer', countFallback: 7 },
  { id: 'Joined', label: 'Hired', countFallback: 3 },
];

const SOURCE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Referral: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  LinkedIn: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Career Site': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Employee Ref': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  Agency: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
};

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId') || 'ALL';

  const [applications, setApplications] = useState<Application[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [appsRes, vacsRes] = await Promise.allSettled([
          getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=100'),
          getApi<Vacancy[]>('/vacancies'),
        ]);

        if (appsRes.status === 'fulfilled' && appsRes.value?.data) {
          setApplications(appsRes.value.data);
        }
        if (vacsRes.status === 'fulfilled' && vacsRes.value) {
          setVacancies(vacsRes.value);
        }
      } catch (err) {
        console.error('Failed to fetch applications', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchVacancy = vacancyId === 'ALL' || app.vacancyId === vacancyId;
      const matchSearch =
        !search ||
        (app.candidate?.firstName && app.candidate.firstName.toLowerCase().includes(search.toLowerCase())) ||
        (app.candidate?.lastName && app.candidate.lastName.toLowerCase().includes(search.toLowerCase())) ||
        (app.positionTitle && app.positionTitle.toLowerCase().includes(search.toLowerCase())) ||
        (app.vacancyCode && app.vacancyCode.toLowerCase().includes(search.toLowerCase()));

      return matchVacancy && matchSearch;
    });
  }, [applications, vacancyId, search]);

  // Group by stage
  const groupedApps = useMemo(() => {
    const map: Record<string, Application[]> = {
      Applied: [],
      Screening: [],
      Interview: [],
      Offer: [],
      Joined: [],
    };

    for (const app of filteredApps) {
      if (map[app.stage]) {
        map[app.stage].push(app);
      } else if (app.stage === 'Pre-Hire') {
        map['Offer'].push(app);
      } else {
        map['Screening'].push(app);
      }
    }
    return map;
  }, [filteredApps]);

  const handleStageMove = async (appId: string, nextStage: ApplicationStage) => {
    try {
      await patchApi(`/applications/${appId}/stage`, { stage: nextStage });
      setApplications((curr) =>
        curr.map((a) => (a.id === appId ? { ...a, stage: nextStage } : a))
      );
    } catch (err) {
      console.error('Failed to update stage', err);
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-5 flex flex-col h-[calc(100vh-70px)]">
      {/* ── Top Header & Filter Toolbar (Panel 5) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Vacancy / Job Dropdown */}
          <select
            value={vacancyId}
            onChange={(e) => setSearchParams(e.target.value === 'ALL' ? {} : { vacancyId: e.target.value })}
            className="h-9 px-3 text-xs font-semibold bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-600 shadow-2xs"
          >
            <option value="ALL">All Jobs</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.position?.title ?? v.vacancyCode}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="h-9 px-3 text-xs font-semibold bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-600 shadow-2xs"
          >
            <option value="ALL">All Departments</option>
            <option value="Nursing">Nursing</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="Radiology">Radiology</option>
            <option value="IT">IT Support</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search applicants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-4 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 w-52 sm:w-64 shadow-2xs"
            />
          </div>
        </div>

        {/* Add Applicant Button */}
        <button
          type="button"
          onClick={() => navigate('/candidates')}
          className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
        >
          <Icon name="plus" size={14} />
          Add Applicant
        </button>
      </div>

      {/* ── Kanban Columns (5 Columns) ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-500">
          <Icon name="refresh-cw" size={20} className="animate-spin text-blue-600 mr-2" />
          Loading recruitment pipeline...
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-hidden min-h-0">
          {KANBAN_STAGES.map((stage) => {
            const appsInStage = groupedApps[stage.id] || [];

            return (
            <div
              key={stage.id}
              className="flex flex-col bg-gray-50/90 rounded-xl border border-gray-200 h-full overflow-hidden shadow-2xs"
            >
              {/* Column Header */}
              <div className="px-3.5 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  {stage.label} <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{appsInStage.length}</span>
                </span>
                <span className="text-xs font-bold text-gray-400">
                  {stage.id === 'Applied' && 'Stage 1'}
                  {stage.id === 'Screening' && 'Stage 2'}
                  {stage.id === 'Interview' && 'Stage 3'}
                  {stage.id === 'Offer' && 'Stage 4'}
                  {stage.id === 'Joined' && 'Hired'}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 rf-scrollbar">
                {appsInStage.length === 0 ? (
                  <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-xl text-gray-400 bg-white/50">
                    <Icon name="users" size={20} className="mb-1.5 opacity-40 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500">No applicants</span>
                    <span className="text-[11px] text-gray-400">Drag or advance candidates here</span>
                  </div>
                ) : (
                  appsInStage.map((app) => {
                    const candidateName = app.candidate
                      ? `${app.candidate.firstName} ${app.candidate.lastName}`
                      : 'Candidate Profile';
                    const roleTitle = app.positionTitle || app.vacancyCode || 'Position Requisition';
                    const sourceTag = (app as unknown as { source?: string }).source || 'Career Site';
                    const sourceStyle = SOURCE_COLORS[sourceTag] || SOURCE_COLORS['Career Site'];

                    const nextActionMap: Record<ApplicationStage, { text: string; tone: string; next?: ApplicationStage }> = {
                      Applied: { text: '📞 Phone Screen', tone: 'text-blue-700 bg-blue-50 border-blue-200/60', next: 'Screening' },
                      Screening: { text: '🗓️ Tech Interview', tone: 'text-purple-700 bg-purple-50 border-purple-200/60', next: 'Interview' },
                      Interview: { text: '📝 Scorecard / Offer', tone: 'text-amber-700 bg-amber-50 border-amber-200/60', next: 'Offer' },
                      'Pre-Hire': { text: '📄 Prepare Offer', tone: 'text-amber-700 bg-amber-50 border-amber-200/60', next: 'Offer' },
                      Offer: { text: '🤝 Confirm Joining', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200/60', next: 'Joined' },
                      Joined: { text: '✅ Onboarding Active', tone: 'text-green-800 bg-green-50 border-green-200/60' },
                      Rejected: { text: 'Archive Record', tone: 'text-gray-600 bg-gray-100' },
                      Withdrawn: { text: 'Candidate Withdrew', tone: 'text-gray-600 bg-gray-100' },
                    };

                    const actionInfo = nextActionMap[app.stage] || nextActionMap.Applied;

                    return (
                      <div
                        key={app.id}
                        onClick={() => setSelectedApplication(app)}
                        className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-blue-500 hover:shadow-xs transition cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {candidateName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-gray-900 truncate leading-snug group-hover:text-blue-600 transition-colors">
                                {candidateName}
                              </h4>
                              <p className="text-xs text-gray-500 truncate font-medium">{roleTitle}</p>
                            </div>
                          </div>

                          {actionInfo.next && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleStageMove(app.id, actionInfo.next!);
                              }}
                              title={`Advance to ${actionInfo.next}`}
                              className="p-1 rounded-md bg-gray-50 hover:bg-blue-600 text-gray-400 hover:text-white border border-gray-200 hover:border-transparent transition shrink-0"
                            >
                              <Icon name="chevron-right" size={14} />
                            </button>
                          )}
                        </div>

                        {/* Odoo-style Next Activity indicator */}
                        <div className="mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${actionInfo.tone}`}>
                            <Icon name="clock" size={11} className="shrink-0" />
                            {actionInfo.text}
                          </span>
                        </div>

                        {/* Rating & Source Tag */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                          <div className="flex text-amber-400 font-bold tracking-tight">
                            ★★★★☆
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sourceStyle.bg} ${sourceStyle.text}`}
                          >
                            {sourceTag}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom Source Tags Legend (Panel 5) ── */}
      <div className="flex items-center gap-5 pt-2 text-xs font-medium text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" /> Referral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> LinkedIn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Career Site
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Employee Ref
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> Agency
        </span>
      </div>

      {/* Candidate Split Drawer Inspection */}
      {selectedApplication && (
        <CandidateSplitDrawer
          isOpen={Boolean(selectedApplication)}
          onClose={() => setSelectedApplication(null)}
          application={selectedApplication}
          onMoveStage={(appId, next) => void handleStageMove(appId, next)}
        />
      )}
    </div>
  );
}
