import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Vacancy } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

interface JobPublishItem {
  id: string;
  title: string;
  location: string;
  department: string;
  status: 'Published' | 'Scheduled' | 'Draft' | 'Unpublished';
  channels: ('site' | 'linkedin' | 'bayt' | 'indeed' | 'internal')[];
  publishedDate: string;
  views: number;
  applications: number;
}

const mockPublishJobs: JobPublishItem[] = [
  {
    id: '1',
    title: 'Registered Nurse',
    location: 'Riyadh, Saudi Arabia',
    department: 'Nursing',
    status: 'Published',
    channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
    publishedDate: 'May 7, 2024',
    views: 1284,
    applications: 36,
  },
  {
    id: '2',
    title: 'Radiology Technician',
    location: 'Jeddah, Saudi Arabia',
    department: 'Radiology',
    status: 'Published',
    channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
    publishedDate: 'May 5, 2024',
    views: 982,
    applications: 28,
  },
  {
    id: '3',
    title: 'Pharmacist',
    location: 'Riyadh, Saudi Arabia',
    department: 'Pharmacy',
    status: 'Published',
    channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
    publishedDate: 'May 3, 2024',
    views: 756,
    applications: 21,
  },
  {
    id: '4',
    title: 'IT Support Specialist',
    location: 'Riyadh, Saudi Arabia',
    department: 'IT',
    status: 'Published',
    channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
    publishedDate: 'Apr 30, 2024',
    views: 642,
    applications: 18,
  },
  {
    id: '5',
    title: 'Medical Coder',
    location: 'Riyadh, Saudi Arabia',
    department: 'Health Info',
    status: 'Scheduled',
    channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
    publishedDate: 'May 15, 2024 9:00 AM',
    views: 0,
    applications: 0,
  },
  {
    id: '6',
    title: 'HR Specialist',
    location: 'Riyadh, Saudi Arabia',
    department: 'Human Resources',
    status: 'Draft',
    channels: [],
    publishedDate: '—',
    views: 0,
    applications: 0,
  },
  {
    id: '7',
    title: 'Talent Acquisition Specialist',
    location: 'Riyadh, Saudi Arabia',
    department: 'Human Resources',
    status: 'Published',
    channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
    publishedDate: 'Apr 28, 2024',
    views: 512,
    applications: 14,
  },
  {
    id: '8',
    title: 'Senior Accountant',
    location: 'Jeddah, Saudi Arabia',
    department: 'Finance',
    status: 'Unpublished',
    channels: [],
    publishedDate: '—',
    views: 0,
    applications: 0,
  },
];

