import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    jobTitle: 'Registered Nurse',
    department: 'Nursing',
    status: 'Interview',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-100',
    dateApplied: 'May 12, 2024',
    nextStep: 'Interview on May 19',
  },
  {
    id: '2',
    jobTitle: 'Radiology Technician',
    department: 'Radiology',
    status: 'Screening',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dateApplied: 'May 10, 2024',
    nextStep: 'Under Review',
  },
  {
    id: '3',
    jobTitle: 'Pharmacist',
    department: 'Pharmacy',
    status: 'Interview',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-100',
    dateApplied: 'May 8, 2024',
    nextStep: 'Interview on May 16',
  },
  {
    id: '4',
    jobTitle: 'IT Support Specialist',
    department: 'IT',
    status: 'Screening',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dateApplied: 'May 5, 2024',
    nextStep: 'Under Review',
  },
  {
    id: '5',
    jobTitle: 'Medical Coder',
    department: 'Health Info',
    status: 'Offer',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-100',
    dateApplied: 'Apr 30, 2024',
    nextStep: 'Offer in Progress',
  },
];

export function ApplicantPortalPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'All' | 'In Progress' | 'Interview' | 'Offer' | 'Hired' | 'Not Selected'>('All');

  const filteredApps = mockApplicantApplications.filter((app) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'In Progress' && (app.status === 'Screening' || app.status === 'Under Review')) return true;
    if (activeTab === 'Interview' && app.status === 'Interview') return true;
    if (activeTab === 'Offer' && app.status === 'Offer') return true;
    return true;
  });

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Page Header (Screen 3) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            My Applications <span className="text-xs font-medium text-gray-400 font-normal">(Applicant Portal)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track your job application statuses, upcoming interview appointments, and formal employment offers.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/careers')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Explore Open Jobs
          </button>
        </div>
      </div>

      {/* ── 4 Top Metrics (Screen 3) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Applications</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">8</span>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">In Progress</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">5</span>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Interview Scheduled</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">2</span>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Offers</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">1</span>
        </div>
      </div>

      {/* ── Tabs & Applications Table (Screen 3) ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-3.5 border-b border-gray-100 bg-gray-50/50 flex-wrap">
          {(['All', 'In Progress', 'Interview', 'Offer', 'Hired', 'Not Selected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === tab ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold">
              <tr>
                <th className="p-3.5">Job Title</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Date Applied</th>
                <th className="p-3.5">Next Step</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50/70 transition">
                  <td className="p-3.5 font-bold text-gray-900">{app.jobTitle}</td>
                  <td className="p-3.5 text-gray-700">{app.department}</td>
                  <td className="p-3.5">
                    <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${app.statusColor}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-gray-600">{app.dateApplied}</td>
                  <td className="p-3.5 text-gray-700 font-semibold">{app.nextStep}</td>
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => navigate('/portal/profile')}
                      className="px-3 py-1 bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 rounded text-xs font-bold transition cursor-pointer"
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

      {/* ── Bottom Banner (Screen 3) ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold text-blue-950">Keep your profile updated</h3>
          <p className="text-xs text-blue-700 mt-0.5">
            Update your profile and latest CV to increase your chances with hiring managers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/portal/profile')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs transition cursor-pointer"
        >
          Update Profile
        </button>
      </div>
    </div>
  );
}
