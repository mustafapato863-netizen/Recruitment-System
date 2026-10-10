/**
 * M3 adapters: the Manager's offer decision on the same file, with the grade band (Figma M05). Backend B7 (#15, feat/b7-manager-decision @3423ec5):
 * - GET  /offers/:id                                 → Offer {grade, location, currentVersionId, versions[]}; pay fields (monthlyPackage, annualFixed,
 *                                                      components[].amount) are OMITTED without OFFER_PAY_VIEW (Managers hold it; Admin does not)
 * - GET  /master-data/grade-bands                    → [{id, grade{id,name}, site{id,name}, currency, status, minMonthlyBase?, maxMonthlyBase?}] (amounts only with OFFER_PAY_VIEW)
 * - POST /offers/:id/versions/:versionId/decision {decision: Approve|Reject|RequestChanges, reason?}
 *     Approve → version + offer Approved. RequestChanges → version Changes Requested, offer Draft. Reject → version Withdrawn, offer Draft (file stays in Offer).
 *     403 OFFER_DECISION_NOT_MANAGER (not the owner's manager, a co-owner manager, or Admin); 409 OFFER_NOT_PENDING_APPROVAL;
 *     409 GRADE_BAND_MISSING / OFFER_PAY_OUTSIDE_BAND with `band{id?, grade, site, currency, minMonthlyBase?, maxMonthlyBase?}` + `offeredMonthlyBase?`;
 *     409 OFFER_BASE_PAY_MISSING / OFFER_BASE_CURRENCY_MIXED; 400 DECISION_REASON_REQUIRED.
 * CoS (Oct 10): Approve accepts pay on the decision (Manager seat only). B2-15: B7 ManagerDecisionDto (#15 @0d6243d) takes it TOP-LEVEL:
 *   {decision, reason?, basePay?, allowances?: [{name, amount, frequency?: Monthly|Annual|Once}], currency?}. A nested `pay: {…}` is a 400
 *   VALIDATION_ERROR (whitelist), so decide() sends the flat shape.
 *   Offers gain `branchId`: the band is matched on branchId when present, else on the location name.
 * Base pay = "Salary" components only, annual amounts / 12 (allowances never count) — mirrored by monthlyBase().
 * Pay is shown only to the Manager seat holding OFFER_PAY_VIEW; everyone else gets stripPay().
 */
