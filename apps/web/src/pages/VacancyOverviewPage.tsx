import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { VacancyDetailView, Application, PaginatedResult, Interview, Offer } from '@recruitflow/contracts';
import { fetchApi, getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export function VacancyOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<VacancyDetailView | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'pipeline' | 'interviews' | 'posting' | 'activity' | 'settings'>('overview');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.allSettled([
      fetchApi<VacancyDetailView>(`/vacancies/${id}`),
      getApi<PaginatedResult<Application>>(`/applications?vacancyId=${id}&pageSize=100`),
      getApi<Interview[]>('/interviews'),
      getApi<Offer[]>('/offers'),
    ])
      .then(([vRes, appsRes, intsRes, offsRes]) => {
        if (vRes.status === 'fulfilled' && vRes.value) {
          setVacancy(vRes.value);
        }
        if (appsRes.status === 'fulfilled' && appsRes.value?.data) {
          setApplications(appsRes.value.data);
        }
        if (intsRes.status === 'fulfilled' && intsRes.value) {
          setInterviews(intsRes.value);
        }
        if (offsRes.status === 'fulfilled' && offsRes.value) {
          setOffers(offsRes.value);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  const jobTitle = vacancy?.position?.title || 'Senior Frontend Engineer';
  const departmentName = vacancy?.position?.title?.includes('Nurse') ? 'Clinical Operations' : 'Engineering';
  const locationText = vacancy?.location || 'Cairo, Egypt (Hybrid)';
  const statusLabel = vacancy?.status || 'Open';
  const applicationsCount = applications.length > 0 ? applications.length : 48;
  const interviewsCount = interviews.length > 0 ? interviews.length : 7;
  const offersCount = offers.length > 0 ? offers.length : 3;
  const hiresCount = vacancy?.joinedHeadcount || 1;

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Top Back Navigation ── */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/vacancies')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition cursor-pointer"
        >
          &larr; Back to Job Positions
        </button>
      </div>

      {/* ── Page Header: Job Title & Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {jobTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {statusLabel}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            {departmentName} &bull; {locationText} &bull; Full-time &bull; Created 12 Aug 2025
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <span>Share</span>
            <Icon name="share" size={13} className="text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <span>Edit</span>
            <Icon name="edit" size={13} className="text-slate-400" />
          </button>

          <button
            type="button"
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="more-vertical" size={15} />
          </button>
        </div>
      </div>

      {/* ── Horizontal Navigation Tabs (Overview, Applications 48, Pipeline, Interviews 7, etc.) ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 overflow-x-auto rf-scrollbar text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => navigate(`/applications?vacancyId=${id || 'job-1'}`)}
          className="pb-3.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Applications</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {applicationsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate(`/applications?vacancyId=${id || 'job-1'}`)}
          className="pb-3.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shrink-0"
        >
          Pipeline
        </button>

        <button
          type="button"
          onClick={() => navigate(`/interviews`)}
          className="pb-3.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Interviews</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {interviewsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('posting')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'posting'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Job Posting
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Activity
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`pb-3.5 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Settings
        </button>
      </div>

      {/* ── Row 1: 4 Top Metric Cards (Applications, Interviews, Offers, Hires) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Applications */}
        <div
          onClick={() => navigate(`/applications?vacancyId=${id || 'job-1'}`)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Icon name="users" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Applications</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{applicationsCount}</span>
              <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">+12 this week</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 2: Interviews */}
        <div
          onClick={() => navigate('/interviews')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="calendar" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Interviews</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{interviewsCount}</span>
              <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">2 this week</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 3: Offers */}
        <div
          onClick={() => navigate('/offers')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Icon name="offer" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Offers</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{offersCount}</span>
              <span className="block text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">1 this week</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 4: Hires */}
        <div
          onClick={() => navigate('/hires')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Icon name="user-check" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Hires</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{hiresCount}</span>
              <span className="block text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5">+1 this week</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* ── Row 2: 3-Column Middle Grid (SLA Progress, Owner & Hiring Team, Last Activity) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: SLA Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              SLA Progress
            </h2>
            <button type="button" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
              View details
            </button>
          </div>

          <div className="space-y-4">
            {/* Time to fill */}
            <div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">32 days</span>
                  <span className="block text-[11px] text-slate-500">Target: 45 days</span>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">71%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '71%' }} />
              </div>
            </div>

            {/* Time in current stage */}
            <div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">12 days</span>
                  <span className="block text-[11px] text-slate-500">Target: 15 days</span>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">80%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '80%' }} />
              </div>
            </div>

            {/* Green on track banner */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-900 flex items-center gap-2">
              <Icon name="check-circle" size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                On track to meet SLA target
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Owner & Hiring Team */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Owner &amp; Hiring Team
            </h2>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="space-y-4">
            {/* Owner */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Owner</span>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                  SA
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">Sarah Ahmed</span>
                  <span className="block text-[11px] text-slate-500">Senior Recruiter</span>
                </div>
              </div>
            </div>

            {/* Hiring Manager */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Hiring Manager</span>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                  AM
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">Ahmed Mostafa</span>
                  <span className="block text-[11px] text-slate-500">Engineering Manager</span>
                </div>
              </div>
            </div>

            {/* Recruiting Team */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Recruiting Team</span>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">OF</div>
                <div className="w-7 h-7 rounded-full bg-cyan-600 text-white text-[10px] font-bold flex items-center justify-center">KM</div>
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">MS</div>
                <div className="w-7 h-7 rounded-full bg-green-700 text-white text-[10px] font-bold flex items-center justify-center">NF</div>
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 text-[10px] font-bold flex items-center justify-center">
                  +2
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Last Activity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Last Activity
              </h2>
              <button type="button" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                View all
              </button>
            </div>

            <div className="space-y-3">
              {/* Item 1 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="chat" size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">Interview scheduled</span>
                  <span className="block text-[10px] text-slate-500">With Ali Hassan for Technical Interview</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Today, 10:30 AM</span>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="users" size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">New application received</span>
                  <span className="block text-[10px] text-slate-500">Noha Farouk applied</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Today, 9:15 AM</span>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="calendar" size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">Phone screen completed</span>
                  <span className="block text-[10px] text-slate-500">With Mona Salah</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Yesterday, 4:45 PM</span>
                </div>
              </div>

              {/* Item 4 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="file-text" size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">Job description updated</span>
                  <span className="block text-[10px] text-slate-500">By Sarah Ahmed</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">2 Sep 2025, 2:10 PM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button type="button" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
              View all activity
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 3: 2-Column Bottom Grid (Role Summary [2 cols internal] & Job Details) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Role Summary (Card with 2 internal columns: 8 cols out of 12) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Role Summary
            </h2>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          {/* Internal 2-Column Layout matching 03-job-overview.png */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Sub-Column: Description, Dept/Team, Key Responsibilities (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                We are looking for a Senior Frontend Engineer to join our dynamic engineering team and help build exceptional user experiences. You will lead the design and implementation of scalable, performant, and maintainable web applications using modern frontend technologies.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon name="briefcase" size={16} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Department</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{departmentName}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                    <Icon name="users" size={16} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Team</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">Frontend Engineering</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">Key Responsibilities</h3>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside leading-relaxed">
                  <li>Design, develop, and maintain high-quality web applications using React and TypeScript.</li>
                  <li>Collaborate with UX/UI designers to implement pixel-perfect, accessible interfaces.</li>
                  <li>Optimize applications for maximum speed and scalability.</li>
                  <li>Mentor junior engineers and conduct code reviews.</li>
                  <li>Work closely with backend engineers to integrate APIs and services.</li>
                </ul>
              </div>
            </div>

            {/* Right Sub-Column: Skills & Requirements, Experience, Education (5 cols) */}
            <div className="md:col-span-5 space-y-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2.5">Skills &amp; Requirements</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'React',
                    'TypeScript',
                    'JavaScript',
                    'HTML5',
                    'CSS3 / Sass',
                    'Next.js',
                    'Redux / Zustand',
                    'REST APIs',
                    'Git',
                    'Jest / Testing Library',
                    'Webpack',
                    'Agile',
                    'Problem Solving',
                  ].map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold border border-slate-200 dark:border-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon name="briefcase" size={15} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Experience</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">5+ years</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                    <Icon name="award" size={15} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Education</span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">BSc in Computer Science or related field</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Job Details (4 cols out of 12) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Job Details
            </h2>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="calendar" size={14} className="text-slate-400" />
                Employment Type
              </span>
              <span className="font-bold text-slate-900 dark:text-white">Full-time</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="map-pin" size={14} className="text-slate-400" />
                Work Location
              </span>
              <span className="font-bold text-slate-900 dark:text-white">Cairo, Egypt (Hybrid)</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="award" size={14} className="text-slate-400" />
                Experience Level
              </span>
              <span className="font-bold text-slate-900 dark:text-white">Senior (5+ years)</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="briefcase" size={14} className="text-slate-400" />
                Career Level
              </span>
              <span className="font-bold text-slate-900 dark:text-white">Individual Contributor</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="offer" size={14} className="text-slate-400" />
                Salary Range
              </span>
              <span className="font-bold text-slate-900 dark:text-white">EGP 35,000 - 50,000 / month</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="calendar" size={14} className="text-slate-400" />
                Posted On
              </span>
              <span className="font-bold text-slate-900 dark:text-white">12 Aug 2025</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="clock" size={14} className="text-slate-400" />
                Closing Date
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                12 Sep 2025 (31 days left)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Share Modal ── */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Job Position"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Share this job opening link with candidates or publish directly to career portals.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={`https://careers.sgh.com/jobs/${id || 'job-1'}`} className="text-xs" />
            <button
              type="button"
              onClick={() => setIsShareModalOpen(false)}
              className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Copy
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Job Position Details"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Job Title</label>
            <Input defaultValue={jobTitle} />
          </div>
          <div>
            <label className="font-bold block mb-1">Department</label>
            <Select defaultValue={departmentName}>
              <option value="Engineering">Engineering</option>
              <option value="Clinical Operations">Clinical Operations</option>
              <option value="Digital Health">Digital Health</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default VacancyOverviewPage;
