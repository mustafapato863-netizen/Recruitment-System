import type { Prisma } from '@recruitflow/database';

/** Notifications about these entities are about a file; they carry applicationId and never show pay to Employees. */
const FILE_ENTITY_TYPES = new Set(['offer', 'offerversion', 'interview', 'application', 'hiringcase', 'hiringcaseapproval']);
export const isFileNotification = (type: string, entityType?: string | null) =>
  FILE_ENTITY_TYPES.has((entityType ?? '').toLowerCase()) || /offer|interview|scorecard/i.test(type);

/** The only permission that shows offer pay (B7). On stacks without it, nobody gets pay in notification text. */
import { PAY_VIEW_PERMISSION } from '../common/access/pay-visibility';
export const OFFER_PAY_PERMISSION = PAY_VIEW_PERMISSION;

const CUR = '(?:AED|SAR|EGP|USD|EUR|GBP|QAR|KWD|OMR|BHD)';
const PAY_PATTERNS: RegExp[] = [
  new RegExp(`\\b${CUR}\\s?\\d[\\d,.]*`, 'gi'),
  new RegExp(`(?<![\\w-])\\d[\\d,.]*\\s?${CUR}\\b`, 'gi'),
  /(?<![\w\-./])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\w\-/])/g,
  /(?<![\w\-./])\d{4,}(?:\.\d+)?(?![\w\-/])/g,
];

/** Replace money-looking amounts (currency + number, 1,234 / 12000 style) with a neutral marker. */
export function stripPay(text: string): string {
  return PAY_PATTERNS.reduce((out, re) => out.replace(re, '[pay hidden]'), text);
}

type Db = Pick<Prisma.TransactionClient, 'rolePermission' | 'offer' | 'offerVersion' | 'interview' | 'hiringCase' | 'hiringCaseApproval'>;

export async function canSeeOfferPay(db: Pick<Prisma.TransactionClient, 'rolePermission'>, userId: string): Promise<boolean> {
  return (await db.rolePermission.count({
    where: { permission: { code: OFFER_PAY_PERMISSION }, role: { status: 'Active', userRoles: { some: { userId } } } },
  })) > 0;
}

/** Resolve applicationId for file notifications (batched; works for rows written by the worker too). */
export async function resolveApplicationIds(db: Db, rows: Array<{ entityType: string | null; entityId: string | null }>): Promise<Map<string, string>> {
  const by = (t: string) => [...new Set(rows.filter((r) => (r.entityType ?? '').toLowerCase() === t && r.entityId).map((r) => r.entityId!))];
  const uuid = (ids: string[]) => ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const out = new Map<string, string>();
  const [offers, versions, interviews, cases, caseApprovals] = await Promise.all([
    db.offer.findMany({ where: { id: { in: uuid(by('offer')) } }, select: { id: true, applicationId: true } }),
    db.offerVersion.findMany({ where: { id: { in: uuid(by('offerversion')) } }, select: { id: true, offer: { select: { applicationId: true } } } }),
    db.interview.findMany({ where: { id: { in: uuid(by('interview')) } }, select: { id: true, applicationId: true } }),
    db.hiringCase.findMany({ where: { id: { in: uuid(by('hiringcase')) } }, select: { id: true, applicationId: true } }),
    db.hiringCaseApproval.findMany({ where: { id: { in: uuid(by('hiringcaseapproval')) } }, select: { id: true, hiringCase: { select: { applicationId: true } } } }),
  ]);
  for (const o of offers) out.set(o.id, o.applicationId);
  for (const v of versions) out.set(v.id, v.offer.applicationId);
  for (const i of interviews) out.set(i.id, i.applicationId);
  for (const c of cases) out.set(c.id, c.applicationId);
  for (const a of caseApprovals) out.set(a.id, a.hiringCase.applicationId);
  for (const id of by('application')) out.set(id, id);
  return out;
}
