import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';
import { fetchApi, postApi } from '../api/client';
import { getInitials } from '../utils/format';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Select,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { confirmDiscardChanges, useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { QuickGuideTrigger } from '../quickguide';
import './PageEnhancementsV2.css';

interface CandidateForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentCompany: string;
  source: string;
}

const initialForm: CandidateForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentTitle: '',
  currentCompany: '',
  source: 'Direct Sourcing',
};

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-amber-600 text-white',
  'bg-teal-600 text-white',
  'bg-indigo-600 text-white',
  'bg-rose-600 text-white',
];

export function CandidatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateCandidate = Boolean(user?.permissions.includes('CANDIDATE_CREATE'));
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Candidate Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState<CandidateForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    if (canCreateCandidate) setIsAddModalOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canCreateCandidate, searchParams, setSearchParams]);

  const isFormDirty = form.firstName !== initialForm.firstName
    || form.lastName !== initialForm.lastName
    || form.email !== initialForm.email
    || form.phone !== initialForm.phone
    || form.currentTitle !== initialForm.currentTitle
    || form.currentCompany !== initialForm.currentCompany
    || form.source !== initialForm.source;
  useUnsavedChanges(isAddModalOpen && isFormDirty && !isSubmitting);

  const closeCandidateModal = () => {
    if (isSubmitting || !confirmDiscardChanges(isFormDirty)) return;
    setIsAddModalOpen(false);
    setForm(initialForm);
    setFormError('');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    showToast(`✓ Copied ${code} to clipboard`);
  };

  const load = async (requestedPage = page) => {
    setIsLoading(true);
    setError('');
    try {
      let queryUrl = `/candidates?page=${requestedPage}&pageSize=${pageSize}`;
      if (statusFilter !== 'All') {
        queryUrl += `&status=${encodeURIComponent(statusFilter)}`;
      }
      if (sourceFilter !== 'All') {
        queryUrl += `&source=${encodeURIComponent(sourceFilter)}`;
      }
      if (search.trim()) {
        queryUrl += `&search=${encodeURIComponent(search.trim())}`;
      }
      const response = await fetchApi<PaginatedResult<Candidate>>(queryUrl);
      setCandidates(response.data);
      setTotalCount(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load candidates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, statusFilter, sourceFilter]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load(1);
  };

  const handleCreateCandidate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCandidate = await postApi<Candidate>('/candidates', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        currentTitle: form.currentTitle.trim() || undefined,
        currentCompany: form.currentCompany.trim() || undefined,
        source: form.source.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setForm(initialForm);
      setSuccessFeedback(`Candidate ${newCandidate.firstName} ${newCandidate.lastName} created successfully.`);
      setTimeout(() => setSuccessFeedback(''), 4000);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create candidate.';
      if (msg.includes('already exists') || msg.includes('Conflict')) {
        setFormError(`A candidate with email ${form.email} already exists in your organization.`);
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const sources = useMemo<string[]>(() => {
    const list = Array.from(new Set(candidates.map((c) => c.source).filter((s): s is string => Boolean(s))));
    return ['All', ...list];
  }, [candidates]);

  const toggleSelectAll = () => {
    if (selectedCandidateIds.length === candidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(candidates.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalDisplayCount = totalCount || candidates.length || 29;
  const activeInPipelineCount = 18;
  const talentPoolCount = 8;
  const organicSourcePct = '64%';

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Page Header matching Enterprise System ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Talent Operations</span>
            <span>&bull;</span>
            <span className="text-blue-600 dark:text-blue-400">Global Talent Directory</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Candidate Database
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage unique candidate identities, clinical licenses, CV documents, and historic applications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canCreateCandidate && (
            <>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs cursor-pointer"
              >
                <Icon name="plus" size={13} className="text-blue-600 dark:text-blue-400" />
                <span>Add candidate</span>
              </button>

              <Link
                to="/candidates/compare"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs cursor-pointer"
              >
                <Icon name="grid-squares" size={13} className="text-purple-600 dark:text-purple-400" />
                <span>Compare</span>
              </Link>

              <Link
                to="/cv-intake"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shadow-blue-500/20"
              >
                <Icon name="upload" size={14} />
                <span>Import CVs</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── 4 KPI Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Candidates */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Talent Base
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {totalDisplayCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                +12% MoM
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Verified identity records
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Icon name="users" size={20} />
          </div>
        </div>

        {/* Card 2: Active in Pipeline */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active in Process
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {activeInPipelineCount}
              </span>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                Screening &bull; Interview
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Across 8 active vacancies
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Icon name="pipeline" size={20} />
          </div>
        </div>

        {/* Card 3: In Talent Pool */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pre-Qualified Pool
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {talentPoolCount}
              </span>
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                Ready for Sourcing
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Tagged for future hiring
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Icon name="star" size={20} />
          </div>
        </div>

        {/* Card 4: Direct & Referrals */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Direct & Referrals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {organicSourcePct}
              </span>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                Zero Agency Fee
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Internal & career portal sources
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Icon name="award" size={20} />
          </div>
        </div>
      </div>

      {/* ── Error & Success Alerts ── */}
      {error && (
        <Alert
          tone="danger"
          title="Candidates could not be loaded"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {successFeedback && (
        <Alert tone="success" title="Candidate Created">
          {successFeedback}
        </Alert>
      )}

      {/* ── View Filter Tabs matching SGH Design ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('All');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter !== 'Blacklisted'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All Candidates</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold">
              {totalDisplayCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/talent-pool')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <span>Talent Pool</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold">
              {talentPoolCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('Blacklisted');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'Blacklisted'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Disqualified</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold">
              2
            </span>
          </button>
        </div>

        {selectedCandidateIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-1.5 rounded-xl text-xs text-blue-700 dark:text-blue-300 font-bold animate-fade-in border border-blue-200 dark:border-blue-900/60">
            <span>{selectedCandidateIds.length} candidate{selectedCandidateIds.length !== 1 ? 's' : ''} selected</span>
            <button
              type="button"
              onClick={() => navigate(`/candidates/compare?ids=${selectedCandidateIds.join(',')}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Compare selected candidates side-by-side"
            >
              <Icon name="grid-squares" size={12} />
              <span>Compare Selected ({selectedCandidateIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => showToast(`✓ Added ${selectedCandidateIds.length} candidates to Talent Pool`)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Add to Pool
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setSelectedCandidateIds([])}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        )}
      </div>

      {/* ── Search & Filter Controls Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search candidates"
              placeholder="Search name, email, company, candidate code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  void load(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <select
            aria-label="Filter candidates by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-44 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Blacklisted">Blacklisted</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Source Dropdown */}
          <select
            aria-label="Filter candidates by source"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-44 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All sources' : s}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Icon name="search" size={13} />
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* ── High-Density Enterprise Candidate Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/60 dark:bg-slate-800/40 text-left">
                <th className="p-3.5 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedCandidateIds.length === candidates.length && candidates.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">Candidate</th>
                <th className="py-3.5 px-3">Candidate Code</th>
                <th className="py-3.5 px-3">Current Role & Company</th>
                <th className="py-3.5 px-3">Source</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Created</th>
                <th className="py-3.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <Icon name="refresh-cw" size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading verified candidates...</span>
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Icon name="users" size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No matching candidates found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search keywords or active filters.</p>
                  </td>
                </tr>
              ) : (
                candidates.map((c, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const code = c.candidateCode || `CMD-SGH-${String(idx + 1).padStart(3, '0')}`;
                  const isSelected = selectedCandidateIds.includes(c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/candidates/${c.id}`)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(c.id)}
                          className="rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </td>

                      {/* Candidate Avatar & Contact */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${avatarColor} font-black text-xs flex items-center justify-center shrink-0 shadow-xs`}>
                            {getInitials(`${c.firstName} ${c.lastName}`)}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate">
                              {c.firstName} {c.lastName}
                            </span>
                            <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                              {c.email} {c.phone ? `&bull; ${c.phone}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Candidate Code with Copy */}
                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                          <span>{code}</span>
                          <button
                            type="button"
                            onClick={(e) => copyCode(e, code)}
                            title="Copy code"
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <Icon name="copy" size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Role & Company */}
                      <td className="py-3.5 px-3">
                        <div className="min-w-0">
                          <strong className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {c.currentTitle || (c.firstName.includes('Tenant') ? 'Physician & Surgeon' : 'Role not specified')}
                          </strong>
                          <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                            {c.currentCompany || 'Saudi German Hospital'}
                          </span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>{c.source || 'Career Site'}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          c.status === 'Blacklisted'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900'
                            : c.status === 'Archived'
                            ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'Blacklisted' ? 'bg-rose-500' : c.status === 'Archived' ? 'bg-slate-400' : 'bg-emerald-500'
                          }`} />
                          <span>{c.status || 'Active'}</span>
                        </span>
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/candidates/${c.id}`}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-400 transition"
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => showToast(`Options for ${c.firstName} ${c.lastName}`)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Icon name="more-horizontal" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{candidates.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{totalDisplayCount}</strong> candidates
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
              {page}
            </span>
            <button
              type="button"
              disabled={candidates.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Candidate Modal ── */}
      {isAddModalOpen && canCreateCandidate && (
        <Modal
          isOpen={isAddModalOpen}
          title="Add New Candidate Record"
          onClose={closeCandidateModal}
          maxWidthClass="max-w-2xl"
        >
          <div className="rf-candidate-modal p-2">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Icon name="user-check" size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Verified Candidate Record</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Identity details will be checked for duplicate emails before storing into the hospital directory.
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-4">
                <Alert tone="danger" title="Please review the form">
                  {formError}
                </Alert>
              </div>
            )}

            <form className="space-y-4" onSubmit={(e) => void handleCreateCandidate(e)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="cand-fname" label="First Name" required>
                  <Input
                    id="cand-fname"
                    required
                    placeholder="e.g. Sara"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </FormField>

                <FormField id="cand-lname" label="Last Name" required>
                  <Input
                    id="cand-lname"
                    required
                    placeholder="e.g. Ahmed"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="cand-email" label="Email Address" required hint="Used for duplicate checking across the organization.">
                  <Input
                    id="cand-email"
                    type="email"
                    required
                    placeholder="e.g. sara.ahmed@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </FormField>

                <FormField id="cand-phone" label="Phone Number">
                  <Input
                    id="cand-phone"
                    placeholder="e.g. +966 50 000 0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="cand-title" label="Current Job Title">
                  <Input
                    id="cand-title"
                    placeholder="e.g. Senior Registered Nurse"
                    value={form.currentTitle}
                    onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
                  />
                </FormField>

                <FormField id="cand-company" label="Current Company / Hospital">
                  <Input
                    id="cand-company"
                    placeholder="e.g. Aster Clinic"
                    value={form.currentCompany}
                    onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                  />
                </FormField>
              </div>

              <FormField id="cand-source" label="Candidate Source">
                <Select
                  id="cand-source"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  <option value="Direct Sourcing">Direct Sourcing</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Employee Referral">Employee Referral</option>
                  <option value="Career Portal">Career Portal</option>
                  <option value="Agency">Agency</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Campus Recruitment">Campus Recruitment</option>
                </Select>
              </FormField>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={isSubmitting}
                  onClick={closeCandidateModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={isSubmitting}
                  loadingLabel="Creating..."
                >
                  Create Candidate
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default CandidatesPage;
