import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Offer, VacancyDetailView } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { PageState } from '../components/ui/PageState';
import { QuickGuideTrigger } from '../quickguide';
import './PageEnhancementsV2.css';

interface OfferRow {
  id: string;
  vacancyId?: string;
  offerCode: string;
  candidateName: string;
  candidateType: string;
  candidateAvatar: string;
  positionTitle: string;
  department: string;
  location: string;
  ownerName: string;
  ownerAvatar: string;
  ownerRole: string;
  monthlySalary: string;
  bonus: string;
  approverName: string;
  approverRole: string;
  approverAvatar: string;
  expiryDate: string;
  daysLeft: string;
  daysLeftTone: 'red' | 'amber' | 'green' | 'gray';
  lastActivity: string;
  lastActivityTime: string;
  nextAction: string;
  nextActionSub: string;
  status: string;
}

export function OffersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');
  const [currentVacancy, setCurrentVacancy] = useState<VacancyDetailView | null>(null);

  const [apiOffers, setApiOffers] = useState<OfferRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePill, setActivePill] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateOfferModalOpen, setIsCreateOfferModalOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setIsLoading(true);
    const offersPromise = getApi<Offer[]>('/offers');
    const vacancyPromise = vacancyId ? getApi<VacancyDetailView>(`/vacancies/${vacancyId}`) : Promise.resolve(null);

    Promise.allSettled([offersPromise, vacancyPromise])
      .then(([offersRes, vacRes]) => {
        if (vacRes.status === 'fulfilled' && vacRes.value) {
          setCurrentVacancy(vacRes.value);
        } else {
          setCurrentVacancy(null);
        }

        const res = offersRes.status === 'fulfilled' ? offersRes.value : [];
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        const filteredList = list.filter((o: any) => {
          if (!vacancyId) return true;
          const appVacId = o.vacancyId || o.application?.vacancyId || o.application?.vacancy?.id;
          return appVacId === vacancyId;
        });

        const mapped: OfferRow[] = filteredList.map((o: any) => {
          const candidateName =
            o.candidateName ||
            (o.application?.candidate
              ? `${o.application.candidate.firstName} ${o.application.candidate.lastName}`.trim()
              : null) ||
            'Unknown candidate';

          const initials =
            candidateName
              .split(' ')
              .map((n: string) => n[0])
              .filter(Boolean)
              .join('')
              .substring(0, 2)
              .toUpperCase() || 'UC';

          const ownerName = o.createdByName || 'Unassigned';
          const ownerInitials =
            ownerName === 'Unassigned'
              ? 'UN'
              : ownerName
                  .split(' ')
                  .map((n: string) => n[0])
                  .filter(Boolean)
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || 'OA';

          const currentVer = o.currentVersion;
          let monthlySalary = '—';
          let bonus = '';

          if (currentVer) {
            if (typeof currentVer.monthlyPackage === 'number' && currentVer.monthlyPackage > 0) {
              monthlySalary = `SAR ${currentVer.monthlyPackage.toLocaleString()} / month`;
            } else if (Array.isArray(currentVer.components) && currentVer.components.length > 0) {
              const sum = currentVer.components.reduce(
                (acc: number, c: any) => acc + (Number(c.amount) || 0),
                0
              );
              if (sum > 0) {
                const cur = currentVer.components[0]?.currency || 'SAR';
                monthlySalary = `${cur} ${sum.toLocaleString()} / month`;
              }
            }

            if (Array.isArray(currentVer.components)) {
              const bonusComp = currentVer.components.find((c: any) =>
                c.name?.toLowerCase().includes('bonus')
              );
              if (bonusComp && bonusComp.amount) {
                bonus = `+ ${bonusComp.currency || 'SAR'} ${Number(bonusComp.amount).toLocaleString()} bonus`;
              }
            }
          }

          let approverName = '—';
          let approverRole = '—';
          let approverAvatar = 'AP';
          if (currentVer?.approvals && currentVer.approvals.length > 0) {
            const firstApp = currentVer.approvals[0];
            approverName = firstApp.approverName || firstApp.roleCode?.replace(/_/g, ' ') || 'Approver';
            approverRole = firstApp.roleCode ? firstApp.roleCode.replace(/_/g, ' ') : 'Offer Approver';
            approverAvatar =
              approverName
                .split(' ')
                .map((n: string) => n[0])
                .filter(Boolean)
                .join('')
                .substring(0, 2)
                .toUpperCase() || 'AP';
          } else if (o.approverName) {
            approverName = o.approverName;
            approverRole = o.approverRole || 'Approver';
            approverAvatar =
              approverName
                .split(' ')
                .map((n: string) => n[0])
                .filter(Boolean)
                .join('')
                .substring(0, 2)
                .toUpperCase() || 'AP';
          }

          let expiryDate = '—';
          let daysLeft = '—';
          let daysLeftTone: 'red' | 'amber' | 'green' | 'gray' = 'gray';

          if (currentVer?.offerExpiry) {
            const exp = new Date(currentVer.offerExpiry);
            if (!isNaN(exp.getTime())) {
              expiryDate = exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (diffDays < 0) {
                daysLeft = 'Expired';
                daysLeftTone = 'red';
              } else if (diffDays <= 3) {
                daysLeft = `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
                daysLeftTone = 'amber';
              } else {
                daysLeft = `${diffDays} days left`;
                daysLeftTone = 'green';
              }
            }
          }

          let nextAction = 'View Details';
          let nextActionSub = '';
          const st = o.status || 'Draft';
          if (st === 'Draft') {
            nextAction = 'Submit for Approval';
          } else if (st === 'Pending Approval') {
            nextAction = 'Review & Approve';
            nextActionSub = 'Awaiting decision';
          } else if (st === 'Approved') {
            nextAction = 'Send to Candidate';
          } else if (st === 'Sent') {
            nextAction = 'Follow up';
            if (daysLeftTone === 'amber') nextActionSub = 'Expiring soon';
          } else if (st === 'Accepted') {
            nextAction = 'Start Onboarding';
            nextActionSub = 'Ready to hire';
          } else if (st === 'Declined') {
            nextAction = 'Review Feedback';
          } else if (st === 'Expired') {
            nextAction = 'Create Revision';
          }

          const updatedAtTime = o.updatedAt
            ? new Date(o.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : o.createdAt
            ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';

          return {
            id: o.id,
            vacancyId: o.vacancyId || o.application?.vacancyId || o.application?.vacancy?.id,
            offerCode: o.offerCode || '—',
            candidateName,
            candidateType: 'External Candidate',
            candidateAvatar: initials,
            positionTitle: o.positionTitle || o.application?.vacancy?.position?.title || 'No position',
            department: o.department || o.application?.vacancy?.department?.name || '—',
            location: currentVer?.workLocation || o.location || '—',
            ownerName,
            ownerAvatar: ownerInitials,
            ownerRole: o.createdByName ? 'Recruiter' : '—',
            monthlySalary,
            bonus,
            approverName,
            approverRole,
            approverAvatar,
            expiryDate,
            daysLeft,
            daysLeftTone,
            lastActivity: `Status: ${st}`,
            lastActivityTime: updatedAtTime,
            nextAction,
            nextActionSub,
            status: st,
          };
        });
        setApiOffers(mapped);
      })
      .catch(() => {
        setApiOffers([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [vacancyId]);

  const kpiMetrics = useMemo(() => {
    const awaitingApproval = apiOffers.filter(
      (o) => o.status === 'Pending Approval' || o.status === 'Approval'
    ).length;
    const sent = apiOffers.filter((o) => o.status === 'Sent').length;
    const accepted = apiOffers.filter((o) => o.status === 'Accepted').length;
    const expiringSoon = apiOffers.filter(
      (o) => o.daysLeftTone === 'amber' || o.daysLeftTone === 'red'
    ).length;
    const drafts = apiOffers.filter((o) => o.status === 'Draft').length;

    return { awaitingApproval, sent, accepted, expiringSoon, drafts };
  }, [apiOffers]);

  const statusCounts = useMemo(() => {
    return {
      ALL: apiOffers.length,
      Draft: apiOffers.filter((o) => o.status === 'Draft').length,
      'Pending Approval': apiOffers.filter(
        (o) => o.status === 'Pending Approval' || o.status === 'Approval'
      ).length,
      Approved: apiOffers.filter((o) => o.status === 'Approved').length,
      Sent: apiOffers.filter((o) => o.status === 'Sent').length,
      Accepted: apiOffers.filter((o) => o.status === 'Accepted').length,
      Declined: apiOffers.filter((o) => o.status === 'Declined').length,
      Expired: apiOffers.filter((o) => o.status === 'Expired').length,
    };
  }, [apiOffers]);

  const filteredOffers = useMemo(() => {
    return apiOffers.filter((offer) => {
      if (activePill !== 'ALL') {
        if (activePill === 'Pending Approval') {
          if (offer.status !== 'Pending Approval' && offer.status !== 'Approval') return false;
        } else if (offer.status !== activePill) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          offer.candidateName.toLowerCase().includes(q) ||
          offer.positionTitle.toLowerCase().includes(q) ||
          offer.ownerName.toLowerCase().includes(q) ||
          offer.offerCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [apiOffers, activePill, searchQuery]);

  const totalOffers = filteredOffers.length;
  const totalPages = Math.max(1, Math.ceil(totalOffers / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedOffers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOffers.slice(start, start + pageSize);
  }, [filteredOffers, safePage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedOffers.length && paginatedOffers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedOffers.map((o) => o.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'Approved':
        return 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800';
      case 'Approval':
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

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Offers
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Manage and track all job offers throughout the approval and negotiation process.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              isMoreFiltersOpen
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
            }`}
          >
            <Icon name="filter" size={13} className="text-slate-400" />
            <span>{isMoreFiltersOpen ? 'Hide Filters' : 'Filters'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/offers/create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Create Offer</span>
          </button>
        </div>
      </div>

      {/* Position Context Banner (E7.2) */}
      {currentVacancy && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-2xs">
                <Icon name="lock" size={10} />
                Position Offers
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {currentVacancy.vacancyCode}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {currentVacancy.status}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentVacancy.position?.title || currentVacancy.title || 'Job Position'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {(currentVacancy as unknown as { department?: string })?.department || currentVacancy.branch?.name || 'Department'} &bull;{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {apiOffers.length} offer{apiOffers.length === 1 ? '' : 's'} recorded
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/vacancies/${currentVacancy.id}`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-xs cursor-pointer"
            >
              <Icon name="arrow-left" size={13} />
              <span>Back to Overview</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/offers')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="View all offers across all vacancies"
            >
              <span>View All Offers</span>
            </button>
          </div>
        </div>
      )}

      {/* Expandable filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-500">Filter by Status:</span>
          {(['ALL', 'Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined', 'Expired'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setActivePill(st);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                activePill === st
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Offers' : st}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setActivePill('ALL');
              setSearchQuery('');
              setPage(1);
            }}
            className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {/* ── Top 5 KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1 */}
        <div
          onClick={() => { setActivePill('Pending Approval'); setPage(1); }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2 relative group cursor-pointer hover:border-blue-300 transition"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Icon name="file-text" size={18} />
            </div>
            <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Awaiting Approval</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {kpiMetrics.awaitingApproval}
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mt-1">
              Pending review
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => { setActivePill('Sent'); setPage(1); }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2 cursor-pointer hover:border-blue-300 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Icon name="send" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Sent Offers</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {kpiMetrics.sent}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-slate-400">Awaiting candidate</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => { setActivePill('Accepted'); setPage(1); }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2 cursor-pointer hover:border-blue-300 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Accepted</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {kpiMetrics.accepted}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Ready to hire</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Expiring / Overdue</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {kpiMetrics.expiringSoon}
            </span>
            <span className="text-xs font-medium text-slate-400 block mt-1">Requires follow-up</span>
          </div>
        </div>

        {/* Card 5 */}
        <div
          onClick={() => { setActivePill('Draft'); setPage(1); }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2 cursor-pointer hover:border-blue-300 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Icon name="file-text" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Draft Offers</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {kpiMetrics.drafts}
            </span>
            <span className="text-xs font-medium text-slate-400 block mt-1">In progress</span>
          </div>
        </div>
      </div>

      {/* ── Filter Pills & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold pb-1">
          {[
            { key: 'ALL', label: 'All Offers', count: statusCounts.ALL },
            { key: 'Draft', label: 'Draft', count: statusCounts.Draft },
            { key: 'Pending Approval', label: 'Approval', count: statusCounts['Pending Approval'] },
            { key: 'Approved', label: 'Approved', count: statusCounts.Approved },
            { key: 'Sent', label: 'Sent', count: statusCounts.Sent },
            { key: 'Accepted', label: 'Accepted', count: statusCounts.Accepted },
            { key: 'Declined', label: 'Declined', count: statusCounts.Declined },
            { key: 'Expired', label: 'Expired', count: statusCounts.Expired },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => {
                setActivePill(pill.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap transition cursor-pointer ${
                activePill === pill.key
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{pill.label}</span>
              <span className="ml-1.5 opacity-70">&bull; {pill.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search offers..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <PageState
              kind="loading"
              title="Loading offers..."
              description="Fetching offer records from server."
            />
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="p-8">
            <PageState
              kind="empty"
              title={apiOffers.length === 0 ? 'No offers found' : 'No matching offers'}
              description={
                apiOffers.length === 0
                  ? 'No job offers have been created yet. Create a new offer to get started.'
                  : 'No offers match your current filter and search criteria.'
              }
              actionLabel={apiOffers.length === 0 ? 'Create Offer' : 'Reset Filters'}
              onAction={() => {
                if (apiOffers.length === 0) {
                  navigate('/offers/new');
                } else {
                  setActivePill('ALL');
                  setSearchQuery('');
                  setPage(1);
                }
              }}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 text-left">
                    <th className="p-3.5 pl-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedOffers.length && paginatedOffers.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-3">Candidate</th>
                    <th className="py-3.5 px-3">Position</th>
                    <th className="py-3.5 px-3">Owner</th>
                    <th className="py-3.5 px-3">Compensation</th>
                    <th className="py-3.5 px-3">Approver</th>
                    <th className="py-3.5 px-3">Expiry Date</th>
                    <th className="py-3.5 px-3">Last Activity</th>
                    <th className="py-3.5 px-3">Next Action</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 pr-4 text-right">
                      <Icon name="settings" size={13} className="text-slate-400 inline" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedOffers.map((offer) => (
                    <tr
                      key={offer.id}
                      onClick={() => navigate(`/offers/${offer.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(offer.id)}
                          onChange={() => toggleSelectOne(offer.id)}
                          className="rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </td>

                      {/* Candidate */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {offer.candidateAvatar}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                              {offer.candidateName}
                            </span>
                            <span className="block text-[10.5px] text-slate-400 font-mono">
                              {offer.offerCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-800 dark:text-slate-200">
                            {offer.positionTitle}
                          </span>
                          <span className="block text-[10.5px] text-slate-400">
                            {offer.department !== '—' && offer.location !== '—'
                              ? `${offer.department} • ${offer.location}`
                              : offer.department !== '—'
                              ? offer.department
                              : offer.location !== '—'
                              ? offer.location
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                            {offer.ownerAvatar}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                              {offer.ownerName}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {offer.ownerRole}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Compensation */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">
                            {offer.monthlySalary}
                          </span>
                          {offer.bonus ? (
                            <span className="block text-[10.5px] text-slate-400">
                              {offer.bonus}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Approver */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-teal-700 text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                            {offer.approverAvatar}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                              {offer.approverName}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {offer.approverRole}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-800 dark:text-slate-200">
                            {offer.expiryDate}
                          </span>
                          {offer.daysLeft !== '—' && (
                            <span
                              className={`block text-[10.5px] font-bold ${
                                offer.daysLeftTone === 'red'
                                  ? 'text-rose-600'
                                  : offer.daysLeftTone === 'amber'
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {offer.daysLeft}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-800 dark:text-slate-200">
                            {offer.lastActivity}
                          </span>
                          <span className="block text-[10.5px] text-slate-400">
                            {offer.lastActivityTime}
                          </span>
                        </div>
                      </td>

                      {/* Next Action */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-blue-600 dark:text-blue-400 hover:underline">
                            {offer.nextAction}
                          </span>
                          {offer.nextActionSub && (
                            <span className="block text-[10.5px] text-amber-600 font-semibold">
                              {offer.nextActionSub}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${getStatusBadge(offer.status)}`}>
                          {offer.status}
                        </span>
                      </td>

                      {/* Row Menu */}
                      <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/offers/${offer.id}`)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          title="View offer details"
                        >
                          <Icon name="more-horizontal" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with Pagination */}
            <div className="p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
              <span>
                Showing {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, totalOffers)} of {totalOffers} offer{totalOffers === 1 ? '' : 's'}
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                        safePage === num
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Offer Modal */}
      <Modal
        isOpen={isCreateOfferModalOpen}
        onClose={() => setIsCreateOfferModalOpen(false)}
        title="Create New Offer Package"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Candidate</label>
            <input
              type="text"
              placeholder="Enter candidate name or ID"
              className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="font-bold block mb-1">Basic Monthly Salary (SAR)</label>
            <input
              type="number"
              placeholder="e.g. 20000"
              className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOfferModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOfferModalOpen(false)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Save Offer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default OffersPage;
