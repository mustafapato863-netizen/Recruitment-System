import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Offer } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { PageState } from '../components/ui/PageState';
import { useAuth } from '../auth/AuthContext';
import './PageEnhancementsV2.css';

interface HiringCaseLookup {
  id: string;
  offerId: string;
}

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningCase, setJoiningCase] = useState<HiringCaseLookup | null>(null);
  const [isCheckingCase, setIsCheckingCase] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Offer Details');
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notesList, setNotesList] = useState<
    Array<{ author: string; authorAvatar: string; date: string; text: string }>
  >([]);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getApi<Offer>(`/offers/${id}`)
      .then((data) => setOffer(data))
      .catch(() => setOffer(null))
      .finally(() => setIsLoading(false));
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
    const authorName = user?.displayName || user?.email || 'Recruiter';
    const initials =
      authorName
        .split(' ')
        .map((n: string) => n[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'RC';

    setNotesList((prev) => [
      ...prev,
      {
        author: authorName,
        authorAvatar: initials,
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
    const candidateName = offer?.candidateName ?? 'Unknown candidate';
    const positionTitle = offer?.positionTitle ?? 'No position';
    const offerCode = offer?.offerCode || offer?.id || 'OFFER';
    const version = offer?.currentVersion;

    const compLines = (version?.components || [])
      .map(
        (c) =>
          `  - ${c.name} (${c.type}): ${c.currency || 'SAR'} ${(c.amount ?? 0).toLocaleString()}${c.frequency ? ` (${c.frequency})` : ''}`
      )
      .join('\n');

    const content = [
      '============================================================',
      '                     OFFER OF EMPLOYMENT                    ',
      '============================================================',
      '',
      `Offer Reference: ${offerCode}`,
      `Date: ${offer?.createdAt ? new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`,
      `Status: ${offer?.status || 'Draft'}`,
      '',
      `Candidate: ${candidateName}`,
      `Position: ${positionTitle}`,
      version?.contractType ? `Contract Type: ${version.contractType}` : null,
      version?.workLocation ? `Work Location: ${version.workLocation}` : null,
      version?.probationPeriod ? `Probation Period: ${version.probationPeriod}` : null,
      version?.proposedJoiningDate ? `Proposed Start Date: ${new Date(version.proposedJoiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : null,
      version?.offerExpiry ? `Offer Expiry Date: ${new Date(version.offerExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : null,
      '',
      '------------------------------------------------------------',
      'COMPENSATION PACKAGE',
      '------------------------------------------------------------',
      compLines || '  No individual components itemized.',
      '',
      version?.monthlyPackage ? `Total Monthly Package: SAR ${version.monthlyPackage.toLocaleString()}` : null,
      version?.annualFixed ? `Total Annual Package: SAR ${version.annualFixed.toLocaleString()}` : null,
      '',
      '============================================================',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug = candidateName.replace(/[^\w.-]+/g, '_');
    link.download = `Offer_Letter_${slug}_${offerCode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Offer letter downloaded successfully!');
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'Approved':
        return 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800';
      case 'Pending Approval':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      case 'Sent':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Declined':
      case 'Rejected':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      case 'Expired':
      case 'Withdrawn':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
      case 'Draft':
      default:
        return 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 border border-slate-200 dark:border-slate-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
        <PageState
          kind="loading"
          title="Loading offer details..."
          description="Fetching offer package and contract data from server."
        />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
        <PageState
          kind="not-found"
          title="Offer not found"
          description="The requested offer record could not be loaded or was removed."
          actionLabel="Back to Offers"
          onAction={() => navigate('/offers')}
        />
      </div>
    );
  }

  const candidateDisplayName = offer.candidateName ?? 'Unknown candidate';
  const candidateInitials =
    candidateDisplayName
      .split(' ')
      .map((n: string) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'UC';

  const positionDisplayName = offer.positionTitle ?? 'No position';
  const candidateEmail = (offer as any).application?.candidate?.email || (offer as any).candidateEmail;
  const candidatePhone = (offer as any).application?.candidate?.phone || (offer as any).candidatePhone;
  const workLocation = offer.currentVersion?.workLocation || '—';
  const ownerDisplayName = (offer as any).createdByName || 'Unassigned';
  const ownerInitials =
    ownerDisplayName === 'Unassigned'
      ? 'UN'
      : ownerDisplayName
          .split(' ')
          .map((n: string) => n[0])
          .filter(Boolean)
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'OA';

  const firstApprover = offer.currentVersion?.approvals?.[0];
  const approverDisplayName = firstApprover?.approverName || firstApprover?.roleCode?.replace(/_/g, ' ') || '—';
  const approverRole = firstApprover?.roleCode ? firstApprover.roleCode.replace(/_/g, ' ') : '—';
  const approverInitials =
    approverDisplayName !== '—'
      ? approverDisplayName
          .split(' ')
          .map((n: string) => n[0])
          .filter(Boolean)
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'AP'
      : 'AP';

  let slaText = '—';
  let slaDue = '';
  if (offer.currentVersion?.offerExpiry) {
    const exp = new Date(offer.currentVersion.offerExpiry);
    if (!isNaN(exp.getTime())) {
      const diff = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diff < 0) {
        slaText = 'Expired';
      } else if (diff === 0) {
        slaText = 'Expires today';
      } else {
        slaText = `${diff} day${diff === 1 ? '' : 's'} left`;
      }
      slaDue = `Due ${exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  }

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumbs & Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span onClick={() => navigate('/offers')} className="hover:text-blue-600 cursor-pointer">
              Offers
            </span>
            <span className="mx-2">/</span>
            <span className="text-slate-900 dark:text-white font-bold">{offer.offerCode || id || '—'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Offer Detail
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${getStatusBadge(offer.status)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> Offer {offer.status}
            </span>
            {offer.status === 'Accepted' && (
              <span className="text-xs text-slate-500 font-medium">
                Next step: Start Onboarding
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => showToast(`Offer ${offer.offerCode}: Options panel`)}
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

          {offer.status === 'Accepted' && (
            joiningCase ? (
              <Link
                to={`/hires/${joiningCase.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Icon name="check" size={14} />
                <span>View Joining Case</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleCreateJoiningCase}
                disabled={isCreatingCase}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
              >
                <Icon name="check" size={14} />
                <span>{isCreatingCase ? 'Creating Case...' : 'Start Onboarding'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Candidate Context Summary Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Candidate Profile Summary (4 cols) */}
          <div className="lg:col-span-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-teal-600 text-white font-black text-xl flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs shrink-0">
              {candidateInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {candidateDisplayName}
                </h2>
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {positionDisplayName}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {workLocation}
              </p>
              {(candidateEmail || candidatePhone) && (
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mt-1.5">
                  {candidateEmail && (
                    <a
                      href={`mailto:${candidateEmail}`}
                      className="flex items-center gap-1 hover:text-blue-600 transition"
                    >
                      <Icon name="mail" size={11} />
                      <span>{candidateEmail}</span>
                    </a>
                  )}
                  {candidatePhone && (
                    <a
                      href={`tel:${candidatePhone}`}
                      className="flex items-center gap-1 hover:text-blue-600 transition"
                    >
                      <Icon name="phone" size={11} />
                      <span>{candidatePhone}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Metadata Grid (8 cols) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-6">
            <div>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase">Offer ID</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">{offer.offerCode || id || '—'}</span>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-2">Offered on</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-2">Last updated</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                {offer.updatedAt ? new Date(offer.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>

            <div>
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase">Owner</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                  {ownerInitials}
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block leading-tight">{ownerDisplayName}</span>
                  <span className="text-[10px] text-slate-400">{ownerDisplayName !== 'Unassigned' ? 'Recruiter' : '—'}</span>
                </div>
              </div>

              {approverDisplayName !== '—' && (
                <>
                  <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-3">Approver</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-full bg-teal-800 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                      {approverInitials}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block leading-tight">{approverDisplayName}</span>
                      <span className="text-[10px] text-slate-400">{approverRole}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="sm:col-span-2">
              <span className="block text-[10.5px] text-slate-400 font-semibold uppercase">Offer Stage</span>
              <span className={`font-black text-sm mt-0.5 block ${
                offer.status === 'Accepted'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : offer.status === 'Sent'
                  ? 'text-blue-600 dark:text-blue-400'
                  : offer.status === 'Pending Approval'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}>
                Offer {offer.status}
              </span>

              {slaText !== '—' && (
                <>
                  <span className="block text-[10.5px] text-slate-400 font-semibold uppercase mt-3">SLA / Expiry</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 block mt-0.5">{slaText}</span>
                  {slaDue && <span className="text-[10.5px] text-slate-400 block">{slaDue}</span>}
                </>
              )}
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
            {offer.currentVersion?.components && offer.currentVersion.components.length > 0 && (
              <span className="text-[11px] font-semibold text-slate-400">
                {offer.currentVersion.components.length} component{offer.currentVersion.components.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            {offer.currentVersion?.components && offer.currentVersion.components.length > 0 ? (
              offer.currentVersion.components.map((comp, idx) => (
                <div key={comp.id || idx} className="flex justify-between">
                  <span className="text-slate-500">
                    {comp.name} <span className="text-[10px] text-slate-400">({comp.type})</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {comp.currency || 'SAR'} {(comp.amount ?? 0).toLocaleString()}{comp.frequency ? ` / ${comp.frequency.toLowerCase()}` : ''}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-2 text-slate-400 text-center">
                No individual components itemized.
              </div>
            )}

            {offer.currentVersion?.monthlyPackage ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                <span className="font-bold text-slate-900 dark:text-white">Gross Monthly Salary</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">
                  SAR {offer.currentVersion.monthlyPackage.toLocaleString()}
                </span>
              </div>
            ) : null}

            {offer.currentVersion?.annualFixed ? (
              <div className="pt-1 flex justify-between">
                <span className="font-bold text-slate-900 dark:text-white">Annual Fixed Package</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  SAR {offer.currentVersion.annualFixed.toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>

          {/* Benefits Section */}
          {offer.currentVersion?.components && offer.currentVersion.components.filter((c) => c.type === 'Benefit').length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Included Benefits</h3>
              <div className="space-y-1.5 text-xs">
                {offer.currentVersion.components
                  .filter((c) => c.type === 'Benefit')
                  .map((b, idx) => (
                    <div key={b.id || idx} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Icon name="check" size={12} className="text-emerald-500" /> {b.name}
                      </span>
                      {b.amount ? (
                        <span className="text-slate-400 text-[11px]">
                          {b.currency || 'SAR'} {Number(b.amount).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>
          )}
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
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(offer.status)}`}>
                  Offer {offer.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Offered On</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              {offer.status === 'Accepted' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Accepted On</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {offer.updatedAt ? new Date(offer.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Valid Until</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.currentVersion?.offerExpiry ? new Date(offer.currentVersion.offerExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Start Date</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.currentVersion?.proposedJoiningDate ? new Date(offer.currentVersion.proposedJoiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Probation Period</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.currentVersion?.probationPeriod || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Work Location</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.currentVersion?.workLocation || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contract Type</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.currentVersion?.contractType || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Working Schedule</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {offer.currentVersion?.workingSchedule || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Attached Offer Letter Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Attached Offer Letter</h3>
              {offer.currentVersion && (
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Preview letter
                </button>
              )}
            </div>

            {offer.currentVersion ? (
              <>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Icon name="file-text" size={16} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                        Offer_Letter_{(candidateDisplayName).replace(/[^\w.-]+/g, '_')}_{offer.offerCode}.txt
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Version {offer.currentVersion.versionNumber} &bull; Generated {offer.currentVersion.createdAt ? new Date(offer.currentVersion.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Active'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadOfferLetter}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Download
                    </button>
                  </div>
                </div>
                {offer.currentVersion.createdAt && (
                  <p className="text-[10px] text-slate-400">
                    Generated on {new Date(offer.currentVersion.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </>
            ) : (
              <PageState
                kind="empty"
                title="No letter content"
                description="No active offer version or letter content available."
              />
            )}
          </div>
        </div>

        {/* Column 3: Approvals Timeline (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
            Approvals Timeline
          </h2>

          <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 space-y-5 text-xs ml-2 py-1">
            {offer.currentVersion?.approvals && offer.currentVersion.approvals.length > 0 ? (
              offer.currentVersion.approvals.map((app, idx) => {
                const isApproved = app.status === 'Approved';
                const isRejected = app.status === 'Rejected';
                return (
                  <div key={app.id || idx} className="relative">
                    <div
                      className={`absolute -left-[31px] top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white ${
                        isApproved
                          ? 'bg-emerald-500'
                          : isRejected
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                      }`}
                    >
                      {isApproved ? '✓' : isRejected ? '✗' : '●'}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="block font-bold text-slate-900 dark:text-white">
                          {app.roleCode ? app.roleCode.replace(/_/g, ' ') : 'Approval'}
                        </span>
                        <span className="block text-[10.5px] text-slate-400">
                          {app.approverName || 'Assigned Approver'} &bull; <span className="font-semibold">{app.status}</span>
                        </span>
                        {app.comment && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">"{app.comment}"</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {app.decidedAt ? new Date(app.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-400 py-2">
                No formal approval workflow recorded for this version.
              </div>
            )}

            {/* Status milestone: Sent */}
            {(offer.status === 'Sent' || offer.status === 'Accepted') && (
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">
                  ✓
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Offer Sent to Candidate</span>
                    <span className="block text-[10.5px] text-slate-400">Dispatched</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {offer.updatedAt ? new Date(offer.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Status milestone: Accepted */}
            {offer.status === 'Accepted' && (
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                  ✓
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Offer Accepted</span>
                    <span className="block text-[10.5px] text-slate-400">{candidateDisplayName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {offer.updatedAt ? new Date(offer.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            )}
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
            <span className="text-xs font-bold text-slate-500">
              {joiningCase ? 'Managed in Joining Case' : offer.status === 'Accepted' ? 'Awaiting Case Creation' : 'Activates on Acceptance'}
            </span>
          </div>

          {joiningCase ? (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <strong className="text-slate-900 dark:text-white block font-bold">
                  Onboarding &amp; Compliance Workflow Active
                </strong>
                <p className="text-slate-500 dark:text-slate-400">
                  Pre-employment verification, documentation, and equipment readiness are tracked live within the candidate joining case.
                </p>
              </div>
              <Button variant="primary" size="sm" asChild>
                <Link to={`/hires/${joiningCase.id}`}>
                  <Icon name="arrow-right" size={13} />
                  View Joining Case
                </Link>
              </Button>
            </div>
          ) : offer.status === 'Accepted' ? (
            <div className="p-5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
              Offer is accepted by candidate. Initiate the joining case in the Next Step banner above to activate pre-hire compliance checks.
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-500">
              Pre-hire checklist and onboarding readiness will activate once the candidate accepts this offer.
            </div>
          )}
        </div>

        {/* Notes (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Internal Notes
            </h2>
            <span className="text-xs font-bold text-slate-500">
              {notesList.length} note{notesList.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {notesList.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
                No internal notes recorded yet.
              </div>
            ) : (
              notesList.map((n, i) => (
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
              ))
            )}

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

      {/* Offer Letter Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={`Offer Letter Preview — ${offer.offerCode || 'Offer'}`}
        maxWidthClass="max-w-2xl"
      >
        {offer.currentVersion ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Employment Offer Package</h4>
                  <p className="text-slate-500 text-[11px]">Position: <strong className="text-slate-800 dark:text-slate-200">{positionDisplayName}</strong></p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(offer.status)}`}>
                  Offer {offer.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Candidate:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{candidateDisplayName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Offer Code:</span>
                  <strong className="font-mono text-slate-800 dark:text-slate-200">{offer.offerCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Date Offered:</span>
                  <span>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Proposed Start Date:</span>
                  <span>{offer.currentVersion.proposedJoiningDate ? new Date(offer.currentVersion.proposedJoiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Valid Until:</span>
                  <span>{offer.currentVersion.offerExpiry ? new Date(offer.currentVersion.offerExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Work Location:</span>
                  <span>{offer.currentVersion.workLocation || '—'}</span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Compensation Components</h5>
              {offer.currentVersion.components && offer.currentVersion.components.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                        <th className="p-2.5 pl-3">Component</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Frequency</th>
                        <th className="p-2.5 pr-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {offer.currentVersion.components.map((c, i) => (
                        <tr key={c.id || i}>
                          <td className="p-2.5 pl-3 font-semibold text-slate-800 dark:text-slate-200">{c.name}</td>
                          <td className="p-2.5 text-slate-500">{c.type}</td>
                          <td className="p-2.5 text-slate-500">{c.frequency || 'Monthly'}</td>
                          <td className="p-2.5 pr-3 text-right font-bold text-slate-900 dark:text-white">
                            {c.currency || 'SAR'} {(c.amount ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400">
                  No individual components specified.
                </div>
              )}
            </div>

            {offer.currentVersion.monthlyPackage ? (
              <div className="flex justify-between items-center p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total Monthly Package</span>
                <span className="font-black text-blue-700 dark:text-blue-300 text-sm">
                  SAR {offer.currentVersion.monthlyPackage.toLocaleString()}
                </span>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-3 py-1.5 text-slate-500 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownloadOfferLetter}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Icon name="download" size={13} />
                <span>Download Letter</span>
              </button>
            </div>
          </div>
        ) : (
          <PageState
            kind="empty"
            title="No letter content"
            description="No active offer version or letter content available."
          />
        )}
      </Modal>

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
