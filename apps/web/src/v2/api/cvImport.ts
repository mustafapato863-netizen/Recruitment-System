/**
 * E11 Import CVs: upload → parse → duplicate check → link or create → add to this job → attach CV → server fill-from-cv.
 *
 * - Parse: POST /resume/parse (multipart `file`, PDF/DOC/DOCX ≤ 10 MB) → ExtractedCandidate (contracts).
 * - Duplicate check: POST /candidates/duplicate-check {email?, phone?} (B6 PR #13) →
 *   { normalized{email,phone}, isDuplicate, matches[{candidateId,candidateCode,name,status,matchedBy[email|phone]}] }.
 *   The evidence shown is what matched (email/phone, normalized value), never a percentage.
 * - Create: POST /candidates (CreateCandidateDto subset). Link: reuse matches[i].candidateId (Roadmap §7: never duplicate).
 * - Add to job: POST /applications {vacancyId, candidateId, source}.
 * - CV file: POST /documents/upload (multipart candidateId, documentType=CV, file, extractionText) — same as v1 intake.
 * - Link fill (R03 / E3): POST /candidates/:id/fill-from-cv {documentId?, parsed?} fills only empty fields on the
 *   server inside a transaction, syncs CandidateSkill rows, and returns {filled[], conflicts[], compared: true}.
 *   Errors are surfaced explicitly so partial progress can be retried without duplicating person, file, or CV.
 * No pay fields exist on these DTOs.
 */
import type { ExtractedCandidate } from '@recruitflow/contracts';
import { postApi, postFormDataApi } from '../../api/client';
import { findExistingFile, isApplicationExists } from './applicationExists';

export type ExtractedCv = ExtractedCandidate;
export type MatchedBy = 'email' | 'phone';
export interface DuplicateMatch { candidateId: string; candidateCode: string; name: string; status: string; matchedBy: MatchedBy[] }
export interface DuplicateCheckResult {
  normalized: { email: string | null; phone: string | null };
  isDuplicate: boolean;
  identityConflict?: boolean;
  matches: DuplicateMatch[];
}

export const parseCv = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return postFormDataApi<ExtractedCv>('/resume/parse', fd);
};
export const duplicateCheck = (body: { email?: string; phone?: string }) => postApi<DuplicateCheckResult>('/candidates/duplicate-check', body);

/**
 * #23 (B2-12): POST /candidates answers 409 CANDIDATE_EXISTS when the email or phone is already in the bank
 * ({code, message, details: {candidateId, candidateCode}}). The API's error normalizer only lets allow-listed
 * `details` through, so the id may be missing: then the person is found again with the duplicate check.
 */
export interface ExistingPerson { candidateId: string; candidateCode?: string; name?: string }
export function candidateExistsDetails(e: unknown): ExistingPerson | null | undefined {
  const err = e as { code?: unknown; details?: { code?: unknown; details?: { candidateId?: unknown; candidateCode?: unknown } } } | null;
  const code = typeof err?.code === 'string' ? err.code : err?.details?.code;
  if (code !== 'CANDIDATE_EXISTS') return undefined; // not this error
  const d = err?.details?.details;
  return typeof d?.candidateId === 'string' ? { candidateId: d.candidateId, ...(typeof d.candidateCode === 'string' ? { candidateCode: d.candidateCode } : {}) } : null;
}
export async function existingPerson(e: unknown, contact: { email?: string; phone?: string }): Promise<ExistingPerson | null | undefined> {
  const hit = candidateExistsDetails(e);
  if (hit === undefined || hit) return hit;
  if (!contact.email && !contact.phone) return null;
  const dup = await duplicateCheck({ ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { phone: contact.phone } : {}) }).catch(() => null);
  const m = dup?.matches[0];
  return m ? { candidateId: m.candidateId, candidateCode: m.candidateCode, name: m.name } : null;
}

export const ACCEPTED_CV = ['.pdf', '.doc', '.docx'];
export const MAX_CV_BYTES = 10 * 1024 * 1024;
export function cvFileProblem(file: File): string | null {
  const n = file.name.toLowerCase();
  if (!ACCEPTED_CV.some((x) => n.endsWith(x))) return 'Not a PDF or Word file. ZIP is not supported; select the CVs themselves (several at once is fine).';
  if (file.size > MAX_CV_BYTES) return 'Larger than 10 MB.';
  return null;
}

