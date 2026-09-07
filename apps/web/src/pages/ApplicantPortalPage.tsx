import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageFrame } from '../components/ui/PageFrame';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Toast } from '../components/ui/Toast';
import './PageEnhancementsV2.css';

export interface ApplicantApplication {
  id: string;
  appCode: string;
  jobTitle: string;
  department: string;
  branch: string;
  status: 'Interview' | 'Screening' | 'Offer' | 'Under Review';
  statusColor: string;
  statusBadgeBg: string;
  dateApplied: string;
  nextStep: string;
  stageProgressIndex: number; // 0: Applied, 1: Screening, 2: Interview, 3: Offer, 4: Joined
  interviewDetails?: {
    date: string;
    time: string;
    format: string;
    panel: string;
    location: string;
    joinUrl?: string;
  };
  offerDetails?: {
    packageSummary: string;
    issueDate: string;
    expiryDate: string;
    statusText: string;
  };
  recruiter: {
    name: string;
    title: string;
    email: string;
  };
  documents: Array<{
    name: string;
    size: string;
    type: string;
  }>;
  timeline: Array<{
    stage: string;
    date: string;
    description: string;
    completed: boolean;
    current?: boolean;
  }>;
}

const mockApplicantApplications: ApplicantApplication[] = [
  {
    id: '1',
    appCode: 'APP-2026-0842',
    jobTitle: 'Registered Nurse (ICU)',
    department: 'Critical Care & Nursing',
    branch: 'Saudi German Hospital Riyadh',
    status: 'Interview',
    statusColor: 'text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80',
    statusBadgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    dateApplied: 'May 12, 2026',
    nextStep: 'Interview on May 19 with Head of Nursing',
    stageProgressIndex: 2,
    interviewDetails: {
      date: 'Tuesday, May 19, 2026',
      time: '10:30 AM - 11:15 AM (AST)',
      format: 'Clinical Panel Interview • Video Conference',
      panel: 'Dr. Fatima Al-Zahrani (Head of Nursing) & Dr. Khalid Mansoor',
      location: 'SGH Riyadh - Executive Tower / MS Teams Conference',
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-interview-842',
    },
    recruiter: {
      name: 'Sarah Al-Ghamdi',
      title: 'Senior Clinical Talent Partner',
      email: 'sarah.ghamdi@sghgroup.com',
    },
    documents: [
      { name: 'Curriculum_Vitae_Updated_2026.pdf', size: '1.4 MB', type: 'PDF' },
      { name: 'SCFHS_Nursing_Specialist_License.pdf', size: '820 KB', type: 'PDF' },
      { name: 'BLS_ACLS_Certification_Card.pdf', size: '540 KB', type: 'PDF' },
    ],
    timeline: [
      { stage: 'Application Submitted', date: 'May 12, 2026', description: 'Application received and confirmed via SGH Career Portal', completed: true },
      { stage: 'Clinical Screening', date: 'May 14, 2026', description: 'SCFHS nursing license and ICU experience validated by Talent Acquisition', completed: true },
      { stage: 'Department Interview', date: 'May 19, 2026', description: 'Panel interview scheduled with Head of Critical Care Nursing', completed: false, current: true },
      { stage: 'Formal Offer', date: 'Upcoming', description: 'Compensation package and formal letter approval', completed: false },
      { stage: 'Onboarding & Joining', date: 'Upcoming', description: 'Hospital credentialing, badging, and orientation', completed: false },
    ],
  },
  {
    id: '2',
    appCode: 'APP-2026-0791',
    jobTitle: 'Senior Radiology Technician',
    department: 'Diagnostic Imaging',
    branch: 'Saudi German Hospital Jeddah',
    status: 'Screening',
    statusColor: 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
    statusBadgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    dateApplied: 'May 10, 2026',
    nextStep: 'Application Under Initial Review',
    stageProgressIndex: 1,
    recruiter: {
      name: 'Dr. Tariq Al-Mansoor',
      title: 'Allied Health Recruitment Lead',
      email: 'tariq.mansoor@sghgroup.com',
    },
    documents: [
      { name: 'Radiology_Tech_Resume.pdf', size: '1.1 MB', type: 'PDF' },
      { name: 'MRI_CT_Technologist_License.pdf', size: '940 KB', type: 'PDF' },
    ],
    timeline: [
      { stage: 'Application Submitted', date: 'May 10, 2026', description: 'Application registered for Diagnostic Imaging requisitions', completed: true },
      { stage: 'Credentials Review', date: 'May 13, 2026', description: 'Under technical review with Chief Radiologist (Estimated completion in 48h)', completed: false, current: true },
      { stage: 'Technical Assessment', date: 'Pending', description: 'Diagnostic imaging protocols and safety checklist', completed: false },
      { stage: 'Final Interview', date: 'Pending', description: 'Hospital department head interview', completed: false },
    ],
  },
  {
    id: '3',
    appCode: 'APP-2026-0745',
    jobTitle: 'Clinical Pharmacist',
    department: 'Hospital Pharmacy',
    branch: 'Saudi German Hospital Ajman',
    status: 'Interview',
    statusColor: 'text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80',
    statusBadgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    dateApplied: 'May 8, 2026',
    nextStep: 'Panel Interview on May 16',
    stageProgressIndex: 2,
    interviewDetails: {
      date: 'Saturday, May 16, 2026',
      time: '02:00 PM - 02:45 PM (GST)',
      format: 'In-Person Department Assessment',
      panel: 'Dr. Youssef El-Husseini (Director of Inpatient Pharmacy)',
      location: 'SGH Ajman Hospital • Inpatient Pharmacy Dept Room 210',
    },
    recruiter: {
      name: 'Nouf Al-Otaibi',
      title: 'Clinical Recruitment Specialist',
      email: 'nouf.otaibi@sghgroup.com',
    },
    documents: [
      { name: 'PharmD_Clinical_Pharmacist_CV.pdf', size: '2.0 MB', type: 'PDF' },
      { name: 'MOH_UAE_Pharmacist_Evaluation.pdf', size: '1.2 MB', type: 'PDF' },
    ],
    timeline: [
      { stage: 'Application Submitted', date: 'May 8, 2026', description: 'Applied via SGH Careers UAE', completed: true },
      { stage: 'Clinical Screening', date: 'May 10, 2026', description: 'Pharmacotherapy credentials and clinical residency confirmed', completed: true },
      { stage: 'Panel Interview', date: 'May 16, 2026', description: 'Case study review and clinical pharmacy workflow assessment', completed: false, current: true },
      { stage: 'Offer Stage', date: 'Upcoming', description: 'Compensation package and license transfer review', completed: false },
    ],
  },
  {
    id: '4',
    appCode: 'APP-2026-0688',
    jobTitle: 'IT Systems Specialist',
    department: 'Information Technology',
    branch: 'Head Office - Riyadh',
    status: 'Screening',
    statusColor: 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
    statusBadgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    dateApplied: 'May 5, 2026',
    nextStep: 'Technical Assessment Review',
    stageProgressIndex: 1,
    recruiter: {
      name: 'Mohammed Al-Sulaiman',
      title: 'Corporate & Tech Talent Lead',
      email: 'mohammed.sulaiman@sghgroup.com',
    },
    documents: [
      { name: 'IT_Systems_Engineer_CV.pdf', size: '980 KB', type: 'PDF' },
      { name: 'AWS_Cisco_Certificates.pdf', size: '1.8 MB', type: 'PDF' },
    ],
    timeline: [
      { stage: 'Application Submitted', date: 'May 5, 2026', description: 'Application received for Health IT & Infrastructure', completed: true },
      { stage: 'Technical Screening', date: 'May 8, 2026', description: 'EHR/EMR experience and network certification validation', completed: false, current: true },
      { stage: 'Technical Interview', date: 'Pending', description: 'Hospital systems architecture assessment', completed: false },
    ],
  },
  {
    id: '5',
    appCode: 'APP-2026-0612',
    jobTitle: 'Medical Coder & Auditor',
    department: 'Health Informatics & RCM',
    branch: 'Saudi German Hospital Dammam',
    status: 'Offer',
    statusColor: 'text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80',
    statusBadgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    dateApplied: 'Apr 30, 2026',
    nextStep: 'Formal Offer Letter in Final Approval',
    stageProgressIndex: 3,
    offerDetails: {
      packageSummary: 'Senior Medical Auditor • Grade 8 • Comprehensive Medical Insurance & Family Housing',
      issueDate: 'May 14, 2026',
      expiryDate: 'May 24, 2026 (10 days remaining)',
      statusText: 'Formal offer package generated • Awaiting candidate signature',
    },
    recruiter: {
      name: 'Sarah Al-Ghamdi',
      title: 'Senior Clinical Talent Partner',
      email: 'sarah.ghamdi@sghgroup.com',
    },
    documents: [
      { name: 'AAPC_CPC_Medical_Coder_CV.pdf', size: '1.3 MB', type: 'PDF' },
      { name: 'Certified_Professional_Coder_Credential.pdf', size: '750 KB', type: 'PDF' },
    ],
    timeline: [
      { stage: 'Application Submitted', date: 'Apr 30, 2026', description: 'Applied for RCM / Coding requisition', completed: true },
      { stage: 'Clinical Screening', date: 'May 3, 2026', description: 'ICD-10-AM and ACHI medical coding assessment score: 96%', completed: true },
      { stage: 'Interviews Completed', date: 'May 9, 2026', description: 'Interviewed with Revenue Cycle Director and CFO', completed: true },
      { stage: 'Formal Offer Issued', date: 'May 14, 2026', description: 'Official SGH employment offer contract ready for signature', completed: false, current: true },
      { stage: 'Joining Date', date: 'Scheduled Jun 15, 2026', description: 'Orientation and hospital system onboarding', completed: false },
    ],
  },
];

