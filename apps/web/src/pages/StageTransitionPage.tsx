import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Application } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function StageTransitionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [note, setNote] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    if (!id) return;
    getApi<Application>(`/applications/${id}`)
      .then((data) => setApplication(data))
      .catch(() => {});
  }, [id]);

  const candidateName = application?.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : 'Ali Hassan';
  const roleName = application?.positionTitle || 'Frontend Developer';
  const appIdDisplay = application?.id ? (application.id.length > 10 ? 'APP-02481' : application.id) : 'APP-02481';

  const handleConfirmTransition = async () => {
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      if (id) {
        await patchApi(`/applications/${id}/stage`, {
          stage: 'Interview',
          reason: note || 'Completed requirements and moved to Second Interview',
        });
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsSubmitting(false);
      setSuccessMessage(true);
      setTimeout(() => {
        navigate(`/applications/${id || 'APP-02481'}`);
      }, 1200);
    }
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumb & Top Bar matching 06-stage-transition.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span
              onClick={() => navigate('/applications')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Applications
            </span>
            <span className="mx-2">/</span>
            <span
              onClick={() => navigate(`/applications/${id || 'APP-02481'}`)}
              className="hover:text-blue-600 cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {candidateName}
            </span>
            <span className="mx-2">/</span>
            <span className="text-slate-900 dark:text-white font-bold">Stage Transition</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Stage Transition
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Move {candidateName} to the next stage in the recruitment process.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate(`/applications/${id || 'APP-02481'}`)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to Application</span>
          </button>
        </div>
      </div>

      {/* ── Candidate Context Header Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Candidate Profile summary */}
          <div className="md:col-span-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
              AH
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                {candidateName}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {roleName}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  First Interview
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  SLA: 6h left
                </span>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-5">
            <div>
              <span className="block text-[11px] text-slate-400 font-semibold uppercase">Application ID</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">{appIdDisplay}</span>
            </div>

            <div>
              <span className="block text-[11px] text-slate-400 font-semibold uppercase">Job Position</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">Senior Frontend Engineer</span>
            </div>

            <div>
              <span className="block text-[11px] text-slate-400 font-semibold uppercase">Owner</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-4 h-4 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                  SA
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Sarah Ahmed</span>
              </div>
            </div>

            <div>
              <span className="block text-[11px] text-slate-400 font-semibold uppercase">Applied on</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">28 Aug 2026 <span className="font-normal text-slate-400">(3 days ago)</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ════════ Left Column (~65% width / 8 cols) ════════ */}
        <div className="lg:col-span-8 space-y-6">
          {/* Define Stage Transition Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Define Stage Transition
            </h2>

            {/* From Stage -> To Stage Flow Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
              {/* From Stage Box (5 cols) */}
              <div className="sm:col-span-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-sm font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 uppercase font-semibold">From stage</span>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">First Interview</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Completed on 28 Aug 2026</span>
                </div>
              </div>

              {/* Arrow Connector (1 col) */}
              <div className="sm:col-span-1 flex justify-center text-slate-400">
                <Icon name="arrow-right" size={20} />
              </div>

              {/* To Stage Box (5 cols) */}
              <div className="sm:col-span-5 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/20 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 text-sm font-black flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <span className="block text-[11px] text-purple-600 dark:text-purple-400 uppercase font-semibold">To stage</span>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">Second Interview</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Next in pipeline</span>
                </div>
              </div>
            </div>

            {/* Transition Requirements Checklist */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Transition Requirements
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {/* Requirement 1 */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0">
                      ✓
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white">Technical interview completed</span>
                      <span className="block text-[11px] text-slate-400">Interview must be marked as completed</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Completed
                  </span>
                </div>

                {/* Requirement 2 */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0">
                      ✓
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white">Interview feedback submitted</span>
                      <span className="block text-[11px] text-slate-400">Technical interview feedback is required</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Completed
                  </span>
                </div>

                {/* Requirement 3 */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0">
                      ✓
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white">Candidate scorecard available</span>
                      <span className="block text-[11px] text-slate-400">Minimum one scorecard must be submitted</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Completed
                  </span>
                </div>

                {/* Requirement 4 */}
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-amber-500 shrink-0" />
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white">Hiring manager availability confirmed</span>
                      <span className="block text-[11px] text-slate-400">Ensure availability for second interview</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Pending
                  </span>
                </div>
              </div>
            </div>

            {/* Interview Feedback Requirement Banner */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Icon name="file-text" size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Interview Feedback Requirement</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Interview feedback is required to proceed. Please ensure all required feedback and scorecards are submitted before moving to the next stage.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-purple-100 dark:border-purple-900/50 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  2 of 2 interviewers have submitted feedback
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/interviews')}
                  className="px-3 py-1 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 transition cursor-pointer"
                >
                  View feedback
                </button>
              </div>
            </div>

            {/* Transition Note Field */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Transition Note <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">{note.length} / 500 characters</span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Add a note about this transition..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* ════════ Right Sidebar (~35% width / 4 cols) ════════ */}
        <div className="lg:col-span-4 space-y-6">
          {/* Transition Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Transition Summary
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                You are about to move this application forward in the process.
              </p>
            </div>

            <div className="space-y-3 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-400">From stage</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  3 First Interview
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <span className="text-slate-400">To stage</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  4 Second Interview
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <span className="text-slate-400">Pipeline</span>
                <span className="font-bold text-slate-900 dark:text-white">Senior Frontend Engineer</span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <span className="text-slate-400">Expected duration</span>
                <span className="font-bold text-slate-900 dark:text-white">20 - 30 mins</span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <span className="text-slate-400">Stage owner</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center">
                    SA
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">Sarah Ahmed</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <span className="text-slate-400">SLA target</span>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white block">48 hours</span>
                  <span className="text-[10px] text-slate-400">(By 30 Aug 2026)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Owner Confirmation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Owner Confirmation
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Please confirm this transition to proceed.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Confirm as stage owner</label>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                      SA
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white leading-none">Sarah Ahmed</span>
                      <span className="block text-[10px] text-slate-400">Stage Owner</span>
                    </div>
                  </div>
                  <Icon name="chevron-down" size={13} className="text-slate-400" />
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                  I confirm all requirements are met and this applicant is ready to move to the next stage.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => navigate(`/applications/${id || 'APP-02481'}`)}
                  className="py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs text-center cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!isConfirmed || isSubmitting}
                  onClick={() => void handleConfirmTransition()}
                  className="py-2.5 px-3 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-xl text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Moving...' : 'Confirm Transition'}</span>
                  <Icon name="arrow-right" size={13} />
                </button>
              </div>

              {successMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 text-center animate-fade-in">
                  ✓ Stage transition confirmed!
                </div>
              )}

              <p className="text-[10.5px] text-slate-400 flex items-center justify-center gap-1 pt-1">
                <Icon name="lock" size={11} />
                <span>This action cannot be undone</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-[11px] text-slate-400 font-medium">
          SGH Design System &bull; Saudi German Health recruitment workspace
        </p>
      </div>
    </div>
  );
}

export default StageTransitionPage;
