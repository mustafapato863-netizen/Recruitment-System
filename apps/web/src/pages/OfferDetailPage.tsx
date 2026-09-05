import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Offer } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import './PageEnhancementsV2.css';

interface HiringCaseLookup {
  id: string;
  offerId: string;
}

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [joiningCase, setJoiningCase] = useState<HiringCaseLookup | null>(null);
  const [isCheckingCase, setIsCheckingCase] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Offer Details');
  const [isHired, setIsHired] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notesList, setNotesList] = useState([
    {
      author: 'Sarah Ahmed',
      authorAvatar: 'SA',
      date: '1 Sep 2026, 4:50 PM',
      text: 'Mona accepted the offer and is excited to join the ICU team. Start date confirmed as 15 Sep 2026.',
    },
  ]);

  useEffect(() => {
    if (!id) return;
    getApi<Offer>(`/offers/${id}`)
      .then((data) => setOffer(data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!offer || offer.status !== 'Accepted') {
      setJoiningCase(null);
      return;
    }
    setIsCheckingCase(true);
    getApi<HiringCaseLookup[]>('/hiring')
      .then((cases) => {
        const match = Array.isArray(cases) ? cases.find((c) => c.offerId === offer.id) : undefined;
        setJoiningCase(match ?? null);
      })
      .catch(() => {
        setJoiningCase(null);
      })
      .finally(() => {
        setIsCheckingCase(false);
      });
  }, [offer]);

  const handleCreateJoiningCase = async () => {
    if (!offer?.id) return;
    setIsCreatingCase(true);
    setCreateCaseError(null);
    try {
      const response = await postApi<{ id?: string }>('/hiring', { offerId: offer.id });
      if (response && typeof response.id === 'string' && response.id) {
        navigate(`/hires/${response.id}`);
        return;
      }
      // Fallback: reload hiring list match by offerId
      const cases = await getApi<HiringCaseLookup[]>('/hiring');
      const match = Array.isArray(cases) ? cases.find((c) => c.offerId === offer.id) : undefined;
      if (match?.id) {
        navigate(`/hires/${match.id}`);
      } else {
        throw new Error('Joining case was created, but unable to locate the new case ID.');
      }
    } catch (err: unknown) {
      setCreateCaseError(err instanceof Error ? err.message : 'An unexpected error occurred while creating the joining case.');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setNotesList((prev) => [
      ...prev,
      {
        author: 'Sarah Ahmed',
        authorAvatar: 'SA',
        date: 'Just now',
        text: newNote.trim(),
      },
    ]);
    setNewNote('');
    setIsAddNoteModalOpen(false);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownloadOfferLetter = () => {
    const content = `OFFER LETTER - SAUDI GERMAN HEALTH\nCandidate: Mona Saleh\nPosition: Registered Nurse - ICU\nDate: 1 September 2026\n\nBasic Salary: SAR 12,000 / month\nHousing Allowance: SAR 3,000 / month\nTransportation Allowance: SAR 1,500 / month\nTotal Monthly Package: SAR 16,500 / month\nStatus: Approved & Accepted`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Offer_Letter_Mona_Saleh.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Offer letter downloaded successfully!');
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumbs & Top Header matching 12-offer-detail-hire.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span onClick={() => navigate('/offers')} className="hover:text-blue-600 cursor-pointer">
              Offers
            </span>
            <span className="mx-2">/</span>
            <span className="text-slate-900 dark:text-white font-bold">{id || 'OFF-2026-1157'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Offer Detail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Offer Accepted
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Next step: Start Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => showToast('Offer options: Edit offer, Re-trigger approvals, or Revoke')}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-900 shadow-xs cursor-pointer"
            title="More actions"
          >
            <Icon name="more-horizontal" size={16} />
          </button>

          <button
            type="button"
            onClick={handleDownloadOfferLetter}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} className="text-slate-400" />
            <span>Download Offer Letter</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHired(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="check" size={14} />
            <span>{isHired ? '✓ Hired & Case Created' : 'Mark as Hired'}</span>
          </button>
        </div>
      </div>

      {/* ── Candidate Context Summary Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Candidate Profile Summary (4 cols) */}
          <div className="lg:col-span-4 flex items-center gap-4">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80"
              alt="Mona Saleh"
              className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  Mona Saleh
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Internal Referral
                </span>
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                Registered Nurse – ICU
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Clinical Operations &bull; Jeddah, KSA &bull; On-site
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mt-1.5">
                <span className="flex items-center gap-1"><Icon name="mail" size={11} /> mona.saleh@email.com</span>
                <span className="flex items-center gap-1"><Icon name="phone" size={11} /> +966 50 123 4567</span>
              </div>
            </div>
          </div>

          {/* Metadata Grid (8 cols) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6">
            <div>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase">Offer ID</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">{id || 'OFF-2026-1157'}</span>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-2">Applied on</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">18 Aug 2026</span>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-2">Interviewed on</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">31 Aug 2026</span>
            </div>

            <div>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase">Owner</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                  SA
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block leading-tight">Sarah Ahmed</span>
                  <span className="text-[10px] text-slate-400">Senior Recruiter</span>
                </div>
              </div>

              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-3">Hiring Manager</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-5 h-5 rounded-full bg-teal-800 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                  BK
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block leading-tight">Basem Khaled</span>
                  <span className="text-[10px] text-slate-400">Clinical Operations Manager</span>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase">Offer Stage</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">Offer Accepted</span>

              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-3">SLA</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 block mt-0.5">2 days left</span>
              <span className="text-[10.5px] text-slate-400 block">Due 8 Sep 2026, 5:00 PM</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Next Step: Joining (Gated by offer.status === 'Accepted') ── */}
      {offer?.status === 'Accepted' && (
        <section
          aria-labelledby="next-step-joining-heading"
          className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-5 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <Icon name="check-circle" size={14} />
                </span>
                <h2 id="next-step-joining-heading" className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Next Step: Joining
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {joiningCase
                  ? 'Candidate accepted the offer. A pre-hire joining and compliance case is active.'
                  : 'Candidate has accepted the offer. Initiate the joining and compliance case to track onboarding readiness and scheduled start date.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isCheckingCase ? (
                <Button variant="secondary" size="sm" loading loadingLabel="Checking case...">
                  Checking case...
                </Button>
              ) : joiningCase ? (
                <Button variant="primary" size="sm" asChild>
                  <Link to={`/hires/${joiningCase.id}`}>
                    <Icon name="arrow-right" size={13} />
                    View Joining Case
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateJoiningCase}
                  loading={isCreatingCase}
                  loadingLabel="Creating Case..."
                >
                  <Icon name="plus" size={13} />
                  Create Joining Case
                </Button>
              )}
            </div>
          </div>

          {createCaseError && (
            <div className="mt-3">
              <Alert tone="danger" title="Unable to create joining case">
                {createCaseError}
              </Alert>
            </div>
          )}
        </section>
      )}

      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto pb-1">
        {['Offer Details', 'Approvals', 'Communication', 'Activity', 'Documents', 'Notes', 'Onboarding Readiness'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? 'text-blue-600 font-extrabold border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Row 1: Compensation (4 cols), Offer Summary (4 cols), Approvals (4 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Compensation Package (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Compensation Package
            </h2>
            <button
              type="button"
              onClick={() => showToast('Monthly compensation breakdown: Basic (SAR 12k), Housing (SAR 3k), Transport (SAR 1k), Specialty (SAR 2k)')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View breakdown
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Basic Salary</span>
              <span className="font-bold text-slate-900 dark:text-white">SAR 12,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Housing Allowance</span>
              <span className="font-bold text-slate-900 dark:text-white">SAR 3,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transport Allowance</span>
              <span className="font-bold text-slate-900 dark:text-white">SAR 1,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Specialty Allowance (ICU)</span>
              <span className="font-bold text-slate-900 dark:text-white">SAR 2,000</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Gross Monthly Salary</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">SAR 18,000</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Annual Bonus (Est.)</span>
              <span className="font-bold text-slate-900 dark:text-white">SAR 9,000</span>
            </div>

            <div className="pt-1 flex justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Annual Gross (Est.)</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">SAR 225,000</span>
            </div>
          </div>

          {/* Benefits List */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs">Benefits</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Icon name="check" size={12} className="text-emerald-500" /> Medical Insurance
                </span>
                <span className="text-slate-400 text-[11px]">Employee + Family</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Icon name="check" size={12} className="text-emerald-500" /> Annual Leave
                </span>
                <span className="text-slate-400 text-[11px]">30 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Icon name="check" size={12} className="text-emerald-500" /> End of Service
                </span>
                <span className="text-slate-400 text-[11px]">As per Saudi Labor Law</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Icon name="check" size={12} className="text-emerald-500" /> Professional Development
                </span>
                <span className="text-slate-400 text-[11px]">Annual budget provided</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Icon name="check" size={12} className="text-emerald-500" /> Shift Allowance
                </span>
                <span className="text-slate-400 text-[11px]">Included</span>
              </div>
            </div>

            <div className="text-right pt-1">
              <button
                type="button"
                onClick={() => showToast('Benefits summary: Full Medical Class A, 30 Days Annual Leave, End of Service, Education Allowance')}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View all benefits
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Offer Summary & Attached Letter (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3 text-xs">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
              Offer Summary
            </h2>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Offer Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                  Offer Accepted
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Offered On</span>
                <span className="font-bold text-slate-900 dark:text-white">1 Sep 2026, 3:10 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Accepted On</span>
                <span className="font-bold text-slate-900 dark:text-white">1 Sep 2026, 4:45 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valid Until</span>
                <span className="font-bold text-slate-900 dark:text-white">8 Sep 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Start Date</span>
                <span className="font-bold text-slate-900 dark:text-white">15 Sep 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Probation Period</span>
                <span className="font-bold text-slate-900 dark:text-white">3 months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Work Location</span>
                <span className="font-bold text-slate-900 dark:text-white">Jeddah, KSA (On-site)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reports To</span>
                <span className="font-bold text-slate-900 dark:text-white">Basem Khaled</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Offer Source</span>
                <span className="font-bold text-slate-900 dark:text-white">Internal Referral</span>
              </div>
            </div>
          </div>

          {/* Attached Offer Letter Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-extrabold text-slate-900 dark:text-white">Attached Offer Letter</h3>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Icon name="file-text" size={16} />
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                    Offer_Letter_Mona_Saleh.pdf
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    PDF &bull; 186 KB
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadOfferLetter}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Download
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Generated on 1 Sep 2026, 3:10 PM by Sarah Ahmed
            </p>
          </div>
        </div>

        {/* Column 3: Approvals Timeline (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
            Approvals Timeline
          </h2>

          <div className="relative pl-6 border-l-2 border-emerald-500 space-y-5 text-xs ml-2 py-1">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                ✓
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Hiring Manager Approval</span>
                  <span className="block text-[10.5px] text-slate-400">Basem Khaled</span>
                </div>
                <span className="text-[10px] text-slate-400">1 Sep 2026, 2:30 PM</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                ✓
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">HR Approval</span>
                  <span className="block text-[10.5px] text-slate-400">Sarah Ahmed</span>
                </div>
                <span className="text-[10px] text-slate-400">1 Sep 2026, 3:05 PM</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                ✓
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Finance Approval</span>
                  <span className="block text-[10.5px] text-slate-400">Faisal Almutairi</span>
                </div>
                <span className="text-[10px] text-slate-400">1 Sep 2026, 3:40 PM</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">
                ●
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Offer Sent to Candidate</span>
                </div>
                <span className="text-[10px] text-slate-400">1 Sep 2026, 3:10 PM</span>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                ✓
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Offer Accepted</span>
                  <span className="block text-[10.5px] text-slate-400">Mona Saleh</span>
                </div>
                <span className="text-[10px] text-slate-400">1 Sep 2026, 4:45 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Hiring Readiness Checklist & Notes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Checklist (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Hiring Readiness Checklist
            </h2>
            <span className="text-xs font-bold text-slate-500">7 of 9 completed</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0">✓</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Background Verification</span>
                <span className="block text-[10px] text-emerald-600 font-semibold">Completed</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0">✓</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Pre-Employment Medical</span>
                <span className="block text-[10px] text-emerald-600 font-semibold">Completed</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center text-[9px] shrink-0">!</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Workstation &amp; Equipment</span>
                <span className="block text-[10px] text-amber-600 font-semibold">Pending</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0">✓</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Credential Verification</span>
                <span className="block text-[10px] text-emerald-600 font-semibold">Completed</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0">✓</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Contract / Offer Letter</span>
                <span className="block text-[10px] text-emerald-600 font-semibold">Completed</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center text-[9px] shrink-0">!</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Team Introduction</span>
                <span className="block text-[10px] text-amber-600 font-semibold">Pending</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0">✓</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Reference Check</span>
                <span className="block text-[10px] text-emerald-600 font-semibold">Completed</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center text-[9px] shrink-0">!</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">IT Access Request</span>
                <span className="block text-[10px] text-amber-600 font-semibold">Pending</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center text-[9px] shrink-0">!</div>
              <div>
                <span className="block font-bold text-slate-900 dark:text-white">Onboarding Plan</span>
                <span className="block text-[10px] text-amber-600 font-semibold">Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Internal Notes
            </h2>
            <button
              type="button"
              onClick={() => showToast(`Displaying all ${notesList.length} internal notes`)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {notesList.map((n, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center">
                      {n.authorAvatar}
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{n.author}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{n.date}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {n.text}
                </p>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setIsAddNoteModalOpen(true)}
              className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Icon name="plus" size={13} />
              <span>Add note</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Note Modal */}
      <Modal
        isOpen={isAddNoteModalOpen}
        onClose={() => setIsAddNoteModalOpen(false)}
        title="Add Internal Offer Note"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <textarea
            rows={4}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Type your note here..."
            className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddNoteModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Save Note
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default OfferDetailPage;