const STAGE_PIPELINE = ['Applied', 'Screening', 'Interview', 'Offer', 'Joined'];

export function ApplicantPortalPage() {
  const navigate = useNavigate();

  // Active filter tab & search query
  const [activeTab, setActiveTab] = useState<'All' | 'In Progress' | 'Interview' | 'Offer'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Selected application for detail drawer
  const [selectedApp, setSelectedApp] = useState<ApplicantApplication | null>(null);
  const [isStreamlinedStepView, setIsStreamlinedStepView] = useState(true);

  // Message Recruiter Modal state
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: mockApplicantApplications.length,
      inProgress: mockApplicantApplications.filter((a) => a.status === 'Screening' || a.status === 'Under Review').length,
      interview: mockApplicantApplications.filter((a) => a.status === 'Interview').length,
      offer: mockApplicantApplications.filter((a) => a.status === 'Offer').length,
    };
  }, []);

  const filteredApps = useMemo(() => {
    return mockApplicantApplications.filter((app) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          app.jobTitle.toLowerCase().includes(q) ||
          app.department.toLowerCase().includes(q) ||
          app.branch.toLowerCase().includes(q) ||
          app.appCode.toLowerCase().includes(q) ||
          app.nextStep.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (activeTab === 'All') return true;
      if (activeTab === 'In Progress' && (app.status === 'Screening' || app.status === 'Under Review')) return true;
      if (activeTab === 'Interview' && app.status === 'Interview') return true;
      if (activeTab === 'Offer' && app.status === 'Offer') return true;
      return true;
    });
  }, [activeTab, searchQuery]);

  const copyAppCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`✓ Application code copied: ${code}`);
    } catch {
      showToast(`Application code: ${code}`);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setIsSendingMessage(true);
    setTimeout(() => {
      setIsSendingMessage(false);
      setIsMessageModalOpen(false);
      setMessageText('');
      showToast('✓ Your inquiry has been dispatched directly to the Talent Acquisition team.');
    }, 600);
  };

  const downloadCalendarInvite = (app: ApplicantApplication) => {
    if (!app.interviewDetails) return;
    const title = `Interview with Saudi German Health - ${app.jobTitle}`;
    const desc = `${app.interviewDetails.format}\nPanel: ${app.interviewDetails.panel}\nLocation: ${app.interviewDetails.location}`;
    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Saudi German Health//RecruitFlow Portal//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${app.interviewDetails.location}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${app.appCode}-Interview.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Calendar event (.ics) downloaded');
  };

  return (
    <PageFrame
      eyebrow="Candidate Portal • Application Tracker"
      title="My Applications"
      description="Track your active Saudi German Health job applications, schedule interview appointments, and review formal employment offers."
      actions={
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <Icon name="list" size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Cards view"
              aria-label="Cards view"
            >
              <Icon name="grid-squares" size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/careers/sgh/jobs')}
            className="px-4 py-2 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <Icon name="search" size={14} />
            <span>Explore Open Vacancies</span>
          </button>
        </div>
      }
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
          <Toast tone="success" title={toastMessage} />
        </div>
      )}

      {/* ── 4 Top Interactive Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Applications */}
        <div
          onClick={() => setActiveTab('All')}
          className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 hover:shadow-md before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[#0084ce] before:to-[#00a3e0] ${
            activeTab === 'All'
              ? 'border-[#0084ce] dark:border-sky-500 ring-2 ring-sky-500/20'
              : 'border-slate-200/80 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Applications
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-[#0084ce] dark:text-sky-400 flex items-center justify-center">
              <Icon name="briefcase" size={13} />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-2 block leading-none">
            {counts.all}
          </span>
          <span className="text-[11px] text-[#0084ce] dark:text-sky-400 font-semibold mt-1.5 block">
            Active submissions across SGH
          </span>
        </div>

        {/* In Screening */}
        <div
          onClick={() => setActiveTab('In Progress')}
          className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 hover:shadow-md before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-emerald-400 before:to-[#00a859] ${
            activeTab === 'In Progress'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-slate-200/80 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              In Screening
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Icon name="users" size={13} />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 block leading-none">
            {counts.inProgress}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 block">
            Under hiring team review
          </span>
        </div>

        {/* Interview Scheduled */}
        <div
          onClick={() => setActiveTab('Interview')}
          className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 hover:shadow-md before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[#0084ce] before:to-blue-600 ${
            activeTab === 'Interview'
              ? 'border-blue-600 ring-2 ring-blue-500/20'
              : 'border-slate-200/80 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Interviews Scheduled
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Icon name="calendar" size={13} />
            </div>
          </div>
          <span className="text-2xl font-black text-blue-600 dark:text-sky-400 mt-2 block leading-none">
            {counts.interview}
          </span>
          <span className="text-[11px] text-blue-600 dark:text-sky-400 font-semibold mt-1.5 block">
            Upcoming rounds & panels
          </span>
        </div>

        {/* Active Offers */}
        <div
          onClick={() => setActiveTab('Offer')}
          className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 hover:shadow-md before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-purple-500 before:to-indigo-500 ${
            activeTab === 'Offer'
              ? 'border-purple-600 ring-2 ring-purple-500/20'
              : 'border-slate-200/80 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Active Offers
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Icon name="award" size={13} />
            </div>
          </div>
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 block leading-none">
            {counts.offer}
          </span>
          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1.5 block">
            Ready for candidate review
          </span>
        </div>
      </div>

      {/* ── Applications Container ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Tabs & Search Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('All')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'All'
                  ? 'bg-gradient-to-r from-[#0084ce] to-[#00a859] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'All' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('In Progress')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'In Progress'
                  ? 'bg-gradient-to-r from-[#0084ce] to-[#00a859] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>In Progress</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'In Progress' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {counts.inProgress}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('Interview')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'Interview'
                  ? 'bg-gradient-to-r from-[#0084ce] to-[#00a859] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>Interview</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'Interview' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {counts.interview}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('Offer')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'Offer'
                  ? 'bg-gradient-to-r from-[#0084ce] to-[#00a859] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>Offer</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'Offer' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {counts.offer}
              </span>
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job, branch, code..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-[#0084ce] focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* ── Table View Mode ── */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            {filteredApps.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                  <Icon name="inbox" size={24} />
                </div>
                <strong className="block font-bold text-slate-700 dark:text-slate-200 text-sm">
                  No matching applications
                </strong>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Try adjusting your search keywords or switch to the &quot;All&quot; filter to view all submissions.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 pl-5">Job Vacancy & Branch</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Submission Date</th>
                    <th className="p-3.5">Next Step</th>
                    <th className="p-3.5 pr-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredApps.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 pl-5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <strong className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                              {app.jobTitle}
                            </strong>
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                              [{app.appCode}]
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Icon name="building" size={11} className="text-slate-400" />
                            <span>{app.branch}</span>
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium">
                        {app.department}
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${app.statusBadgeBg} ${app.statusColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          <span>{app.status}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-500 dark:text-slate-400 font-medium">
                        {app.dateApplied}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                          {app.status === 'Interview' ? (
                            <Icon name="calendar" size={13} className="text-blue-500 shrink-0" />
                          ) : app.status === 'Offer' ? (
                            <Icon name="award" size={13} className="text-purple-500 shrink-0" />
                          ) : (
                            <Icon name="clock" size={13} className="text-slate-400 shrink-0" />
                          )}
                          <span className="truncate max-w-[220px]">{app.nextStep}</span>
                        </div>
                      </td>

                      <td className="p-3.5 pr-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApp(app);
                          }}
                          className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0084ce] dark:text-sky-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs inline-flex items-center gap-1"
                        >
                          <span>View Details</span>
                          <Icon name="arrow-right" size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* ── Cards View Mode ── */
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className="bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 hover:border-blue-400 dark:hover:border-slate-700 transition cursor-pointer shadow-2xs hover:shadow-md transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] text-slate-400 font-bold block">
                      {app.appCode}
                    </span>
                    <strong className="text-sm font-black text-slate-900 dark:text-white block mt-0.5">
                      {app.jobTitle}
                    </strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Icon name="building" size={11} />
                      <span>{app.branch}</span>
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${app.statusBadgeBg} ${app.statusColor}`}>
                    {app.status}
                  </span>
                </div>

                {/* Progress Mini Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                    <span>Stage: {STAGE_PIPELINE[app.stageProgressIndex]}</span>
                    <span>{app.stageProgressIndex + 1} of {STAGE_PIPELINE.length}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full"
                      style={{ width: `${((app.stageProgressIndex + 1) / STAGE_PIPELINE.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Upcoming Action
                  </span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-[11.5px]">
                    <Icon name="clock" size={12} className="text-blue-500 shrink-0" />
                    <span>{app.nextStep}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-400">
                  <span>Applied {app.dateApplied}</span>
                  <span className="text-blue-600 dark:text-sky-400 font-bold hover:underline">
                    Dossier Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Candidate Support & Credentials Banner ── */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-slate-900 dark:via-[#0c182a] dark:to-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0084ce] to-[#00a859] text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
            <Icon name="activity" size={22} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Keep your clinical licenses and CV up to date
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-xl">
              Saudi German Health clinical committees prioritize applicants with active SCFHS, DHA, or MOH registrations and verified board certifications.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            My Profile
          </button>
          <button
            type="button"
            onClick={() => setIsMessageModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <Icon name="chat" size={13} />
            <span>Contact Recruiter</span>
          </button>
        </div>
      </div>

      {/* ── Application Dossier Drawer (Slide-Over) ── */}
      {selectedApp && (
        <Drawer
          isOpen={Boolean(selectedApp)}
          onClose={() => setSelectedApp(null)}
          title={
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-base">
                {selectedApp.jobTitle}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${selectedApp.statusBadgeBg} ${selectedApp.statusColor}`}>
                {selectedApp.status}
              </span>
            </div>
          }
          subtitle={
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{selectedApp.branch}</span>
              <span>&bull;</span>
              <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {selectedApp.appCode}
              </span>
              <button
                type="button"
                onClick={() => void copyAppCode(selectedApp.appCode)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Copy reference code"
              >
                <Icon name="copy" size={11} />
              </button>
            </div>
          }
          width="standard"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsMessageModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20 flex items-center gap-1.5"
              >
                <Icon name="chat" size={13} />
                <span>Message Talent Partner</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
            {/* 1. Visual Stage Pipeline Stepper with Streamlined 3-Step toggle */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                  Current Pipeline Progress
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsStreamlinedStepView(!isStreamlinedStepView)}
                    className="text-[10px] font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    {isStreamlinedStepView ? 'Show Full 5 Stages' : 'Simplify to 3 Steps'}
                  </button>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-sky-400">
                    {isStreamlinedStepView
                      ? `Step ${(selectedApp.stageProgressIndex <= 1 ? 0 : selectedApp.stageProgressIndex === 2 ? 1 : 2) + 1} of 3`
                      : `Step ${selectedApp.stageProgressIndex + 1} of 5`}
                  </span>
                </div>
              </div>

              {isStreamlinedStepView ? (
                /* Streamlined 3-Step View */
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  {[
                    { label: 'Application & Screening', idx: 0, sub: 'Intake & qualification' },
                    { label: 'Clinical Evaluation', idx: 1, sub: 'Interviews & panels' },
                    { label: 'Offer & Onboarding', idx: 2, sub: 'Contract & joining' },
                  ].map((step) => {
                    const currentStreamlinedIdx =
                      selectedApp.stageProgressIndex <= 1 ? 0 : selectedApp.stageProgressIndex === 2 ? 1 : 2;
                    const isCompleted = step.idx < currentStreamlinedIdx;
                    const isCurrent = step.idx === currentStreamlinedIdx;

                    return (
                      <div key={step.label} className="space-y-1.5">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isCurrent
                              ? 'bg-blue-600 dark:bg-sky-500 animate-pulse'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                        <span
                          className={`block text-[11px] font-bold leading-tight ${
                            isCurrent
                              ? 'text-blue-600 dark:text-sky-400'
                              : isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="block text-[9.5px] text-slate-400 hidden sm:block">
                          {step.sub}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Detailed 5-Step View */
                <div className="grid grid-cols-5 gap-1 text-center pt-1">
                  {STAGE_PIPELINE.map((stageName, idx) => {
                    const isCompleted = idx < selectedApp.stageProgressIndex;
                    const isCurrent = idx === selectedApp.stageProgressIndex;

                    return (
                      <div key={stageName} className="space-y-1.5">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isCurrent
                              ? 'bg-blue-600 dark:bg-sky-500 animate-pulse'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                        <span
                          className={`block text-[10px] font-bold truncate ${
                            isCurrent
                              ? 'text-blue-600 dark:text-sky-400'
                              : isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {stageName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Stage Specific Highlight Card */}
            {selectedApp.interviewDetails && (
              <div className="bg-gradient-to-br from-blue-50/60 to-emerald-50/40 dark:from-blue-950/40 dark:to-emerald-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                      <Icon name="calendar" size={13} />
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                        Scheduled Clinical Interview
                      </strong>
                      <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Please be ready 10 minutes prior to session start
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadCalendarInvite(selectedApp)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-600 dark:text-sky-400 rounded-lg text-[10.5px] font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <Icon name="calendar" size={11} />
                    <span>Add to Calendar</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1 text-[11.5px]">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                    <Icon name="clock" size={13} className="text-blue-500 shrink-0" />
                    <span>{selectedApp.interviewDetails.date} &bull; {selectedApp.interviewDetails.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Icon name="users" size={13} className="text-slate-400 shrink-0" />
                    <span>Panel: {selectedApp.interviewDetails.panel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Icon name="map-pin" size={13} className="text-slate-400 shrink-0" />
                    <span>{selectedApp.interviewDetails.location}</span>
                  </div>
                </div>

                {selectedApp.interviewDetails.joinUrl && (
                  <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60 flex items-center justify-between">
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold">
                      Video Meeting URL:
                    </span>
                    <a
                      href={selectedApp.interviewDetails.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1"
                    >
                      <span>Join Meeting Link</span>
                      <Icon name="external-link" size={11} />
                    </a>
                  </div>
                )}
              </div>
            )}

            {selectedApp.offerDetails && (
              <div className="bg-gradient-to-br from-purple-50/60 to-indigo-50/40 dark:from-purple-950/40 dark:to-indigo-950/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/60 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                    <Icon name="award" size={13} />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                      Official Offer Package
                    </strong>
                    <span className="text-[10.5px] text-purple-700 dark:text-purple-300 font-semibold">
                      {selectedApp.offerDetails.expiryDate}
                    </span>
                  </div>
                </div>
                <p className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">
                  {selectedApp.offerDetails.packageSummary}
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => showToast('✓ Downloading full offer letter package (PDF)...')}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Icon name="download" size={13} />
                    <span>Download Offer Letter (PDF)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Submitted Clinical Documents */}
            <div className="space-y-2.5">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400 block">
                Submitted Application Documents
              </span>
              <div className="space-y-2">
                {selectedApp.documents.map((doc) => (
                  <div
                    key={doc.name}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Icon name="document" size={13} />
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {doc.name}
                        </strong>
                        <span className="text-[10px] text-slate-400">{doc.size} &bull; {doc.type}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => showToast(`✓ Previewing ${doc.name}`)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10.5px] font-bold transition cursor-pointer shrink-0"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Chronological Application Timeline */}
            <div className="space-y-2.5">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400 block">
                Activity & Status Milestones
              </span>
              <div className="space-y-3 pl-2 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
                {selectedApp.timeline.map((step) => (
                  <div key={step.stage} className="relative pl-4">
                    <span
                      className={`absolute -left-[17px] top-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                        step.completed
                          ? 'bg-emerald-500'
                          : step.current
                          ? 'bg-blue-600 dark:bg-sky-400 ring-2 ring-blue-400/40'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    />
                    <div>
                      <div className="flex items-center justify-between">
                        <strong className={`text-xs font-bold ${
                          step.current
                            ? 'text-blue-600 dark:text-sky-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {step.stage}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-medium">{step.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Assigned Recruiter Contact */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0084ce] text-white font-bold flex items-center justify-center text-xs">
                  {selectedApp.recruiter.name[0]}
                </div>
                <div>
                  <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                    {selectedApp.recruiter.name}
                  </strong>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    {selectedApp.recruiter.title}
                  </span>
                </div>
              </div>
              <a
                href={`mailto:${selectedApp.recruiter.email}`}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10.5px] font-bold transition"
              >
                Email
              </a>
            </div>
          </div>
        </Drawer>
      )}

      {/* ── Message Recruiter Modal ── */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title="Inquire with Talent Acquisition"
      >
        <form onSubmit={handleSendMessage} className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Send a direct note or question regarding your active application ({selectedApp?.jobTitle || 'Clinical Application'}).
            The assigned recruiter typically responds within 1 business day.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Your Message or Question
            </label>
            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="e.g. Inquiring about scheduling availability for next week's interview or clarifying license renewal documents..."
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0084ce] focus:outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsMessageModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSendingMessage || !messageText.trim()}
              className="px-4 py-2 bg-gradient-to-r from-[#0084ce] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSendingMessage ? 'Sending...' : 'Send Message to Team'}
            </button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}

export default ApplicantPortalPage;
