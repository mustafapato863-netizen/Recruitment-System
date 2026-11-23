import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CloudUpload, Info, LayoutGrid, List, RotateCcw,
  RotateCw, Scale, Search, Sparkles,
} from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip, type StatusTone } from '../../components/v2';
import { fetchActiveApplications, fetchBank, OPEN_APPLICATION_STAGES, type ActiveRow, type BankRow } from '../api/matching';
import { useCachedResource } from '../api/useCachedResource';
import { loadCachedView, readViewCache } from '../api/viewCache';
import { buildCandidatesHref, buildCompareHref, parseCompareIds, withReturnTo } from '../returnTarget';
import { formatDay } from './OpenJobsV2';
import { getInitials } from '../userIdentity';
import './jobs.css';
import './candidates.css';

const STAGE_LABEL: Record<string, string> = { Applied: 'Applied', Screening: 'Screening', Interview: 'Interview', Offer: 'Offer', 'Pre-Hire': 'Pre-hire' };
const STAGE_TONE: Record<string, StatusTone> = { Applied: 'neutral', Screening: 'info', Interview: 'info', Offer: 'warning', 'Pre-Hire': 'success' };
const PAGE_SIZE = 15;
const QUERY_KEYS = ['tab', 'search', 'job', 'source', 'stage'] as const;

function buildPageWindow(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}
type QueryKey = (typeof QUERY_KEYS)[number];
type Failure = { kind: 'forbidden' } | { kind: 'error'; message: string };
type ActiveState = { kind: 'loading' } | { kind: 'ready'; rows: ActiveRow[]; truncated: boolean; loaded: number; total: number | null } | Failure;
type BankState = { kind: 'loading' } | { kind: 'ready'; rows: BankRow[]; truncated: boolean; loaded: number; total: number | null } | Failure;

function loadError(e: { statusCode?: number; message?: string }): Failure {
  return e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' };
}

function orderedQuery(current: URLSearchParams, patch: Partial<Record<QueryKey, string | null>> = {}) {
  const ordered = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : current.get(key);
    if (value) ordered.set(key, value);
  }
  return ordered;
}

function applicationHref(applicationId: string, returnTo: string) {
  return withReturnTo(`/applications/${encodeURIComponent(applicationId)}`, returnTo);
}

function listCount(count: number, selected: number, truncated: boolean) {
  const people = truncated ? `${count} people shown` : `${count} people`;
  return selected > 0 ? `${people} · ${selected} selected` : people;
}

function knownStage(value: string) {
  return (OPEN_APPLICATION_STAGES as readonly string[]).includes(value) ? value : '';
}