export function splitName(cv: ExtractedCv, fileName: string): { firstName: string; lastName: string } {
  const first = cv.firstName?.trim();
  const last = cv.lastName?.trim();
  if (first || last) return { firstName: first || '-', lastName: last || '-' };
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b(cv|resume|\d{4})\b/gi, '').trim();
  const [f, ...rest] = base.split(/\s+/);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return { firstName: cap(f || 'Unknown'), lastName: cap(rest.join(' ') || '-') };
}

export type ImportDecision = { kind: 'link'; candidateId: string } | { kind: 'create' };
export interface PartialImportProgress {
  candidateId: string;
  applicationId?: string | null;
  documentId?: string | null;
  alreadyOnJob?: boolean;
  link?: LinkResult;
}

/** Field labels for the conflicts list (same field names as the B6 import report). */
export const FIELD_LABEL: Record<string, string> = { currentTitle: 'Current title', currentCompany: 'Current company', location: 'Location', experienceYears: 'Experience (years)', skills: 'Skills' };
export interface LinkConflict { field: string; existing: string; incoming: string }
export interface LinkResult { filled: string[]; conflicts: LinkConflict[]; compared: boolean }

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());
/** Same rule as B6 import.service: fill empty, list conflicts, never overwrite; skills are merged. */
export function diffForLink(existing: Record<string, unknown>, cv: ExtractedCv): { fill: Record<string, unknown>; filled: string[]; conflicts: LinkConflict[] } {
  const incoming: Record<string, unknown> = {
    currentTitle: cv.title?.trim().slice(0, 120) || null, currentCompany: cv.currentCompany?.trim().slice(0, 120) || null,
    location: cv.location?.trim().slice(0, 120) || null, experienceYears: typeof cv.experienceYears === 'number' ? Math.round(cv.experienceYears) : null,
  };
  const fill: Record<string, unknown> = {}; const filled: string[] = []; const conflicts: LinkConflict[] = [];
  for (const [field, value] of Object.entries(incoming)) {
    if (value === null) continue;
    const current = existing[field];
    if (isEmpty(current)) { fill[field] = value; filled.push(field); continue; }
    if (String(current).trim().toLowerCase() !== String(value).trim().toLowerCase()) conflicts.push({ field, existing: String(current), incoming: String(value) });
  }
  const have = Array.isArray(existing.skills) ? (existing.skills as string[]) : [];
  const merged = [...have];
  for (const sk of cv.skills ?? []) if (sk?.trim() && !merged.some((x) => x.toLowerCase() === sk.trim().toLowerCase())) merged.push(sk.trim());
  if (merged.length !== have.length) { fill.skills = merged; filled.push('skills'); }
  return { fill, filled, conflicts };
}

function importProgressStorageKey(vacancyId: string, file: File): string {
  return `rf2:cv-import:${vacancyId}:${file.name}:${file.size}`;
}

