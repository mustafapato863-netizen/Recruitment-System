import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

interface ApplicantApplication {
  id: string;
  jobTitle: string;
  department: string;
  status: 'Interview' | 'Screening' | 'Offer' | 'Under Review';
  statusColor: string;
  dateApplied: string;
  nextStep: string;
}

const mockApplicantApplications: ApplicantApplication[] = [
  {
    id: '1',
    jobTitle: 'Registered Nurse (ICU)',
    department: 'Critical Care & Nursing',
    status: 'Interview',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
    dateApplied: 'May 12, 2026',
    nextStep: 'Interview on May 19 with Head of Nursing',
  },
  {
    id: '2',
    jobTitle: 'Senior Radiology Technician',
    department: 'Diagnostic Imaging',
    status: 'Screening',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
    dateApplied: 'May 10, 2026',
    nextStep: 'Application Under Initial Review',
  },
  {
    id: '3',
    jobTitle: 'Clinical Pharmacist',
    department: 'Hospital Pharmacy',
    status: 'Interview',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
    dateApplied: 'May 8, 2026',
    nextStep: 'Panel Interview on May 16',
  },
  {
    id: '4',
    jobTitle: 'IT Systems Specialist',
    department: 'Information Technology',
    status: 'Screening',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
    dateApplied: 'May 5, 2026',
    nextStep: 'Technical Assessment Review',
  },
  {
    id: '5',
    jobTitle: 'Medical Coder & Auditor',
    department: 'Health Informatics',
    status: 'Offer',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900',
    dateApplied: 'Apr 30, 2026',
    nextStep: 'Formal Offer Letter in Final Approval',
  },
];

export function ApplicantPortalPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'All' | 'In Progress' | 'Interview' | 'Offer'>('All');

  const filteredApps = mockApplicantApplications.filter((app) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'In Progress' && (app.status === 'Screening' || app.status === 'Under Review')) return true;
    if (activeTab === 'Interview' && app.status === 'Interview') return true;
    if (activeTab === 'Offer' && app.status === 'Offer') return true;
    return true;
  });

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Candidate Portal</span>
            <span>&bull;</span>
            <span className="text-blue-600 dark:text-blue-400">Application Tracker</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            My Applications
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track your Saudi German Health job applications, scheduled interview appointments, and formal employment offers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/careers/sgh/jobs')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer shadow-blue-500/20 flex items-center gap-1.5"
          >
            <Icon name="search" size={14} />
            <span>Explore Open Vacancies</span>
          </button>
        </div>
      </div>

      {/* ── 4 Top Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Applications</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">5</span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 block">Active submissions</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">In Screening</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">2</span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 block">Review by hiring team</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Interview Scheduled</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">2</span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 block">Upcoming rounds</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Offers</span>
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">1</span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 block">Awaiting sign-off</span>
        </div>
      </div>

      {/* ── Applications Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex-wrap">
          {(['All', 'In Progress', 'Interview', 'Offer'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold text-[11px]">
              <tr>
                <th className="p-3.5 pl-4">Job Vacancy</th>
                <th className="p-3.5">Hospital Department</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Submission Date</th>
                <th className="p-3.5">Next Step</th>
                <th className="p-3.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <td className="p-3.5 pl-4 font-bold text-slate-900 dark:text-white">{app.jobTitle}</td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-300">{app.department}</td>
                  <td className="p-3.5">
                    <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${app.statusColor}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400">{app.dateApplied}</td>
                  <td className="p-3.5 text-slate-700 dark:text-slate-200 font-semibold">{app.nextStep}</td>
                  <td className="p-3.5 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Banner ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200">Keep your clinical credentials updated</h3>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            Update your medical licenses (SCFHS, DHA, MOH) and latest CV to increase your chances with department heads.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition cursor-pointer shadow-blue-500/20"
        >
          Update Candidate Profile
        </button>
      </div>
    </div>
  );
}

export default ApplicantPortalPage;