/** E23 Candidates: active applications (one row per file) and the bank. No contact details or pay. */
export function CandidatesV2() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'bank' ? 'bank' : 'active';
  const q = params.get('search') ?? '';
  const job = params.get('job') ?? '';
  const source = params.get('source') ?? '';
  const stage = knownStage(params.get('stage') ?? '');
  const candidateId = params.get('candidateId') ?? '';
  const rawIds = params.get('ids') ?? '';
  const urlIds = useMemo(() => parseCompareIds(rawIds), [rawIds]);
  const seededIdsRef = useRef<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [activePage, setActivePage] = useState(1);
  const [bankPage, setBankPage] = useState(1);
  const nextActiveSliceRef = useRef<{ source: ActiveRow[]; page: number; rows: ActiveRow[] } | null>(null);
  const nextBankSliceRef = useRef<{ source: BankRow[]; page: number; rows: BankRow[] } | null>(null);
  const [narrowedActive, setNarrowedActive] = useState<ActiveState | null>(null);
  const bankKey = `candidates:bank:${q.trim()}`;
  const [bankSnap, setBankSnap] = useState<{ key: string; state: BankState }>(() => {
    const hit = readViewCache<Awaited<ReturnType<typeof fetchBank>>>(bankKey);
    return hit
      ? { key: bankKey, state: { kind: 'ready', rows: hit.data, truncated: Boolean(hit.data.truncated), loaded: hit.data.loaded ?? hit.data.length, total: hit.data.total ?? null } }
      : { key: bankKey, state: { kind: 'loading' } };
  });

  const activeRes = useCachedResource({
    key: 'candidates:active',
    enabled: tab === 'active',
    attempt,
    fetcher: fetchActiveApplications,
  });

  const active: ActiveState =
    activeRes.kind === 'loading'
      ? { kind: 'loading' }
      : activeRes.kind === 'error'
        ? loadError(activeRes.error as { statusCode?: number; message?: string })
        : { kind: 'ready', rows: activeRes.data.rows, truncated: activeRes.data.truncated, loaded: activeRes.data.loaded, total: activeRes.data.total };

  const cachedBank = tab === 'bank' ? readViewCache<Awaited<ReturnType<typeof fetchBank>>>(bankKey) : null;
  const bank: BankState = bankSnap.key === bankKey
    ? bankSnap.state
    : cachedBank
      ? { kind: 'ready', rows: cachedBank.data, truncated: Boolean(cachedBank.data.truncated), loaded: cachedBank.data.loaded ?? cachedBank.data.length, total: cachedBank.data.total ?? null }
      : { kind: 'loading' };

  const updateQuery = (patch: Partial<Record<QueryKey, string | null>>) => {
    setParams((prev) => orderedQuery(prev, patch));
  };
  const setTab = (next: 'active' | 'bank') => {
    updateQuery({ tab: next === 'bank' ? 'bank' : null });
    setPicked([]);
  };

  const hasActiveFilters = Boolean(q.trim() || job || source || stage);
  const activeTruncated = active.kind === 'ready' && active.truncated;
  useEffect(() => {
    if (tab !== 'active' || !activeTruncated || !hasActiveFilters) {
      setNarrowedActive(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      fetchActiveApplications({ search: q, job, source, stage })
        .then((result) => {
          if (live) {
            setNarrowedActive({ kind: 'ready', rows: result.rows, truncated: result.truncated, loaded: result.loaded, total: result.total });
          }
        })
        .catch(() => {
          if (live) setNarrowedActive(null);
        });
    }, 150);
    return () => { live = false; window.clearTimeout(t); };
  }, [tab, activeTruncated, hasActiveFilters, q, job, source, stage]);

  useEffect(() => {
    if (tab !== 'bank') return;
    const hit = readViewCache<Awaited<ReturnType<typeof fetchBank>>>(bankKey);
    if (attempt === 0 && hit?.fresh) {
      setBankSnap({
        key: bankKey,
        state: {
          kind: 'ready',
          rows: hit.data,
          truncated: Boolean(hit.data.truncated),
          loaded: hit.data.loaded ?? hit.data.length,
          total: hit.data.total ?? null,
        },
      });
      return;
    }
    let live = true;
    const run = () => {
      loadCachedView(bankKey, () => fetchBank(q), { force: attempt > 0 })
        .then((rows) => {
          if (live) {
            setBankSnap({
              key: bankKey,
              state: {
                kind: 'ready',
                rows,
                truncated: Boolean(rows.truncated),
                loaded: rows.loaded ?? rows.length,
                total: rows.total ?? null,
              },
            });
          }
        })
        .catch((e) => {
          if (!live) return;
          if (hit && attempt === 0) return;
          setBankSnap({ key: bankKey, state: loadError(e) });
        });
    };
    const delay = q.trim() && !hit ? 250 : 0;
    if (delay === 0) {
      run();
      return () => { live = false; };
    }
    const t = window.setTimeout(run, delay);
    return () => { live = false; window.clearTimeout(t); };
  }, [tab, bankKey, q, attempt]);

  const effectiveActive = narrowedActive?.kind === 'ready' ? narrowedActive : active;
  const activeRows = useMemo(() => {
    if (effectiveActive.kind !== 'ready') return [];
    const needle = q.trim().toLowerCase();
    return effectiveActive.rows.filter((row) => {
      if (job && row.vacancyId !== job) return false;
      if (source && row.source !== source) return false;
      if (stage && row.stage !== stage) return false;
      if (!needle) return true;
      return `${row.name} ${row.title ?? ''} ${row.job}`.toLowerCase().includes(needle);
    });
  }, [effectiveActive, q, job, source, stage]);
  useLayoutEffect(() => {
    if (tab !== 'active' || effectiveActive.kind !== 'ready') return;
    const visible = new Set(activeRows.map((row) => row.applicationId));
    if (seededIdsRef.current !== rawIds) {
      seededIdsRef.current = rawIds;
      if (urlIds.length > 0) {
        const idSet = new Set(urlIds);
        const restored = activeRows
          .filter((row) => idSet.has(row.candidateId) || idSet.has(row.applicationId))
          .slice(0, 4)
          .map((row) => row.applicationId);
        setPicked(restored);
        return;
      }
    }
    setPicked((prev) => {
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [tab, effectiveActive, activeRows, rawIds, urlIds]);

  const jobs = active.kind === 'ready' ? [...new Map(active.rows.map((row) => [row.vacancyId, row.job])).entries()] : [];
  const sources = active.kind === 'ready' ? [...new Set(active.rows.map((row) => row.source).filter((value): value is string => Boolean(value)))] : [];
  const pickedRows = activeRows.filter((row) => picked.includes(row.applicationId));
  const returnTo = buildCandidatesHref({
    tab,
    search: q,
    job,
    source,
    stage,
    ids: tab === 'active' && pickedRows.length > 0 ? pickedRows.map((row) => row.candidateId) : null,
  });
  const cvBankParams = new URLSearchParams();
  if (job) cvBankParams.set('job', job);
  if (candidateId) cvBankParams.set('candidateId', candidateId);
  const cvBankHref = withReturnTo(`/cv-bank${cvBankParams.toString() ? `?${cvBankParams.toString()}` : ''}`, returnTo);

  const sameJob = pickedRows.length > 0 && pickedRows.every((row) => row.vacancyId === pickedRows[0].vacancyId);
  const canCompare = pickedRows.length >= 2 && pickedRows.length <= 4 && sameJob;
  const compareHref = canCompare
    ? buildCompareHref({
      job: pickedRows[0].vacancyId,
      ids: pickedRows.map((row) => row.candidateId),
      search: q,
      source,
      stage,
    })
    : null;
  const why = pickedRows.length < 2 ? 'Select 2 to 4 people on the same job.' : !sameJob ? 'Compare works within one job; select people on the same job.' : pickedRows.length > 4 ? 'Compare up to 4.' : '';
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  const cur = tab === 'active' ? effectiveActive : bank;
  const truncated = tab === 'active'
    ? (effectiveActive.kind === 'ready' && effectiveActive.truncated)
    : (bank.kind === 'ready' && bank.truncated);
  const shown = tab === 'active' ? activeRows.length : bank.kind === 'ready' ? bank.rows.length : 0;
  const hasFilters = Boolean(q || job || source || stage);

  // Reset pagination to page 1 when filters/search/tab change
  useEffect(() => {
    setActivePage(1);
    setBankPage(1);
  }, [tab, q, job, source, stage]);

  const activeTotalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const safeActivePage = Math.min(activePage, activeTotalPages);
  const activePageRows = useMemo(() => {
    const cached = nextActiveSliceRef.current;
    if (cached && cached.source === activeRows && cached.page === safeActivePage) {
      return cached.rows;
    }
    const start = (safeActivePage - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, safeActivePage]);

  useEffect(() => {
    if (safeActivePage < activeTotalPages) {
      const nextStart = safeActivePage * PAGE_SIZE;
      nextActiveSliceRef.current = {
        source: activeRows,
        page: safeActivePage + 1,
        rows: activeRows.slice(nextStart, nextStart + PAGE_SIZE),
      };
    } else {
      nextActiveSliceRef.current = null;
    }
  }, [activeRows, safeActivePage, activeTotalPages]);

  return (
    <div className="rf2-jobs rf2-cand">
      <div className="rf2-cand__hero">
        <div className="rf2-cand__hero-copy">
          <h1 className="rf2-jobs__title rf2-cand__visible-title">Candidates</h1>
          <p className="rf2-cand__subtitle">
            View and manage all candidates across your jobs. Import CVs, review applications, and move candidates through the hiring process.
          </p>
        </div>
      </div>

      {/* Top Segmented Tabs + Count & Compare Bar */}
      <div className="rf2-cand__top-bar">
        <div className="rf2-seg" role="tablist" aria-label="Candidates view">
          <button type="button" role="tab" aria-selected={tab === 'active'} className="rf2-seg__opt" onClick={() => setTab('active')}>Active applications</button>
          <button type="button" role="tab" aria-selected={tab === 'bank'} className="rf2-seg__opt" onClick={() => setTab('bank')}>Bank</button>
        </div>
        <div className="rf2-cand__head-tools">
          <p className="rf2-jobs__count" aria-live="polite">{cur.kind === 'ready' ? listCount(shown, tab === 'active' ? pickedRows.length : 0, truncated) : ''}</p>
          {tab === 'active' ? (
            compareHref
              ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={compareHref}><Scale aria-hidden="true" /> Compare {pickedRows.length} on skills</Link>
              : <><ButtonV2 icon={<Scale />} disabled aria-describedby="cmp-why">Compare on skills</ButtonV2><span id="cmp-why" className="rf2-sr-only">{why}</span></>
          ) : null}
        </div>
      </div>

      {/* CV Intake & What Happens Next Split Banner Card */}
      <div className="rf2-cand__intake-banner">
        <div className="rf2-cand__intake-left">
          <div className="rf2-cand__intake-head">
            <span className="rf2-cand__intake-icon" aria-hidden="true"><CloudUpload /></span>
            <div>
              <span className="rf2-cand__intake-title">Import CVs</span>
              <p className="rf2-cand__intake-desc">Add candidates by uploading CV files (PDF, DOC, DOCX).</p>
            </div>
          </div>
          <div className="rf2-cand__intake-actions">
            <Link className="rf2-cand__intake-btn rf2-cand__intake-btn--primary" to={cvBankHref}>
              <CloudUpload aria-hidden="true" />
              <span>Upload CVs</span>
            </Link>
          </div>
          <p className="rf2-cand__intake-foot">Supports PDF, DOC, DOCX (Max 10 MB per file). Add multiple files to import in bulk.</p>
        </div>

        <div className="rf2-cand__intake-right">
          <div className="rf2-cand__next-head">
            <span className="rf2-cand__next-icon" aria-hidden="true"><Sparkles /></span>
            <span className="rf2-cand__intake-title">What happens next?</span>
          </div>
          <ol className="rf2-cand__steps">
            <li><span className="rf2-cand__step-num">1</span><span>We extract candidate details from the CVs automatically</span></li>
            <li><span className="rf2-cand__step-num">2</span><span>Duplicates are detected and flagged</span></li>
            <li><span className="rf2-cand__step-num">3</span><span>You can review and edit the extracted information</span></li>
            <li><span className="rf2-cand__step-num">4</span><span>Candidates are added to your selected job or to the bank</span></li>
          </ol>
        </div>
      </div>

      {/* Filter & View Bar */}
      <div className="rf2-jobs__filters rf2-cand__filter-bar">
        <InputV2 label="Search people" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search name, title, or job..." leadingIcon={<Search />} value={q} onChange={(e) => updateQuery({ search: e.target.value || null })} />
        {tab === 'active' ? (
          <>
            <SelectV2 label="Job" fieldClassName="rf2-sr-label" value={job} onChange={(e) => updateQuery({ job: e.target.value || null })}><option value="">Job: All my jobs</option>{jobs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</SelectV2>
            <SelectV2 label="Source" fieldClassName="rf2-sr-label" value={source} onChange={(e) => updateQuery({ source: e.target.value || null })}><option value="">Source: All</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</SelectV2>
            <SelectV2 label="Stage" fieldClassName="rf2-sr-label" value={stage} onChange={(e) => updateQuery({ stage: e.target.value || null })}><option value="">All stages</option>{OPEN_APPLICATION_STAGES.map((item) => <option key={item} value={item}>{STAGE_LABEL[item] ?? item}</option>)}</SelectV2>
          </>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            className="rf2-cand__reset-btn"
            onClick={() => updateQuery({ search: null, job: null, source: null, stage: null })}
          >
            <RotateCcw aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        ) : null}
        <div className="rf2-cand__view-switch" role="group" aria-label="Layout view">
          <button
            type="button"
            className={`rf2-cand__view-opt${viewMode === 'cards' ? ' rf2-cand__view-opt--active' : ''}`}
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid aria-hidden="true" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            className={`rf2-cand__view-opt${viewMode === 'list' ? ' rf2-cand__view-opt--active' : ''}`}
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          >
            <List aria-hidden="true" />
            <span>List</span>
          </button>
        </div>
      </div>

      {cur.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading people…" /> : null}
      {cur.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include candidates." /> : null}
      {cur.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load people" body={cur.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {tab === 'active' && effectiveActive.kind === 'ready' ? (
        <section className="rf2-panel" aria-label="Active applications">
          {truncated ? <p className="rf2-cand__bound" role="status">{`This list is incomplete. Loaded ${effectiveActive.loaded} of ${effectiveActive.total ?? effectiveActive.loaded} applications; stage, job, source, and search apply only to that window.`}</p> : null}
          {activeRows.length === 0 ? <EmptyStateV2 headingLevel={3} title={effectiveActive.rows.length === 0 && !truncated ? 'No active applications' : 'No people match these filters'} body={effectiveActive.rows.length === 0 && !truncated ? 'People you add to your jobs show here.' : 'Try another stage, job, source, or search.'} /> : viewMode === 'cards' ? (
            <>
              <div className="rf2-cand__grid">
                {activePageRows.map((row) => {
                  const href = applicationHref(row.applicationId, returnTo);
                  const years = [row.experienceYears != null ? `${row.experienceYears} yrs` : null, row.title].filter(Boolean).join(' · ');
                  return (
                    <article key={row.applicationId} className="rf2-cand__card" data-selected={picked.includes(row.applicationId) || undefined}>
                      <div className="rf2-cand__card-head">
                        <label className="rf2-cand__card-check">
                          <input type="checkbox" aria-label={`Select ${row.name} (${row.job})`} checked={picked.includes(row.applicationId)} onChange={() => toggle(row.applicationId)} />
                          <span className="rf2-kcard__avatar" aria-hidden="true">{getInitials(row.name)}</span>
                        </label>
                        <div className="rf2-cand__card-who">
                          <Link className="rf2-kcard__name" to={href}>{row.name}</Link>
                          {years ? <p className="rf2-jtable__sub">{years}</p> : null}
                        </div>
                        <StatusChip tone={STAGE_TONE[row.stage] ?? 'info'} label={STAGE_LABEL[row.stage] ?? row.stage} />
                      </div>
                      <div className="rf2-cand__card-meta">
                        <span className="rf2-cand__job-pill">{row.job}</span>
                        <span>Source: {row.source ?? '—'}</span>
                        <span>Owner: {row.owner ?? '—'}</span>
                      </div>
                      <div className="rf2-cand__card-foot">
                        <span className="rf2-cand__next">
                          {row.nextAt ? <StatusChip tone={row.nextAt < new Date().toISOString() ? 'warning' : 'neutral'} label={`Follow-up due ${formatDay(row.nextAt)}`} /> : row.next ?? '—'}
                        </span>
                        <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={href} aria-label={`Open ${row.name}`}>Open</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
              <CandidatePagination
                total={activeRows.length}
                page={safeActivePage}
                onPageChange={setActivePage}
              />
            </>
          ) : (
            <>
              <table className="rf2-jtable">
                <thead>
                  <tr>
                    <th scope="col" className="rf2-row-check"><span className="rf2-sr-only">Select</span></th>
                    <th scope="col">Candidate / job</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Source</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Next action</th>
                    <th scope="col"><span className="rf2-sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {activePageRows.map((row) => {
                    const href = applicationHref(row.applicationId, returnTo);
                    const years = [row.experienceYears != null ? `${row.experienceYears} yrs` : null, row.title].filter(Boolean).join(' · ');
                    return (
                      <tr key={row.applicationId} data-selected={picked.includes(row.applicationId) || undefined}>
                        <td><input type="checkbox" aria-label={`Select ${row.name} (${row.job})`} checked={picked.includes(row.applicationId)} onChange={() => toggle(row.applicationId)} /></td>
                        <td className="rf2-cand__who">
                          <div className="rf2-cand__who-split">
                            <div className="rf2-kcard__top">
                              <span className="rf2-kcard__avatar" aria-hidden="true">{getInitials(row.name)}</span>
                              <div>
                                <Link className="rf2-kcard__name" to={href}>{row.name}</Link>
                                {years ? <p className="rf2-jtable__sub">{years}</p> : null}
                              </div>
                            </div>
                            <span className="rf2-cand__job-pill">{row.job}</span>
                          </div>
                        </td>
                        <td><StatusChip tone={STAGE_TONE[row.stage] ?? 'info'} label={STAGE_LABEL[row.stage] ?? row.stage} /></td>
                        <td className="rf2-cand__quiet"><span className="rf2-cand__label">Source</span>{row.source ?? '—'}</td>
                        <td className="rf2-cand__quiet"><span className="rf2-cand__label">Owner</span>{row.owner ?? '—'}</td>
                        <td className="rf2-cand__next">{row.nextAt ? <StatusChip tone={row.nextAt < new Date().toISOString() ? 'warning' : 'neutral'} label={`Follow-up due ${formatDay(row.nextAt)}`} /> : row.next ?? '—'}</td>
                        <td className="rf2-jtable__act"><Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={href} aria-label={`Open ${row.name}`}>Open</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <CandidatePagination
                total={activeRows.length}
                page={safeActivePage}
                onPageChange={setActivePage}
              />
            </>
          )}
        </section>
      ) : null}
      {tab === 'bank' && bank.kind === 'ready' ? (
        <BankPanel
          rows={bank.rows}
          truncated={bank.truncated}
          loaded={bank.loaded}
          total={bank.total}
          returnTo={returnTo}
          viewMode={viewMode}
          page={bankPage}
          onPageChange={setBankPage}
          nextSliceRef={nextBankSliceRef}
        />
      ) : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Rejecting someone closes one application only. The person stays in the bank and can be suggested for other jobs.</p>
    </div>
  );
}

function CandidatePagination({
  total,
  page,
  onPageChange,
}: {
  total: number;
  page: number;
  onPageChange: (nextPage: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const windowPages = buildPageWindow(safePage, totalPages);

  return (
    <div className="rf2-cand__pager">
      <div className="rf2-cand__pager-meta">
        <span>
          Showing <strong>{start}–{end}</strong> of <strong>{total}</strong>
        </span>
        <span className="rf2-cand__pager-pill">{PAGE_SIZE} per page</span>
        {safePage < totalPages ? <span className="rf2-cand__pager-cache">Next page cached</span> : null}
      </div>
      <nav className="rf2-cand__pager-nav" aria-label="Candidates pagination">
        <button
          type="button"
          className="rf2-cand__page-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
          <span>Previous</span>
        </button>
        {windowPages.map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`e-${idx}`} className="rf2-cand__page-ellipsis" aria-hidden="true">…</span>
          ) : (
            <button
              key={item}
              type="button"
              className="rf2-cand__page-btn"
              data-active={item === safePage ? 'true' : undefined}
              aria-current={item === safePage ? 'page' : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="rf2-cand__page-btn"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

/** People in the bank (added via CV upload). */
function BankPanel({
  rows,
  truncated,
  loaded,
  total,
  returnTo,
  viewMode,
  page,
  onPageChange,
  nextSliceRef,
}: {
  rows: BankRow[];
  truncated?: boolean;
  loaded?: number;
  total?: number | null;
  returnTo: string;
  viewMode: 'list' | 'cards';
  page: number;
  onPageChange: (nextPage: number) => void;
  nextSliceRef: React.MutableRefObject<{ source: BankRow[]; page: number; rows: BankRow[] } | null>;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const cached = nextSliceRef.current;
    if (cached && cached.source === rows && cached.page === safePage) {
      return cached.rows;
    }
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage, nextSliceRef]);

  useEffect(() => {
    if (safePage < totalPages) {
      const nextStart = safePage * PAGE_SIZE;
      nextSliceRef.current = {
        source: rows,
        page: safePage + 1,
        rows: rows.slice(nextStart, nextStart + PAGE_SIZE),
      };
    } else {
      nextSliceRef.current = null;
    }
  }, [rows, safePage, totalPages, nextSliceRef]);

  return (
    <section className="rf2-panel" aria-label="Bank">
      {truncated ? <p className="rf2-cand__bound" role="status">{`This list is incomplete. Loaded ${loaded ?? rows.length} of ${total ?? loaded ?? rows.length} bank people; search applies across the full bank.`}</p> : null}
      <nav className="rf2-bank-links" aria-label="Bank tools">
        <Link to="/cv-bank">CV bank</Link>
        <Link to="/sourcing-match">Match Skills</Link>
      </nav>
      <p className="rf2-inline-note"><Info aria-hidden="true" /> PDF and Word CVs are added from a job or via Upload CVs. Each duplicate person stays one record in the bank.</p>
      {rows.length === 0 ? <EmptyStateV2 headingLevel={3} title="No one found" body="Try another name or title." /> : viewMode === 'cards' ? (
        <>
          <div className="rf2-cand__grid">
            {pageRows.map((row) => (
              <article key={row.candidateId} className="rf2-cand__card">
                <div className="rf2-cand__card-head">
                  <span className="rf2-kcard__avatar" aria-hidden="true">{getInitials(row.name)}</span>
                  <div className="rf2-cand__card-who">
                    <Link className="rf2-jtable__name" to={withReturnTo(`/candidates/${encodeURIComponent(row.candidateId)}`, returnTo)}>{row.name}</Link>
                    <p className="rf2-jtable__sub">
                      {row.code} · <Link className="rf2-cand__doc-link" to={withReturnTo(`/candidates/${encodeURIComponent(row.candidateId)}/documents`, returnTo)} aria-label={`Documents for ${row.name}`}>Documents</Link>
                    </p>
                  </div>
                </div>
                <div className="rf2-cand__card-meta">
                  <span>{row.title ?? 'Title not specified'}</span>
                  <span>{row.location ?? 'Location not specified'}</span>
                  <span>{row.experienceYears != null ? `${row.experienceYears} yrs` : 'Experience not specified'}</span>
                </div>
              </article>
            ))}
          </div>
          <CandidatePagination total={rows.length} page={safePage} onPageChange={onPageChange} />
        </>
      ) : (
        <>
          <table className="rf2-jtable">
            <thead><tr><th scope="col">Name</th><th scope="col">Current title</th><th scope="col">Location</th><th scope="col">Experience</th></tr></thead>
            <tbody>{pageRows.map((row) => (
              <tr key={row.candidateId}>
                <td><div className="rf2-kcard__top"><span className="rf2-kcard__avatar" aria-hidden="true">{getInitials(row.name)}</span><div><Link className="rf2-jtable__name" to={withReturnTo(`/candidates/${encodeURIComponent(row.candidateId)}`, returnTo)}>{row.name}</Link><p className="rf2-jtable__sub">{row.code} · <Link className="rf2-cand__doc-link" to={withReturnTo(`/candidates/${encodeURIComponent(row.candidateId)}/documents`, returnTo)} aria-label={`Documents for ${row.name}`}>Documents</Link></p></div></div></td>
                <td><span className="rf2-cand__label">Title</span>{row.title ?? '—'}</td>
                <td><span className="rf2-cand__label">Location</span>{row.location ?? '—'}</td>
                <td className="rf2-num"><span className="rf2-cand__label">Experience</span>{row.experienceYears != null ? `${row.experienceYears} yrs` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
          <CandidatePagination total={rows.length} page={safePage} onPageChange={onPageChange} />
        </>
      )}
    </section>
  );
}
