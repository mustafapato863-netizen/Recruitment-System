import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { Icon } from '../components/Icon';

const progressOverTimeData = [
  { month: "Jan '24", actual: 18, plan: 25, forecast: 25 },
  { month: "Feb '24", actual: 36, plan: 50, forecast: 50 },
  { month: "Mar '24", actual: 58, plan: 80, forecast: 80 },
  { month: "Apr '24", actual: 84, plan: 110, forecast: 110 },
  { month: "May '24", actual: 92, plan: 145, forecast: 145 },
  { month: "Jun '24", actual: null, plan: 180, forecast: 180 },
  { month: "Jul '24", actual: null, plan: 212, forecast: 212 },
  { month: "Aug '24", actual: null, plan: 240, forecast: 240 },
  { month: "Sep '24", actual: null, plan: 270, forecast: 270 },
  { month: "Oct '24", actual: null, plan: 295, forecast: 295 },
  { month: "Nov '24", actual: null, plan: 312, forecast: 312 },
];

const deptHeadcountData = [
  { dept: 'Nursing', actual: 78, plan: 120 },
  { dept: 'Pharmacy', actual: 18, plan: 28 },
  { dept: 'Radiology', actual: 14, plan: 30 },
  { dept: 'IT', actual: 11, plan: 25 },
  { dept: 'Finance', actual: 9, plan: 18 },
  { dept: 'Human Res.', actual: 6, plan: 12 },
  { dept: 'Operations', actual: 16, plan: 24 },
];

