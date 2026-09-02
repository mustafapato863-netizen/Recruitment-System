import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Icon } from '../components/Icon';
import { getApi } from '../api/client';
import type { Vacancy, Application, ReportOverview } from '@recruitflow/contracts';

interface JobSummary {
  id: string;
  title: string;
  applicantsCount: number;
  colorClass: string;
}

interface InterviewItem {
  id: string;
  candidateName: string;
  timeStr: string;
  role: string;
  avatarColor: string;
}

const mockPipelineChartData = [
  { stage: 'May 5', applicants: 128 },
  { stage: 'May 12', applicants: 214 },
  { stage: 'May 19', applicants: 96 },
  { stage: 'May 26', applicants: 24 },
  { stage: 'May 31', applicants: 18 },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const [vRes, aRes, oRes] = await Promise.allSettled([
          getApi<Vacancy[]>('/vacancies'),
          getApi<{ data: Application[] }>('/applications?pageSize=100'),
          getApi<ReportOverview>(
            `/reports/overview?from=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`
          ),
        ]);

        if (vRes.status === 'fulfilled' && vRes.value) setVacancies(vRes.value);
        if (aRes.status === 'fulfilled' && aRes.value?.data) setApplications(aRes.value.data);
        if (oRes.status === 'fulfilled' && oRes.value) setOverview(oRes.value);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadDashboard();
  }, []);

  // Top Open Jobs
  const topJobs: JobSummary[] = vacancies.slice(0, 5).map((v, i) => {
    const colors = [
      'bg-blue-100 text-blue-900 border-blue-200',
      'bg-amber-100 text-amber-900 border-amber-200',
      'bg-emerald-100 text-emerald-900 border-emerald-200',
      'bg-indigo-100 text-indigo-900 border-indigo-200',
      'bg-purple-100 text-purple-900 border-purple-200',
    ];
    const appsCount = applications.filter((a) => a.vacancyId === v.id).length;
    return {
      id: v.id,
      title: v.position?.title ?? v.vacancyCode,
      applicantsCount: appsCount,
      colorClass: colors[i % colors.length],
    };
  });

  const upcomingInterviews: InterviewItem[] = applications
    .filter((a) => a.stage === 'Interview')
    .slice(0, 5)
    .map((a, i) => {
      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-indigo-500'];
      const cName = a.candidate ? `${a.candidate.firstName} ${a.candidate.lastName}` : `Candidate ${i + 1}`;
      return {
        id: a.id,
        candidateName: cName,
        timeStr: a.appliedAt ? new Date(a.appliedAt).toLocaleDateString() : 'TBD',
        role: a.positionTitle || a.vacancyCode || 'Specialist',
        avatarColor: colors[i % colors.length],
      };
    });

  const totalApplicantsCount = overview?.funnel?.find(f => f.name.toLowerCase().includes('appl'))?.count ?? applications.length;
  const interviewsCount = overview?.funnel?.find(f => f.name.toLowerCase().includes('interview'))?.count ?? applications.filter(a => a.stage === 'Interview').length;
  const offersCount = overview?.funnel?.find(f => f.name.toLowerCase().includes('offer'))?.count ?? applications.filter(a => a.stage === 'Offer').length;
  const hiredCount = overview?.funnel?.find(f => f.name.toLowerCase().includes('join') || f.name.toLowerCase().includes('hire'))?.count ?? applications.filter(a => a.stage === 'Joined').length;

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Recruitment Dashboard <span className="text-xs font-medium text-gray-400 font-normal">(Recruiter / HR)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time pipeline metrics, upcoming candidate interviews, and operational shortcuts.
          </p>
        </div>
      </div>

      {/* ── 1. Top Metrics Grid (4 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Applicants</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">
              {isLoading ? '—' : totalApplicantsCount.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs font-medium text-emerald-600">
            <span className="inline-block mr-1">↑</span> 12.5% vs last month
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Interviews This Week</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">
              {isLoading ? '—' : interviewsCount}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs font-medium text-emerald-600">
            <span className="inline-block mr-1">↓</span> 8.1% vs last week
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Offers Pending</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">
              {isLoading ? '—' : offersCount}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs font-medium text-emerald-600">
            <span className="inline-block mr-1">↑</span> 20% vs last month
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hired This Month</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">
              {isLoading ? '—' : hiredCount}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs font-medium text-emerald-600">
            <span className="inline-block mr-1">↑</span> 33% vs last month
          </div>
        </div>
      </div>

      {/* ── 2. Middle Row: Top Open Jobs | Pipeline Chart | Upcoming Interviews ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Top Open Jobs (3 cols) */}
        {/* Left Column: Top Open Jobs (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Top Open Jobs</h2>
            <button
              onClick={() => navigate('/vacancies')}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-gray-100 mt-1">
            {topJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/applications?vacancyId=${job.id}`)}
                className="py-3 flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 rounded-lg cursor-pointer transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${job.colorClass}`}>
                    <Icon name="briefcase" size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{job.title}</p>
                    <p className="text-xs text-gray-500 font-medium">{job.applicantsCount} applicants</p>
                  </div>
                </div>
                <Icon name="chevron-right" size={15} className="text-gray-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Center Column: Hiring Pipeline Overview (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-900">Hiring Pipeline Overview</h2>
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1"><strong className="text-gray-900">128</strong> New</span>
              <span className="flex items-center gap-1"><strong className="text-gray-900">214</strong> Screened</span>
              <span className="flex items-center gap-1"><strong className="text-gray-900">96</strong> Interview</span>
              <span className="flex items-center gap-1"><strong className="text-gray-900">24</strong> Offer</span>
              <span className="flex items-center gap-1"><strong className="text-gray-900">18</strong> Hired</span>
            </div>
          </div>

          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockPipelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pipelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="stage"
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="applicants"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#2563eb' }}
                  fillOpacity={1}
                  fill="url(#pipelineGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Upcoming Interviews (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Upcoming Interviews</h2>
            <button
              onClick={() => navigate('/interviews')}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              View calendar
            </button>
          </div>
          <div className="divide-y divide-gray-100 mt-1">
            {upcomingInterviews.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('/interviews')}
                className="py-2.5 flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg cursor-pointer transition"
              >
                <div className={`w-8 h-8 rounded-full ${item.avatarColor} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                  {item.candidateName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.candidateName}</p>
                  <p className="text-xs text-gray-500 truncate font-medium">{item.timeStr}</p>
                </div>
                <Icon name="chevron-right" size={14} className="text-gray-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Row: Quick Actions ── */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => navigate('/vacancies')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-xs transition group cursor-pointer shadow-2xs"
          >
            <div className="w-10 h-10 rounded-full border border-blue-200 text-blue-600 bg-blue-50 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition">
              <Icon name="plus" size={18} />
            </div>
            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600">Post New Job</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/candidates')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-xs transition group cursor-pointer shadow-2xs"
          >
            <div className="w-10 h-10 rounded-full border border-blue-200 text-blue-600 bg-blue-50 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition">
              <Icon name="users" size={18} />
            </div>
            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600">Add Candidate</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/import')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-xs transition group cursor-pointer shadow-2xs"
          >
            <div className="w-10 h-10 rounded-full border border-blue-200 text-blue-600 bg-blue-50 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition">
              <Icon name="upload" size={18} />
            </div>
            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600">Import Candidates</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/cv-bank')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-xs transition group cursor-pointer shadow-2xs"
          >
            <div className="w-10 h-10 rounded-full border border-blue-200 text-blue-600 bg-blue-50 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition">
              <Icon name="search" size={18} />
            </div>
            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600">Advanced Search</span>
          </button>
        </div>
      </div>
    </div>
  );
}
