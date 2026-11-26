import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageReturn, withReturnTo } from '../returnTarget';
import { ApiError } from '../../api/client';
import {
  Briefcase,
  Check,
  CircleCheck,
  CircleX,
  FileText,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Tags,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import type { JdCriteriaDefinition } from '@recruitflow/contracts';
import { calculateCandidateFitScore, detectClinicalDomain } from '@recruitflow/validation';
import { ButtonV2, DiscardChangesDialog, DrawerV2, InputV2, StatusChip, type StatusTone } from '../../components/v2';
import {
  FIELD_LABEL,
  candidateExistsDetails,
  cvFileProblem,
  duplicateCheck,
  existingPerson,
  importRow,
  parseCv,
  readStoredImportProgress,
  splitName,
  type DuplicateCheckResult,
  type ExtractedCv,
  type ExistingPerson,
  type ImportDecision,
  type LinkResult,
  type PartialImportProgress,
} from '../api/cvImport';
import { errorMessage, jobTitle, type JobDetail } from '../api/jobs';
import { formatSkillLabel, isSkillMatched, parseSkillInput } from './skillFormat';
import './cv-intake-drawer.css';

type RowStatus = 'parsing' | 'ready' | 'unreadable' | 'invalid' | 'importing' | 'done' | 'failed';
interface Row {
  key: string;
  file: File;
  status: RowStatus;
  cv?: ExtractedCv;
  dup?: DuplicateCheckResult | null;
  decision?: ImportDecision;
  problem?: string;
  link?: LinkResult;
  existing?: ExistingPerson;
  onJob?: { applicationId: string | null };
  partial?: PartialImportProgress;
}

const MATCH_LABEL = { email: 'same email', phone: 'same phone' } as const;

interface RoleFitEvaluation {
  label: string;
  tone: StatusTone;
  matched: string[];
  missing: string[];
  experienceNote: string | null;
}

function resolveJobCriteria(job: JobDetail) {
  const criteria = (job.jdCriteria as JdCriteriaDefinition | null | undefined) ?? null;
  const requiredSkills = criteria?.mustHaveSkills?.length
    ? criteria.mustHaveSkills.map((s) => s.name).filter(Boolean)
    : (job.requiredSkills ?? []).filter(Boolean);
  const niceToHaveSkills = criteria?.niceToHaveSkills?.map((s) => s.name).filter(Boolean) ?? [];
  const minExperienceYears = criteria?.minExperienceYears ?? job.minExperienceYears ?? 0;
  return { requiredSkills, niceToHaveSkills, minExperienceYears };
}

/** Deterministic role-fit engine via @recruitflow/validation (qualitative badge only, no % digits). */
function evaluateRoleFit(cv: ExtractedCv, job: JobDetail): RoleFitEvaluation {
  const { requiredSkills, niceToHaveSkills, minExperienceYears } = resolveJobCriteria(job);
  const title = jobTitle(job);
  const fit = calculateCandidateFitScore(
    {
      skills: cv.skills ?? [],
      experienceYears: cv.experienceYears ?? null,
      location: cv.location ?? null,
      certifications: cv.certifications ?? [],
      currentTitle: cv.title ?? null,
      summary: cv.summary ?? null,
      rawText: cv.rawText ?? null,
      responsibilities: cv.responsibilities ?? null,
      projects: cv.projects ?? null,
      workHistory: cv.workHistory ?? null,
      education: cv.education ?? null,
      educationHistory: cv.educationHistory ?? null,
      projectHistory: cv.projectHistory ?? null,
      evidenceChunks: cv.evidenceChunks ?? null,
    },
    {
      requiredSkills,
      niceToHaveSkills,
      minExperienceYears,
      location: job.location || job.branch?.name || '',
      qualifications: [title, job.qualifications].filter(Boolean).join(' '),
      department: job.department || '',
    },
  );

  const matched = fit.breakdown.skills.matched;
  const missing = fit.breakdown.skills.missing;
  const exp = fit.breakdown.experience;
  const experienceNote = exp.required > 0
    ? exp.met
      ? `Experience meets target (${exp.actual} yrs vs ${exp.required}+ yrs)`
      : `Experience below target (${exp.actual} yrs vs ${exp.required}+ yrs)`
    : null;

  if (fit.score >= 70) return { label: 'Strong fit', tone: 'success', matched, missing, experienceNote };
  if (fit.score >= 50) return { label: 'Good fit', tone: 'info', matched, missing, experienceNote };
  if (fit.score >= 30) return { label: 'Partial fit', tone: 'warning', matched, missing, experienceNote };
  return { label: 'Review fit', tone: 'neutral', matched, missing, experienceNote };
}

/** E11 / Ticket 10: Shared CV upload workspace (used in full-page /vacancies/:id/upload-cv and legacy drawer). */
export function CvUploadCore({
  job,
  mode = 'page',
  onClose,
  onDone,
  onImported,
}: {
  job: JobDetail;
  mode?: 'page' | 'drawer';
  onClose: () => void;
  onDone: () => void;
  onImported?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const jobCriteria = useMemo(() => resolveJobCriteria(job), [job]);

  const readRow = async (key: string, file: File) => {
    try {
      const rawCv = await parseCv(file);
      const normalizedSkills = rawCv.skills?.length
        ? Array.from(
            new Map(
              rawCv.skills
                .map((s) => formatSkillLabel(s))
                .filter(Boolean)
                .map((s) => [s.toLowerCase(), s]),
            ).values(),
          )
        : rawCv.skills;
      const cv: ExtractedCv = normalizedSkills ? { ...rawCv, skills: normalizedSkills } : rawCv;
      const named = Boolean(cv.firstName || cv.lastName || cv.email || cv.phone);
      if (!named && !cv.rawText?.trim()) {
        patch(key, { status: 'unreadable', problem: 'No readable text. Re-scan it or add it as a single CV.' });
        return;
      }
      let dup: DuplicateCheckResult | null = null;
      if (cv.email || cv.phone) {
        dup = await duplicateCheck({
          ...(cv.email ? { email: cv.email } : {}),
          ...(cv.phone ? { phone: cv.phone } : {}),
        });
      }
      const stored = readStoredImportProgress(job.id, file);
      const decision: ImportDecision = stored?.candidateId
        ? { kind: 'link', candidateId: stored.candidateId }
        : dup?.identityConflict
          ? { kind: 'link', candidateId: dup.matches[0]?.candidateId ?? '' }
          : dup?.matches[0]
            ? { kind: 'link', candidateId: dup.matches[0].candidateId }
            : { kind: 'create' };
      patch(key, { status: 'ready', cv, dup, decision, ...(stored ? { partial: stored } : {}), problem: undefined });
    } catch (e) {
      const unreadable = e instanceof ApiError && e.code === 'FILE_INVALID';
      patch(key, { status: unreadable ? 'unreadable' : 'failed', problem: errorMessage(e, 'CV processing failed. Please retry.') });
    }
  };

  const recheckDuplicate = async (key: string, cv: ExtractedCv) => {
    if (!cv.email && !cv.phone) {
      patch(key, { dup: null, decision: { kind: 'create' } });
      return;
    }
    try {
      const dup = await duplicateCheck({
        ...(cv.email ? { email: cv.email.trim() } : {}),
        ...(cv.phone ? { phone: cv.phone.trim() } : {}),
      });
      const decision: ImportDecision = dup?.matches[0]
        ? { kind: 'link', candidateId: dup.matches[0].candidateId }
        : { kind: 'create' };
      patch(key, { dup, decision, existing: undefined });
    } catch {
      // Keep current duplicate state if lookup fails transiently
    }
  };

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setSummary(null);
    const fresh: Row[] = [...files].map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, status: 'parsing' as RowStatus }));
    setRows((rs) => [...rs, ...fresh]);
    for (const row of fresh) {
      const problem = cvFileProblem(row.file);
      if (problem) {
        patch(row.key, { status: 'invalid', problem });
        continue;
      }
      void readRow(row.key, row.file);
    }
  };

  const retryRow = (key: string) => {
    const row = rows.find((item) => item.key === key);
    if (!row) return;
    if (row.status === 'unreadable' || (row.status === 'failed' && !row.cv)) {
      patch(key, { status: 'parsing', problem: undefined });
      void readRow(key, row.file);
      return;
    }
    if (row.status === 'failed' && row.cv) patch(key, { status: 'ready', problem: undefined });
  };

  const ready = rows.filter((r) => r.status === 'ready');
  const parsing = rows.some((r) => r.status === 'parsing');
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const duplicateCount = ready.filter((r) => r.dup?.isDuplicate).length;
  const issueCount = rows.filter((r) => r.status === 'unreadable' || r.status === 'invalid' || r.status === 'failed').length;

  const requestClose = () => {
    if (busy) return;
    if (ready.length === 0) {
      onClose();
      return;
    }
    setConfirmDiscardOpen(true);
  };

  const run = async () => {
    setBusy(true);
    let ok = 0;
    let linked = 0;
    let failed = 0;
    let conflicted = 0;
    let already = 0;
    for (const r of ready) {
      patch(r.key, { status: 'importing' });
      try {
        const res = await importRow(job.id, r.file, r.cv ?? {}, r.decision ?? { kind: 'create' }, r.partial);
        if (res.alreadyOnJob) {
          already += 1;
          patch(r.key, { status: 'done', link: res.link, onJob: { applicationId: res.applicationId }, partial: undefined, problem: undefined });
          continue;
        }
        ok += 1;
        if (r.decision?.kind === 'link') linked += 1;
        if (res.link?.conflicts.length) conflicted += 1;
        patch(r.key, { status: 'done', link: res.link, onJob: undefined, partial: undefined, problem: undefined });
      } catch (e) {
        const partial = (e as { partialImport?: PartialImportProgress } | null)?.partialImport;
        if (partial?.candidateId) {
          failed += 1;
          patch(
            r.key,
            partial.documentId
              ? {
                  status: 'failed',
                  decision: { kind: 'link', candidateId: partial.candidateId },
                  partial,
                  ...(partial.applicationId ? { onJob: { applicationId: partial.applicationId } } : {}),
                  problem: `Added to Applied and CV attached, but profile enrichment failed: ${errorMessage(e, 'Profile fill failed.')} Retry to complete enrichment or open the file.`,
                }
              : partial.applicationId
                ? {
                    status: 'failed',
                    decision: { kind: 'link', candidateId: partial.candidateId },
                    partial,
                    onJob: { applicationId: partial.applicationId },
                    problem: `Added to Applied, but CV upload failed: ${errorMessage(e, 'Upload failed.')} Retry to attach the CV or open the file.`,
                  }
                : { status: 'failed', decision: { kind: 'link', candidateId: partial.candidateId }, partial, problem: errorMessage(e, 'Import failed.') },
          );
          continue;
        }
        // #23 CANDIDATE_EXISTS: someone with this email/phone is already in the bank. Offer to link that person (never copy).
        const found = await existingPerson(e, { email: r.cv?.email, phone: r.cv?.phone });
        if (found !== undefined) {
          const dup: DuplicateCheckResult | null = found && candidateExistsDetails(e)
            ? {
                normalized: { email: null, phone: null },
                isDuplicate: true,
                matches: [{ candidateId: found.candidateId, candidateCode: found.candidateCode ?? '', name: found.name ?? found.candidateCode ?? 'the existing person', status: 'Active', matchedBy: [] }],
              }
            : await duplicateCheck({ ...(r.cv?.email ? { email: r.cv.email } : {}), ...(r.cv?.phone ? { phone: r.cv.phone } : {}) }).catch(() => null);
          failed += 1;
          patch(
            r.key,
            found
              ? { status: 'ready', dup: dup ?? r.dup, decision: { kind: 'link', candidateId: found.candidateId }, existing: found, problem: undefined }
              : { status: 'failed', problem: 'This person is already in the bank. Find them under Candidates and add them to this job from there.' },
          );
          continue;
        }
        failed += 1;
        patch(r.key, { status: 'failed', problem: errorMessage(e, 'Import failed.') });
      }
    }
    setBusy(false);
    setSummary(`${ok} added to Applied${linked ? ` (${linked} linked to an existing person)` : ''}${already ? ` · ${already} already on this job` : ''}${failed ? ` · ${failed} failed` : ''}.`);
    if (ok && !failed && !conflicted && !already) onDone();
    else if (ok) onImported?.();
  };

  const activeStep: 1 | 2 | 3 | 4 = rows.length === 0 || parsing
    ? 1
    : rows.some((r) => Boolean(r.dup?.identityConflict || r.dup?.matches?.length))
      ? 2
      : doneCount > 0 && ready.length === 0
        ? 4
        : 3;

  const content = (
    <div className="rf2-jimp">
      {/* Ticket 10: Explicit 4-step CV intake pipeline bar */}
      <div className="rf2-intake__engine-notes" role="region" aria-label="CV upload pipeline steps">
        <div className="rf2-intake__engine-note" aria-current={activeStep === 1 ? 'step' : undefined}>
          <strong>1. ATS extraction</strong>
          <span>Extracts identity, experience, skills, and certifications automatically.</span>
        </div>
        <div className="rf2-intake__engine-note" aria-current={activeStep === 2 ? 'step' : undefined}>
          <strong>2. Duplicate check</strong>
          <span>Matches normalized email and phone against the candidate bank.</span>
        </div>
        <div className="rf2-intake__engine-note" aria-current={activeStep === 3 ? 'step' : undefined}>
          <strong>3. Skills match</strong>
          <span>Evaluates extracted skills and certifications against this vacancy.</span>
        </div>
        <div className="rf2-intake__engine-note" aria-current={activeStep === 4 ? 'step' : undefined}>
          <strong>4. Review &amp; add to Applied</strong>
          <span>Edit detected fields, resolve duplicates, and commit ready CVs.</span>
        </div>
      </div>

      {/* Target Role Criteria Card */}
      <div className="rf2-jimp__criteria">
        <div className="rf2-jimp__criteria-head">
          <h3 className="rf2-jimp__criteria-title">
            <Briefcase aria-hidden="true" />
            <span>Matching Criteria · {jobTitle(job)}</span>
          </h3>
          <span className="rf2-jimp__criteria-meta">
            {[job.vacancyCode, job.branch?.name, jobCriteria.minExperienceYears > 0 ? `${jobCriteria.minExperienceYears}+ yrs exp` : null].filter(Boolean).join(' · ')}
          </span>
        </div>
        {jobCriteria.requiredSkills.length > 0 ? (
          <div className="rf2-jimp__criteria-chips">
            {jobCriteria.requiredSkills.slice(0, 8).map((skill) => (
              <span key={skill} className="rf2-jimp__req-chip">{skill}</span>
            ))}
            {jobCriteria.requiredSkills.length > 8 ? (
              <span className="rf2-jimp__criteria-meta">+{jobCriteria.requiredSkills.length - 8} more</span>
            ) : null}
          </div>
        ) : (
          <span className="rf2-jimp__criteria-meta">
            CV engine evaluates extracted skills, certifications, clinical domain, experience, and contact identity for this role.
          </span>
        )}
      </div>

      {/* Upgraded Drag & Drop CV Extraction Zone */}
      <div
        className="rf2-jimp__drop"
        data-dragging={dragging ? 'true' : 'false'}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
      >
        <span className="rf2-jimp__drop-icon" aria-hidden="true">
          <Upload />
        </span>
        <label htmlFor="cv-files" className="rf2-jimp__drop-label">
          Drop CVs or <span className="rf2-link">select files</span>
        </label>
        <input
          id="cv-files"
          ref={input}
          className="rf2-sr-only"
          type="file"
          multiple
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="rf2-jtable__sub">
          Select one or several PDF or Word files, up to 10 MB each. Each CV runs ATS extraction, duplicate check, and skills match before saving.
        </p>
        <div className="rf2-jimp__drop-formats" aria-hidden="true">
          <span className="rf2-jimp__format-pill">PDF</span>
          <span className="rf2-jimp__format-pill">DOCX</span>
          <span className="rf2-jimp__format-pill">DOC</span>
          <span className="rf2-jimp__format-pill">Multi-CV batch</span>
        </div>
      </div>

      {/* Queue Status Strip */}
      {rows.length > 0 ? (
        <div className="rf2-jimp__queue-bar">
          <span>
            {rows.length} {rows.length === 1 ? 'CV queued' : 'CVs queued'}
            {ready.length ? ` · ${ready.length} ready` : ''}
            {duplicateCount ? ` · ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''}` : ''}
            {issueCount ? ` · ${issueCount} need${issueCount === 1 ? 's' : ''} attention` : ''}
          </span>
          {parsing ? <StatusChip tone="info" label="Extracting CVs…" /> : null}
        </div>
      ) : null}

      {rows.length ? (
        <ul className="rf2-imports" aria-label="CVs">
          {rows.map((r) => (
            <ImportRow
              key={r.key}
              row={r}
              job={job}
              busy={busy}
              onDecide={(d) => patch(r.key, { decision: d })}
              onUpdateCv={(nextCv) => patch(r.key, { cv: nextCv })}
              onRecheckDup={(nextCv) => void recheckDuplicate(r.key, nextCv)}
              onRetry={() => retryRow(r.key)}
              onRemove={() => removeRow(r.key)}
            />
          ))}
        </ul>
      ) : null}

      {summary ? <p className="rf2-inline-note" role="status">{summary}</p> : null}

      {mode === 'page' ? (
        <div className="rf2-req__foot">
          <ButtonV2 kind="secondary" disabled={busy} onClick={requestClose}>Cancel</ButtonV2>
          <ButtonV2 icon={<Upload />} loading={busy} disabled={!ready.length || parsing} onClick={() => void run()}>
            {`Import ${ready.length} to Applied`}
          </ButtonV2>
        </div>
      ) : null}
    </div>
  );

  const discardDialog = (
    <DiscardChangesDialog
      open={confirmDiscardOpen}
      body="You have parsed CVs ready to import. If you leave now, these unsaved items will be discarded."
      onKeepEditing={() => setConfirmDiscardOpen(false)}
      onDiscard={() => {
        setConfirmDiscardOpen(false);
        onClose();
      }}
    />
  );

  if (mode === 'page') {
    return (
      <>
        {content}
        {discardDialog}
      </>
    );
  }

  return (
    <>
      <DrawerV2
        open
        onClose={requestClose}
        kicker={`Import CVs · ${jobTitle(job)}`}
        title="Add candidates to Applied"
        subtitle="Extract candidate details, validate skills & certifications against this role, and verify bank duplicates before importing."
        primaryAction={
          <ButtonV2 icon={<Upload />} loading={busy} disabled={!ready.length || parsing} onClick={() => void run()}>
            {`Import ${ready.length} to Applied`}
          </ButtonV2>
        }
        secondaryAction={<ButtonV2 kind="secondary" onClick={requestClose}>Cancel</ButtonV2>}
      >
        {content}
      </DrawerV2>
      {discardDialog}
    </>
  );
}

