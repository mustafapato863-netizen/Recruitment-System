import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Candidate, CandidateMetrics, PaginatedResult, Vacancy } from '@recruitflow/contracts';
import { downloadApi, fetchApi, postApi, patchApi, deleteApi, getApi } from '../api/client';
import { getInitials } from '../utils/format';
import { saveBlob } from '../utils/download';
import {
  Alert,
  Button,
  ConfirmDialog,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { confirmDiscardChanges, useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useMasterDataOptions } from '../hooks/useMasterDataOptions';
import { CANDIDATE_SOURCE_FALLBACK } from '../data/masterDataDefaults';
import { QuickGuideTrigger } from '../quickguide';
import './PageEnhancementsV2.css';

interface EditCandidateForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentCompany: string;
  experienceYears: number | string;
  location: string;
  status: 'Active' | 'Blacklisted' | 'Archived';
  source: string;
  skills: string[];
  summary: string;
}

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
  'bg-emerald-800 text-white',
  'bg-purple-600 text-white',
  'bg-amber-800 text-white',
  'bg-teal-800 text-white',
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
  const [metrics, setMetrics] = useState<CandidateMetrics | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Active row action menu
  const [activeMenuCandidateId, setActiveMenuCandidateId] = useState<string | null>(null);

  // Assign to Vacancy Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignCandidate, setAssignCandidate] = useState<Candidate | null>(null);
  const [assignCandidateIds, setAssignCandidateIds] = useState<string[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [vacancySearch, setVacancySearch] = useState('');

  // Edit Candidate Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [editForm, setEditForm] = useState<EditCandidateForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentTitle: '',
    currentCompany: '',
    experienceYears: '',
    location: '',
    status: 'Active',
    source: 'Direct Sourcing',
    skills: [],
    summary: '',
  });
  const [editSkillInput, setEditSkillInput] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Candidate state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Bulk Delete state
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

  // Downloading CV state
  const [downloadingCandidateId, setDownloadingCandidateId] = useState<string | null>(null);

  // Add Candidate Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState<CandidateForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');
  const { options: candidateSourceOptions } = useMasterDataOptions('candidate-sources', CANDIDATE_SOURCE_FALLBACK);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    if (canCreateCandidate) setIsAddModalOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canCreateCandidate, searchParams, setSearchParams]);

  useEffect(() => {
    if (candidateSourceOptions.length === 0) return;
    if (candidateSourceOptions.some((option) => option.name === form.source)) return;
    setForm((current) => ({ ...current, source: candidateSourceOptions[0].name }));
  }, [candidateSourceOptions, form.source]);

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

  const { notify, error: toastError, getErrorMessage } = useFeedback();
  const showToast = (msg: string) => notify(msg);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter);
      if (sourceFilter && sourceFilter !== 'All') params.set('source', sourceFilter);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString() ? `?${params.toString()}` : '';
      const blob = await downloadApi(`/candidates/export.xlsx${query}`);
      saveBlob(blob, `candidates-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Candidate export downloaded successfully.');
    } catch {
      setError('Failed to export candidates to Excel.');
      toastError(new Error('Failed to export candidates to Excel.'), 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const copyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    showToast(`Copied ${code} to clipboard`);
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
      try {
        setMetrics(await fetchApi<CandidateMetrics>('/candidates/metrics'));
      } catch {
        setMetrics(null);
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load candidates');
      setError(message);
      toastError(err, 'Unable to load candidates');
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

  // Close row action menu on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.rf-row-action-menu-container')) {
        setActiveMenuCandidateId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuCandidateId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 1. Assign to Vacancy
  const openAssignModal = async (candidate?: Candidate) => {
    setActiveMenuCandidateId(null);
    setAssignError(null);
    setVacancySearch('');
    if (candidate) {
      setAssignCandidate(candidate);
      setAssignCandidateIds([candidate.id]);
    } else {
      setAssignCandidate(null);
      setAssignCandidateIds(selectedCandidateIds);
    }
    setIsAssignModalOpen(true);

    if (vacancies.length === 0) {
      setVacanciesLoading(true);
      try {
        const res = await getApi<Vacancy[] | { data: Vacancy[] }>('/vacancies?pageSize=100');
        const list = Array.isArray(res) ? res : res.data ?? [];
        setVacancies(list);
        if (list.length > 0) {
          setSelectedVacancyId((prev) => prev || list[0].id);
        }
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Failed to load vacancies list.');
        setAssignError(message);
        toastError(err, 'Unable to load vacancies');
      } finally {
        setVacanciesLoading(false);
      }
    }
  };

  const handleConfirmAssign = async () => {
    if (!selectedVacancyId) {
      setAssignError('Please select a target job requisition.');
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      const targetIds = assignCandidate ? [assignCandidate.id] : assignCandidateIds;
      const results = await Promise.allSettled(
        targetIds.map((cId) =>
          postApi('/applications', {
            candidateId: cId,
            vacancyId: selectedVacancyId,
          }),
        ),
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      const targetVacancy = vacancies.find((v) => v.id === selectedVacancyId);
      const vacTitle = targetVacancy?.title || targetVacancy?.position?.title || 'Requisition';

      if (successCount > 0) {
        showToast(
          `✓ Successfully assigned ${
            assignCandidate
              ? `${assignCandidate.firstName} ${assignCandidate.lastName}`
              : `${successCount} candidate${successCount > 1 ? 's' : ''}`
          } to ${vacTitle}${failedCount > 0 ? ` (${failedCount} already applied)` : ''}`,
        );
        setIsAssignModalOpen(false);
      } else {
        throw new Error(
          failedCount > 0
            ? 'Selected candidate(s) already have an active application for this requisition.'
            : 'Failed to assign candidate.',
        );
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to assign candidate to requisition.');
      setAssignError(message);
      toastError(err, 'Assignment failed');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // 2. Download CV
  const handleDownloadCv = async (c: Candidate) => {
    setActiveMenuCandidateId(null);
    setDownloadingCandidateId(c.id);
    showToast(`Locating CV document for ${c.firstName} ${c.lastName}...`);

    try {
      let downloaded = false;
      try {
        const docs = await getApi<Array<{ id: string; fileName: string; documentType?: string }>>(
          `/documents/candidate/${c.id}`,
        );
        if (Array.isArray(docs) && docs.length > 0) {
          const cvDoc = docs.find((d) => d.documentType === 'CV') || docs[0];
          const blob = await downloadApi(`/documents/${cvDoc.id}/download`);
          saveBlob(blob, cvDoc.fileName || `${c.firstName}_${c.lastName}_CV.pdf`);
          downloaded = true;
          showToast(`Downloaded ${cvDoc.fileName}`);
        }
      } catch {
        // Fall back to generating clean formatted profile CV text if no physical file on server
      }

      if (!downloaded) {
        const cvLines = [
          '================================================================================',
          `                     ${c.firstName.toUpperCase()} ${c.lastName.toUpperCase()} — CURRICULUM VITAE`,
          '================================================================================',
          `Candidate Code: ${c.candidateCode || 'N/A'}`,
          `Email:          ${c.email || 'N/A'}`,
          `Phone:          ${c.phone || 'N/A'}`,
          `Current Title:  ${c.currentTitle || 'Not recorded'}`,
          `Company:        ${c.currentCompany || 'Not recorded'}`,
          `Experience:     ${c.experienceYears ? `${c.experienceYears} Years` : 'Not specified'}`,
          `Location:       ${c.location || 'Not specified'}`,
          `Status:         ${c.status || 'Active'}`,
          `Source:         ${c.source || 'Direct Intake'}`,
          '',
          '--------------------------------------------------------------------------------',
          'PROFESSIONAL SUMMARY',
          '--------------------------------------------------------------------------------',
          c.summary?.trim() || 'No professional summary recorded.',
          '',
          '--------------------------------------------------------------------------------',
          'SKILLS & COMPETENCIES',
          '--------------------------------------------------------------------------------',
          c.skills && c.skills.length > 0
            ? c.skills.map((s) => `• ${s}`).join('\n')
            : 'No skills recorded.',
          '',
          '--------------------------------------------------------------------------------',
          'LANGUAGES',
          '--------------------------------------------------------------------------------',
          c.languages && c.languages.length > 0 ? c.languages.join(', ') : 'Not specified',
          '',
          '--------------------------------------------------------------------------------',
          'CERTIFICATIONS & LICENSES',
          '--------------------------------------------------------------------------------',
          c.certifications && c.certifications.length > 0
            ? c.certifications.map((cert) => `• ${cert}`).join('\n')
            : 'None recorded',
          '',
          '================================================================================',
          `RecruitFlow ATS • Saudi German Health • Generated ${new Date().toLocaleDateString()}`,
          '================================================================================',
        ];

        const blob = new Blob([cvLines.join('\n')], { type: 'text/plain;charset=utf-8' });
        saveBlob(blob, `${c.firstName}_${c.lastName}_Profile_CV.txt`);
        showToast(`Downloaded CV profile document for ${c.firstName} ${c.lastName}`);
      }
    } catch (err: unknown) {
      toastError(err, 'CV download failed');
    } finally {
      setDownloadingCandidateId(null);
    }
  };

  // 3. Edit Candidate
  const openEditModal = (c: Candidate) => {
    setActiveMenuCandidateId(null);
    setEditCandidate(c);
    setEditForm({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      email: c.email || '',
      phone: c.phone || '',
      currentTitle: c.currentTitle || '',
      currentCompany: c.currentCompany || '',
      experienceYears: c.experienceYears ?? '',
      location: c.location || '',
      status: c.status || 'Active',
      source: c.source || 'Direct Sourcing',
      skills: Array.isArray(c.skills) ? [...c.skills] : [],
      summary: c.summary || '',
    });
    setEditSkillInput('');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCandidate) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError('First and last name are required.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const payload: Partial<Candidate> = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        currentTitle: editForm.currentTitle.trim() || null,
        currentCompany: editForm.currentCompany.trim() || null,
        experienceYears: editForm.experienceYears !== '' ? Number(editForm.experienceYears) : null,
        location: editForm.location.trim() || null,
        status: editForm.status,
        source: editForm.source.trim() || null,
        skills: editForm.skills,
        summary: editForm.summary.trim() || null,
      };

      const updated = await patchApi<Candidate>(`/candidates/${editCandidate.id}`, payload);
      setCandidates((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      setIsEditModalOpen(false);
      showToast(`Candidate ${updated.firstName} ${updated.lastName} updated successfully`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to update candidate record.');
      setEditError(message);
      toastError(err, 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  // 4. Delete Candidate
  const openDeleteDialog = (c: Candidate) => {
    setActiveMenuCandidateId(null);
    setDeleteCandidate(c);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteSubmitting(true);
    try {
      await deleteApi(`/candidates/${deleteCandidate.id}`);
      setCandidates((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== deleteCandidate.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setIsDeleteDialogOpen(false);
      showToast(`Candidate ${deleteCandidate.firstName} ${deleteCandidate.lastName} deleted successfully`);
    } catch (err: unknown) {
      toastError(err, 'Delete failed');
      setIsDeleteDialogOpen(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // 5. Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedCandidateIds.length === 0) return;
    setBulkDeleteSubmitting(true);
    try {
      const count = selectedCandidateIds.length;
      await Promise.allSettled(selectedCandidateIds.map((id) => deleteApi(`/candidates/${id}`)));
      setCandidates((prev) => prev.filter((item) => !selectedCandidateIds.includes(item.id)));
      setTotalCount((prev) => Math.max(0, prev - count));
      setSelectedCandidateIds([]);
      setIsBulkDeleteDialogOpen(false);
      showToast(`Deleted ${count} candidate records successfully`);
    } catch (err: unknown) {
      toastError(err, 'Bulk delete failed');
      setIsBulkDeleteDialogOpen(false);
    } finally {
      setBulkDeleteSubmitting(false);
    }
  };

  const handleCreateCandidate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    const hasEmail = /^\S+@\S+\.\S+$/.test(form.email.trim());
    const hasPhone = form.phone.replace(/\D/g, '').length >= 7;
    if (!hasEmail && !hasPhone) {
      setFormError('Enter a valid email address or a phone number with at least 7 digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCandidate = await postApi<Candidate>('/candidates', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: hasEmail ? form.email.trim().toLowerCase() : null,
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
      const msg = getErrorMessage(err, 'Failed to create candidate.');
      if (msg.includes('already exists') || msg.includes('Conflict')) {
        setFormError(`A candidate with email ${form.email} already exists in your organization.`);
        toastError(err, 'Candidate already exists');
      } else {
        setFormError(msg);
        toastError(err, 'Unable to create candidate');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const sources = useMemo<string[]>(() => {
    const list = Array.from(new Set([
      ...candidateSourceOptions.map((option) => option.name),
      ...candidates.map((c) => c.source).filter((s): s is string => Boolean(s)),
    ]));
    return ['All', ...list];
  }, [candidates, candidateSourceOptions]);

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

  const totalDisplayCount = metrics?.totalCandidates ?? totalCount;
  const activeInPipelineCount = metrics?.activeInPipeline ?? 0;
  const talentPoolCount = metrics?.talentPool ?? 0;
  const organicSourcePct = metrics?.directReferralPercentage === null || metrics === null
    ? '—'
    : `${metrics.directReferralPercentage}%`;

  return (
    <div className="flex w-full flex-col p-3 sm:p-4 lg:p-5 max-w-[1720px] mx-auto space-y-5">

      {/* ── Page Header matching Enterprise System ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-600 dark:text-slate-400 uppercase">
            <span>Talent Operations</span>
            <span>&bull;</span>
            <span className="text-blue-600 dark:text-blue-400">Global Talent Directory</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            <h1 className="rf-page-title">
              Candidate Database
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage unique candidate identities, clinical licenses, CV documents, and historic applications.
          </p>
        </div>

        <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => void load()}
            className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={isExporting}
            className="flex min-h-10 items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs cursor-pointer disabled:opacity-50"
            aria-label="Export candidates to Excel"
            title="Export filtered candidate records as XLSX workbook"
          >
            <Icon name={isExporting ? 'refresh-cw' : 'download'} size={13} className={`text-emerald-700 dark:text-emerald-400 ${isExporting ? 'animate-spin' : ''}`} />
            <span>{isExporting ? 'Exporting...' : 'Export XLSX'}</span>
          </button>

          {canCreateCandidate && (
            <>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex min-h-10 items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs cursor-pointer"
              >
                <Icon name="plus" size={13} className="text-blue-600 dark:text-blue-400" />
                <span>Add candidate</span>
              </button>

              <Link
                to="/candidates/compare"
                className="flex min-h-10 items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs cursor-pointer"
              >
                <Icon name="grid-squares" size={13} className="text-purple-600 dark:text-purple-400" />
                <span>Compare</span>
              </Link>

              <Link
                to="/cv-intake"
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-500/20 cursor-pointer"
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
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[#0084ce] before:to-[#00a3e0]">
          <div>
            <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Total Talent Base
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="rf-metric-value">
                {totalDisplayCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                {metrics ? 'Live count' : 'Unavailable'}
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Verified identity records
            </span>
          </div>
          <div className="rf-metric-icon-box rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#0084ce] dark:text-sky-400 flex items-center justify-center shrink-0">
            <Icon name="users" size={20} />
          </div>
        </div>

        {/* Card 2: Active in Pipeline */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-emerald-400 before:to-[#00a859]">
          <div>
            <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Active in Process
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="rf-metric-value">
                {activeInPipelineCount}
              </span>
                <span className="text-[11px] font-bold text-blue-700 dark:text-sky-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                Screening &bull; Interview
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Across active vacancies
            </span>
          </div>
          <div className="rf-metric-icon-box rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#00a859] dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Icon name="pipeline" size={20} />
          </div>
        </div>

        {/* Card 3: In Sourcing Match Bench */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-purple-500 before:to-indigo-500">
          <div>
            <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Sourcing Bench
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="rf-metric-value">
                {talentPoolCount}
              </span>
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                Bench Qualified
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Ready for instant matching
            </span>
          </div>
          <div className="rf-metric-icon-box rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Icon name="star" size={20} />
          </div>
        </div>

        {/* Card 4: Direct & Referrals */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center justify-between before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-amber-400 before:to-amber-500">
          <div>
            <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Direct & Referrals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="rf-metric-value">
                {organicSourcePct}
              </span>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                Zero Agency Fee
              </span>
            </div>
            <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Internal & career portal sources
            </span>
          </div>
          <div className="rf-metric-icon-box rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
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
            onClick={() => navigate('/sourcing-match')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 transition cursor-pointer"
          >
            <Icon name="sparkles" size={13} />
            <span>Smart Match Bench</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-200/60 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-extrabold">
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
              {metrics?.disqualified ?? 0}
            </span>
          </button>
        </div>

        {selectedCandidateIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2 rounded-xl text-xs text-blue-700 dark:text-blue-300 font-bold animate-fade-in border border-blue-200 dark:border-blue-900/60">
            <span>{selectedCandidateIds.length} candidate{selectedCandidateIds.length !== 1 ? 's' : ''} selected</span>
            <button
              type="button"
              onClick={() => void openAssignModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Assign selected candidates to a job vacancy"
            >
              <Icon name="briefcase" size={12} />
              <span>Assign to Vacancy</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/candidates/compare?ids=${selectedCandidateIds.join(',')}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Compare selected candidates side-by-side"
            >
              <Icon name="grid-squares" size={12} />
              <span>Compare Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Delete selected candidates"
            >
              <Icon name="trash-2" size={12} />
              <span>Delete Selected</span>
            </button>
            <button
              type="button"
              onClick={() => showToast(`Added ${selectedCandidateIds.length} candidates to Talent Pool`)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Add to Pool
            </button>
            <span>•</span>
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
            <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none" />
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs cursor-pointer"
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
          <table className="w-full text-xs" aria-label="Candidates">
            <caption className="sr-only">Candidates</caption>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50/60 dark:bg-slate-800/40 text-left">
                <th className="p-3.5 pl-4 w-10">
                  <input
                    type="checkbox" aria-label="Select all candidates"
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
                Array.from({ length: 6 }).map((_, rowIdx) => (
                  <tr key={`candidate-skeleton-${rowIdx}`} className="animate-pulse">
                    <td className="p-3.5 pl-4"><div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                    <td className="p-3.5"><div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-700" /></td>
                  </tr>
                ))
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-600 dark:text-slate-300">
                    <Icon name="users" size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No matching candidates found</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Try adjusting your search keywords or active filters.</p>
                  </td>
                </tr>
              ) : (
                candidates.map((c, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const code = c.candidateCode || 'Code unavailable';
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
                          type="checkbox" aria-label="Select candidate"
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
                            <span className="block text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                              {c.email} {c.phone ? ` • ${c.phone}` : ''}
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
                            className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <Icon name="copy" size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Role & Company */}
                      <td className="py-3.5 px-3">
                        <div className="min-w-0">
                          <strong className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {c.currentTitle || 'Role not specified'}
                          </strong>
                          <span className="block text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                            {c.currentCompany || 'Company not recorded'}
                          </span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>{c.source || 'Source not recorded'}</span>
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
                        <div className="flex items-center justify-end gap-1.5 rf-row-action-menu-container relative">
                          <Link
                            to={`/candidates/${c.id}`}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-400 transition"
                          >
                            Open
                          </Link>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuCandidateId((prev) => (prev === c.id ? null : c.id));
                              }}
                              aria-label={`More options for ${c.firstName} ${c.lastName}`}
                              aria-expanded={activeMenuCandidateId === c.id}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                activeMenuCandidateId === c.id
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 ring-2 ring-blue-500/20'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Icon name="more-horizontal" size={15} />
                            </button>

                            {/* Floating Action Menu Popover */}
                            {activeMenuCandidateId === c.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute right-0 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 py-1.5 text-xs animate-fade-in divide-y divide-slate-100 dark:divide-slate-800 text-left ${
                                  idx >= candidates.length - 1 && candidates.length >= 3
                                    ? 'bottom-full mb-1.5'
                                    : 'top-full mt-1.5'
                                }`}
                              >
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => void openAssignModal(c)}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 font-semibold transition cursor-pointer"
                                  >
                                    <Icon name="briefcase" size={14} className="text-blue-500 shrink-0" />
                                    <span>Assign to Vacancy</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={downloadingCandidateId === c.id}
                                    onClick={() => void handleDownloadCv(c)}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 font-semibold transition cursor-pointer disabled:opacity-50"
                                  >
                                    <Icon
                                      name={downloadingCandidateId === c.id ? 'refresh-cw' : 'download'}
                                      size={14}
                                      className={`text-emerald-500 shrink-0 ${downloadingCandidateId === c.id ? 'animate-spin' : ''}`}
                                    />
                                    <span>{downloadingCandidateId === c.id ? 'Downloading CV...' : 'Download CV'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(c)}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400 font-semibold transition cursor-pointer"
                                  >
                                    <Icon name="edit" size={14} className="text-amber-500 shrink-0" />
                                    <span>Edit Details</span>
                                  </button>
                                  <Link
                                    to={`/candidates/${c.id}`}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition"
                                  >
                                    <Icon name="external-link" size={14} className="text-slate-400 shrink-0" />
                                    <span>Full 360° Profile</span>
                                  </Link>
                                </div>
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => openDeleteDialog(c)}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition cursor-pointer"
                                  >
                                    <Icon name="trash-2" size={14} className="text-rose-500 shrink-0" />
                                    <span>Delete Candidate</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
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
                <FormField id="cand-email" label="Email Address" hint="Optional when a valid phone number is provided; populated emails remain unique.">
                  <Input
                    id="cand-email"
                    type="email"
                    placeholder="e.g. sara.ahmed@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </FormField>

                <FormField id="cand-phone" label="Phone Number" hint="At least one valid contact method is required.">
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
                  {candidateSourceOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
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

      {/* ── Assign to Vacancy Modal ── */}
      {isAssignModalOpen && (
        <Modal
          isOpen={isAssignModalOpen}
          title={
            assignCandidate
              ? `Assign Candidate — ${assignCandidate.firstName} ${assignCandidate.lastName}`
              : `Assign ${assignCandidateIds.length} Candidates to Requisition`
          }
          onClose={() => setIsAssignModalOpen(false)}
          maxWidthClass="max-w-xl"
        >
          <div className="p-2 space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Icon name="briefcase" size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {assignCandidate
                    ? `Assign ${assignCandidate.firstName} ${assignCandidate.lastName} (${assignCandidate.candidateCode || 'Candidate'})`
                    : `Assign ${assignCandidateIds.length} Selected Candidates`}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  An active application record will be generated in the selected requisition pipeline.
                </p>
              </div>
            </div>

            {assignError && (
              <Alert tone="danger" title="Assignment Error">
                {assignError}
              </Alert>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Requisition / Vacancy *
              </label>
              <div className="relative mb-2.5">
                <Icon
                  name="search"
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by role title, code, or department..."
                  value={vacancySearch}
                  onChange={(e) => setVacancySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              {vacanciesLoading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <Icon name="refresh-cw" size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
                  <span>Loading open requisitions...</span>
                </div>
              ) : vacancies.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed rounded-xl">
                  No active requisitions found. Please verify open vacancies exist.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {vacancies
                    .filter((v) => {
                      if (!vacancySearch.trim()) return true;
                      const q = vacancySearch.toLowerCase();
                      const t = (v.title || v.position?.title || '').toLowerCase();
                      const d = (v.department || '').toLowerCase();
                      const c = (v.vacancyCode || v.position?.code || '').toLowerCase();
                      return t.includes(q) || d.includes(q) || c.includes(q);
                    })
                    .map((v) => {
                      const isSelected = selectedVacancyId === v.id;
                      const title = v.title || v.position?.title || 'Open Requisition';
                      const code = v.vacancyCode || v.position?.code || 'VAC';

                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVacancyId(v.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {title}
                              </strong>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                {code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{v.department || 'Clinical Services'}</span>
                              <span>•</span>
                              <span>{v.location || 'Hospital'}</span>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{v.status}</span>
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={assignSubmitting}
                onClick={() => setIsAssignModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={!selectedVacancyId || assignSubmitting}
                loading={assignSubmitting}
                loadingLabel="Assigning..."
                onClick={() => void handleConfirmAssign()}
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Candidate Modal ── */}
      {isEditModalOpen && editCandidate && (
        <Modal
          isOpen={isEditModalOpen}
          title={`Edit Candidate — ${editCandidate.firstName} ${editCandidate.lastName}`}
          onClose={() => setIsEditModalOpen(false)}
          maxWidthClass="max-w-2xl"
        >
          <div className="p-2 space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Icon name="edit" size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Update Candidate Identity Details
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Changes will sync across matching scorecards, talent pool records, and active pipeline applications.
                </p>
              </div>
            </div>

            {editError && (
              <Alert tone="danger" title="Validation Error">
                {editError}
              </Alert>
            )}

            <form className="space-y-3.5" onSubmit={(e) => void handleSaveEdit(e)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField id="edit-cand-fname" label="First Name" required>
                  <Input
                    id="edit-cand-fname"
                    required
                    placeholder="First Name"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </FormField>

                <FormField id="edit-cand-lname" label="Last Name" required>
                  <Input
                    id="edit-cand-lname"
                    required
                    placeholder="Last Name"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField id="edit-cand-email" label="Email Address">
                  <Input
                    id="edit-cand-email"
                    type="email"
                    placeholder="e.g. candidate@example.com"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </FormField>

                <FormField id="edit-cand-phone" label="Phone Number">
                  <Input
                    id="edit-cand-phone"
                    placeholder="e.g. +966 50 000 0000"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField id="edit-cand-title" label="Current Job Title">
                  <Input
                    id="edit-cand-title"
                    placeholder="e.g. HRIS Performance Specialist"
                    value={editForm.currentTitle}
                    onChange={(e) => setEditForm({ ...editForm, currentTitle: e.target.value })}
                  />
                </FormField>

                <FormField id="edit-cand-company" label="Current Company">
                  <Input
                    id="edit-cand-company"
                    placeholder="e.g. Saudi German Health"
                    value={editForm.currentCompany}
                    onChange={(e) => setEditForm({ ...editForm, currentCompany: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField id="edit-cand-exp" label="Total Experience (Years)">
                  <Input
                    id="edit-cand-exp"
                    type="number"
                    min={0}
                    max={60}
                    placeholder="e.g. 5"
                    value={editForm.experienceYears}
                    onChange={(e) => setEditForm({ ...editForm, experienceYears: e.target.value })}
                  />
                </FormField>

                <FormField id="edit-cand-loc" label="Location / City">
                  <Input
                    id="edit-cand-loc"
                    placeholder="e.g. Riyadh, KSA"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField id="edit-cand-status" label="Record Status">
                  <Select
                    id="edit-cand-status"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as 'Active' | 'Blacklisted' | 'Archived' })
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="Blacklisted">Blacklisted / Disqualified</option>
                    <option value="Archived">Archived</option>
                  </Select>
                </FormField>

                <FormField id="edit-cand-source" label="Candidate Source">
                  <Select
                    id="edit-cand-source"
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                  >
                    {candidateSourceOptions.map((opt) => (
                      <option key={opt.id} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {/* Skills Tags Manager */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Skills & Technical Competencies ({editForm.skills.length})
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-2 min-h-11">
                  {editForm.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 text-xs font-bold text-blue-700 dark:text-blue-300"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            skills: editForm.skills.filter((s) => s !== skill),
                          })
                        }
                        className="hover:text-rose-600 transition cursor-pointer"
                        title="Remove skill"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {editForm.skills.length === 0 && (
                    <span className="text-xs text-slate-400 italic py-1">No skills registered yet.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a skill and press Enter..."
                    value={editSkillInput}
                    onChange={(e) => setEditSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const s = editSkillInput.trim();
                        if (s && !editForm.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
                          setEditForm({ ...editForm, skills: [...editForm.skills, s] });
                          setEditSkillInput('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const s = editSkillInput.trim();
                      if (s && !editForm.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
                        setEditForm({ ...editForm, skills: [...editForm.skills, s] });
                        setEditSkillInput('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Summary Textarea */}
              <FormField id="edit-cand-summary" label="Professional Summary & Highlights">
                <Textarea
                  id="edit-cand-summary"
                  rows={3}
                  placeholder="Candidate profile summary, clinical specialties, achievements..."
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                />
              </FormField>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={editSubmitting}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={editSubmitting}
                  loadingLabel="Saving..."
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ── Single Candidate Delete Confirmation Dialog ── */}
      {isDeleteDialogOpen && deleteCandidate && (
        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Candidate Record"
          description={`Are you sure you want to delete ${deleteCandidate.firstName} ${deleteCandidate.lastName} (${deleteCandidate.candidateCode || 'Record'})? All associated applications, interview records, and CV documents will be permanently removed.`}
          confirmLabel="Delete Candidate"
          cancelLabel="Cancel"
          tone="danger"
          isLoading={deleteSubmitting}
        />
      )}

      {/* ── Bulk Delete Confirmation Dialog ── */}
      {isBulkDeleteDialogOpen && (
        <ConfirmDialog
          isOpen={isBulkDeleteDialogOpen}
          onClose={() => setIsBulkDeleteDialogOpen(false)}
          onConfirm={handleConfirmBulkDelete}
          title="Delete Selected Candidates"
          description={`Are you sure you want to permanently delete ${selectedCandidateIds.length} candidate record(s)? This action cannot be undone.`}
          confirmLabel={`Delete ${selectedCandidateIds.length} Candidates`}
          cancelLabel="Cancel"
          tone="danger"
          isLoading={bulkDeleteSubmitting}
        />
      )}
    </div>
  );
}

export default CandidatesPage;
