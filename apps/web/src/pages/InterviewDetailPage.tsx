import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Interview } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import './PageEnhancementsV2.css';

export function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setInterview] = useState<Interview | null>(null);
  const [feedbackTab, setFeedbackTab] = useState<'byQuestion' | 'byInterviewer'>('byInterviewer');
  const [isReminderSent, setIsReminderSent] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isScoreGuideOpen, setIsScoreGuideOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getApi<Interview>(`/interviews/${id}`)
      .then((data) => setInterview(data))
      .catch(() => {});
  }, [id]);

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumbs & Top Action Bar matching 10-interview-detail-feedback.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span onClick={() => navigate('/')} className="hover:text-blue-600 cursor-pointer">
              My Work
            </span>
            <span className="mx-2">&gt;</span>
            <span onClick={() => navigate('/interviews')} className="hover:text-blue-600 cursor-pointer">
              Interviews
            </span>
            <span className="mx-2">&gt;</span>
            <span className="text-slate-900 dark:text-white font-bold">Interview Details</span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Technical Interview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Scheduled
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Next stage: Panel Interview &bull; After this: Offer Approval
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <span>Actions</span>
            <Icon name="more-vertical" size={13} />
          </button>

          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => navigate('/interviews')}
              className="p-2 hover:bg-slate-50 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 cursor-pointer"
              title="Previous Interview"
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/interviews')}
              className="p-2 hover:bg-slate-50 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Next Interview"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Candidate Context Header Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Candidate Profile Info (5 cols) */}
          <div className="lg:col-span-5 flex items-center gap-4">
            <img
              src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80"
              alt="Ali Hassan"
              className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-xs shrink-0"
            />
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                Ali Hassan
              </h2>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                Senior Frontend Engineer
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Engineering &bull; Cairo, Egypt &bull; Applied 28 Aug 2026
              </p>
              {/* Quick Contact Buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                <button type="button" className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer">
                  <Icon name="mail" size={12} />
                </button>
                <button type="button" className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer">
                  <Icon name="phone" size={12} />
                </button>
                <button type="button" className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer">
                  <Icon name="link" size={12} />
                </button>
                <button type="button" className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer">
                  <Icon name="more-horizontal" size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Application Metadata (3 cols) */}
          <div className="lg:col-span-3 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Application ID</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">APP-02481</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Current Stage</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Technical Interview
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase text-[10.5px]">Application Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                In Progress
              </span>
            </div>
          </div>

          {/* Fit Summary Bars (4 cols) */}
          <div className="lg:col-span-4 space-y-1.5 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-1">
              <span>Fit Summary</span>
              <button
                type="button"
                onClick={() => navigate('/applications/APP-02481')}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                View full profile
              </button>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-500">Skills match</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">85%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '85%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-500">Experience match</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">80%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '80%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-500">Culture fit</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">75%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row: 3 Operational Cards (Interview Details, Panel, Attachments) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Interview Details */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Interview Details
            </h2>
            <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
              Edit
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Date &amp; Time</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Today, 2 Sep 2026</span>
              <span className="text-[11px] text-slate-400">2:00 PM – 3:00 PM (AST)</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Interview Type</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Video Interview</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Location / Link</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Icon name="video" size={13} className="text-blue-500" /> Microsoft Teams
                </span>
                <a href="#join" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                  Join meeting ↗
                </a>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Time Zone</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">Asia/Riyadh (GMT+3)</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block text-[11px] font-semibold uppercase">Interview Owner</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                  SA
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block leading-none">Sarah Ahmed</span>
                  <span className="text-[10px] text-slate-400">Senior Recruiter</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Interview Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Interview Panel
              </h2>
              <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
                Manage panel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Member 1 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center">
                    SA
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Sarah Ahmed</span>
                    <span className="block text-[10.5px] text-slate-400">Senior Recruiter</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Feedback submitted
                </span>
              </div>

              {/* Member 2 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-teal-700 text-white text-[10px] font-black flex items-center justify-center">
                    AM
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Ahmed Mostafa</span>
                    <span className="block text-[10.5px] text-slate-400">Engineering Manager</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Feedback submitted
                </span>
              </div>

              {/* Member 3 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center">
                    KM
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Khaled Mostafa</span>
                    <span className="block text-[10.5px] text-slate-400">Senior Frontend Engineer</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Feedback pending
                </span>
              </div>

              {/* Member 4 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                    NS
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white leading-tight">Nourhan Sami</span>
                    <span className="block text-[10.5px] text-slate-400">HR Business Partner</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Feedback submitted
                </span>
              </div>
            </div>
          </div>

          {/* Pending Alert Banner */}
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
              <Icon name="alert-triangle" size={13} className="text-amber-600" />
              <span>1 panel member has not submitted feedback</span>
            </div>
            <button
              type="button"
              onClick={() => setIsReminderSent(true)}
              className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
            >
              {isReminderSent ? '✓ Sent' : 'Send reminder'}
            </button>
          </div>
        </div>

        {/* Card 3: Attachments */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Attachments
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Upload
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { name: 'Ali Hassan CV.pdf', size: 'PDF • 210 KB' },
                { name: 'Portfolio - Ali Hassan.pdf', size: 'PDF • 1.2 MB' },
                { name: 'Technical Assessment Report.pdf', size: 'PDF • 842 KB' },
                { name: 'Interview Agenda - Technical.pdf', size: 'PDF • 145 KB' },
              ].map((doc) => (
                <div
                  key={doc.name}
                  className="p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      <Icon name="file-text" size={13} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                        {doc.name}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {doc.size}
                      </span>
                    </div>
                  </div>
                  <Icon name="download" size={12} className="text-slate-300 group-hover:text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
              View all attachments (5)
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Scorecard (~45%), Feedback (~30%), Recommendation (~25%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Interview Scorecard (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Interview Scorecard
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Average Score: 4.1 / 5
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10.5px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2">Criteria</th>
                  <th className="pb-2 text-center">Sarah Ahmed</th>
                  <th className="pb-2 text-center">Ahmed Mostafa</th>
                  <th className="pb-2 text-center">Khaled Mostafa</th>
                  <th className="pb-2 text-right">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Technical Skills</span>
                    <span className="text-[10px] text-slate-400 block">Frontend, React, TypeScript</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.5</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.3</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Problem Solving</span>
                    <span className="text-[10px] text-slate-400 block">Analytical thinking &amp; approach</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.0</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Communication</span>
                    <span className="text-[10px] text-slate-400 block">Clarity &amp; collaboration</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.5</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.3</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Culture Fit</span>
                    <span className="text-[10px] text-slate-400 block">Values &amp; team alignment</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.0</td>
                </tr>

                <tr>
                  <td className="py-2.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Ownership &amp; Initiative</span>
                    <span className="text-[10px] text-slate-400 block">Proactiveness &amp; ownership</span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.5</td>
                  <td className="py-2.5 text-center font-bold text-slate-800">4.0</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">4.3</td>
                </tr>

                <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                  <td className="py-2.5 font-extrabold text-slate-900 dark:text-white">Total Score (Average)</td>
                  <td className="py-2.5 text-center font-black text-slate-900 dark:text-white">4.2</td>
                  <td className="py-2.5 text-center font-black text-slate-900 dark:text-white">4.1</td>
                  <td className="py-2.5 text-center text-slate-400">–</td>
                  <td className="py-2.5 text-right">
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                      4.1
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
            <button
              type="button"
              onClick={() => setIsScoreGuideOpen(true)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View scoring guide
            </button>
          </div>
        </div>

        {/* Column 2: Feedback Summary (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Feedback Summary
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFeedbackTab('byQuestion')}
                  className={`px-2 py-0.5 rounded-lg ${feedbackTab === 'byQuestion' ? 'font-bold text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                >
                  By Question
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackTab('byInterviewer')}
                  className={`px-2 py-0.5 rounded-lg ${feedbackTab === 'byInterviewer' ? 'font-bold text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                >
                  By Interviewer
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Feedback item 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center">
                      SA
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">Sarah Ahmed</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Submitted 2 Sep 2026, 2:55 PM</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic text-[11px] leading-relaxed">
                  &ldquo;Ali demonstrated strong knowledge of React and TypeScript. Communicates clearly and explains complex topics well.&rdquo;
                </p>
              </div>

              {/* Feedback item 2 */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-700 text-white text-[8px] font-extrabold flex items-center justify-center">
                      AM
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">Ahmed Mostafa</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Submitted 2 Sep 2026, 2:57 PM</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic text-[11px] leading-relaxed">
                  &ldquo;Solid problem solving skills and good system design thinking. I&apos;d like to see deeper discussion on scalability trade-offs.&rdquo;
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
              View full feedback ↗
            </button>
          </div>
        </div>

        {/* Column 3: Recommendation & Decision (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Recommendation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500">
              <Icon name="award" size={15} className="text-amber-500" />
              <span>Recommendation (Average)</span>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              Strong Hire
            </div>
            <p className="text-[11px] text-slate-400">
              Based on 2 of 3 submitted feedbacks
            </p>
          </div>

          {/* Hiring Decision Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-extrabold text-slate-900 dark:text-white">Hiring Decision</h3>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decision</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">To be decided</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decided by</span>
                <span className="text-slate-500">–</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decision date</span>
                <span className="text-slate-500">–</span>
              </div>
            </div>

            <button type="button" className="text-xs font-bold text-blue-600 hover:underline block pt-1">
              Add decision note
            </button>
          </div>

          {/* Next Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate('/applications/APP-02481/transition')}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Move to Panel Interview</span>
              <Icon name="arrow-right" size={13} />
            </button>

            <button
              type="button"
              className="w-full py-2 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer"
            >
              Request more feedback
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Interview Attachment"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
            <Icon name="upload" size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-600">Drag files here or click to browse</p>
            <p className="text-[10px] text-slate-400 mt-1">Supports PDF, DOCX up to 10MB</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Scoring Guide Modal */}
      <Modal
        isOpen={isScoreGuideOpen}
        onClose={() => setIsScoreGuideOpen(false)}
        title="Interview Scoring Guide"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-2 text-xs">
          <div className="p-2 border rounded-lg"><b>5.0 - Exceptional:</b> Exceeds role requirements significantly.</div>
          <div className="p-2 border rounded-lg"><b>4.0 - Strong:</b> Meets all requirements with clear strengths.</div>
          <div className="p-2 border rounded-lg"><b>3.0 - Meets standard:</b> Acceptable competency level.</div>
          <div className="p-2 border rounded-lg"><b>2.0 - Below standard:</b> Noticeable gaps.</div>
          <div className="p-2 border rounded-lg"><b>1.0 - Unacceptable:</b> Major deficiencies.</div>
        </div>
      </Modal>
    </div>
  );
}

export default InterviewDetailPage;
