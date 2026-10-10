/**
 * E11 Import CVs: upload → parse → duplicate check → link or create → add to this job.
 *
 * - Parse: POST /resume/parse (multipart `file`, PDF/DOC/DOCX ≤ 10 MB) → ExtractedCandidate (contracts).
 * - Duplicate check: POST /candidates/duplicate-check {email?, phone?} (B6 PR #13) →
 *   { normalized{email,phone}, isDuplicate, matches[{candidateId,candidateCode,name,status,matchedBy[email|phone]}] }.
 *   The evidence shown is what matched (email/phone, normalized value), never a percentage.
 * - Create: POST /candidates (CreateCandidateDto subset). Link: reuse matches[i].candidateId (Roadmap §7: never duplicate).
 * - CV file: POST /documents/upload (multipart candidateId, documentType=CV, file, extractionText) — same as v1 intake.
 * - Link fill (B6 #13 @7c836ec rule, mirrored): empty fields on the existing person are filled from the CV, a
 *   different non-empty value is a conflict and is NEVER overwritten; skills are merged. B6 applies this rule in
 *   the bulk import confirm (`duplicateReport[].filled/conflicts`); the per-CV path has no link endpoint, so the
 *   client reads GET /candidates/:id and PATCHes only the empty fields (flagged as a Backend gap).
 * - Add to job: POST /applications {vacancyId, candidateId, source}.
 * No pay fields exist on these DTOs.
 */
import { getApi, patchApi, postApi, postFormDataApi } from '../../api/client';
import { stripPay } from './paySafety';
import { findExistingFile, isApplicationExists } from './applicationExists';

export interface ExtractedCv {
  firstName?: string; lastName?: string; email?: string; phone?: string; title?: string; currentCompany?: string;
  rawText?: string; skills?: string[]; experienceYears?: number; location?: string; parsingQuality?: 'high' | 'medium' | 'low';
}
export type MatchedBy = 'email' | 'phone';
export interface DuplicateMatch { candidateId: string; candidateCode: string; name: string; status: string; matchedBy: MatchedBy[] }
export interface DuplicateCheckResult { normalized: { email: string | null; phone: string | null }; isDuplicate: boolean; matches: DuplicateMatch[] }

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

async function linkFill(candidateId: string, cv: ExtractedCv): Promise<LinkResult> {
  let existing: Record<string, unknown>;
  try { existing = stripPay(await getApi<Record<string, unknown>>(`/candidates/${encodeURIComponent(candidateId)}`)); } catch { return { filled: [], conflicts: [], compared: false }; }
  const { fill, filled, conflicts } = diffForLink(existing, cv);
  if (filled.length) {
    try { await patchApi(`/candidates/${encodeURIComponent(candidateId)}`, fill); } catch { return { filled: [], conflicts, compared: true }; }
  }
  return { filled, conflicts, compared: true };
}

/** Runs one row after the recruiter confirmed. Returns the candidate id, application id and, for a link, what was filled / not overwritten. */
export async function importRow(vacancyId: string, file: File, cv: ExtractedCv, decision: ImportDecision): Promise<{ candidateId: string; applicationId: string | null; link?: LinkResult; alreadyOnJob?: boolean }> {
  let candidateId: string;
  let link: LinkResult | undefined;
  if (decision.kind === 'link') { candidateId = decision.candidateId; link = await linkFill(candidateId, cv); }
  else {
    const { firstName, lastName } = splitName(cv, file.name);
    const created = await postApi<{ id: string }>('/candidates', {
      firstName, lastName,
      ...(cv.email ? { email: cv.email } : {}), ...(cv.phone ? { phone: cv.phone } : {}),
      ...(cv.title ? { currentTitle: cv.title.slice(0, 120) } : {}), ...(cv.currentCompany ? { currentCompany: cv.currentCompany.slice(0, 120) } : {}),
      ...(cv.location ? { location: cv.location.slice(0, 120) } : {}),
      ...(typeof cv.experienceYears === 'number' ? { experienceYears: Math.round(cv.experienceYears) } : {}),
      ...(cv.skills?.length ? { skills: cv.skills } : {}),
      source: 'CV import',
    });
    candidateId = created.id;
  }
  const doc = new FormData();
  doc.append('candidateId', candidateId);
  doc.append('documentType', 'CV');
  doc.append('file', file);
  if (cv.rawText?.trim()) doc.append('extractionText', cv.rawText.trim().slice(0, 50000));
  await postFormDataApi('/documents/upload', doc);
  try {
    const app = await postApi<{ id?: string }>('/applications', { vacancyId, candidateId, source: 'CV import' });
    return { candidateId, applicationId: app?.id ?? null, ...(link ? { link } : {}) };
  } catch (e) {
    // #23 409 APPLICATION_EXISTS: already on this job; link to that file instead of failing.
    if (!isApplicationExists(e)) throw e;
    return { candidateId, applicationId: await findExistingFile(vacancyId, candidateId), alreadyOnJob: true, ...(link ? { link } : {}) };
  }
}