export function ReportsPage() {
  const [department, setDepartment] = useState('ALL');
  const [recruiter, setRecruiter] = useState('ALL');
  const [location, setLocation] = useState('ALL');

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Top Filters Bar (Panel 22) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase">Department</span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-8 px-2 text-xs font-semibold bg-transparent border-0 text-gray-900 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              <option value="Nursing">Nursing</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Radiology">Radiology</option>
              <option value="IT">Information Technology</option>
            </select>
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase">Recruiter</span>
            <select
              value={recruiter}
              onChange={(e) => setRecruiter(e.target.value)}
              className="h-8 px-2 text-xs font-semibold bg-transparent border-0 text-gray-900 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Recruiters</option>
              <option value="Omar">Omar Hassan</option>
              <option value="Sarah">Sarah Ahmed</option>
            </select>
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase">Location</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-8 px-2 text-xs font-semibold bg-transparent border-0 text-gray-900 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Locations</option>
              <option value="Riyadh">Riyadh, Saudi Arabia</option>
              <option value="Jeddah">Jeddah, Saudi Arabia</option>
            </select>
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase">Date Range</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 h-8 px-2">
              <Icon name="calendar" size={13} className="text-gray-400" />
              May 1 – May 31, 2024
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5">
            Clear Filters
          </button>
          <button className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition">
            <Icon name="download" size={13} /> Export
          </button>
        </div>
      </div>

      {/* ── 6 Top KPI Metrics (Panel 22) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Headcount Plan</span>
            <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="users" size={12} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-900 tnum">312</span>
            <span className="text-[11px] text-gray-400 block font-medium">Total Planned</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-600">▲ 12% vs last month</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Open Requisitions</span>
            <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="briefcase" size={12} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-900 tnum">46</span>
            <span className="text-[11px] text-gray-400 block font-medium">Open</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-600">▲ 9% vs last month</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Candidates in Pipeline</span>
            <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="pipeline" size={12} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-900 tnum">1,248</span>
            <span className="text-[11px] text-gray-400 block font-medium">Across all stages</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-600">▲ 13% vs last month</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Offers Accepted</span>
            <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="check-circle" size={12} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-900 tnum">28</span>
            <span className="text-[11px] text-gray-400 block font-medium">This month</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-600">▲ 27% vs last month</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Time to Fill</span>
            <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="clock" size={12} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-900 tnum">32</span>
            <span className="text-[11px] text-gray-400 block font-medium">Days (avg.)</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-600">▼ 5 days vs last month</div>
        </div>

        {/* Circular gauge: Hiring Goal Progress */}
        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 block">Hiring Goal Progress</span>
            <span className="text-xl font-bold text-gray-900 mt-1 block tnum">212 / 312</span>
            <span className="text-[10px] text-gray-400 block">Hires YTD vs Plan</span>
            <span className="text-[11px] font-bold text-emerald-600 mt-0.5 block">▲ 14% vs last month</span>
          </div>

          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-gray-100" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-blue-600" strokeDasharray="68, 100" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span className="absolute font-bold text-xs text-gray-900 tnum">68%</span>
          </div>
        </div>
      </div>

      {/* ── Middle Row: Funnel Overview | Progress Line Chart | Priority Roles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Recruitment Pipeline Funnel (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <h2 className="text-xs font-bold text-gray-900 mb-3">Recruitment Pipeline Overview <span className="text-gray-400 font-normal">(All Open Requisitions)</span></h2>

          <div className="grid grid-cols-5 gap-1 text-center py-2 bg-gray-50/80 rounded-lg border border-gray-100 mb-3">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Applied</span>
              <span className="text-xs font-bold text-gray-900 tnum">3,842</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Screened</span>
              <span className="text-xs font-bold text-gray-900 tnum">1,926</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Interview</span>
              <span className="text-xs font-bold text-gray-900 tnum">642</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Offer</span>
              <span className="text-xs font-bold text-gray-900 tnum">128</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Hired</span>
              <span className="text-xs font-bold text-gray-900 tnum">92</span>
            </div>
          </div>

          {/* Stepped Conversion bars */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>Applied → Screened: <strong className="text-gray-900">50.1%</strong></span>
              <span className="text-rose-600 font-semibold">▼ 1,916</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full" style={{ width: '50.1%' }} />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>Screened → Interview: <strong className="text-gray-900">33.3%</strong></span>
              <span className="text-rose-600 font-semibold">▼ 1,284</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: '33.3%' }} />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>Interview → Offer: <strong className="text-gray-900">19.9%</strong></span>
              <span className="text-rose-600 font-semibold">▼ 514</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full" style={{ width: '19.9%' }} />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>Offer → Hired: <strong className="text-gray-900">71.9%</strong></span>
              <span className="text-rose-600 font-semibold">▼ 36</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '71.9%' }} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-gray-500">Overall Conversion Rate: <strong className="text-gray-900">2.40%</strong></span>
            <span className="text-emerald-600">▲ 0.28 pp vs last month</span>
          </div>
        </div>

        {/* Center: Hiring Progress Over Time (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-900">Hiring Progress Over Time</h2>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-blue-600" /> Hired (Actual)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-blue-400 border-b border-dashed" /> Plan</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-emerald-500" /> Forecast</span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressOverTimeData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} />
                <Line type="monotone" dataKey="plan" stroke="#93c5fd" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeDasharray="2 2" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Priority Roles (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
            <h2 className="text-xs font-bold text-gray-900">Priority Roles</h2>
            <button className="text-[11px] text-blue-600 font-semibold hover:underline">View all roles &gt;</button>
          </div>
          <div className="divide-y divide-gray-100 text-xs">
            {[
              { title: 'Registered Nurse', plan: 45, pipe: 96, priority: 'High', color: 'bg-rose-50 text-rose-700' },
              { title: 'Radiology Technician', plan: 25, pipe: 48, priority: 'High', color: 'bg-rose-50 text-rose-700' },
              { title: 'Pharmacist', plan: 12, pipe: 22, priority: 'Medium', color: 'bg-amber-50 text-amber-700' },
              { title: 'IT Support Specialist', plan: 15, pipe: 28, priority: 'Medium', color: 'bg-amber-50 text-amber-700' },
              { title: 'Medical Coder', plan: 10, pipe: 18, priority: 'Medium', color: 'bg-amber-50 text-amber-700' },
            ].map((role, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-900">{role.title}</h4>
                  <p className="text-[11px] text-gray-400">Plan: {role.plan} • Pipeline: {role.pipe}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role.color}`}>
                  {role.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Plan vs Actual Headcount by Department ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Department Hiring Table (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <h2 className="text-xs font-bold text-gray-900 mb-3">Hiring Plan by Department / Role</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 border-b border-gray-100 text-[11px]">
                <tr>
                  <th className="pb-2">Department</th>
                  <th className="pb-2 text-right">Plan</th>
                  <th className="pb-2 text-right">In Pipe</th>
                  <th className="pb-2 text-right">Hired</th>
                  <th className="pb-2">Plan vs Actual</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { dept: 'Nursing', plan: 120, pipe: 612, hired: 78, pct: 65, status: 'On Track' },
                  { dept: 'Pharmacy', plan: 28, pipe: 112, hired: 18, pct: 64, status: 'On Track' },
                  { dept: 'Radiology', plan: 30, pipe: 86, hired: 14, pct: 47, status: 'At Risk' },
                  { dept: 'Information Tech', plan: 25, pipe: 98, hired: 11, pct: 44, status: 'At Risk' },
                  { dept: 'Finance', plan: 18, pipe: 42, hired: 9, pct: 50, status: 'On Track' },
                ].map((row, i) => (
                  <tr key={i} className="py-2">
                    <td className="py-2 font-bold text-gray-900">{row.dept}</td>
                    <td className="py-2 text-right text-gray-600 tnum">{row.plan}</td>
                    <td className="py-2 text-right text-gray-600 tnum">{row.pipe}</td>
                    <td className="py-2 text-right font-bold text-gray-900 tnum">{row.hired}</td>
                    <td className="py-2 w-28">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-700">{row.pct}%</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.pct >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.status === 'On Track' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Headcount Bar Chart Comparison (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-900">Plan vs Actual Headcount</h2>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> Plan</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Actual (YTD)</span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptHeadcountData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="dept" tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="plan" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
