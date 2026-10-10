/**
 * E11 Import CVs: upload → parse → duplicate check → link or create → add to this job.
 *
 * - Parse: POST /resume/parse (multipart `file`, PDF/DOC/DOCX ≤ 10 MB) → ExtractedCandidate (contracts).
 * - Duplicate check: POST /candidates/duplicate-check {email?, phone?} (B6 PR #13) →
 *   { normalized{email,phone}, isDuplicate, matches[{candidateId,candidateCode,name,status,matchedBy[email|phone]}] }.
 *   The evidence shown is what matched (email/phone, normalized value), never a percentage.
 * - Create: POST /candidates (CreateCandidateDto subset). Link: reuse matches[i].candidateId (Roadmap §7: never duplicate).
 * - CV file: POST /documents/upload (multipart candidateId, documentType=CV, file, extractionText) — same as v1 intake.
 * - Add to job: POST /applications {vacancyId, candidateId, source}.
 * No pay fields exist on these DTOs.
 */
import { postApi, postFormDataApi } from '../../api/client';

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

/** Runs one row after the recruiter confirmed. Returns the candidate id and application id. */
export async function importRow(vacancyId: string, file: File, cv: ExtractedCv, decision: ImportDecision): Promise<{ candidateId: string; applicationId: string | null }> {
  let candidateId: string;
  if (decision.kind === 'link') candidateId = decision.candidateId;
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
  const app = await postApi<{ id?: string }>('/applications', { vacancyId, candidateId, source: 'CV import' });
  return { candidateId, applicationId: app?.id ?? null };
}
