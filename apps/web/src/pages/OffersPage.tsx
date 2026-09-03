import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import './PageEnhancementsV2.css';

interface OfferRow {
  id: string;
  candidateName: string;
  candidateType: 'Internal Candidate' | 'External Candidate';
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
  status: 'Approval' | 'Sent' | 'Accepted' | 'Expired' | 'Declined' | 'Draft';
}

const DEFAULT_OFFERS: OfferRow[] = [
  {
    id: 'OFF-2026-1157',
    candidateName: 'Ali Hassan',
    candidateType: 'Internal Candidate',
    candidateAvatar: 'AH',
    positionTitle: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    ownerRole: 'Senior Recruiter',
    monthlySalary: 'SAR 28,000 / month',
    bonus: '+ 15% annual bonus',
    approverName: 'Ahmed Tarek',
    approverRole: 'Engineering Manager',
    approverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80',
    expiryDate: '12 Sep 2026',
    daysLeft: '3 days left',
    daysLeftTone: 'amber',
    lastActivity: 'Offer updated',
    lastActivityTime: 'Today, 9:12 AM',
    nextAction: 'Approval',
    nextActionSub: 'Due today',
    status: 'Approval',
  },
  {
    id: 'OFF-2026-1158',
    candidateName: 'Mona Khaled',
    candidateType: 'External Candidate',
    candidateAvatar: 'MK',
    positionTitle: 'Product Manager',
    department: 'Digital Health',
    location: 'Riyadh, KSA',
    ownerName: 'Mona Saleh',
    ownerAvatar: 'MS',
    ownerRole: 'HR Business Partner',
    monthlySalary: 'SAR 32,000 / month',
    bonus: '+ 20% annual bonus',
    approverName: 'Omar Ashraf',
    approverRole: 'Director, Digital Health',
    approverAvatar: 'OA',
    expiryDate: '15 Sep 2026',
    daysLeft: '6 days left',
    daysLeftTone: 'green',
    lastActivity: 'Offer sent',
    lastActivityTime: 'Today, 10:05 AM',
    nextAction: 'Follow up',
    nextActionSub: 'In 2 days',
    status: 'Sent',
  },
  {
    id: 'OFF-2026-1159',
    candidateName: 'Islam Fathy',
    candidateType: 'External Candidate',
    candidateAvatar: 'IF',
    positionTitle: 'Backend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    ownerRole: 'Senior Recruiter',
    monthlySalary: 'SAR 22,000 / month',
    bonus: '+ 10% annual bonus',
    approverName: 'Ahmed Tarek',
    approverRole: 'Engineering Manager',
    approverAvatar: 'AT',
    expiryDate: '10 Sep 2026',
    daysLeft: '1 day left',
    daysLeftTone: 'amber',
    lastActivity: 'Candidate viewed',
    lastActivityTime: 'Yesterday, 4:20 PM',
    nextAction: 'Candidate Follow up',
    nextActionSub: '',
    status: 'Sent',
  },
  {
    id: 'OFF-2026-1160',
    candidateName: 'Nourhan Sami',
    candidateType: 'Internal Candidate',
    candidateAvatar: 'NS',
    positionTitle: 'ICU Nurse',
    department: 'Clinical Ops',
    location: 'Jeddah, KSA',
    ownerName: 'Lina Hassan',
    ownerAvatar: 'LH',
    ownerRole: 'HR Business Partner',
    monthlySalary: 'SAR 14,000 / month',
    bonus: '+ Shift allowance',
    approverName: 'Noha Farouk',
    approverRole: 'Nursing Manager',
    approverAvatar: 'NF',
    expiryDate: '18 Sep 2026',
    daysLeft: '9 days left',
    daysLeftTone: 'green',
    lastActivity: 'Offer accepted',
    lastActivityTime: '2 days ago',
    nextAction: 'Onboarding Setup',
    nextActionSub: '',
    status: 'Accepted',
  },
  {
    id: 'OFF-2026-1161',
    candidateName: 'Yousef Ali',
    candidateType: 'External Candidate',
    candidateAvatar: 'YA',
    positionTitle: 'Data Analyst',
    department: 'Strategy & Analytics',
    location: 'Riyadh, KSA',
    ownerName: 'Sara Mohamed',
    ownerAvatar: 'SM',
    ownerRole: 'Data Analyst',
    monthlySalary: 'SAR 16,000 / month',
    bonus: '+ 10% annual bonus',
    approverName: 'Omar Farouk',
    approverRole: 'Head of Analytics',
    approverAvatar: 'OF',
    expiryDate: '8 Sep 2026',
    daysLeft: 'Expired',
    daysLeftTone: 'red',
    lastActivity: 'Offer expired',
    lastActivityTime: '3 days ago',
    nextAction: 'Create new offer',
    nextActionSub: '',
    status: 'Expired',
  },
  {
    id: 'OFF-2026-1162',
    candidateName: 'Ahmed Mostafa',
    candidateType: 'External Candidate',
    candidateAvatar: 'AM',
    positionTitle: 'Radiology Technologist',
    department: 'Clinical Ops',
    location: 'Dammam, KSA',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    ownerRole: 'Senior Recruiter',
    monthlySalary: 'SAR 18,000 / month',
    bonus: '+ Shift allowance',
    approverName: 'Noha Farouk',
    approverRole: 'Clinical Ops Manager',
    approverAvatar: 'NF',
    expiryDate: '14 Sep 2026',
    daysLeft: '5 days left',
    daysLeftTone: 'green',
    lastActivity: 'Awaiting approval',
    lastActivityTime: 'Yesterday, 11:30 AM',
    nextAction: 'Reminder to approver',
    nextActionSub: '',
    status: 'Approval',
  },
  {
    id: 'OFF-2026-1163',
    candidateName: 'Heba Mohamed',
    candidateType: 'External Candidate',
    candidateAvatar: 'HM',
    positionTitle: 'DevOps Engineer',
    department: 'Engineering',
    location: 'Jeddah, KSA',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    ownerRole: 'Senior Recruiter',
    monthlySalary: 'SAR 24,000 / month',
    bonus: '+ 15% annual bonus',
    approverName: 'Ahmed Tarek',
    approverRole: 'Engineering Manager',
    approverAvatar: 'AT',
    expiryDate: '20 Sep 2026',
    daysLeft: '11 days left',
    daysLeftTone: 'green',
    lastActivity: 'Offer declined',
    lastActivityTime: '5 days ago',
    nextAction: 'Review feedback',
    nextActionSub: '',
    status: 'Declined',
  },
  {
    id: 'OFF-2026-1164',
    candidateName: 'Omar Ashraf',
    candidateType: 'Internal Candidate',
    candidateAvatar: 'OA',
    positionTitle: 'UX Designer',
    department: 'Digital Health',
    location: 'Cairo, Egypt',
    ownerName: 'Mona Saleh',
    ownerAvatar: 'MS',
    ownerRole: 'HR Business Partner',
    monthlySalary: 'SAR 17,000 / month',
    bonus: '+ 10% annual bonus',
    approverName: 'Omar Ashraf',
    approverRole: 'Director, Digital Health',
    approverAvatar: 'OF',
    expiryDate: '16 Sep 2026',
    daysLeft: '7 days left',
    daysLeftTone: 'green',
    lastActivity: 'Draft created',
    lastActivityTime: '6 days ago',
    nextAction: 'Complete details',
    nextActionSub: '',
    status: 'Draft',
  },
];

