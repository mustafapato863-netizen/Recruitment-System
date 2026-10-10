/**
 * A3 (Admin seat): the single pipeline template, message templates, master data.
 * - B9 #21: GET /pipeline-templates lists only the one template; POST /pipeline-templates and POST /:id/duplicate → 409
 *   SINGLE_PIPELINE_TEMPLATE. v2 never offers New / Duplicate / Delete; it edits stage names in place
 *   (PATCH /pipeline-templates/:id/stages/:stageId {name}). Create is offered only when the list is empty.
 * - Templates: /email-templates and /whatsapp-templates (GET, POST, PATCH; no DELETE, B2). Admin seat only (route-gated).
 * - Master data: GET /master-data/catalog/:category, POST /master-data/catalog/:category/batch {rows:[{id?, name, status?}]}.
 *   Deactivate = a batch row with status 'Inactive' (never DELETE). Grade bands: B7 /master-data/grade-bands (POST/PATCH).
 */
import { getApi, patchApi, postApi } from '../../api/client';
import { domainError } from '../api/gates';

const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
const enc = encodeURIComponent;

// ── Pipeline template ──
export interface PipelineTemplate { id: string; name: string; isDefault: boolean; status: string; stageCount?: number }
export interface PipelineStage { id: string; name: string; stageType: string; sortOrder: number; status: string; entryGate?: string | null; exitGate?: string | null }
export async function fetchPipeline(): Promise<{ template: PipelineTemplate; stages: PipelineStage[] } | null> {
  const t = list(await getApi<PipelineTemplate[] | { data: PipelineTemplate[] }>('/pipeline-templates'))[0];
  if (!t) return null;
  const full = await getApi<PipelineTemplate & { stages?: PipelineStage[] }>(`/pipeline-templates/${enc(t.id)}`);
  return { template: t, stages: [...(full.stages ?? [])].filter((s) => s.status !== 'Archived').sort((a, b) => a.sortOrder - b.sortOrder) };
}
export const renameStage = (tid: string, sid: string, name: string) => patchApi(`/pipeline-templates/${enc(tid)}/stages/${enc(sid)}`, { name });
export const createPipeline = () => postApi<PipelineTemplate>('/pipeline-templates', { name: 'Default pipeline', isDefault: true });
export const isSingleTemplate = (e: unknown) => domainError(e)?.code === 'SINGLE_PIPELINE_TEMPLATE';
const EXIT_TYPES = new Set(['rejected', 'withdrawn', 'declined', 'exit']);
export const isExit = (s: PipelineStage) => EXIT_TYPES.has(s.stageType.toLowerCase()) || EXIT_TYPES.has(s.name.toLowerCase());

/** What each v2 stage does (Roadmap §7–§8), keyed by stage name; unknown names show "—". */
export const STAGE_INFO: Record<string, { drawer: string; actions: string; gate?: string }> = {
  applied: { drawer: 'Import CVs (single or bulk)', actions: 'Shortlist to Screening · Reject' },
  screening: { drawer: 'Log screening: outcome, notice period, written fit note', actions: 'Move to Interview · Reject', gate: 'Gate: screen note saved before Interview' },
  interview: { drawer: 'Schedule interview: user-picker interviewer, room link', actions: 'Scorecard by the interviewer · Move to Offer', gate: 'Gate: scorecard submitted before Offer' },
  offer: { drawer: 'Offer draft (no pay) → Manager decision → Send offer → Record answer', actions: 'Approve / Request changes (Manager) · Withdraw', gate: 'Gate: Manager approval before Send offer' },
  'pre-hire': { drawer: 'Pre-hire checklist', actions: 'Mark as joined', gate: 'Gate: ID, contract and SCFHS licence checked' },
  joined: { drawer: '—', actions: 'Counts toward the job target; closes the application' },
  rejected: { drawer: 'Reject drawer · reason required · the person stays in the Candidates bank', actions: '' },
  withdrawn: { drawer: 'Candidate pulled out or declined the offer · reason required · stays in the bank', actions: '' },
};
export const stageInfo = (s: PipelineStage) => STAGE_INFO[s.name.toLowerCase().replace(/\s+/g, '-').replace('prehire', 'pre-hire')] ?? STAGE_INFO[s.stageType.toLowerCase()] ?? null;