export function VacantListPage() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedId, setSelectedId] = useState<string>('1');
  const [activeTab, setActiveTab] = useState<'All Jobs' | 'Published' | 'Scheduled' | 'Drafts' | 'Unpublished'>('All Jobs');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getApi<Vacancy[]>('/vacancies');
        if (res && res.length > 0) setVacancies(res);
      } catch (err) {
        console.error('Failed to load vacancies', err);
      }
    }
    void loadData();
  }, []);

  const items: JobPublishItem[] = vacancies.length > 0
    ? vacancies.map((v, i) => ({
        id: v.id,
        title: v.position?.title ?? v.vacancyCode,
        location: v.location || 'Riyadh, Saudi Arabia',
        department: v.position?.title?.split(' ')?.[0] || 'General',
        status: (v.status === 'Open' ? 'Published' : v.status === 'Pending Activation' ? 'Draft' : 'Unpublished') as JobPublishItem['status'],
        channels: ['site', 'linkedin', 'bayt', 'indeed', 'internal'],
        publishedDate: 'May 7, 2024',
        views: 800 + i * 120,
        applications: 20 + i * 5,
      }))
    : mockPublishJobs;

  const filteredJobs = useMemo(() => {
    return items.filter((job) => {
      if (activeTab === 'Published' && job.status !== 'Published') return false;
      if (activeTab === 'Scheduled' && job.status !== 'Scheduled') return false;
      if (activeTab === 'Drafts' && job.status !== 'Draft') return false;
      if (activeTab === 'Unpublished' && job.status !== 'Unpublished') return false;
      if (filterDept !== 'ALL' && !job.department.toLowerCase().includes(filterDept.toLowerCase())) return false;
      if (search && !job.title.toLowerCase().includes(search.toLowerCase()) && !job.location.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, activeTab, filterDept, search]);

  const selectedJob = items.find((j) => j.id === selectedId) || items[0] || mockPublishJobs[0];

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Top Header & Title ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Career Site / Job Publishing Management <span className="text-xs font-medium text-gray-400 font-normal">(HR / Admin / Recruiter)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Multi-channel job board syndication, SEO parameters, and live career portal previews.
          </p>
        </div>
      </div>

      {/* ── Top Metrics (Panel 21) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Published Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="globe" size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">84</span>
          </div>
          <div className="mt-1 flex items-center text-xs font-medium text-emerald-600">
            <span>↑ 12% vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Scheduled Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="calendar" size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">15</span>
          </div>
          <div className="mt-1 flex items-center text-xs font-medium text-emerald-600">
            <span>↑ 25% vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Channel Reach</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="activity" size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">1,248,560</span>
          </div>
          <div className="mt-1 flex items-center text-xs font-medium text-emerald-600">
            <span>↑ 18% vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Drafts</span>
            <div className="w-7 h-7 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center">
              <Icon name="file-text" size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 tnum">26</span>
          </div>
          <div className="mt-1 flex items-center text-xs font-medium text-rose-600">
            <span>↓ 8% vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 block">Top Channel by Applications</span>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
              in
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900 block">LinkedIn</span>
              <span className="text-[11px] text-gray-500">512 applications</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(['All Jobs', 'Published', 'Scheduled', 'Drafts', 'Unpublished'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filters & Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs by title, department, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 w-64 shadow-2xs"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="h-9 px-3 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-600 shadow-2xs font-semibold"
          >
            <option value="ALL">All Departments</option>
            <option value="Nursing">Nursing</option>
            <option value="Radiology">Radiology</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="IT">IT</option>
          </select>

          <button
            type="button"
            onClick={() => navigate('/vacancy-requests/create')}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Icon name="plus" size={14} /> Publish Job
          </button>
        </div>
      </div>

      {/* ── Main Split: Jobs Table (Left) + Career Site Live Preview (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Jobs Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-8"><input type="checkbox" className="rounded" /></th>
                  <th className="p-3.5">Job Title & Location</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Channels</th>
                  <th className="p-3.5">Published Date</th>
                  <th className="p-3.5 text-right">Views</th>
                  <th className="p-3.5 text-right">Applicants</th>
                  <th className="p-3.5 text-center">Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredJobs.map((job) => {
                  const isSelected = job.id === selectedId;
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedId(job.id)}
                      className={`hover:bg-gray-50/80 transition cursor-pointer ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded" />
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900 text-sm leading-snug">{job.title}</div>
                        <div className="text-xs text-gray-500 font-medium mt-0.5">{job.location}</div>
                      </td>
                      <td className="p-3.5 text-gray-700 font-medium text-sm">{job.department}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            job.status === 'Published'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : job.status === 'Scheduled'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : job.status === 'Draft'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          {job.channels.length > 0 ? (
                            <>
                              <span title="Career Site" className="text-blue-600 font-bold">💻</span>
                              <span title="LinkedIn" className="text-blue-700 font-bold text-xs">in</span>
                              <span title="Bayt" className="text-cyan-600 font-bold text-xs">b</span>
                              <span title="Indeed" className="text-blue-600 font-bold text-xs">i</span>
                              <span title="Internal" className="text-indigo-600 font-bold text-xs">🏢</span>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-gray-600 text-xs font-medium">{job.publishedDate}</td>
                      <td className="p-3.5 text-right font-semibold text-gray-800 text-sm tnum">{job.views.toLocaleString()}</td>
                      <td className="p-3.5 text-right font-extrabold text-blue-600 text-sm tnum">{job.applications}</td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/applications?vacancyId=${job.id}`)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-transparent rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Icon name="users" size={12} />
                          Pipeline
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <span>Showing 1 to {filteredJobs.length} of {items.length} results</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">&lt;</button>
              <button className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold">1</button>
              <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">&gt;</button>
            </div>
          </div>
        </div>

        {/* Right: Selected Job & Quick Pipeline Action (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <span className="text-xs text-gray-500 block font-semibold uppercase tracking-wider">Selected Position</span>
              <h3 className="text-base font-bold text-gray-900 mt-0.5">{selectedJob.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selectedJob.location}</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
              {selectedJob.status}
            </span>
          </div>

          {/* Odoo-style Recruiter Quick Action Ribbon */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate(`/applications?vacancyId=${selectedJob.id}`)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Icon name="users" size={16} />
              Open Applicants Pipeline ({selectedJob.applications})
            </button>
            <button
              type="button"
              onClick={() => navigate(`/vacancies/${selectedJob.id}`)}
              className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Icon name="briefcase" size={14} />
              Requisition Details & Funnel
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Career Site Portal Card</span>
              <button
                type="button"
                onClick={() => navigate(`/careers/default/jobs/${selectedJob.id}`)}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                Public View &gt;
              </button>
            </div>

            {/* Career Portal Card */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-2xs">
              <div className="bg-slate-900 text-white p-4">
                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Active Hiring</span>
                <h4 className="text-base font-bold mt-1">{selectedJob.title}</h4>
                <p className="text-xs text-gray-300 mt-0.5">{selectedJob.location} • Full-time</p>
                <button
                  type="button"
                  onClick={() => navigate(`/careers/default/jobs/${selectedJob.id}/apply`)}
                  className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Apply Now
                </button>
              </div>
              <div className="p-3.5 text-xs text-gray-600 space-y-2">
                <p><strong>About the Role:</strong> Actively recruiting qualified candidates for this position...</p>
                <button
                  type="button"
                  onClick={() => navigate(`/careers/default/jobs/${selectedJob.id}`)}
                  className="text-blue-600 font-bold text-xs hover:underline"
                >
                  View full job details →
                </button>
              </div>
            </div>
          </div>

          {/* Publishing Details Form */}
          <div className="space-y-3 pt-3 border-t border-gray-100 text-xs">
            <h4 className="font-bold text-gray-900 text-sm">Publishing Metadata</h4>
            <div>
              <span className="text-gray-500 text-xs font-medium block">Job Slug / URL</span>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  readOnly
                  value={`/careers/jobs/${selectedJob.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-700"
                />
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-xs font-medium block">Meta Title</span>
              <input
                readOnly
                value={`${selectedJob.title} - ${selectedJob.location}`}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
