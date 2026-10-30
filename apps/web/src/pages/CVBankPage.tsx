import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Clock, Database,
  Download, Eye, FileText, FolderUp, MoreVertical, RefreshCw, Search,
  ShieldCheck, Trash2, Upload, X,
} from 'lucide-react';
import { withReturnTo } from '../v2/returnTarget';
import type { CandidateDocument, CvBankBackupStatus, PaginatedResult } from '@recruitflow/contracts';
import { downloadApi, getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/Modal';
import { PageState } from '../components/ui/PageState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import './PageEnhancementsV2.css';
import '../v2/pages/cv-bank.css';

export function CVBankPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [params, setParams] = useSearchParams();
  const canDownload = Boolean(user?.permissions.includes('DOWNLOAD_DOCUMENTS'));

  const [result, setResult] = useState<PaginatedResult<CandidateDocument> | null>(null);
  const [backupStatus, setBackupStatus] = useState<CvBankBackupStatus | null>(null);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CandidateDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appliedSearch = params.get('search') ?? '';
  const rawPage = params.get('page') ?? '';
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const returnTo = `/cv-bank${params.toString() ? `?${params.toString()}` : ''}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const onDocDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.rf2-cvb__row-actions')) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [openMenuId]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (appliedSearch) query.set('search', appliedSearch);
      const [cvBank, backup] = await Promise.all([
        getApi<PaginatedResult<CandidateDocument>>(`/documents/cv-bank?${query.toString()}`),
        getApi<CvBankBackupStatus>('/documents/cv-bank/backup-status'),
      ]);
      setResult(cvBank);
      setBackupStatus(backup);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the CV Bank.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, appliedSearch]);

  const downloadFile = async (record: CandidateDocument) => {
    if (
      record.scanStatus !== 'Clean' ||
      !record.hasFile ||
      record.consentStatus === 'Withdrawn' ||
      record.consentStatus === 'Expired' ||
      (record.retentionExpiresAt && new Date(record.retentionExpiresAt) <= new Date())
    ) {
      setError('This CV is not available for download because it is not clean, stored, or within its consent and retention rules.');
      return;
    }
    try {
      const blob = await downloadApi(`/documents/${record.id}/download`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = record.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download the CV file.');
    }
  };

  const rawDocuments = useMemo(
    () => (result?.data ?? []).filter((doc) => !deletedIds.includes(doc.id)),
    [result, deletedIds],
  );

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const list = rawDocuments.filter((doc) => {
      const cand = (doc.candidateName || doc.candidateId || '').toLowerCase();
      const file = (doc.fileName || '').toLowerCase();
      if (q && !cand.includes(q) && !file.includes(q)) return false;

      if (statusFilter === 'Parsed' && doc.scanStatus !== 'Clean') return false;
      if (statusFilter === 'Pending' && doc.scanStatus === 'Clean') return false;
      if (statusFilter === 'Stored' && !doc.hasFile) return false;
      if (statusFilter === 'Metadata' && doc.hasFile) return false;

      if (dateFilter) {
        const createdMs = new Date(doc.createdAt).getTime();
        const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
        if (Number.isFinite(createdMs) && now - createdMs > days * 86_400_000) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const nameA = a.candidateName || a.candidateId || '';
      const nameB = b.candidateName || b.candidateId || '';
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }, [rawDocuments, search, statusFilter, dateFilter, sortAsc]);

  const totalRecords = result?.total ?? rawDocuments.length;
  const storedCount = backupStatus?.storedFiles ?? rawDocuments.filter((d) => d.hasFile).length;
  const pendingCount = backupStatus?.pendingFiles ?? rawDocuments.filter((d) => d.scanStatus !== 'Clean').length;

  const allSelected = filteredDocs.length > 0 && filteredDocs.every((d) => selectedIds.includes(d.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDocs.map((d) => d.id));
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleDeleteRecord = (doc: CandidateDocument) => {
    setDeletedIds((prev) => [...prev, doc.id]);
    setOpenMenuId(null);
    show({
      tone: 'success',
      title: 'CV record removed',
      message: `${doc.fileName} was removed from the active CV Bank list.`,
    });
  };

  const handleFileUploadSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    show({
      tone: 'success',
      title: 'CVs queued for parsing',
      message: `${files.length} CV file(s) selected. Opening candidate intake to complete parsing.`,
    });
    event.target.value = '';
    navigate('/candidates');
  };

  return (
    <div className="rf2-cvb">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        hidden
        onChange={handleFileUploadSelected}
      />

      {/* Page Header */}
      <header className="rf2-cvb__header">
        <div>
          <span className="rf2-cvb__eyebrow">Talent / CV Bank</span>
          <h1 className="rf2-cvb__title">CV Bank</h1>
          <p className="rf2-cvb__subtitle">
            Store, parse and manage candidate CVs for easy access and faster hiring.
          </p>
        </div>
        <div className="rf2-cvb__actions">
          <button
            type="button"
            className="rf2-cvb__btn rf2-cvb__btn--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            <span>Upload CVs</span>
          </button>
          <button
            type="button"
            className="rf2-cvb__btn"
            onClick={() => navigate('/candidates')}
          >
            <FolderUp aria-hidden="true" />
            <span>Bulk upload</span>
          </button>
          <button
            type="button"
            className="rf2-cvb__btn"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {error ? (
        <Alert
          tone="danger"
          title="CV Bank unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {/* 3 KPI Summary Cards */}
      <section className="rf2-cvb__kpis" aria-label="CV Bank summary">
        <div className="rf2-cvb__kpi">
          <span className="rf2-cvb__kpi-icon" data-tone="blue" aria-hidden="true">
            <FileText />
          </span>
          <div className="rf2-cvb__kpi-body">
            <span className="rf2-cvb__kpi-label">CV records</span>
            <strong className="rf2-cvb__kpi-value">{totalRecords}</strong>
            <span className="rf2-cvb__kpi-sub">Total candidate CVs in the system</span>
          </div>
        </div>

        <div className="rf2-cvb__kpi">
          <span className="rf2-cvb__kpi-icon" data-tone="green" aria-hidden="true">
            <Database />
          </span>
          <div className="rf2-cvb__kpi-body">
            <span className="rf2-cvb__kpi-label">Stored files</span>
            <strong className="rf2-cvb__kpi-value">{storedCount}</strong>
            <span className="rf2-cvb__kpi-sub">CV files securely stored</span>
          </div>
        </div>

        <div className="rf2-cvb__kpi">
          <span className="rf2-cvb__kpi-icon" data-tone="amber" aria-hidden="true">
            <Clock />
          </span>
          <div className="rf2-cvb__kpi-body">
            <span className="rf2-cvb__kpi-label">Pending review</span>
            <strong className="rf2-cvb__kpi-value">{pendingCount}</strong>
            <span className="rf2-cvb__kpi-sub">CVs ready for review</span>
          </div>
        </div>
      </section>

      {/* Dismissible Info Banner */}
      {!bannerDismissed ? (
        <div className="rf2-cvb__banner" role="region" aria-label="CV storage information">
          <div className="rf2-cvb__banner-left">
            <span className="rf2-cvb__banner-icon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <div className="rf2-cvb__banner-text">
              <p className="rf2-cvb__banner-title">Secure CV storage and automatic parsing</p>
              <p className="rf2-cvb__banner-desc">
                CVs are securely stored, automatically parsed to extract key information, and ready for your review. Use the search and filters to quickly find candidates.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rf2-cvb__banner-close"
            aria-label="Dismiss storage notice"
            onClick={() => setBannerDismissed(true)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Main Candidate CV Records Card */}
      <section className="rf2-cvb__card" aria-labelledby="rf2-cvb-records-heading">
        <div className="rf2-cvb__card-head">
          <h2 id="rf2-cvb-records-heading" className="rf2-cvb__card-title">
            Candidate CV records
          </h2>
          <p className="rf2-cvb__card-sub">
            Search, filter and manage candidate CVs. Click on a candidate to view the parsed details.
          </p>
        </div>

        <div className="rf2-cvb__toolbar">
          <div className="rf2-cvb__filters">
            <div className="rf2-cvb__search-wrap">
              <Search aria-hidden="true" />
              <input
                type="text"
                aria-label="Search CV Bank"
                placeholder="Search candidate or file name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const next = new URLSearchParams();
                    if (search.trim()) next.set('search', search.trim());
                    setParams(next);
                  }
                }}
                className="rf2-cvb__search-input"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rf2-cvb__select"
            >
              <option value="">All statuses</option>
              <option value="Parsed">Parsed</option>
              <option value="Stored">Stored</option>
              <option value="Pending">Pending review</option>
              <option value="Metadata">Metadata only</option>
            </select>

            <select
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="rf2-cvb__select"
            >
              <option value="">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          <span className="rf2-cvb__count">{filteredDocs.length} results</span>
        </div>

        {loading ? (
          <div className="p-4">
            <TableSkeleton columns={6} rows={6} />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-6">
            <PageState
              kind="empty"
              title="No CV records found"
              description={
                search || statusFilter || dateFilter
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Upload a CV from a candidate profile to build the bank.'
              }
            />
          </div>
        ) : (
          <>
            <div className="rf2-cvb__table-wrap">
              <table className="rf2-cvb__table" aria-label="CV Bank records">
                <thead>
                  <tr>
                    <th className="rf2-cvb__th-check">
                      <input
                        type="checkbox"
                        className="rf2-cvb__check"
                        aria-label="Select all CV records"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>
                      <button
                        type="button"
                        className="rf2-cvb__sort-btn"
                        onClick={() => setSortAsc((prev) => !prev)}
                      >
                        <span>Candidate</span>
                        <ArrowUpDown aria-hidden="true" />
                      </button>
                    </th>
                    <th>CV file</th>
                    <th>Parse status</th>
                    <th>File status</th>
                    <th>Added date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const isParsed = doc.scanStatus === 'Clean';
                    const isDownloadable =
                      doc.hasFile &&
                      doc.scanStatus === 'Clean' &&
                      doc.consentStatus !== 'Withdrawn' &&
                      doc.consentStatus !== 'Expired';
                    const candidateLabel = doc.candidateName || doc.candidateId;
                    const menuOpen = openMenuId === doc.id;

                    return (
                      <tr key={doc.id}>
                        <td className="rf2-cvb__td-check">
                          <input
                            type="checkbox"
                            className="rf2-cvb__check"
                            aria-label={`Select ${candidateLabel}`}
                            checked={selectedIds.includes(doc.id)}
                            onChange={() => toggleOne(doc.id)}
                          />
                        </td>
                        <td>
                          <Link
                            className="rf2-cvb__cand-link"
                            to={withReturnTo(`/candidates/${encodeURIComponent(doc.candidateId)}`, returnTo)}
                          >
                            {candidateLabel}
                          </Link>
                        </td>
                        <td>
                          <span className="rf2-cvb__file-name">{doc.fileName}</span>
                        </td>
                        <td>
                          <span
                            className="rf2-cvb__parse-badge"
                            data-tone={isParsed ? 'parsed' : 'pending'}
                          >
                            <CheckCircle2 aria-hidden="true" />
                            <span>{isParsed ? 'Parsed' : doc.scanStatus}</span>
                          </span>
                        </td>
                        <td>
                          <span
                            className="rf2-cvb__stored-status"
                            data-tone={doc.hasFile ? 'stored' : 'meta'}
                          >
                            <span className="rf2-cvb__stored-dot" aria-hidden="true" />
                            <span>{doc.hasFile ? 'Stored' : 'Metadata only'}</span>
                          </span>
                        </td>
                        <td>
                          <span className="rf2-cvb__date">
                            {new Date(doc.createdAt).toLocaleDateString('en-US')}
                          </span>
                        </td>
                        <td>
                          <div className="rf2-cvb__row-actions">
                            <button
                              type="button"
                              className="rf2-cvb__view-btn"
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <Eye aria-hidden="true" />
                              <span>View CV</span>
                            </button>
                            <button
                              type="button"
                              className="rf2-cvb__more-btn"
                              aria-label={`More actions for ${candidateLabel}`}
                              aria-haspopup="menu"
                              aria-expanded={menuOpen}
                              onClick={() => setOpenMenuId((prev) => (prev === doc.id ? null : doc.id))}
                            >
                              <MoreVertical aria-hidden="true" />
                            </button>

                            {menuOpen ? (
                              <div className="rf2-cvb__menu" role="menu" aria-label={`Actions for ${candidateLabel}`}>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="rf2-cvb__menu-item"
                                  disabled={!isDownloadable || !canDownload}
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    void downloadFile(doc);
                                  }}
                                >
                                  <Download aria-hidden="true" />
                                  <span>Download</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="rf2-cvb__menu-item rf2-cvb__menu-item--danger"
                                  onClick={() => handleDeleteRecord(doc)}
                                >
                                  <Trash2 aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="rf2-cvb__footer">
              <span className="rf2-cvb__footer-info">
                Showing 1–{filteredDocs.length} of {totalRecords} candidates
              </span>
              <div className="rf2-cvb__pager">
                <button
                  type="button"
                  className="rf2-cvb__page-btn"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(Math.max(1, page - 1)));
                    setParams(next);
                  }}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="rf2-cvb__page-btn"
                  data-active="true"
                  aria-current="page"
                >
                  {page}
                </button>
                <button
                  type="button"
                  className="rf2-cvb__page-btn"
                  aria-label="Next page"
                  disabled={filteredDocs.length >= totalRecords}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(page + 1));
                    setParams(next);
                  }}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {/* View CV Parsed Details Modal */}
      {previewDoc ? (
        <Modal
          isOpen
          onClose={() => setPreviewDoc(null)}
          title={`CV Record — ${previewDoc.candidateName || previewDoc.candidateId}`}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">File name</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{previewDoc.fileName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Parse & scan status</span>
                <span className="font-semibold text-emerald-600">
                  {previewDoc.scanStatus === 'Clean' ? 'Parsed & Clean' : previewDoc.scanStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Storage status</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {previewDoc.hasFile ? 'Stored in CV Bank' : 'Metadata only'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Added date</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(previewDoc.createdAt).toLocaleDateString('en-US')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {canDownload && previewDoc.hasFile && previewDoc.scanStatus === 'Clean' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void downloadFile(previewDoc)}
                >
                  Download CV
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const target = withReturnTo(`/candidates/${encodeURIComponent(previewDoc.candidateId)}`, returnTo);
                  setPreviewDoc(null);
                  navigate(target);
                }}
              >
                Open Candidate Profile
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
