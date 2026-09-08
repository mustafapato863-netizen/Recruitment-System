import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { VacancyDetailView, Application, PaginatedResult, Interview } from '@recruitflow/contracts';
import { fetchApi, getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { PageState } from '../components/ui/PageState';
import { useSetBreadcrumbTitle } from '../context/BreadcrumbContext';
import { QuickGuideTrigger } from '../quickguide';
import './PageEnhancementsV2.css';

interface InterviewerUser {
  id: string;
  displayName: string;
  name?: string;
  email?: string;
}

export function JobAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<VacancyDetailView | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [interviewers, setInterviewers] = useState<InterviewerUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('All Time');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.allSettled([
      fetchApi<VacancyDetailView>(`/vacancies/${id}`),
      getApi<PaginatedResult<Application>>(`/applications?vacancyId=${id}&pageSize=100`),
      getApi<Interview[]>('/interviews'),
      getApi<InterviewerUser[]>('/users/interviewers'),
    ])
      .then(([vRes, appsRes, intsRes, usersRes]) => {
        if (vRes.status === 'fulfilled' && vRes.value) {
          setVacancy(vRes.value);
        }
        if (appsRes.status === 'fulfilled' && appsRes.value?.data) {
          setApplications(appsRes.value.data);
        }
        if (intsRes.status === 'fulfilled' && intsRes.value) {
          setInterviews(intsRes.value);
        }
        if (usersRes.status === 'fulfilled' && usersRes.value) {
          setInterviewers(usersRes.value);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  const jobTitle = vacancy?.position?.title || vacancy?.title || 'No position';
  useSetBreadcrumbTitle(jobTitle && jobTitle !== 'No position' ? `${jobTitle} Analytics` : 'Job Analytics');
  const statusLabel = vacancy?.status || '—';
  const departmentName = (vacancy as unknown as { department?: string } | null | undefined)?.department || vacancy?.branch?.name || '—';
  const locationText = vacancy?.location || vacancy?.branch?.name || '—';
  const employmentType = vacancy?.vacancyRequest?.employmentType || 'Full-time';
  const openedDateStr = vacancy?.openedAt || vacancy?.createdAt
    ? new Date(vacancy.openedAt || vacancy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const recruiterAssignment =
    vacancy?.assignments?.find((a) => a.assignmentKind === 'PRIMARY') ||
    vacancy?.assignments?.find((a) => a.roleCode === 'RECRUITER' || a.roleCode === 'LEAD_RECRUITER') ||
    vacancy?.assignments?.[0];
  const recruiterUser = recruiterAssignment
    ? interviewers.find((u) => u.id === recruiterAssignment.userId) || (recruiterAssignment as unknown as { user?: { displayName?: string; name?: string } } | null | undefined)?.user
    : null;
  const recruiterName = recruiterUser?.displayName || recruiterUser?.name || 'Unassigned';

  const appIds = new Set(applications.map((a) => a.id));
  const vacancyInterviews = interviews.filter((i) => appIds.has(i.applicationId));

  const totalApps = vacancy?.funnelCounts?.applied ?? applications.length;
  const qualifiedApps = applications.filter((a) => !['Applied', 'New', 'Rejected', 'Withdrawn'].includes(a.stage)).length;
  const interviewCount = vacancy?.funnelCounts?.interviews ?? vacancyInterviews.length;
  const offerCount = vacancy?.funnelCounts?.offer ?? applications.filter((a) => a.stage === 'Offer').length;
  const hireCount = vacancy?.joinedHeadcount ?? vacancy?.funnelCounts?.joined ?? applications.filter((a) => a.stage === 'Joined' || (a as unknown as { stage?: string; status?: string }).stage === 'Hired' || (a as unknown as { status?: string }).status === 'HIRED').length;
  const daysOpen = vacancy?.openedAt || vacancy?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(vacancy.openedAt || vacancy.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleExportCsv = () => {
    const csvContent = [
      'Metric,Value',
      `Job Title,"${jobTitle}"`,
      `Department,"${departmentName}"`,
      `Location,"${locationText}"`,
      `Total Applications,${totalApps}`,
      `Qualified Candidates,${qualifiedApps}`,
      `Interviews,${interviewCount}`,
      `Offers,${offerCount}`,
      `Hires,${hireCount}`,
      `Days Open,${daysOpen}`,
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job-analytics-${id || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Job analytics metrics exported to CSV!');
  };

  if (isLoading && !vacancy) {
    return (
      <div className="flex w-full flex-col p-6 max-w-[1720px] mx-auto">
        <PageState kind="loading" title="Loading job analytics..." description="Fetching vacancy performance and funnel telemetry." />
      </div>
    );
  }

  if (!isLoading && !vacancy && id) {
    return (
      <div className="flex w-full flex-col p-6 max-w-[1720px] mx-auto">
        <PageState
          kind="empty"
          title="Job analytics not found"
          description="The requested position could not be found or has been removed."
          actionLabel="Back to Reports"
          onAction={() => navigate('/reports')}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header matching 15-job-analytics.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {jobTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {statusLabel}
            </span>
            <QuickGuideTrigger />
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>{departmentName}</span>
            <span>&bull;</span>
            <span>{locationText}</span>
            <span>&bull;</span>
            <span>{employmentType}</span>
            <span>&bull;</span>
            <span>Opened {openedDateStr}</span>
            <span>&bull;</span>
            <span>Recruiter: {recruiterName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to reports</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} className="text-slate-400" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => showToast('Analytics options: Refresh metrics, Schedule automated weekly report')}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-900 shadow-xs cursor-pointer"
            title="More options"
          >
            <Icon name="more-horizontal" size={15} />
          </button>

          <button
            type="button"
            onClick={() => setDateRange((prev) => (prev === 'All Time' ? 'This Month' : prev === 'This Month' ? 'Last 90 Days' : 'All Time'))}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Icon name="calendar" size={13} className="text-slate-400" />
            <div>
              <span className="block font-bold leading-none">{dateRange}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Pipeline overview</span>
            </div>
            <Icon name="chevron-down" size={12} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── 6 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Applications */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="file-text" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Applications</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">{totalApps}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">
                {applications.filter((a) => Date.now() - new Date(a.appliedAt || a.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length} new this week
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Qualified */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="users" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Qualified</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">{qualifiedApps}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">
                {totalApps > 0 ? Math.round((qualifiedApps / totalApps) * 100) : 0}% of total
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Interviews */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Icon name="calendar" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Interviews</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">{interviewCount}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-purple-600">
                {vacancyInterviews.length} sessions
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Offers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Icon name="offer" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Offers</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">{offerCount}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-orange-600">
                {hireCount} accepted
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Hires */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="user-check" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Hires</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">{hireCount}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">
                Target: {vacancy?.approvedHeadcount || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Time to Hire */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="clock" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Time to Fill</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{daysOpen}</span>
              <span className="text-[10px] text-slate-400">days</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-slate-500">Target: 45 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Applications by Stage (Funnel), Stage Aging, Source ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Funnel (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Applications by Stage
          </h2>

          <div className="space-y-2 text-xs py-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Applied</span>
              <span className="font-black text-slate-900 dark:text-white">
                {applications.filter((a) => a.stage === 'Applied').length} ({totalApps > 0 ? Math.round((applications.filter((a) => a.stage === 'Applied').length / totalApps) * 100) : 0}%)
              </span>
            </div>
            <div
              className="bg-blue-500 h-2.5 rounded-full"
              style={{ width: `${totalApps > 0 ? Math.max(8, Math.round((applications.filter((a) => a.stage === 'Applied').length / totalApps) * 100)) : 0}%` }}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Screening</span>
              <span className="font-black text-slate-900 dark:text-white">
                {applications.filter((a) => a.stage === 'Screening').length} ({totalApps > 0 ? Math.round((applications.filter((a) => a.stage === 'Screening').length / totalApps) * 100) : 0}%)
              </span>
            </div>
            <div
              className="bg-emerald-500 h-2.5 rounded-full"
              style={{ width: `${totalApps > 0 ? Math.max(8, Math.round((applications.filter((a) => a.stage === 'Screening').length / totalApps) * 100)) : 0}%` }}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Interview</span>
              <span className="font-black text-slate-900 dark:text-white">
                {interviewCount} ({totalApps > 0 ? Math.round((interviewCount / totalApps) * 100) : 0}%)
              </span>
            </div>
            <div
              className="bg-purple-500 h-2.5 rounded-full"
              style={{ width: `${totalApps > 0 ? Math.max(8, Math.round((interviewCount / totalApps) * 100)) : 0}%` }}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Offer</span>
              <span className="font-black text-slate-900 dark:text-white">
                {offerCount} ({totalApps > 0 ? Math.round((offerCount / totalApps) * 100) : 0}%)
              </span>
            </div>
            <div
              className="bg-orange-500 h-2.5 rounded-full"
              style={{ width: `${totalApps > 0 ? Math.max(8, Math.round((offerCount / totalApps) * 100)) : 0}%` }}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Hired</span>
              <span className="font-black text-slate-900 dark:text-white">
                {hireCount} ({totalApps > 0 ? Math.round((hireCount / totalApps) * 100) : 0}%)
              </span>
            </div>
            <div
              className="bg-teal-500 h-2.5 rounded-full"
              style={{ width: `${totalApps > 0 ? Math.max(8, Math.round((hireCount / totalApps) * 100)) : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
            <span className="text-slate-500">Overall conversion rate</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {totalApps > 0 ? ((hireCount / totalApps) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
        </div>

        {/* Stage Aging (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Stage Aging
              </h2>
              <span className="text-[10px] text-slate-400">ⓘ</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 0-3d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 4-7d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 8-14d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> 15+d</span>
            </div>
          </div>

          {applications.filter((a) => !['Joined', 'Rejected', 'Withdrawn'].includes(a.stage)).length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">No active applicants currently in pipeline.</p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {(['Applied', 'Screening', 'Interview', 'Offer'] as const).map((st) => {
                const inStage = applications.filter((a) => a.stage === st);
                if (inStage.length === 0) return null;
                let d0_3 = 0;
                let d4_7 = 0;
                let d8_14 = 0;
                let d15_plus = 0;
                inStage.forEach((a) => {
                  const age = Math.floor((Date.now() - new Date(a.appliedAt || a.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  if (age <= 3) d0_3++;
                  else if (age <= 7) d4_7++;
                  else if (age <= 14) d8_14++;
                  else d15_plus++;
                });
                const total = inStage.length || 1;
                return (
                  <div key={st}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{st}</span>
                      <span className="text-slate-400">{d0_3} &bull; {d4_7} &bull; {d8_14} &bull; {d15_plus}</span>
                    </div>
                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                      {d0_3 > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(d0_3 / total) * 100}%` }} />}
                      {d4_7 > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(d4_7 / total) * 100}%` }} />}
                      {d8_14 > 0 && <div className="bg-orange-500 h-full" style={{ width: `${(d8_14 / total) * 100}%` }} />}
                      {d15_plus > 0 && <div className="bg-rose-500 h-full" style={{ width: `${(d15_plus / total) * 100}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between text-[10.5px] font-medium text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Applications by Source (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Applications by Source
          </h2>

          {applications.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">No source telemetry available.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-1">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-blue-500 flex items-center justify-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{totalApps}</span>
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5">Total</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs w-full mt-3">
                {Object.entries(
                  applications.reduce<Record<string, number>>((acc, a) => {
                    const src = a.source || 'Direct / Careers';
                    acc[src] = (acc[src] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .slice(0, 4)
                  .map(([src, count], idx) => {
                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500'];
                    return (
                      <div key={src} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                          <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} /> {src}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                          {count} ({Math.round((count / (totalApps || 1)) * 100)}%)
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="text-right text-[11px] text-blue-600 dark:text-blue-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-2">
            {totalApps > 0 ? `${totalApps} total recorded` : '0 applications'}
          </div>
        </div>
      </div>

      {/* ── Row 3: Conversion Rates, Turnaround Time, Bottlenecks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Conversion Rates (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Conversion Rates
            </h2>
            <span className="text-[10px] text-slate-400">ⓘ</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Applied &rarr; Screening</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {totalApps > 0 ? Math.round((applications.filter((a) => a.stage === 'Screening').length / totalApps) * 100) : 0}% &bull; {applications.filter((a) => a.stage === 'Screening').length} / {totalApps}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${totalApps > 0 ? Math.round((applications.filter((a) => a.stage === 'Screening').length / totalApps) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Screening &rarr; Interview</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {applications.filter((a) => a.stage === 'Screening').length > 0 ? Math.round((interviewCount / applications.filter((a) => a.stage === 'Screening').length) * 100) : 0}% &bull; {interviewCount} / {applications.filter((a) => a.stage === 'Screening').length}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${applications.filter((a) => a.stage === 'Screening').length > 0 ? Math.round((interviewCount / applications.filter((a) => a.stage === 'Screening').length) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Interview &rarr; Offer</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {interviewCount > 0 ? Math.round((offerCount / interviewCount) * 100) : 0}% &bull; {offerCount} / {interviewCount}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${interviewCount > 0 ? Math.round((offerCount / interviewCount) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Offer &rarr; Hired</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offerCount > 0 ? Math.round((hireCount / offerCount) * 100) : 0}% &bull; {hireCount} / {offerCount}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${offerCount > 0 ? Math.round((hireCount / offerCount) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Turnaround Time (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Interviewer Turnaround Time
            </h2>
            <span className="text-[10px] text-slate-400 font-bold">Telemetry</span>
          </div>

          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Icon name="clock" size={20} />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {vacancyInterviews.length > 0
                ? `${vacancyInterviews.length} Interviews Recorded`
                : 'No Interview Turnaround Data'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
              {vacancyInterviews.length > 0
                ? `Tracking response turnaround across ${vacancyInterviews.length} scheduled interview sessions.`
                : 'Turnaround telemetry will populate as interview scorecards and candidate evaluations are logged.'}
            </p>
          </div>
        </div>

        {/* Bottlenecks (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
            Top Bottlenecks
          </h2>

          {(() => {
            const activeApps = applications.filter((a) => !['Joined', 'Rejected', 'Withdrawn'].includes(a.stage));
            const stuckList = (['Screening', 'Interview', 'Offer'] as const)
              .map((stage) => {
                const inStage = activeApps.filter((a) => a.stage === stage);
                const stuck = inStage.filter((a) => {
                  const age = Math.floor((Date.now() - new Date(a.appliedAt || a.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  return age >= 7;
                }).length;
                return { stage, total: inStage.length, stuck };
              })
              .filter((b) => b.stuck > 0);

            if (stuckList.length === 0) {
              return (
                <div className="py-6 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    No SLA bottlenecks detected. All applicants are progressing within standard SLA.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3 text-xs">
                {stuckList.map((b) => (
                  <div key={b.stage} className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{b.stage}</span>
                      <span className="text-[10px] text-slate-400">{b.stuck} stuck &gt; 7d</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                      {Math.round((b.stuck / (b.total || 1)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="text-right pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => showToast('Bottlenecks evaluated against a 7-day stage SLA threshold')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View SLA policy
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 4: Applicants Needing Action ── */}
      {(() => {
        const needingAction = applications
          .filter((a) => !['Joined', 'Rejected', 'Withdrawn'].includes(a.stage))
          .sort((a, b) => new Date(a.appliedAt || a.createdAt).getTime() - new Date(b.appliedAt || b.createdAt).getTime());

        return (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Applicants Needing Action ({needingAction.length})
            </h2>

            {needingAction.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No applicants currently waiting on action for this position.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <th className="pb-2">Applicant</th>
                        <th className="pb-2">Stage</th>
                        <th className="pb-2">Waiting on</th>
                        <th className="pb-2">For</th>
                        <th className="pb-2">Waiting since</th>
                        <th className="pb-2">SLA</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {needingAction.slice(0, 6).map((app) => {
                        const candidateName = app.candidate
                          ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
                          : (app as unknown as { candidateName?: string }).candidateName || 'Unknown candidate';
                        const age = Math.max(0, Math.floor((Date.now() - new Date(app.appliedAt || app.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
                        const slaStatus = age > 7 ? 'Overdue' : age > 3 ? 'At risk' : 'On track';
                        const slaClass =
                          age > 7
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : age > 3
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
                        const waitingOn =
                          app.stage === 'Interview'
                            ? 'Interview feedback'
                            : app.stage === 'Screening'
                            ? 'Screening review'
                            : 'Stage progression';
                        const owner = app.taskOwnerName || app.primaryRecruiterName || recruiterName;

                        return (
                          <tr key={app.id}>
                            <td className="py-2.5">
                              <span className="font-bold text-slate-900 dark:text-white block">{candidateName}</span>
                              <span className="text-[10px] text-slate-400">APP-{app.id.slice(0, 8)}</span>
                            </td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                {app.stage}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{waitingOn}</span>
                              <span className="block text-[10px] text-slate-400">{owner}</span>
                            </td>
                            <td className="py-2.5 text-slate-500 dark:text-slate-400">{age} days</td>
                            <td className="py-2.5 text-slate-500 dark:text-slate-400">
                              {new Date(app.appliedAt || app.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${slaClass}`}>
                                {slaStatus}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => navigate(`/applications?vacancyId=${id || ''}`)}
                                className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => navigate(`/applications?vacancyId=${id || ''}`)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    View all ({needingAction.length})
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default JobAnalyticsPage;