/** E11 Import CVs drawer wrapper (preserved for deep links at ?drawer=import). */
export function ImportCvsDrawer({
  job,
  onClose,
  onDone,
  onImported,
}: {
  job: JobDetail;
  onClose: () => void;
  onDone: () => void;
  onImported?: () => void;
}) {
  return <CvUploadCore job={job} mode="drawer" onClose={onClose} onDone={onDone} onImported={onImported} />;
}

function ImportRow({
  row,
  job,
  busy,
  onDecide,
  onUpdateCv,
  onRecheckDup,
  onRetry,
  onRemove,
}: {
  row: Row;
  job: JobDetail;
  busy: boolean;
  onDecide: (d: ImportDecision) => void;
  onUpdateCv: (cv: ExtractedCv) => void;
  onRecheckDup: (cv: ExtractedCv) => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const pageReturn = usePageReturn();
  const [editing, setEditing] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');

  const chip = {
    parsing: <StatusChip tone="neutral" label="Reading…" />,
    ready: row.dup?.isDuplicate ? <StatusChip tone="warning" label="Duplicate" /> : <StatusChip tone="success" label="Parsed" />,
    unreadable: <StatusChip tone="danger" label="Unreadable" />,
    invalid: <StatusChip tone="danger" label="Not accepted" />,
    importing: <StatusChip tone="neutral" label="Importing…" />,
    done: <StatusChip tone="success" label={row.decision?.kind === 'link' ? 'Linked' : 'Added'} />,
    failed: <StatusChip tone="danger" label="Failed" />,
  }[row.status];

  const name = row.cv ? splitName(row.cv, row.file.name) : null;
  const group = `dup-${row.key}`;
  const roleFit = useMemo(() => (row.status === 'ready' && row.cv ? evaluateRoleFit(row.cv, job) : null), [row.status, row.cv, job]);

  const updateField = (patchCv: Partial<ExtractedCv>) => {
    if (!row.cv) return;
    onUpdateCv({ ...row.cv, ...patchCv });
  };

  const addSkill = (explicit?: string) => {
    if (!row.cv) return;
    const incoming = parseSkillInput(explicit ?? newSkill);
    if (incoming.length === 0) return;
    const current = row.cv.skills ?? [];
    const existingKeys = new Set(current.map((s) => s.toLowerCase()));
    const next = [...current];
    for (const item of incoming) {
      if (!existingKeys.has(item.toLowerCase())) {
        existingKeys.add(item.toLowerCase());
        next.push(item);
      }
    }
    if (next.length !== current.length) {
      onUpdateCv({ ...row.cv, skills: next });
    }
    if (explicit === undefined) setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    if (!row.cv) return;
    onUpdateCv({ ...row.cv, skills: (row.cv.skills ?? []).filter((s) => s !== skill) });
  };

  const addCertification = () => {
    if (!row.cv) return;
    const clean = newCert.trim();
    if (!clean) return;
    const current = row.cv.certifications ?? [];
    if (!current.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      onUpdateCv({ ...row.cv, certifications: [...current, clean] });
    }
    setNewCert('');
  };

  const removeCertification = (cert: string) => {
    if (!row.cv) return;
    onUpdateCv({ ...row.cv, certifications: (row.cv.certifications ?? []).filter((c) => c !== cert) });
  };

  const clearAllSkills = () => {
    if (!row.cv) return;
    onUpdateCv({ ...row.cv, skills: [] });
  };

  const refreshDomain = () => {
    if (!row.cv) return;
    const detection = detectClinicalDomain(
      row.cv.skills ?? [],
      row.cv.title,
      row.cv.certifications,
      row.cv.rawText,
      row.cv.experienceYears ?? 0,
    );
    onUpdateCv({ ...row.cv, clinicalDomain: detection.domain, subspecialties: detection.subspecialties });
  };

  return (
    <li className="rf2-imports__row rf2-jimp__card" aria-busy={row.status === 'parsing' || row.status === 'importing' || undefined}>
      <div className="rf2-jimp__card-head">
        <span className="rf2-imports__file">
          <FileText aria-hidden="true" />
          <strong>{row.file.name}</strong>
        </span>
        <div className="rf2-jimp__card-badges">
          {row.status === 'ready' && row.cv?.parsingQuality ? (
            <StatusChip
              tone="info"
              label={`${row.cv.parsingQuality} quality${row.cv.parserSource ? ` · ${row.cv.parserSource === 'affinda' ? 'ATS engine' : 'Local extractor'}` : ''}`}
            />
          ) : null}
          {chip}
        </div>
      </div>

      {row.problem ? (
        <p className="rf2-imports__problem" role={row.status === 'failed' ? 'alert' : undefined}>
          <CircleX aria-hidden="true" /> {row.problem}
        </p>
      ) : null}

      {row.status === 'failed' || row.status === 'unreadable' ? (
        <p className="rf2-imports__actions">
          <ButtonV2 kind="secondary" size="sm" onClick={onRetry}>Retry</ButtonV2>
          {row.status === 'failed' && row.partial?.applicationId ? (
            <>
              {' '}
              <Link className="rf2-link" to={withReturnTo(`/applications/${encodeURIComponent(row.partial.applicationId)}`, pageReturn)}>
                Open the file
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {row.status === 'ready' && row.cv ? (
        <>
          {/* Role Fit Engine Summary */}
          {roleFit ? (
            <div className="rf2-jimp__fit-box">
              <div className="rf2-jimp__fit-head">
                <span className="rf2-intake__section-title">
                  <Sparkles aria-hidden="true" />
                  <span>Role Fit Evaluation</span>
                </span>
                <div className="rf2-jimp__card-badges">
                  {row.cv.clinicalDomain ? <StatusChip tone="neutral" label={row.cv.clinicalDomain} /> : null}
                  <StatusChip tone={roleFit.tone} label={roleFit.label} />
                </div>
              </div>
              {roleFit.matched.length > 0 || roleFit.missing.length > 0 ? (
                <div className="rf2-intake__kw-row">
                  {roleFit.matched.slice(0, 6).map((kw) => (
                    <span key={`m-${kw}`} className="rf2-intake__kw" data-kind="match">✓ {kw}</span>
                  ))}
                  {roleFit.missing.slice(0, 4).map((kw) => (
                    <span key={`x-${kw}`} className="rf2-intake__kw" data-kind="missing">− {kw}</span>
                  ))}
                </div>
              ) : null}
              {roleFit.experienceNote ? <p className="rf2-intake__rec-reason">{roleFit.experienceNote}</p> : null}
            </div>
          ) : null}

          {/* Extracted Fields Summary */}
          <dl className="rf2-imports__parsed">
            <div><dt>Name</dt><dd>{name ? `${name.firstName} ${name.lastName}` : '—'}</dd></div>
            {row.cv.title ? <div><dt>Current title</dt><dd>{row.cv.title}{row.cv.currentCompany ? `, ${row.cv.currentCompany}` : ''}</dd></div> : null}
            <div><dt>Email</dt><dd>{row.cv.email || 'Not found'}</dd></div>
            <div><dt>Phone</dt><dd>{row.cv.phone || 'Not found'}</dd></div>
            {typeof row.cv.experienceYears === 'number' ? <div><dt>Experience</dt><dd>{row.cv.experienceYears} years</dd></div> : null}
            {row.cv.location ? <div><dt>Location</dt><dd>{row.cv.location}</dd></div> : null}
            {row.cv.skills?.length ? (
              <div>
                <dt>Extracted skills</dt>
                <dd>
                  <span className="rf2-jimp__skill-pills">
                    {row.cv.skills.slice(0, 8).map((skill) => {
                      const matched = isSkillMatched(skill, roleFit?.matched ?? []);
                      return (
                        <span
                          key={skill}
                          className="rf2-jimp__skill-pill"
                          data-matched={matched ? 'true' : undefined}
                        >
                          {matched ? <Check size={11} aria-hidden="true" /> : null}
                          {formatSkillLabel(skill)}
                        </span>
                      );
                    })}
                    {row.cv.skills.length > 8 ? (
                      <span className="rf2-jimp__skill-pill rf2-jimp__skill-pill--more">
                        +{row.cv.skills.length - 8} more
                      </span>
                    ) : null}
                  </span>
                </dd>
              </div>
            ) : null}
            {row.cv.certifications?.length ? (
              <div>
                <dt>Certifications</dt>
                <dd>
                  <span className="rf2-jimp__skill-pills">
                    {row.cv.certifications.map((cert) => (
                      <span key={cert} className="rf2-jimp__skill-pill">{cert}</span>
                    ))}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>

          {/* Row Action Controls: Inline Validate & Edit + Remove */}
          <div className="rf2-jimp__row-tools">
            <ButtonV2
              kind="secondary"
              size="sm"
              icon={<Pencil />}
              disabled={busy}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Done editing' : 'Edit detected data'}
            </ButtonV2>
            <ButtonV2
              kind="tertiary"
              size="sm"
              icon={<Trash2 />}
              disabled={busy}
              onClick={onRemove}
            >
              Remove
            </ButtonV2>
          </div>

          {/* Collapsible Inline Editor for Validating & Correcting Parsed CV Data */}
          {editing ? (
            <div className="rf2-jimp__edit-panel">
              <div className="rf2-intake__grid">
                <InputV2
                  label="First name"
                  value={row.cv.firstName ?? name?.firstName ?? ''}
                  onChange={(e) => updateField({ firstName: e.target.value })}
                />
                <InputV2
                  label="Last name"
                  value={row.cv.lastName ?? (name?.lastName === '-' ? '' : name?.lastName) ?? ''}
                  onChange={(e) => updateField({ lastName: e.target.value })}
                />
                <InputV2
                  label="Email"
                  type="email"
                  value={row.cv.email ?? ''}
                  onChange={(e) => updateField({ email: e.target.value })}
                />
                <InputV2
                  label="Phone"
                  type="tel"
                  value={row.cv.phone ?? ''}
                  onChange={(e) => updateField({ phone: e.target.value })}
                />
                <InputV2
                  label="Current title"
                  value={row.cv.title ?? ''}
                  onChange={(e) => updateField({ title: e.target.value })}
                />
                <InputV2
                  label="Experience (years)"
                  type="number"
                  min={0}
                  max={60}
                  value={row.cv.experienceYears ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    updateField({ experienceYears: raw === '' ? undefined : Math.max(0, Number(raw)) });
                  }}
                />
              </div>

              <div className="rf2-skills-box">
                <div className="rf2-skills-box__head">
                  <span className="rf2-skills-box__title">
                    <Tags aria-hidden="true" />
                    <span>Skills &amp; competencies</span>
                    <span className="rf2-skills-box__count">{row.cv.skills?.length ?? 0}</span>
                  </span>
                  <div className="rf2-skills-box__head-right">
                    {roleFit && roleFit.matched.length > 0 ? (
                      <span className="rf2-skills-box__legend">
                        <Check size={12} aria-hidden="true" /> Role match
                      </span>
                    ) : null}
                    {row.cv.skills && row.cv.skills.length > 0 ? (
                      <button
                        type="button"
                        className="rf2-skills-box__clear"
                        onClick={clearAllSkills}
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rf2-skills-box__well">
                  {row.cv.skills && row.cv.skills.length > 0 ? (
                    row.cv.skills.map((skill) => {
                      const label = formatSkillLabel(skill);
                      const matched = isSkillMatched(skill, roleFit?.matched ?? []);
                      return (
                        <span
                          key={skill}
                          className="rf2-intake__tag"
                          data-matched={matched ? 'true' : undefined}
                        >
                          {matched ? <Check className="rf2-intake__tag-check" aria-hidden="true" /> : null}
                          <span>{label}</span>
                          <button
                            type="button"
                            className="rf2-intake__tag-remove"
                            aria-label={`Remove skill ${label}`}
                            onClick={() => removeSkill(skill)}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </span>
                      );
                    })
                  ) : (
                    <p className="rf2-skills-box__empty">
                      No skills tagged yet — add skills below to refine role-fit evaluation.
                    </p>
                  )}
                </div>

                {roleFit && roleFit.missing.length > 0 ? (
                  <div className="rf2-skills-box__suggest">
                    <span className="rf2-skills-box__suggest-label">Missing for this role:</span>
                    {roleFit.missing.slice(0, 5).map((missingSkill) => {
                      const label = formatSkillLabel(missingSkill);
                      return (
                        <button
                          key={missingSkill}
                          type="button"
                          className="rf2-skills-box__suggest-btn"
                          onClick={() => addSkill(label)}
                        >
                          <Plus size={11} aria-hidden="true" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="rf2-intake__tag-add">
                  <InputV2
                    label="Add skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Type skill(s), e.g. ICU, ACLS, PACS"
                  />
                  <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={() => addSkill()}>
                    Add
                  </ButtonV2>
                </div>
                <p className="rf2-skills-box__hint">
                  Press Enter or separate multiple skills with commas.
                </p>
              </div>

              {/* Ticket 10: Extracted certifications editor */}
              <div className="rf2-skills-box">
                <div className="rf2-skills-box__head">
                  <span className="rf2-skills-box__title">
                    <CircleCheck aria-hidden="true" />
                    <span>Certifications</span>
                    <span className="rf2-skills-box__count">{row.cv.certifications?.length ?? 0}</span>
                  </span>
                </div>
                <div className="rf2-skills-box__well">
                  {row.cv.certifications && row.cv.certifications.length > 0 ? (
                    row.cv.certifications.map((cert) => (
                      <span key={cert} className="rf2-intake__tag">
                        <span>{cert}</span>
                        <button
                          type="button"
                          className="rf2-intake__tag-remove"
                          aria-label={`Remove certification ${cert}`}
                          onClick={() => removeCertification(cert)}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <p className="rf2-skills-box__empty">No certifications detected yet — add licenses or certificates below.</p>
                  )}
                </div>
                <div className="rf2-intake__tag-add">
                  <InputV2
                    label="Add certification"
                    value={newCert}
                    onChange={(e) => setNewCert(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCertification();
                      }
                    }}
                    placeholder="e.g. BLS — AHA (2025), SCFHS"
                  />
                  <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={addCertification}>
                    Add certification
                  </ButtonV2>
                </div>
              </div>

              <div className="rf2-jimp__row-tools">
                <ButtonV2 kind="secondary" size="sm" icon={<RefreshCw />} onClick={() => onRecheckDup(row.cv!)}>
                  Re-check duplicate
                </ButtonV2>
                <ButtonV2 kind="secondary" size="sm" icon={<Sparkles />} onClick={refreshDomain}>
                  Refresh domain
                </ButtonV2>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {row.status === 'ready' && !row.cv?.email && !row.cv?.phone ? (
        <p className="rf2-inline-note" data-tone="warning">
          <TriangleAlert aria-hidden="true" /> No email or phone in this CV, so it can’t be checked for duplicates. It will be added as a new person.
        </p>
      ) : null}

      {row.status === 'ready' && row.existing ? (
        <p className="rf2-inline-note" data-tone="warning" role="alert" data-testid="candidate-exists">
          <Link2 aria-hidden="true" /> Already in the bank{row.existing.name ? ` as ${row.existing.name}` : ''}{row.existing.candidateCode ? ` (${row.existing.candidateCode})` : ''}. Import again to link this CV to{' '}
          <Link className="rf2-link" to={withReturnTo(`/candidates/${encodeURIComponent(row.existing.candidateId)}`, pageReturn)}>
            the existing person
          </Link>
          .
        </p>
      ) : null}

      {row.status === 'ready' && row.dup?.isDuplicate ? (
        <fieldset className="rf2-dup">
          <legend className="rf2-dup__legend">
            <TriangleAlert aria-hidden="true" />{' '}
            {row.dup.identityConflict
              ? 'Identity conflict: email and phone match two different people in the bank. Review carefully and pick the right person manually.'
              : 'Already in the bank. It will be linked to the existing person, not copied (a second person with the same email or phone is not allowed).'}
          </legend>
          {row.dup.matches.map((m) => (
            <label key={m.candidateId} className="rf2-dup__opt">
              <input
                type="radio"
                name={group}
                checked={row.decision?.kind === 'link' && row.decision.candidateId === m.candidateId}
                onChange={() => onDecide({ kind: 'link', candidateId: m.candidateId })}
              />
              <span>
                <Link2 aria-hidden="true" /> Link to <strong>{m.name}</strong> ({m.candidateCode}{m.status !== 'Active' ? `, ${m.status}` : ''})
                <span className="rf2-dup__why">
                  Evidence: {m.matchedBy.map((k) => `${MATCH_LABEL[k]} (${k === 'email' ? row.dup?.normalized.email : row.dup?.normalized.phone})`).join(' and ')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {row.status === 'done' && row.onJob ? (
        <p className="rf2-inline-note" data-tone="warning" role="note" data-testid="application-exists">
          <Link2 aria-hidden="true" /> Already on this job.{' '}
          {row.onJob.applicationId ? (
            <Link className="rf2-link" to={withReturnTo(`/applications/${encodeURIComponent(row.onJob.applicationId)}`, pageReturn)}>
              Open the existing file
            </Link>
          ) : (
            'Find the existing file on the board.'
          )}
        </p>
      ) : null}

      {row.status === 'done' && !row.onJob ? (
        <p className="rf2-jtable__sub">
          <CircleCheck aria-hidden="true" /> Added to Applied.
          {row.link?.filled.length ? ` Filled from the CV: ${row.link.filled.map((f) => FIELD_LABEL[f] ?? f).join(', ')}.` : ''}
        </p>
      ) : null}

      {row.status === 'done' && row.link?.conflicts.length ? (
        <div className="rf2-conflicts" role="group" aria-label={`Not overwritten for ${row.file.name}`}>
          <p className="rf2-conflicts__title">
            <TriangleAlert aria-hidden="true" /> Not overwritten — the bank keeps its value. Check these on the person:
          </p>
          <ul>
            {row.link.conflicts.map((c) => (
              <li key={c.field}>
                <strong>{FIELD_LABEL[c.field] ?? c.field}</strong>: bank “{c.existing}” · CV “{c.incoming}”
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.status === 'done' && row.link && !row.link.compared ? (
        <p className="rf2-jtable__sub">Linked. The existing record could not be compared with this CV.</p>
      ) : null}
    </li>
  );
}