export function readStoredImportProgress(vacancyId: string, file: File): PartialImportProgress | undefined {
  try {
    const raw = window.sessionStorage?.getItem(importProgressStorageKey(vacancyId, file));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PartialImportProgress | null;
    return parsed?.candidateId ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredImportProgress(vacancyId: string, file: File, progress: PartialImportProgress | null): void {
  try {
    const key = importProgressStorageKey(vacancyId, file);
    if (!progress) window.sessionStorage?.removeItem(key);
    else window.sessionStorage?.setItem(key, JSON.stringify(progress));
  } catch {
    // sessionStorage unavailable in restricted contexts
  }
}

async function serverLinkFill(candidateId: string, documentId: string | null, cv: ExtractedCv): Promise<LinkResult> {
  const res = await postApi<{ filled?: string[]; conflicts?: LinkConflict[]; compared?: boolean }>(
    `/candidates/${encodeURIComponent(candidateId)}/fill-from-cv`,
    {
      ...(documentId ? { documentId } : {}),
      parsed: cv,
    },
  );
  return {
    filled: Array.isArray(res?.filled) ? res.filled : [],
    conflicts: Array.isArray(res?.conflicts) ? res.conflicts : [],
    compared: res?.compared ?? true,
  };
}

/**
 * Runs one row after the recruiter confirmed. Returns the candidate id, application id and, for a link, what was filled / not overwritten.
 * B2F-2: the application is created FIRST (POST /applications works for any bank person), because candidate reads,
 * edits and POST /documents/upload are scoped to people on the caller's jobs (404 for a bank person on none).
 * R03: CV document is uploaded before calling POST /candidates/:id/fill-from-cv so the backend enrichment service
 * can validate the stored CV and transactionally fill only empty fields without overwriting concurrent manual edits.
 */
function buildCandidateCreatePayload(cv: ExtractedCv, firstName: string, lastName: string) {
  const atsMeta: Record<string, unknown> = {
    ...(cv.clinicalDomain ? { clinicalDomain: cv.clinicalDomain } : {}),
    ...(cv.subspecialties?.length ? { subspecialties: cv.subspecialties } : {}),
    ...(cv.keyHighlights?.length ? { keyHighlights: cv.keyHighlights } : {}),
    ...(cv.education ? { education: cv.education } : {}),
    ...(cv.parsingQuality ? { parsingQuality: cv.parsingQuality } : {}),
    ...(cv.parserSource ? { parserSource: cv.parserSource } : {}),
  };
  return {
    firstName,
    lastName,
    ...(cv.email ? { email: cv.email } : {}),
    ...(cv.phone ? { phone: cv.phone } : {}),
    ...(cv.title ? { currentTitle: cv.title.slice(0, 120) } : {}),
    ...(cv.currentCompany ? { currentCompany: cv.currentCompany.slice(0, 120) } : {}),
    ...(cv.location ? { location: cv.location.slice(0, 120) } : {}),
    ...(typeof cv.experienceYears === 'number' ? { experienceYears: Math.round(cv.experienceYears) } : {}),
    ...(cv.skills?.length ? { skills: cv.skills } : {}),
    ...(cv.summary?.trim() ? { summary: cv.summary.trim().slice(0, 5000) } : {}),
    ...(cv.certifications?.length ? { certifications: cv.certifications } : {}),
    ...(cv.languages?.length ? { languages: cv.languages } : {}),
    ...(Object.keys(atsMeta).length > 0 ? { metadata: { ...atsMeta, cvExtractionStatus: 'Completed' } } : {}),
    source: 'CV import',
  };
}

export async function importRow(
  vacancyId: string,
  file: File,
  cv: ExtractedCv,
  decision: ImportDecision,
  resume?: PartialImportProgress,
): Promise<{ candidateId: string; applicationId: string | null; documentId?: string | null; link?: LinkResult; alreadyOnJob?: boolean }> {
  const stored = resume ?? readStoredImportProgress(vacancyId, file);
  let candidateId: string;
  if (stored?.candidateId) candidateId = stored.candidateId;
  else if (decision.kind === 'link') candidateId = decision.candidateId;
  else {
    const { firstName, lastName } = splitName(cv, file.name);
    const created = await postApi<{ id: string }>('/candidates', buildCandidateCreatePayload(cv, firstName, lastName));
    candidateId = created.id;
    writeStoredImportProgress(vacancyId, file, { candidateId });
  }
  let applicationId: string | null = stored?.applicationId ?? null;
  let documentId: string | null = stored?.documentId ?? null;
  let alreadyOnJob = Boolean(stored?.alreadyOnJob);
  let link: LinkResult | undefined = stored?.link;
  try {
    // 1) the file on this job (or the existing one: 409 APPLICATION_EXISTS links to it). A resumed application is reused.
    if (!applicationId) {
      try {
        const app = await postApi<{ id?: string }>('/applications', { vacancyId, candidateId, source: 'CV import' });
        applicationId = app?.id ?? null;
      } catch (e) {
        if (!isApplicationExists(e)) throw e;
        alreadyOnJob = true;
        applicationId = await findExistingFile(vacancyId, candidateId);
      }
      writeStoredImportProgress(vacancyId, file, { candidateId, applicationId, alreadyOnJob });
    }
    // 2) attach the CV document if not already uploaded in a previous partial attempt.
    if (!documentId) {
      const doc = new FormData();
      doc.append('candidateId', candidateId);
      doc.append('documentType', 'CV');
      doc.append('file', file);
      if (cv.rawText?.trim()) doc.append('extractionText', cv.rawText.trim().slice(0, 50000));
      const uploaded = await postFormDataApi<{ id?: string } | null>('/documents/upload', doc);
      documentId = uploaded?.id ?? 'uploaded';
      writeStoredImportProgress(vacancyId, file, { candidateId, applicationId, documentId, alreadyOnJob });
    }
    // 3) for link decisions, run the server fill-from-cv endpoint (never swallows errors).
    if (decision.kind === 'link' && !link) {
      link = await serverLinkFill(candidateId, documentId === 'uploaded' ? null : documentId, cv);
    }
    writeStoredImportProgress(vacancyId, file, null);
  } catch (err) {
    const partialState: PartialImportProgress = { candidateId, applicationId, documentId, alreadyOnJob, link };
    writeStoredImportProgress(vacancyId, file, partialState);
    (err as { partialImport?: PartialImportProgress }).partialImport = partialState;
    throw err;
  }
  return {
    candidateId,
    applicationId,
    ...(documentId && documentId !== 'uploaded' ? { documentId } : {}),
    ...(link ? { link } : {}),
    ...(alreadyOnJob ? { alreadyOnJob } : {}),
  };
}

export interface BankCvImportResult {
  candidateId: string;
  applicationId: string | null;
  documentId: string | null;
  linked: boolean;
  fileName: string;
  cv: ExtractedCv;
  duplicateCheck: DuplicateCheckResult | null;
  linkResult: LinkResult | null;
}

/**
 * Direct CV Bank uploader: validates the file, parses via POST /resume/parse, checks duplicates,
 * creates or links the person in the bank, optionally attaches to a job (opts.vacancyId),
 * uploads the binary CV via POST /documents/upload, and runs serverLinkFill when linked.
 */
export async function importBankCv(
  file: File,
  opts?: { vacancyId?: string; candidateId?: string },
): Promise<BankCvImportResult> {
  const problem = cvFileProblem(file);
  if (problem) throw new Error(problem);

  const cv = await parseCv(file);
  let candidateId = opts?.candidateId?.trim() || '';
  let linked = Boolean(candidateId);
  let dupResult: DuplicateCheckResult | null = null;
  let linkResult: LinkResult | null = null;

  if (!candidateId && (cv.email || cv.phone)) {
    dupResult = await duplicateCheck({
      ...(cv.email ? { email: cv.email } : {}),
      ...(cv.phone ? { phone: cv.phone } : {}),
    });
    const matchId = dupResult?.matches?.[0]?.candidateId;
    if (matchId) {
      candidateId = matchId;
      linked = true;
    }
  }

  if (!candidateId) {
    const { firstName, lastName } = splitName(cv, file.name);
    try {
      const created = await postApi<{ id: string }>('/candidates', buildCandidateCreatePayload(cv, firstName, lastName));
      candidateId = created.id;
    } catch (e) {
      const hit = await existingPerson(e, { email: cv.email, phone: cv.phone });
      if (!hit?.candidateId) throw e;
      candidateId = hit.candidateId;
      linked = true;
      if (!dupResult?.isDuplicate) {
        dupResult = {
          normalized: { email: cv.email ?? null, phone: cv.phone ?? null },
          isDuplicate: true,
          matches: [{
            candidateId: hit.candidateId,
            candidateCode: hit.candidateCode ?? '',
            name: hit.name ?? hit.candidateCode ?? 'Existing candidate',
            status: 'Active',
            matchedBy: [
              ...(cv.email ? (['email'] as const) : []),
              ...(cv.phone ? (['phone'] as const) : []),
            ],
          }],
        };
      }
    }
  }

  let applicationId: string | null = null;
  const vacancyId = opts?.vacancyId?.trim() || '';
  if (vacancyId) {
    try {
      const app = await postApi<{ id?: string }>('/applications', {
        vacancyId,
        candidateId,
        source: 'CV import',
      });
      applicationId = app?.id ?? null;
    } catch (e) {
      if (!isApplicationExists(e)) throw e;
      applicationId = await findExistingFile(vacancyId, candidateId);
    }
  }

  const doc = new FormData();
  doc.append('candidateId', candidateId);
  doc.append('documentType', 'CV');
  doc.append('file', file);
  if (cv.rawText?.trim()) doc.append('extractionText', cv.rawText.trim().slice(0, 50000));
  const uploaded = await postFormDataApi<{ id?: string } | null>('/documents/upload', doc);
  const documentId = uploaded?.id ?? null;

  if (linked) {
    linkResult = await serverLinkFill(candidateId, documentId, cv);
  }

  return {
    candidateId,
    applicationId,
    documentId,
    linked,
    fileName: file.name,
    cv,
    duplicateCheck: dupResult,
    linkResult,
  };
}

export interface ValidatedCvIntakeInput {
  file: File | null;
  cv: ExtractedCv;
  decision: ImportDecision;
  vacancyId?: string | null;
  source?: string;
  duplicateCheck?: DuplicateCheckResult | null;
}

export interface ValidatedCvIntakeResult extends BankCvImportResult {
  candidateCode: string | null;
  alreadyOnJob: boolean;
}

/**
 * Commits a recruiter-validated CV intake after the 4-stage engine:
 * Upload -> Detect & Validate/Edit -> Duplicate Resolution & Open-Job Fit -> Confirm.
 */
export async function saveValidatedCvIntake(input: ValidatedCvIntakeInput): Promise<ValidatedCvIntakeResult> {
  const { file, cv, decision } = input;
  const source = (input.source?.trim() || 'CV Intake Upload').slice(0, 80);
  const fileName = file?.name || 'manual-intake.pdf';

  let candidateId = decision.kind === 'link' ? decision.candidateId : '';
  let candidateCode: string | null = null;
  let linked = decision.kind === 'link';
  let dupResult: DuplicateCheckResult | null = input.duplicateCheck ?? null;
  let linkResult: LinkResult | null = null;

  if (linked && dupResult?.matches?.length) {
    const match = dupResult.matches.find((m) => m.candidateId === candidateId) ?? dupResult.matches[0];
    candidateCode = match?.candidateCode ?? null;
  }

  if (!candidateId) {
    const { firstName, lastName } = splitName(cv, fileName);
    const payload = {
      ...buildCandidateCreatePayload(cv, firstName, lastName),
      source,
    };
    try {
      const created = await postApi<{ id: string; candidateCode?: string }>('/candidates', payload);
      candidateId = created.id;
      candidateCode = created.candidateCode ?? null;
    } catch (e) {
      const hit = await existingPerson(e, { email: cv.email, phone: cv.phone });
      if (!hit?.candidateId) throw e;
      candidateId = hit.candidateId;
      candidateCode = hit.candidateCode ?? null;
      linked = true;
      if (!dupResult?.isDuplicate) {
        dupResult = {
          normalized: { email: cv.email ?? null, phone: cv.phone ?? null },
          isDuplicate: true,
          matches: [{
            candidateId: hit.candidateId,
            candidateCode: hit.candidateCode ?? '',
            name: hit.name ?? hit.candidateCode ?? 'Existing candidate',
            status: 'Active',
            matchedBy: [
              ...(cv.email ? (['email'] as const) : []),
              ...(cv.phone ? (['phone'] as const) : []),
            ],
          }],
        };
      }
    }
  }

  let applicationId: string | null = null;
  let alreadyOnJob = false;
  const vacancyId = input.vacancyId && input.vacancyId !== 'pool' ? input.vacancyId.trim() : '';
  if (vacancyId) {
    try {
      const app = await postApi<{ id?: string }>('/applications', {
        vacancyId,
        candidateId,
        source,
      });
      applicationId = app?.id ?? null;
    } catch (e) {
      if (!isApplicationExists(e)) throw e;
      alreadyOnJob = true;
      applicationId = await findExistingFile(vacancyId, candidateId);
    }
  }

  let documentId: string | null = null;
  if (file) {
    const doc = new FormData();
    doc.append('candidateId', candidateId);
    doc.append('documentType', 'CV');
    doc.append('file', file);
    if (cv.rawText?.trim()) doc.append('extractionText', cv.rawText.trim().slice(0, 50000));
    const uploaded = await postFormDataApi<{ id?: string } | null>('/documents/upload', doc);
    documentId = uploaded?.id ?? null;
  }

  if (linked) {
    linkResult = await serverLinkFill(candidateId, documentId, cv);
  }

  return {
    candidateId,
    candidateCode,
    applicationId,
    alreadyOnJob,
    documentId,
    linked,
    fileName,
    cv,
    duplicateCheck: dupResult,
    linkResult,
  };
}