export function OffersPage() {
  const navigate = useNavigate();
  const [apiOffers, setApiOffers] = useState<OfferRow[]>([]);
  const [activePill, setActivePill] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateOfferModalOpen, setIsCreateOfferModalOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    getApi<any>('/offers')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          const mapped: OfferRow[] = list.map((o: any) => {
            const candidateName = o.application?.candidate
              ? `${o.application.candidate.firstName} ${o.application.candidate.lastName}`
              : (o.candidateName || 'Candidate');
            const initials = candidateName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'CD';
            return {
              id: o.offerCode || o.id,
              candidateName,
              candidateType: 'External Candidate',
              candidateAvatar: initials,
              positionTitle: o.application?.positionTitle || o.positionTitle || 'Specialist Role',
              department: o.department || 'Clinical Operations',
              location: o.location || 'SGH Jeddah',
              ownerName: o.createdByName || 'Sarah Ahmed',
              ownerAvatar: 'SA',
              ownerRole: 'Recruiter',
              monthlySalary: o.monthlySalary ? `SAR ${Number(o.monthlySalary).toLocaleString()} / month` : 'SAR 32,000 / month',
              bonus: '+ 15% annual bonus',
              approverName: o.approverName || 'Executive Committee',
              approverRole: 'Medical Director',
              approverAvatar: 'MD',
              expiryDate: o.offerExpiry ? new Date(o.offerExpiry).toLocaleDateString() : 'In 7 days',
              daysLeft: '6 days left',
              daysLeftTone: 'green',
              lastActivity: 'Offer package synced',
              lastActivityTime: 'Today',
              nextAction: o.status === 'Draft' ? 'Submit for Approval' : 'Follow up',
              nextActionSub: '',
              status: (o.status as any) || 'Sent',
            };
          });
          setApiOffers(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const offers = apiOffers.length > 0 ? apiOffers : DEFAULT_OFFERS;

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (activePill !== 'ALL' && offer.status !== activePill) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          offer.candidateName.toLowerCase().includes(q) ||
          offer.positionTitle.toLowerCase().includes(q) ||
          offer.ownerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [offers, activePill, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOffers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOffers.map((o) => o.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: OfferRow['status']) => {
    switch (status) {
      case 'Accepted':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'Approval':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      case 'Sent':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Declined':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      case 'Expired':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
      case 'Draft':
      default:
        return 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 border border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header matching 11-offers.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Offers
          </h1>
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
            onClick={() => navigate('/offers/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Create Offer</span>
          </button>
        </div>
      </div>

      {/* Expandable filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-500">Filter by Status:</span>
          {['ALL', 'Draft', 'Approved', 'Sent', 'Accepted', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setActivePill(st)}
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2 relative group cursor-pointer hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Icon name="file-text" size={18} />
            </div>
            <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Awaiting Approval</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">6</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block mt-1">2 overdue</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Icon name="send" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Sent Today</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">4</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-slate-400">vs yesterday</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+33%</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Accepted</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">9</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-slate-400">vs last 7 days</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+29%</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Expiring Soon</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">5</span>
            <span className="text-xs font-medium text-slate-400 block mt-1">next 7 days</span>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <Icon name="alert-triangle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Overdue Approvals</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">2</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block mt-1">requires attention</span>
          </div>
        </div>
      </div>

      {/* ── Filter Pills & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold pb-1">
          {[
            { key: 'ALL', label: 'All Offers', count: 26 },
            { key: 'Draft', label: 'Draft', count: 3 },
            { key: 'Approval', label: 'Approval', count: 6 },
            { key: 'Sent', label: 'Sent', count: 8 },
            { key: 'Accepted', label: 'Accepted', count: 9 },
            { key: 'Declined', label: 'Declined', count: 3 },
            { key: 'Expired', label: 'Expired', count: 2 },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setActivePill(pill.key)}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offers..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ── Table matching 11-offers.png ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 text-left">
                <th className="p-3.5 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredOffers.length && filteredOffers.length > 0}
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
              {filteredOffers.map((offer) => (
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
                        <span className="block text-[10.5px] text-slate-400">
                          {offer.candidateType}
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
                        {offer.department} &bull; {offer.location}
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
                      <span className="block text-[10.5px] text-slate-400">
                        {offer.bonus}
                      </span>
                    </div>
                  </td>

                  {/* Approver */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      {offer.approverAvatar.startsWith('http') ? (
                        <img
                          src={offer.approverAvatar}
                          alt={offer.approverName}
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-teal-700 text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                          {offer.approverAvatar}
                        </div>
                      )}
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

        {/* Footer with Pagination matching reference */}
        <div className="p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
          <span>Showing {(page - 1) * 8 + 1} to {Math.min(page * 8, 26)} of 26 offers</span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                &lt;
              </button>
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                    page === num
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(3, p + 1))}
                disabled={page === 3}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                &gt;
              </button>
            </div>

            <select className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-700 font-semibold cursor-pointer">
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
            </select>
          </div>
        </div>
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
              defaultValue="Ali Hassan"
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="font-bold block mb-1">Basic Monthly Salary (SAR)</label>
            <input
              type="number"
              defaultValue={28000}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
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