// ── Templates ──
export type Channel = 'email' | 'whatsapp';
export interface MessageTemplate { id: string; name: string; category: string; subject?: string; bodyTemplate: string; isDefault: boolean; status: string; interviewType?: string }
const TPL_PATH: Record<Channel, string> = { email: '/email-templates', whatsapp: '/whatsapp-templates' };
export const CATEGORIES: Record<Channel, Array<[string, string]>> = {
  email: [['stage_auto', 'Stage email (sent on a move)'], ['notification', 'Notification'], ['misc', 'Other']],
  whatsapp: [['ack', 'Acknowledgement'], ['interview_invite', 'Schedule interview drawer'], ['offer_next_step', 'Send offer drawer'], ['rejection', 'Reject drawer'], ['misc', 'Other']],
};
/** Server interpolation keys (email + WhatsApp services). Missing ones stay as {{key}}. */
export const VARIABLES = ['candidateName', 'positionTitle', 'stageName', 'organizationName'] as const;
export const SAMPLE: Record<string, string> = { candidateName: 'Ahmed Embaby', positionTitle: 'HRIS Developer', stageName: 'Interview', organizationName: 'RecruitFlow' };
export const render = (t: string) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => SAMPLE[k] ?? m);
export const unknownVars = (t: string) => [...new Set([...t.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))].filter((k) => !(VARIABLES as readonly string[]).includes(k));
export async function fetchTemplates(ch: Channel): Promise<MessageTemplate[]> {
  return list(await getApi<MessageTemplate[] | { data: MessageTemplate[] }>(TPL_PATH[ch])).filter((t) => t.status !== 'Archived' && t.status !== 'Inactive').sort((a, b) => a.name.localeCompare(b.name));
}
export type TemplateInput = Pick<MessageTemplate, 'name' | 'category' | 'bodyTemplate'> & { subject?: string };
export const saveTemplate = (ch: Channel, id: string | null, body: TemplateInput) =>
  (id ? patchApi<MessageTemplate>(`${TPL_PATH[ch]}/${enc(id)}`, body) : postApi<MessageTemplate>(TPL_PATH[ch], body));

// ── Master data ──
export interface CatalogValue { id: string; name: string; code?: string | null; status: string; version?: number; metadata?: Record<string, unknown> | null }
export interface CatalogDef { category: string; title: string; hint: string }
export const CATALOGS: CatalogDef[] = [
  { category: 'skills', title: 'Skills', hint: 'Skill library for matching and Compare' },
  { category: 'departments', title: 'Departments', hint: 'Owning department on a requisition' },
  { category: 'rejection-reasons', title: 'Rejection reasons', hint: 'Required on Reject and Withdrawn' },
  { category: 'hold-reasons', title: 'Hold reasons', hint: 'Required to put a job on hold' },
  { category: 'close-reasons', title: 'Close reasons', hint: 'Required to close a job' },
  { category: 'reassign-reasons', title: 'Reassign reasons', hint: 'Shown in the Manager’s Reassign drawer' },
];
/** null = category not on this server (404/400). */
export async function fetchCatalog(category: string): Promise<CatalogValue[] | null> {
  try { return list(await getApi<CatalogValue[] | { data: CatalogValue[] }>(`/master-data/catalog/${enc(category)}`)); }
  catch (e) { const s = (e as { statusCode?: number })?.statusCode; if (s === 404 || s === 400) return null; throw e; }
}
export const addValue = (category: string, name: string) => postApi(`/master-data/catalog/${enc(category)}/batch`, { rows: [{ name }] });
export const setValueStatus = (category: string, v: CatalogValue, status: 'Active' | 'Inactive') =>
  postApi(`/master-data/catalog/${enc(category)}/batch`, { rows: [{ id: v.id, name: v.name, status, ...(typeof v.version === 'number' ? { expectedVersion: v.version } : {}) }] });

export interface Band { id: string; grade?: { id: string; name: string } | null; site?: { id: string; name: string } | null; currency: string; status: string; minMonthlyBase?: number | null; maxMonthlyBase?: number | null }
export async function fetchBands(): Promise<Band[] | null> {
  try { return list(await getApi<Band[] | { data: Band[] }>('/master-data/grade-bands')); }
  catch (e) { if ((e as { statusCode?: number })?.statusCode === 404) return null; throw e; }
}
export interface BandInput { gradeId: string; branchId: string; currency: string; minMonthlyBase: number; maxMonthlyBase: number }
export const createBand = (b: BandInput) => postApi<Band>('/master-data/grade-bands', b);
export const updateBand = (id: string, b: Partial<BandInput> & { status?: 'Active' | 'Inactive' }) => patchApi<Band>(`/master-data/grade-bands/${enc(id)}`, b);
export const fetchOptions = async (category: 'grades' | 'branches') => ((await fetchCatalog(category)) ?? []).filter((v) => v.status === 'Active');
