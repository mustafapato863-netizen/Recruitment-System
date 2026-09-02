import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Offer } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Offer Details' | 'Approvals' | 'Communication' | 'History'>('Overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadOffer() {
      if (!id) return;
      try {
        const res = await getApi<Offer>(`/offers/${id}`);
        if (res) setOffer(res);
      } catch (err) {
        console.error('Failed to load offer', err);
      }
    }
    void loadOffer();
  }, [id]);

  const candidateName = offer?.candidateName || 'Nour Ali';
  const jobTitle = offer?.positionTitle || 'Registered Nurse';
  const offerCode = offer?.offerCode || 'OFF-2024-0142';

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(offerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-5">
      {/* ── Top Back Button ── */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/offers')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
        >
          &larr; Back to Offers
        </button>
      </div>

      {/* ── Candidate Banner (Panel 14) ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs ring-4 ring-blue-50">
            NA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-gray-900 tracking-tight">{candidateName}</h1>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active Candidate
              </span>
            </div>
            <p className="text-xs font-semibold text-gray-500">{jobTitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs md:border-l md:border-gray-200/80 md:pl-6">
          <div>
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">Offer ID</span>
            <div className="flex items-center gap-1 font-mono font-bold text-gray-900">
              <span>{offerCode}</span>
              <button
                onClick={handleCopyCode}
                className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title={copied ? 'Copied!' : 'Copy Offer ID'}
              >
                {copied ? <Icon name="check" size={12} className="text-emerald-600" /> : <Icon name="copy" size={12} />}
              </button>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">Job Title</span>
            <span className="font-bold text-gray-900">{jobTitle}</span>
          </div>

          <div>
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">Current Offer Status</span>
            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Sent to Candidate</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                On Track
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1 mb-1">
              <Icon name="calendar" size={12} /> Start Date
            </span>
            <span className="font-bold text-gray-900 block">May 27, 2024</span>
            <span className="text-[10px] text-gray-400 block">20 days to start</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/candidates/1')}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            View Candidate Profile &gt;
          </button>
        </div>
      </div>

      {/* ── Navigation Tab Bar (Panel 14) ── */}
      <div className="flex items-center gap-6 border-b border-gray-200 px-2 text-xs font-bold">
        {[
          { label: 'Overview', icon: 'file-text' },
          { label: 'Offer Details', icon: 'file' },
          { label: 'Approvals', icon: 'users' },
          { label: 'Communication', icon: 'message-square' },
          { label: 'History', icon: 'clock' },
        ].map((tab) => {
          const isActive = activeTab === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label as any)}
              className={`pb-3 flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon name={tab.icon as any} size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Main Layout: 3 Columns (Left) + Right Actions/Activity Sidebar (Panel 14) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Offer Progress + Compensation Summary + Approval Flow */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* 1. Offer Progress Stepper Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-extrabold text-gray-900">Offer Progress</h3>

              <div className="space-y-4 text-xs">
                {/* Step 1: Draft */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">1. Draft</span>
                    <span className="text-[10px] text-gray-400 block">May 5, 2024 • 10:15 AM • By You</span>
                  </div>
                </div>

                {/* Step 2: Internal Review */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">2. Internal Review</span>
                    <span className="text-[10px] text-gray-400 block">May 6, 2024 • 11:20 AM • By Omar Hassan</span>
                  </div>
                </div>

                {/* Step 3: Approved */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">3. Approved</span>
                    <span className="text-[10px] text-gray-400 block">May 6, 2024 • 2:45 PM • By HR Manager</span>
                  </div>
                </div>

                {/* Step 4: Sent to Candidate (Current) */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-[0_0_0_3px_rgba(37,99,235,0.2)]">
                    <Icon name="send" size={10} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-blue-600 block">4. Sent to Candidate</span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Current Step
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 block">May 7, 2024 • 10:32 AM • By You</span>
                  </div>
                </div>

                {/* Step 5: Candidate Review */}
                <div className="flex items-start gap-3 opacity-60">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-[10px] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-700 block">5. Candidate Review</span>
                    <span className="text-[10px] text-gray-400 block">Pending</span>
                  </div>
                </div>

                {/* Step 6: Accepted */}
                <div className="flex items-start gap-3 opacity-60">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-[10px] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-700 block">6. Accepted</span>
                    <span className="text-[10px] text-gray-400 block">Pending</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Compensation Summary Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold text-gray-900">Compensation Summary</h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Base Salary (Annual)</span>
                  <span className="font-bold text-gray-900">SAR 96,000</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Housing Allowance (Annual)</span>
                  <span className="font-bold text-gray-900">SAR 12,000</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Transportation Allowance (Annual)</span>
                  <span className="font-bold text-gray-900">SAR 6,000</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Annual Bonus</span>
                  <span className="font-bold text-gray-900">SAR 5,000</span>
                </div>

                <div className="pt-2.5 pb-1 border-t border-gray-100 flex items-center justify-between font-extrabold">
                  <span className="text-gray-900">Total Fixed Compensation</span>
                  <span className="text-blue-600 text-sm font-black">SAR 119,000</span>
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Contract Type</span>
                    <span className="font-bold text-gray-900">Full-time</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Probation Period</span>
                    <span className="font-bold text-gray-900">90 days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Working Hours</span>
                    <span className="font-bold text-gray-900">48 hrs / week</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Approval Flow Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold text-gray-900">Approval Flow</h3>

              <div className="space-y-3 text-xs">
                {/* Approver 1 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      OH
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">HR Manager</span>
                      <span className="text-[10px] text-gray-400 block">Omar Hassan</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Approved
                    </span>
                    <span className="text-[9px] text-gray-400 block mt-0.5">May 6, 11:20 AM</span>
                  </div>
                </div>

                {/* Approver 2 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      SA
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">Hiring Manager</span>
                      <span className="text-[10px] text-gray-400 block">Sarah Ahmed</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Approved
                    </span>
                    <span className="text-[9px] text-gray-400 block mt-0.5">May 6, 1:05 PM</span>
                  </div>
                </div>

                {/* Approver 3 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      YH
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">Finance</span>
                      <span className="text-[10px] text-gray-400 block">Yousef Hamdy</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Approved
                    </span>
                    <span className="text-[9px] text-gray-400 block mt-0.5">May 6, 2:10 PM</span>
                  </div>
                </div>

                {/* Approver 4 */}
                <div className="flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-400 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      HS
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block">Legal</span>
                      <span className="text-[10px] text-gray-400 block">Heba Salem</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                      Pending
                    </span>
                    <span className="text-[9px] text-gray-400 block mt-0.5">Waiting for review</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 text-right">
                <button className="text-[11px] font-bold text-blue-600 hover:underline">
                  View Approval Details &gt;
                </button>
              </div>
            </div>
          </div>

          {/* Bottom: Offer Summary Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
              <Icon name="file-text" size={14} className="text-gray-400" /> Offer Summary
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              We are pleased to extend this offer of employment for the position of Registered Nurse at Good Karma Health. We believe your skills and experience will be a great addition to our team.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-100 text-xs">
              <div>
                <span className="text-gray-400 block text-[11px]">Offer Expiry Date</span>
                <span className="font-bold text-gray-900">May 14, 2024</span>
                <span className="text-[10px] text-amber-600 font-semibold block">7 days remaining</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Offer Version</span>
                <span className="font-bold text-gray-900">v1.0</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Prepared By</span>
                <span className="font-bold text-gray-900">You</span>
                <span className="text-[10px] text-gray-400 block">May 5, 2024</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Offer Package</span>
                <a href="#pdf" className="text-blue-600 font-bold hover:underline flex items-center gap-1 mt-0.5">
                  <Icon name="file" size={12} /> View Offer Letter (PDF)
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Actions + Recent Communication */}
        <div className="lg:col-span-4 space-y-6">
          {/* Actions Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold text-gray-900">Actions</h3>

            <div className="space-y-2 text-xs font-bold">
              <button
                type="button"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Prepare Offer
              </button>

              <button
                type="button"
                className="w-full py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="edit" size={13} /> Edit Offer
              </button>

              <button
                type="button"
                className="w-full py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="send" size={13} /> Send Offer
              </button>

              <button
                type="button"
                className="w-full py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="refresh" size={13} /> Resend Offer
              </button>

              <button
                type="button"
                className="w-full py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="trash" size={13} /> Withdraw Offer
              </button>
            </div>
          </div>

          {/* Recent Communication Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-gray-900">Recent Communication</h3>

            <div className="space-y-3 text-xs">
              {/* Event 1 */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="send" size={12} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Offer sent to candidate</h4>
                  <p className="text-[10px] text-gray-400">By You • May 7, 2024 10:32 AM</p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="mail" size={12} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Offer approved by Finance</h4>
                  <p className="text-[10px] text-gray-400">By Yousef Hamdy • May 6, 2024 2:10 PM</p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="mail" size={12} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Offer approved by Hiring Manager</h4>
                  <p className="text-[10px] text-gray-400">By Sarah Ahmed • May 6, 2024 1:05 PM</p>
                </div>
              </div>

              {/* Event 4 */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="message-square" size={12} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Draft offer created</h4>
                  <p className="text-[10px] text-gray-400">By You • May 5, 2024 10:15 AM</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 text-right">
              <button className="text-[11px] font-bold text-blue-600 hover:underline">
                View All Communication &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footnote (Panel 14) */}
      <p className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-2">
        <span>ⓘ</span> All dates and times are displayed in your local time zone (GMT+3).
      </p>
    </div>
  );
}
