import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, Archive, ArrowUpDown, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Clock, Database,
  Download, Eye, FileText, FolderUp, Link2, MoreVertical, RefreshCw, Search,
  ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react';
import { withReturnTo } from '../returnTarget';
import { importBankCv, type BankCvImportResult, type ValidatedCvIntakeResult } from '../api/cvImport';
import { fetchCandidateJobRecommendations } from '../api/ats';
import { fetchNationalities } from '../api/requisitions';
import { CvIntakeEngineDrawer } from '../drawers/CvIntakeEngineDrawer';
import { SuggestJobsDrawer } from '../drawers/SuggestJobsDrawer';
import type { Candidate, CandidateDocument, CandidateJobRecommendation, CvBankBackupStatus, PaginatedResult } from '@recruitflow/contracts';
import { downloadApi, getApi, patchApi, postApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Alert } from '../../components/ui/Alert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { PageState } from '../../components/ui/PageState';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/ToastContext';
import '../../pages/PageEnhancementsV2.css';
import './cv-bank.css';

const ITEMS_PER_PAGE = 25;
const FETCH_PAGE_SIZE = 100;

type ParseStatus = 'Parsed' | 'Needs review' | 'Pending' | 'Failed';
type FileStatus = 'No file' | 'Quarantined' | 'Scanning' | 'Stored';

interface CVRow {
  key: string;
  documentId: string;
  candidateId: string;
  candidateName: string;
  fileName: string;
  createdAt: string;
  fileStatus: FileStatus;
  parseStatus: ParseStatus;
  doc: CandidateDocument | null;
  candidate: Candidate | null;
}

interface ReviewDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  location: string;
  /** Meeting notes 2026-11-25 (item 2): candidate nationality. */
  nationality: string;
  skills: string;
}

const EMPTY_DRAFT: ReviewDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentTitle: '',
  location: '',
  nationality: '',
  skills: '',
};

const BLOCKED_SCAN = new Set(['Quarantined', 'Failed', 'Rejected', 'Infected']);

function asMetadata(candidate: Candidate | null): Record<string, unknown> | undefined {
  const metadata = candidate?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  return metadata;
}

function skillNames(candidate: Candidate | null): string[] {
  if (!candidate || !Array.isArray(candidate.skills)) return [];
  return candidate.skills.filter((skill): skill is string => typeof skill === 'string' && skill.trim().length > 0);
}

function fileStatusFor(doc: CandidateDocument | null): FileStatus {
  if (!doc) return 'No file';
  if (BLOCKED_SCAN.has(doc.scanStatus)) return 'Quarantined';
  if (doc.scanStatus === 'Pending') return 'Scanning';
  return 'Stored';
}

function parseStatusFor(doc: CandidateDocument | null, candidate: Candidate | null): ParseStatus {
  const extraction = asMetadata(candidate)?.cvExtractionStatus;
  if ((doc && BLOCKED_SCAN.has(doc.scanStatus)) || extraction === 'Failed') return 'Failed';
  if (doc?.scanStatus === 'Pending' || extraction === 'Pending') return 'Pending';
  if (skillNames(candidate).length > 0 && Boolean(candidate?.currentTitle?.trim())) return 'Parsed';
  return 'Needs review';
}