import { ApiError, getApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { domainError } from './gates';

const enc = encodeURIComponent;
export type Decision = 'Approve' | 'Reject' | 'RequestChanges';
export interface OfferComponent { id?: string; type: string; name: string; amount?: number | null; currency?: string | null; frequency?: string | null }
export interface DecisionVersion {
  id: string; versionNumber: number; status?: string; approvalStatus?: string; createdAt: string;
  contractType?: string | null; probationPeriod?: string | null; proposedJoiningDate?: string | null; offerExpiry?: string | null; workLocation?: string | null;
  monthlyPackage?: number | null; components?: OfferComponent[];
}
export interface DecisionOffer {
  id: string; applicationId: string; offerCode: string; candidateName?: string; positionTitle?: string; status: string;
  grade?: { id: string; name: string } | null; location?: string | null; branchId?: string | null; currentVersionId?: string | null; versions?: DecisionVersion[]; currentVersion?: DecisionVersion | null;
}
export interface GradeBand { id: string; grade: { id: string; name: string } | null; site: { id: string; name: string } | null; currency: string; status?: string; minMonthlyBase?: number; maxMonthlyBase?: number }
export interface Pay { base: { amount: number; currency: string } | null; allowances: { amount: number; currency: string } | null; mixed: boolean }

export function currentVersion(o: DecisionOffer): DecisionVersion | null {
  return o.currentVersion ?? o.versions?.find((v) => v.id === o.currentVersionId) ?? [...(o.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}
const monthly = (c: OfferComponent) => { const a = Number(c.amount ?? 0); return (c.frequency ?? 'Monthly').toLowerCase().startsWith('annual') ? a / 12 : a; };
/** B7 monthlyBase(): Salary components only, Annual / 12; allowances shown separately, never in the band. */
export function payOf(v: DecisionVersion | null): Pay {
  const comps = v?.components ?? [];
  const withAmount = comps.filter((c) => typeof c.amount === 'number');
  const salary = withAmount.filter((c) => c.type.trim().toLowerCase() === 'salary');
  const allow = withAmount.filter((c) => ['allowance', 'benefit'].includes(c.type.trim().toLowerCase()));
  const cur = (xs: OfferComponent[]) => [...new Set(xs.map((c) => (c.currency ?? 'AED').toUpperCase()))];
  const sum = (xs: OfferComponent[]) => Math.round(xs.reduce((t, c) => t + monthly(c), 0) * 100) / 100;
  const sc = cur(salary);
  return {
    base: salary.length && sc.length === 1 ? { amount: sum(salary), currency: sc[0] } : null,
    allowances: allow.length ? { amount: sum(allow), currency: cur(allow)[0] } : null,
    mixed: sc.length > 1,
  };
}

export const canSeePay = (seat: string | undefined, permissions: readonly string[] | undefined) => seat === 'manager' && (permissions ?? []).includes('OFFER_PAY_VIEW');

export async function loadDecision(offerId: string, showPay: boolean): Promise<{ offer: DecisionOffer; bands: GradeBand[] | null }> {
  const raw = await getApi<DecisionOffer>(`/offers/${enc(offerId)}`);
  const offer = showPay ? raw : stripPay(raw);
  let bands: GradeBand[] | null;
  try {
    const r = await getApi<GradeBand[] | { data: GradeBand[] }>('/master-data/grade-bands');
    const rows = Array.isArray(r) ? r : r?.data ?? [];
    bands = (showPay ? rows : stripPay(rows)).filter((b) => (b.status ?? 'Active') === 'Active');
  } catch { bands = null; }
  return { offer, bands };
}

/** The band B7 would use: same grade, site (job location) and base-pay currency. */
export function bandFor(bands: GradeBand[] | null, offer: DecisionOffer, currency: string | null): GradeBand | null {
  if (!bands || !offer.grade) return null;
  const site = (b: GradeBand) => (offer.branchId ? b.site?.id === offer.branchId : !offer.location || b.site?.name === offer.location);
  return bands.find((b) => b.grade?.id === offer.grade!.id && site(b) && (!currency || b.currency.toUpperCase() === currency.toUpperCase())) ?? null;
}
export type BandPosition = 'inside' | 'below' | 'above';
export function bandPosition(band: Pick<GradeBand, 'minMonthlyBase' | 'maxMonthlyBase'> | null, amount: number | null): BandPosition | null {
  if (!band || amount === null || typeof band.minMonthlyBase !== 'number' || typeof band.maxMonthlyBase !== 'number') return null;
  return amount < band.minMonthlyBase ? 'below' : amount > band.maxMonthlyBase ? 'above' : 'inside';
}

/** Pay the Manager sets on Approve (CoS). Monthly amounts; allowances never count toward the band. */
export interface DecisionPay { basePay: number; allowances: Array<{ name: string; amount: number; frequency?: 'Monthly' | 'Annual' | 'Once' }>; currency: string }
/** = B7 ManagerDecisionDto: pay fields are top-level siblings of `decision` (B2-15). */
export interface DecisionBody { decision: Decision; reason?: string; basePay?: number; allowances?: DecisionPay['allowances']; currency?: string }
export function decisionBody(decision: Decision, reason?: string, pay?: DecisionPay): DecisionBody {
  return {
    decision, ...(reason ? { reason } : {}),
    ...(decision === 'Approve' && pay ? { basePay: pay.basePay, currency: pay.currency, allowances: pay.allowances.map((a) => ({ name: a.name, amount: a.amount, frequency: a.frequency ?? 'Monthly' })) } : {}),
  };
}
export const decide = (offerId: string, versionId: string, decision: Decision, reason?: string, pay?: DecisionPay) =>
  postApi<{ id: string; decision: Decision; toStatus: string }>(`/offers/${enc(offerId)}/versions/${enc(versionId)}/decision`, decisionBody(decision, reason, pay));

/** B2-15: default the pay currency to the band that exists for this grade + site (not a hard-coded EGP). */
export function defaultCurrency(bands: GradeBand[] | null, offer: DecisionOffer): string | null {
  if (!bands || !offer.grade) return null;
  const site = (b: GradeBand) => (offer.branchId ? b.site?.id === offer.branchId : !offer.location || b.site?.name === offer.location);
  return bands.find((b) => b.grade?.id === offer.grade!.id && site(b))?.currency?.toUpperCase() ?? null;
}
export const CURRENCIES = ['EGP', 'AED', 'SAR'] as const;

export interface DecisionError { code?: string; field?: 'reason' | 'pay'; text: string; band?: Record<string, string | number | null>; offered?: number }
const TEXT: Record<string, { field?: 'reason' | 'pay'; text: string }> = {
  OFFER_DECISION_NOT_MANAGER: { text: 'Only the manager of this file’s owner can decide. If you co-own the file, your own manager decides it.' },
  OFFER_NOT_PENDING_APPROVAL: { text: 'This version is no longer waiting for a decision (someone already decided, or it was revised). Reload to see it.' },
  GRADE_BAND_MISSING: { text: 'No active pay band for this grade, site and currency, so it cannot be approved. Ask an admin to add the band, or request changes.' },
  OFFER_PAY_OUTSIDE_BAND: { text: 'Base pay is outside the band. Request changes, or ask for the band to be reviewed.' },
  OFFER_BASE_PAY_MISSING: { text: 'This offer has no base pay (Salary) yet, so the band cannot be checked. Request changes.' },
  OFFER_BASE_CURRENCY_MIXED: { text: 'Base pay uses more than one currency. Request changes.' },
  DECISION_REASON_REQUIRED: { field: 'reason', text: 'Write a comment to request changes or reject.' },
  DECISION_INVALID: { text: 'That decision is not allowed.' },
  // Expected with pay-on-approve (names not final; unknown codes fall back to the server message).
  OFFER_PAY_INVALID: { field: 'pay', text: 'Check the pay: base pay above 0, allowances 0 or more, one currency.' },
  CURRENCY_INVALID: { field: 'pay', text: 'Pick a supported currency.' },
};
export function decisionError(e: unknown): DecisionError {
  const d = domainError(e);
  const env = (e instanceof ApiError ? e.details : null) as { band?: Record<string, string | number | null>; offeredMonthlyBase?: number } | null;
  if (d && TEXT[d.code]) return { code: d.code, ...TEXT[d.code], ...(env?.band ? { band: env.band } : {}), ...(typeof env?.offeredMonthlyBase === 'number' ? { offered: env.offeredMonthlyBase } : {}) };
  const x = e as { statusCode?: number; message?: string; details?: unknown } | null;
  if (x?.statusCode === 403) return { code: d?.code, text: x?.message && d?.code ? x.message : 'You do not have permission to decide on this offer.' };
  // B2-15: always show the API's own message (e.g. 400 VALIDATION_ERROR), plus the fields it names.
  const fields = fieldsOf(x?.details);
  const payField = fields.some((f) => /^(basePay|currency|allowances)/.test(f));
  const text = [x?.message || 'Something went wrong. Try again.', fields.length ? `(${fields.join(', ')})` : ''].filter(Boolean).join(' ');
  return { code: d?.code, ...(payField ? { field: 'pay' as const } : {}), text };
}

function fieldsOf(details: unknown): string[] {
  const f = (details as { fields?: unknown } | null)?.fields;
  if (Array.isArray(f)) return f.map((x) => (typeof x === 'string' ? x : String((x as { field?: string; property?: string })?.field ?? (x as { property?: string })?.property ?? ''))).filter(Boolean);
  if (f && typeof f === 'object') return Object.keys(f);
  return [];
}

export const money = (n: number, currency?: string) => `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n)}${currency ? ` ${currency}` : ''}`;