function displayName(candidate: Candidate | null, fallback: string): string {
  if (!candidate) return fallback || 'Unnamed candidate';
  const name = `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim();
  return name || fallback || 'Unnamed candidate';
}

function buildRows(docs: CandidateDocument[], people: Candidate[]): CVRow[] {
  const byId = new Map(people.map((candidate) => [candidate.id, candidate]));
  const covered = new Set<string>();
  const rows: CVRow[] = docs.map((doc) => {
    covered.add(doc.candidateId);
    const candidate = byId.get(doc.candidateId) ?? null;
    return {
      key: doc.id,
      documentId: doc.id,
      candidateId: doc.candidateId,
      candidateName: displayName(candidate, doc.candidateName || doc.candidateId),
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      fileStatus: fileStatusFor(doc),
      parseStatus: parseStatusFor(doc, candidate),
      doc,
      candidate,
    };
  });
  for (const candidate of people) {
    if (covered.has(candidate.id)) continue;
    rows.push({
      key: `cand-only-${candidate.id}`,
      documentId: `cand-only-${candidate.id}`,
      candidateId: candidate.id,
      candidateName: displayName(candidate, candidate.id),
      fileName: 'No CV file',
      createdAt: candidate.createdAt,
      fileStatus: 'No file',
      parseStatus: parseStatusFor(null, candidate),
      doc: null,
      candidate,
    });
  }
  return rows;
}

function draftFromRow(row: CVRow): ReviewDraft {
  const candidate = row.candidate;
  if (candidate) {
    return {
      firstName: candidate.firstName ?? '',
      lastName: candidate.lastName ?? '',
      email: candidate.email ?? '',
      phone: candidate.phone ?? '',
      currentTitle: candidate.currentTitle ?? '',
      location: candidate.location ?? '',
      nationality: candidate.nationality ?? '',
      skills: skillNames(candidate).join(', '),
    };
  }
  const parts = row.candidateName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    email: '',
    phone: '',
    currentTitle: '',
    location: '',
    nationality: '',
    skills: '',
  };
}

function parseTone(status: ParseStatus): string {
  if (status === 'Parsed') return 'parsed';
  if (status === 'Failed') return 'failed';
  if (status === 'Needs review') return 'review';
  return 'pending';
}

function fileTone(status: FileStatus): string {
  if (status === 'Stored') return 'stored';
  if (status === 'Quarantined') return 'quarantined';
  if (status === 'Scanning') return 'scanning';
  return 'meta';
}

function pageQuery(pageNum: number, search: string): string {
  const query = new URLSearchParams({ page: String(pageNum), pageSize: String(FETCH_PAGE_SIZE) });
  if (search) query.set('search', search);
  return query.toString();
}

export function CVBankPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [params, setParams] = useSearchParams();
  const canDownload = Boolean(user?.permissions?.includes('DOWNLOAD_DOCUMENTS'));

  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [backupStatus, setBackupStatus] = useState<CvBankBackupStatus | null>(null);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  // Meeting notes 2026-11-25 (item 2): filter candidates by nationality.
  const [nationalityFilter, setNationalityFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CVRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  // Meeting notes 2026-11-25 (item 2): nationality catalog for the review form.
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docUrlLoading, setDocUrlLoading] = useState(false);
  const [docUrlError, setDocUrlError] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [retryingExtraction, setRetryingExtraction] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [applyingRecKey, setApplyingRecKey] = useState<string | null>(null);
  const [appliedRecMap, setAppliedRecMap] = useState<Record<string, string>>({});
  const [latestExtractions, setLatestExtractions] = useState<Array<BankCvImportResult & { recommendations: CandidateJobRecommendation[] }>>([]);
  const [suggestCandidate, setSuggestCandidate] = useState<{ id: string; name: string } | null>(null);
  const [reviewRecs, setReviewRecs] = useState<{ candidateId: string; loading: boolean; items: CandidateJobRecommendation[] }>({
    candidateId: '',
    loading: false,
    items: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appliedSearch = params.get('search') ?? '';
  const contextJobId = params.get('job') ?? params.get('vacancyId') ?? '';
  const contextCandidateId = params.get('candidateId') ?? '';
  const isAdministrator = Boolean(user?.roles?.some((role) => role.code === 'ADMINISTRATOR'));
  const canEditDocuments = isAdministrator || Boolean(user?.permissions?.includes('CANDIDATE_EDIT'));
  const canCreateCandidates = isAdministrator || Boolean(user?.permissions?.includes('CANDIDATE_CREATE'));
  const canUploadCv = canEditDocuments && (Boolean(contextCandidateId) || canCreateCandidates);

  useEffect(() => {
    if (params.get('intake') === '1' && canUploadCv) {
      setIntakeOpen(true);
    }
  }, [params, canUploadCv]);
  const rawPage = params.get('page') ?? '';
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const returnTo = `/cv-bank${params.toString() ? `?${params.toString()}` : ''}`;
  const bulkUploadHref = withReturnTo(
    contextJobId ? `/import/candidates/${encodeURIComponent(contextJobId)}` : '/import',
    returnTo,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  // Meeting notes 2026-11-25 (item 2): load the nationality list once.
  useEffect(() => {
    let live = true;
    fetchNationalities().then((rows) => { if (live && rows) setNationalities(rows); }).catch(() => {});
    return () => { live = false; };
  }, []);

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

  const loadData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError('');
    try {
      const [firstPage, backup] = await Promise.all([
        getApi<PaginatedResult<CandidateDocument>>(`/documents/cv-bank?${pageQuery(1, appliedSearch)}`),
        getApi<CvBankBackupStatus>('/documents/cv-bank/backup-status'),
      ]);
      const docs: CandidateDocument[] = [];
      const seenDocs = new Set<string>();
      const pushDocs = (batch: CandidateDocument[]) => {
        for (const doc of batch) {
          if (seenDocs.has(doc.id)) continue;
          seenDocs.add(doc.id);
          docs.push(doc);
        }
      };
      pushDocs(firstPage.data ?? []);
      const docTotal = firstPage.total ?? docs.length;
      for (let pageNum = 2; docs.length < docTotal && pageNum <= 20; pageNum += 1) {
        const before = docs.length;
        const nextPage = await getApi<PaginatedResult<CandidateDocument>>(`/documents/cv-bank?${pageQuery(pageNum, appliedSearch)}`);
        pushDocs(nextPage.data ?? []);
        if (docs.length === before) break;
      }

      let nextCandidates: Candidate[] = [];
      try {
        const firstCandidates = await getApi<PaginatedResult<Candidate> | Candidate[]>(`/candidates?${pageQuery(1, appliedSearch)}`);
        if (Array.isArray(firstCandidates)) {
          nextCandidates = firstCandidates;
        } else {
          const seenCandidates = new Set<string>();
          const pushCandidates = (batch: Candidate[]) => {
            for (const candidate of batch) {
              if (seenCandidates.has(candidate.id)) continue;
              seenCandidates.add(candidate.id);
              nextCandidates.push(candidate);
            }
          };
          pushCandidates(firstCandidates.data ?? []);
          const candTotal = firstCandidates.total ?? nextCandidates.length;
          for (let pageNum = 2; nextCandidates.length < candTotal && pageNum <= 20; pageNum += 1) {
            const before = nextCandidates.length;
            const nextPage = await getApi<PaginatedResult<Candidate>>(`/candidates?${pageQuery(pageNum, appliedSearch)}`);
            pushCandidates(nextPage.data ?? []);
            if (nextCandidates.length === before) break;
          }
        }
      } catch {
        nextCandidates = [];
      }

      setDocuments(docs);
      setCandidates(nextCandidates);
      setBackupStatus(backup);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the CV Bank.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch]);

  const allRows = useMemo(() => buildRows(documents, candidates), [documents, candidates]);
  const viewingRow = useMemo(
    () => (viewingKey ? allRows.find((row) => row.key === viewingKey) ?? null : null),
    [allRows, viewingKey],
  );

  useEffect(() => {
    const documentId = viewingRow?.documentId;
    let cancelled = false;
    let localBlob: string | null = null;

    if (!documentId || documentId.startsWith('cand-only-')) {
      setDocUrl(null);
      setDocUrlError('');
      setDocUrlLoading(false);
      return undefined;
    }

    setDocUrlLoading(true);
    setDocUrl(null);
    setDocUrlError('');

    void (async () => {
      try {
        let nextUrl: string | null = null;
        try {
          const payload = await getApi<{ downloadUrl?: string; url?: string }>(
            `/documents/${encodeURIComponent(documentId)}/download`,
          );
          nextUrl = (payload?.downloadUrl || payload?.url || '').trim() || null;
        } catch {
          nextUrl = null;
        }
        if (!nextUrl) {
          const blob = await downloadApi(`/documents/${encodeURIComponent(documentId)}/download`);
          if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Could not load the CV file.');
          localBlob = URL.createObjectURL(blob);
          nextUrl = localBlob;
        }
        if (cancelled) {
          if (localBlob) URL.revokeObjectURL(localBlob);
          return;
        }
        setDocUrl(nextUrl);
      } catch (reason) {
        if (cancelled) return;
        setDocUrlError(reason instanceof Error ? reason.message : 'Could not load the CV file.');
      } finally {
        if (!cancelled) setDocUrlLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (localBlob) URL.revokeObjectURL(localBlob);
    };
  }, [viewingRow?.documentId]);

  useEffect(() => {
    const candidateId = viewingRow?.candidateId;
    if (!candidateId) {
      setReviewRecs({ candidateId: '', loading: false, items: [] });
      return undefined;
    }
    let alive = true;
    setReviewRecs({ candidateId, loading: true, items: [] });
    void fetchCandidateJobRecommendations(candidateId)
      .then((items) => {
        if (alive) setReviewRecs({ candidateId, loading: false, items: Array.isArray(items) ? items : [] });
      })
      .catch(() => {
        if (alive) setReviewRecs({ candidateId, loading: false, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [viewingRow?.candidateId]);

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const list = allRows.filter((row) => {
      const cand = (row.candidateName ?? '').toLowerCase();
      const file = (row.fileName ?? '').toLowerCase();
      if (q && !cand.includes(q) && !file.includes(q)) return false;
      if (statusFilter && row.parseStatus !== statusFilter) return false;
      // Meeting notes 2026-11-25 (item 2): filter by nationality.
      if (nationalityFilter && (row.candidate?.nationality ?? '') !== nationalityFilter) return false;
      if (dateFilter) {
        const createdMs = new Date(row.createdAt).getTime();
        const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
        if (Number.isFinite(createdMs) && now - createdMs > days * 86_400_000) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => (sortAsc ? a.candidateName.localeCompare(b.candidateName) : b.candidateName.localeCompare(a.candidateName)));
  }, [allRows, search, statusFilter, dateFilter, nationalityFilter, sortAsc]);

  const totalRecords = allRows.length;
  const storedCount = backupStatus?.storedFiles ?? allRows.filter((row) => row.doc?.hasFile).length;
  const pendingCount = allRows.filter((row) => row.parseStatus === 'Pending' || row.parseStatus === 'Needs review').length;
  const totalDisplayCount = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalDisplayCount / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startIdx = totalDisplayCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIdx = Math.min((currentPage - 1) * ITEMS_PER_PAGE + paginatedRows.length, totalDisplayCount);

  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.key));
  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filteredRows.map((row) => row.key));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const openReview = (row: CVRow) => {
    setViewingKey(row.key);
    setDraft(draftFromRow(row));
    setOpenMenuId(null);
  };

  const archiveCv = async (reason?: string) => {
    if (!archiveTarget?.doc || !canEditDocuments || archiving) return;
    const note = reason?.trim();
    if (!note) {
      setError('An archive reason is required.');
      return;
    }
    setArchiving(true);
    setError('');
    try {
      await postApi(`/documents/${encodeURIComponent(archiveTarget.doc.id)}/archive`, { reason: note });
      const name = archiveTarget.fileName;
      setArchiveTarget(null);
      await loadData({ silent: true });
      show({ tone: 'success', title: 'CV archived', message: `${name} was removed from the active bank. The document remains recoverable.` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to archive the CV document.');
    } finally {
      setArchiving(false);
    }
  };

  const handleFileUploadSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (selectedFiles.length === 0) return;
    if (!canUploadCv) {
      setError('You do not have permission to upload or create candidate CV records.');
      return;
    }

    setUploading(true);
    setError('');
    let importedCount = 0;
    let linkedCount = 0;
    const importedResults: BankCvImportResult[] = [];
    const failures: string[] = [];

    for (const file of selectedFiles) {
      try {
        const imported = await importBankCv(file, {
          ...(contextJobId ? { vacancyId: contextJobId } : {}),
          ...(contextCandidateId ? { candidateId: contextCandidateId } : {}),
        });
        importedCount += 1;
        if (imported.linked) linkedCount += 1;
        importedResults.push(imported);
      } catch (reason) {
        const msg = reason instanceof Error ? reason.message : 'Unable to upload CV.';
        failures.push(`${file.name}: ${msg}`);
      }
    }

    try {
      if (importedCount > 0) {
        const enriched = await Promise.all(
          importedResults.map(async (item) => ({
            ...item,
            recommendations: await fetchCandidateJobRecommendations(item.candidateId)
              .then((r) => (Array.isArray(r) ? r : []))
              .catch(() => [] as CandidateJobRecommendation[]),
          })),
        );
        setLatestExtractions(enriched);
        await loadData({ silent: true });
      }
      if (failures.length > 0) {
        const summary = failures.join(' ');
        setError(summary);
        show({
          tone: importedCount > 0 ? 'warning' : 'error',
          title: importedCount > 0 ? 'Partial CV upload completed' : 'CV upload failed',
          message: importedCount > 0 ? `${importedCount} uploaded, ${failures.length} failed (${failures[0]}).` : summary,
        });
      } else if (importedCount > 0) {
        show({
          tone: 'success',
          title: importedCount === 1 ? 'CV uploaded and parsed' : 'CVs uploaded and parsed',
          message: `${importedCount} CV file(s) parsed and stored in the CV Bank${linkedCount ? ` (${linkedCount} linked to existing candidate${linkedCount > 1 ? 's' : ''})` : ''}.`,
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleIntakeCompleted = async (result: ValidatedCvIntakeResult) => {
    const recs = await fetchCandidateJobRecommendations(result.candidateId)
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => [] as CandidateJobRecommendation[]);
    setLatestExtractions((prev) => [
      { ...result, recommendations: recs },
      ...prev.filter((item) => item.candidateId !== result.candidateId || item.fileName !== result.fileName),
    ]);
    await loadData({ silent: true });
  };

  const applyFromRecommendationCard = async (candidateId: string, rec: CandidateJobRecommendation) => {
    const key = `${candidateId}:${rec.vacancyId}`;
    if (applyingRecKey) return;
    setApplyingRecKey(key);
    try {
      const created = await postApi<{ id: string }>('/applications', {
        vacancyId: rec.vacancyId,
        candidateId,
        source: 'CV Intake Recommendation',
      });
      setAppliedRecMap((prev) => ({ ...prev, [key]: created?.id || 'applied' }));
      show({
        tone: 'success',
        title: 'Applied to recommended role',
        message: `Candidate was added to ${rec.title}.`,
      });
      await loadData({ silent: true });
    } catch (reason) {
      show({
        tone: 'error',
        title: 'Could not apply candidate',
        message: reason instanceof Error ? reason.message : 'Unable to apply candidate to this role.',
      });
    } finally {
      setApplyingRecKey(null);
    }
  };

  const saveReview = async () => {
    if (!viewingRow) return;
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const email = draft.email.trim() || null;
    const phone = draft.phone.trim() || null;
    const currentTitle = draft.currentTitle.trim() || null;
    const location = draft.location.trim() || null;
    const nationality = draft.nationality.trim() || null;
    const skills = draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    if (!firstName || !lastName) {
      show({ tone: 'error', title: 'Name required', message: 'Enter a first and last name before saving.' });
      return;
    }
    setSavingReview(true);
    try {
      await patchApi(`/candidates/${encodeURIComponent(viewingRow.candidateId)}`, {
        firstName,
        lastName,
        email,
        phone,
        currentTitle,
        location,
        nationality,
        skills,
      });
      show({
        tone: 'success',
        title: 'Reviewed details saved',
        message: `${firstName} ${lastName} was updated from the CV review.`,
      });
      await loadData({ silent: true });
    } catch (reason) {
      show({
        tone: 'error',
        title: 'Could not save reviewed details',
        message: reason instanceof Error ? reason.message : 'Could not save reviewed details.',
      });
    } finally {
      setSavingReview(false);
    }
  };

  const retryExtraction = async () => {
    if (!viewingRow) return;
    setRetryingExtraction(true);
    try {
      await postApi(`/candidates/${encodeURIComponent(viewingRow.candidateId)}/skills/derive-evidence`, {});
      show({
        tone: 'success',
        title: 'Extraction requested',
        message: 'Skill extraction was run again from the stored CV text.',
      });
      await loadData({ silent: true });
    } catch (reason) {
      show({
        tone: 'error',
        title: 'Could not retry extraction',
        message: reason instanceof Error ? reason.message : 'Could not retry extraction.',
      });
    } finally {
      setRetryingExtraction(false);
    }
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
  };

  return (
    <div className="rf2-cvb">
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Upload CV files"
        disabled={!canUploadCv}
        accept=".pdf,.doc,.docx"
        multiple
        hidden
        onChange={(event) => {
          void handleFileUploadSelected(event);
        }}
      />

      <header className="rf2-cvb__header">
        <div>
          <span className="rf2-cvb__eyebrow">Talent / CV Bank</span>
          <h1 className="rf2-cvb__title">CV Bank</h1>
          <p className="rf2-cvb__subtitle">
            Store, parse and manage candidate CVs for easy access and faster hiring.
          </p>
        </div>
        <div className="rf2-cvb__actions">
          {canUploadCv ? <button
            type="button"
            className="rf2-cvb__btn rf2-cvb__btn--primary"
            disabled={uploading}
            onClick={() => setIntakeOpen(true)}
          >
            <Upload aria-hidden="true" />
            <span>{uploading ? 'Uploading…' : 'Upload CVs'}</span>
          </button> : null}
          {canCreateCandidates ? <button
            type="button"
            className="rf2-cvb__btn"
            onClick={() => navigate(bulkUploadHref)}
          >
            <FolderUp aria-hidden="true" />
            <span>Bulk upload</span>
          </button> : null}
          <button
            type="button"
            className="rf2-cvb__btn"
            onClick={() => void loadData()}
            disabled={loading || uploading}
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
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

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
            <span className="rf2-cvb__kpi-sub">CVs waiting for extraction review</span>
          </div>
        </div>
      </section>

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

      {latestExtractions.length > 0 ? (
        <section className="rf2-cvb__card p-5 mb-4 space-y-4" aria-label="ATS CV extraction and job fit results">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="rf2-cvb__card-title flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--rf2-action)]" aria-hidden="true" />
                <span>Latest ATS Extraction, Duplicate Check &amp; Best-Fit Positions</span>
              </h2>
              <p className="rf2-cvb__card-sub">
                Extracted profile highlights, identity verification, and open positions ranked by matched main keywords.
              </p>
            </div>
            <button
              type="button"
              className="rf2-cvb__banner-close"
              aria-label="Dismiss extraction report"
              onClick={() => setLatestExtractions([])}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <ul className="space-y-3 list-none p-0 m-0">
            {latestExtractions.map((item) => {
              const dupMatch = item.duplicateCheck?.matches?.[0] ?? null;
              const extractedName = [item.cv.firstName, item.cv.lastName].filter(Boolean).join(' ') || item.fileName;
              const topRecs = item.recommendations.slice(0, 3);
              const existingRow = allRows.find((r) => r.candidateId === item.candidateId) ?? null;

              return (
                <li
                  key={`${item.candidateId}-${item.fileName}`}
                  className="rounded-xl border border-[var(--rf2-divider)] bg-[var(--rf2-surface)] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-[var(--rf2-ink)]">{`${extractedName} · ${item.fileName}`}</strong>
                        {item.cv.parsingQuality ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--rf2-well)] text-[var(--rf2-ink)] border border-[var(--rf2-divider)]">
                            {item.cv.parsingQuality} quality{item.cv.parserSource ? ` · ${item.cv.parserSource === 'affinda' ? 'ATS engine' : 'Local extractor'}` : ''}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--rf2-muted)] m-0">
                        {[
                          item.cv.title || null,
                          item.cv.clinicalDomain || null,
                          typeof item.cv.experienceYears === 'number' ? `${item.cv.experienceYears} yrs experience` : null,
                          item.cv.location || null,
                        ].filter(Boolean).join(' · ') || 'Extracted from CV document'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rf2-cvb__btn"
                        onClick={() => setSuggestCandidate({ id: item.candidateId, name: extractedName })}
                      >
                        <Briefcase className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                        Suggest roles ({item.recommendations.length})
                      </button>
                      {existingRow ? (
                        <button type="button" className="rf2-cvb__btn" onClick={() => openReview(existingRow)}>
                          Review details
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Duplicate verification banner */}
                  <div
                    className={`rounded-lg px-3 py-2 text-xs flex flex-wrap items-center gap-2 border ${
                      item.linked
                        ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800/60'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800/60'
                    }`}
                  >
                    {item.linked ? <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    <span>
                      {item.linked ? (
                        dupMatch ? (
                          <>
                            <strong>Duplicate verified</strong>
                            {dupMatch.matchedBy?.length ? ` (${dupMatch.matchedBy.join(' & ')})` : ''}: Linked to existing candidate{' '}
                            <strong>{dupMatch.name}</strong>
                            {dupMatch.candidateCode ? ` (${dupMatch.candidateCode})` : ''}.
                            {item.linkResult?.filled.length ? ` Enriched: ${item.linkResult.filled.join(', ')}.` : ''}
                            {item.linkResult?.conflicts.length ? ` ${item.linkResult.conflicts.length} existing field(s) preserved.` : ''}
                          </>
                        ) : (
                          <><strong>Linked to existing candidate profile</strong> without duplicating identity.</>
                        )
                      ) : item.cv.email || item.cv.phone ? (
                        <><strong>Duplicate check passed:</strong> No existing candidate matched this email/phone — created new profile.</>
                      ) : (
                        <><strong>Added to bank:</strong> No email or phone found in CV to match against existing candidates.</>
                      )}
                    </span>
                  </div>

                  {/* Extracted Keywords */}
                  {item.cv.skills && item.cv.skills.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5" aria-label="Extracted main keywords">
                      <span className="text-[11px] font-semibold text-[var(--rf2-muted)] mr-1">Extracted keywords:</span>
                      {item.cv.skills.slice(0, 10).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--rf2-well)] text-[var(--rf2-ink)] border border-[var(--rf2-divider)]"
                        >
                          {skill}
                        </span>
                      ))}
                      {item.cv.skills.length > 10 ? (
                        <span className="text-[11px] text-[var(--rf2-muted)]">+{item.cv.skills.length - 10} more</span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Best-Fit Open Positions & Why from Main Keywords */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--rf2-muted)]">
                      Best-fit open positions
                    </div>
                    {topRecs.length === 0 ? (
                      <p className="text-xs text-[var(--rf2-muted)] m-0">
                        No active open positions matched yet. You can review or add more skills below.
                      </p>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-3">
                        {topRecs.map((rec) => (
                          <div
                            key={rec.vacancyId}
                            className="rounded-lg border border-[var(--rf2-divider)] bg-[var(--rf2-well)]/50 p-2.5 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[var(--rf2-ink)] truncate">{rec.title}</div>
                                <div className="text-[11px] text-[var(--rf2-muted)] truncate">
                                  {rec.vacancyCode} · {rec.branchName || rec.department || 'Open role'}
                                </div>
                              </div>
                              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--rf2-action-soft)] text-[var(--rf2-action)]">
                                {rec.atsScore}% Match
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--rf2-muted)]">
                              {rec.matchedSkillsCount}/{rec.totalRequiredSkillsCount} required keywords
                            </div>
                            {rec.matchedKeywords && rec.matchedKeywords.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {rec.matchedKeywords.slice(0, 4).map((kw) => (
                                  <span key={kw} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                    ✓ {kw}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {rec.fitReasons && rec.fitReasons.length > 0 ? (
                              <p className="text-[11px] text-[var(--rf2-muted)] m-0">
                                {rec.fitReasons[0]}
                              </p>
                            ) : null}
                            <div className="pt-1">
                              {rec.alreadyApplied || appliedRecMap[`${item.candidateId}:${rec.vacancyId}`] ? (
                                <Link
                                  to={`/applications/${encodeURIComponent(appliedRecMap[`${item.candidateId}:${rec.vacancyId}`] || rec.existingApplicationId || '')}`}
                                  className="rf2-cvb__btn"
                                >
                                  Open application
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className="rf2-cvb__btn"
                                  disabled={applyingRecKey === `${item.candidateId}:${rec.vacancyId}`}
                                  onClick={() => void applyFromRecommendationCard(item.candidateId, rec)}
                                >
                                  {applyingRecKey === `${item.candidateId}:${rec.vacancyId}` ? 'Applying…' : 'Apply to job'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
                    const next = new URLSearchParams(params);
                    if (search.trim()) next.set('search', search.trim());
                    else next.delete('search');
                    next.delete('page');
                    setParams(next);
                  }
                }}
                className="rf2-cvb__search-input"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                goToPage(1);
              }}
              className="rf2-cvb__select"
            >
              <option value="">All statuses</option>
              <option value="Parsed">Parsed</option>
              <option value="Needs review">Needs review</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
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

            {/* Meeting notes 2026-11-25 (item 2): filter by nationality. */}
            <select
              aria-label="Filter by nationality"
              value={nationalityFilter}
              onChange={(event) => setNationalityFilter(event.target.value)}
              className="rf2-cvb__select"
            >
              <option value="">All nationalities</option>
              {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <span className="rf2-cvb__count">{filteredRows.length} results</span>
        </div>

        {loading ? (
          <div className="p-4">
            <TableSkeleton columns={6} rows={6} />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6">
            <PageState
              kind="empty"
              title="No CV records found"
              description={
                search || statusFilter || dateFilter || nationalityFilter
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
                  {paginatedRows.map((row) => {
                    const isDownloadable = Boolean(
                      row.doc
                      && row.doc.hasFile
                      && row.doc.scanStatus === 'Clean'
                      && row.doc.consentStatus !== 'Withdrawn'
                      && row.doc.consentStatus !== 'Expired',
                    );
                    const menuOpen = openMenuId === row.key;
                    return (
                      <tr key={row.key}>
                        <td className="rf2-cvb__td-check">
                          <input
                            type="checkbox"
                            className="rf2-cvb__check"
                            aria-label={`Select ${row.candidateName}`}
                            checked={selectedIds.includes(row.key)}
                            onChange={() => toggleOne(row.key)}
                          />
                        </td>
                        <td className="rf2-cvb__td-cand" data-label="Candidate">
                          <Link
                            className="rf2-cvb__cand-link"
                            to={withReturnTo(`/candidates/${encodeURIComponent(row.candidateId)}`, returnTo)}
                          >
                            {row.candidateName}
                          </Link>
                        </td>
                        <td className="rf2-cvb__td-file" data-label="CV file">
                          <span className="rf2-cvb__file-name">{row.fileName}</span>
                        </td>
                        <td className="rf2-cvb__td-parse" data-label="Parse status">
                          <span className="rf2-cvb__parse-badge" data-tone={parseTone(row.parseStatus)}>
                            {row.parseStatus === 'Parsed' ? <CheckCircle2 aria-hidden="true" /> : <Clock aria-hidden="true" />}
                            <span>{row.parseStatus}</span>
                          </span>
                        </td>
                        <td className="rf2-cvb__td-file-status" data-label="File status">
                          <span className="rf2-cvb__stored-status" data-tone={fileTone(row.fileStatus)}>
                            <span className="rf2-cvb__stored-dot" aria-hidden="true" />
                            <span>{row.fileStatus}</span>
                          </span>
                        </td>
                        <td className="rf2-cvb__td-date" data-label="Added date">
                          <span className="rf2-cvb__date">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US') : '—'}
                          </span>
                        </td>
                        <td className="rf2-cvb__td-actions" data-label="Actions">
                          <div className="rf2-cvb__row-actions">
                            <button type="button" className="rf2-cvb__view-btn" onClick={() => openReview(row)}>
                              <Eye aria-hidden="true" />
                              <span>View CV</span>
                            </button>
                            <button
                              type="button"
                              className="rf2-cvb__more-btn"
                              aria-label={`More actions for ${row.candidateName}`}
                              aria-haspopup="menu"
                              aria-expanded={menuOpen}
                              onClick={() => setOpenMenuId((prev) => (prev === row.key ? null : row.key))}
                            >
                              <MoreVertical aria-hidden="true" />
                            </button>

                            {menuOpen ? (
                              <div className="rf2-cvb__menu" role="menu" aria-label={`Actions for ${row.candidateName}`}>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="rf2-cvb__menu-item"
                                  onClick={() => openReview(row)}
                                >
                                  <FileText aria-hidden="true" />
                                  <span>Review parsed details</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="rf2-cvb__menu-item"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setSuggestCandidate({ id: row.candidateId, name: row.candidateName });
                                  }}
                                >
                                  <Briefcase aria-hidden="true" />
                                  <span>Find matching roles</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="rf2-cvb__menu-item"
                                  disabled={!isDownloadable || !canDownload || !row.doc}
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    if (row.doc) void downloadFile(row.doc);
                                  }}
                                >
                                  <Download aria-hidden="true" />
                                  <span>Download</span>
                                </button>
                                {canEditDocuments && row.doc ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="rf2-cvb__menu-item rf2-cvb__menu-item--danger"
                                    onClick={() => {
                                      setArchiveTarget(row);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    <Archive aria-hidden="true" />
                                    <span>Archive CV</span>
                                  </button>
                                ) : null}
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
                Showing {startIdx}–{endIdx} of {totalDisplayCount} candidates
              </span>
              <div className="rf2-cvb__pager">
                <button
                  type="button"
                  className="rf2-cvb__page-btn"
                  aria-label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button type="button" className="rf2-cvb__page-btn" data-active="true" aria-current="page">
                  {currentPage}
                </button>
                <button
                  type="button"
                  className="rf2-cvb__page-btn"
                  aria-label="Next page"
                  disabled={currentPage >= pageCount}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {viewingRow ? (
        <Drawer
          isOpen
          onClose={() => setViewingKey(null)}
          width="evidence"
          title={`CV review — ${viewingRow.candidateName}`}
          subtitle={`Parse: ${viewingRow.parseStatus}. File: ${viewingRow.fileStatus}.`}
          footer={(
            <div className="rf2-cvb__review-actions">
              <button
                type="button"
                className="rf2-cvb__btn rf2-cvb__btn--primary"
                disabled={savingReview}
                onClick={() => void saveReview()}
              >
                {savingReview ? 'Saving…' : 'Save reviewed details'}
              </button>
              <button
                type="button"
                className="rf2-cvb__btn"
                disabled={retryingExtraction}
                onClick={() => void retryExtraction()}
              >
                {retryingExtraction ? 'Retrying…' : 'Retry extraction'}
              </button>
              <button
                type="button"
                className="rf2-cvb__btn"
                onClick={() => navigate(withReturnTo(`/candidates/${encodeURIComponent(viewingRow.candidateId)}`, returnTo))}
              >
                Open full candidate profile
              </button>
            </div>
          )}
        >
          <div className="rf2-cvb__review">
            {viewingRow.parseStatus === 'Failed' ? (
              <p className="rf2-cvb__review-note">
                The security scan or extraction failed. Review the fields below, or retry extraction when a CV file is stored.
              </p>
            ) : null}
            {viewingRow.parseStatus === 'Needs review' ? (
              <p className="rf2-cvb__review-note">
                This record is missing a current title or extracted skills. Review the fields before using this CV.
              </p>
            ) : null}
            {viewingRow.parseStatus === 'Pending' ? (
              <p className="rf2-cvb__review-note">Scanning or extraction is still in progress.</p>
            ) : null}

            <section className="rf2-cvb__review-file space-y-2" aria-label="ATS job fit recommendations">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--rf2-action)]" aria-hidden="true" />
                  <span>Best-fit open positions (ATS keywords)</span>
                </h3>
                <button
                  type="button"
                  className="rf2-cvb__btn"
                  onClick={() => setSuggestCandidate({ id: viewingRow.candidateId, name: viewingRow.candidateName })}
                >
                  Suggest &amp; apply to roles
                </button>
              </div>
              {reviewRecs.loading ? (
                <p role="status" className="text-xs text-[var(--rf2-muted)] m-0">Checking open positions…</p>
              ) : reviewRecs.items.length === 0 ? (
                <p className="text-xs text-[var(--rf2-muted)] m-0">No active open positions currently match extracted skills.</p>
              ) : (
                <ul className="space-y-2 list-none p-0 m-0">
                  {reviewRecs.items.slice(0, 4).map((rec) => (
                    <li key={rec.vacancyId} className="rounded-lg border border-[var(--rf2-divider)] bg-[var(--rf2-well)]/40 p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs text-[var(--rf2-ink)]">
                          {rec.title} <span className="font-normal text-[var(--rf2-muted)]">({rec.vacancyCode})</span>
                        </strong>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--rf2-action-soft)] text-[var(--rf2-action)]">
                          {rec.atsScore}% Match
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--rf2-muted)]">
                        {rec.matchedSkillsCount}/{rec.totalRequiredSkillsCount} required keywords
                        {rec.matchedKeywords?.length ? ` · Matched: ${rec.matchedKeywords.join(', ')}` : ''}
                      </div>
                      {rec.missingKeywords?.length ? (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>Missing: {rec.missingKeywords.join(', ')}</span>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rf2-cvb__review-file" aria-label="Document preview">
              <h3>Document preview</h3>
              {viewingRow.documentId.startsWith('cand-only-') ? (
                <p>No CV file is stored for this candidate.</p>
              ) : (
                <>
                  {docUrl ? (
                    <a className="rf2-cvb__btn" href={docUrl} target="_blank" rel="noopener noreferrer">
                      Open / Download CV file
                    </a>
                  ) : (
                    <button type="button" className="rf2-cvb__btn" disabled>
                      Open / Download CV file
                    </button>
                  )}
                  {docUrlLoading ? <p role="status">Loading CV preview…</p> : null}
                  {docUrlError ? <p className="rf2-cvb__review-error" role="alert">{docUrlError}</p> : null}
                  {docUrl ? (
                    <iframe
                      src={docUrl}
                      title={`CV preview for ${viewingRow.candidateName}`}
                      className="rf-cvb__preview-frame"
                    />
                  ) : null}
                </>
              )}
            </section>

            <form
              className="rf2-cvb__review-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void saveReview();
              }}
            >
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-first-name">First name</label>
                <input
                  id="rf2-cvb-first-name"
                  value={draft.firstName}
                  onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
                  autoComplete="given-name"
                />
              </div>
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-last-name">Last name</label>
                <input
                  id="rf2-cvb-last-name"
                  value={draft.lastName}
                  onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
                  autoComplete="family-name"
                />
              </div>
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-email">Email</label>
                <input
                  id="rf2-cvb-email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                />
              </div>
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-phone">Phone</label>
                <input
                  id="rf2-cvb-phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  autoComplete="tel"
                />
              </div>
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-title">Current title</label>
                <input
                  id="rf2-cvb-title"
                  value={draft.currentTitle}
                  onChange={(event) => setDraft((current) => ({ ...current, currentTitle: event.target.value }))}
                />
              </div>
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-location">Location</label>
                <input
                  id="rf2-cvb-location"
                  value={draft.location}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                />
              </div>
              {/* Meeting notes 2026-11-25 (item 2): candidate nationality. */}
              <div className="rf2-cvb__field">
                <label htmlFor="rf2-cvb-nationality">Nationality</label>
                <select
                  id="rf2-cvb-nationality"
                  value={draft.nationality}
                  onChange={(event) => setDraft((current) => ({ ...current, nationality: event.target.value }))}
                >
                  <option value="">Not recorded</option>
                  {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
                  {draft.nationality && !nationalities.includes(draft.nationality) ? <option value={draft.nationality}>{draft.nationality}</option> : null}
                </select>
              </div>
              <div className="rf2-cvb__field rf2-cvb__field--wide">
                <label htmlFor="rf2-cvb-skills">Skills</label>
                <input
                  id="rf2-cvb-skills"
                  value={draft.skills}
                  onChange={(event) => setDraft((current) => ({ ...current, skills: event.target.value }))}
                  aria-describedby="rf2-cvb-skills-hint"
                />
                <p id="rf2-cvb-skills-hint" className="rf2-cvb__field-hint">Separate skills with commas.</p>
              </div>
            </form>
          </div>
        </Drawer>
      ) : null}
      <ConfirmDialog
        isOpen={archiveTarget !== null}
        onClose={() => { if (!archiving) setArchiveTarget(null); }}
        onConfirm={(reason) => archiveCv(reason)}
        title="Archive candidate CV"
        description={archiveTarget ? `Archive ${archiveTarget.fileName} for ${archiveTarget.candidateName}? This is audited and reversible. It will no longer appear in the active CV bank.` : undefined}
        confirmLabel="Archive CV"
        tone="warning"
        withComment
        commentLabel="Reason for archiving"
        commentPlaceholder="Why should this CV be removed from the active bank?"
        commentRequired
        isLoading={archiving}
      />
      {suggestCandidate ? (
        <SuggestJobsDrawer
          isOpen
          candidateId={suggestCandidate.id}
          candidateName={suggestCandidate.name}
          onClose={() => setSuggestCandidate(null)}
          onApplied={() => void loadData({ silent: true })}
        />
      ) : null}
      {intakeOpen && canUploadCv ? (
        <CvIntakeEngineDrawer
          open={intakeOpen}
          initialVacancyId={contextJobId || null}
          initialCandidateId={contextCandidateId || null}
          onClose={() => {
            setIntakeOpen(false);
            if (params.get('intake')) {
              const next = new URLSearchParams(params);
              next.delete('intake');
              setParams(next, { replace: true });
            }
          }}
          onCompleted={(result) => {
            void handleIntakeCompleted(result);
          }}
        />
      ) : null}
    </div>
  );
}

export { CVBankPage as CvBankV2 };
