import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';

/**
 * C3: ONE master-data base for every reason list (hold, close, rejection, reassign).
 * Same rules for all: stored in master_data_values under the category, seeded per org,
 * deactivate-only (history rows quote them): PATCH /master-data/catalog/:category/:id {status:'Inactive'}
 * (DELETE also deactivates). Lists with an "Other" value require a note when it is picked.
 * Seeds live in database/prisma/seed.cjs (seedReasonLists) and the 20261010_b3d_reason_lists migration.
 */
export const REASON_CATEGORIES = ['hold-reasons', 'close-reasons', 'rejection-reasons', 'reassign-reasons'] as const;
export type ReasonCategory = (typeof REASON_CATEGORIES)[number];
export const OTHER_REASON = 'Other';
const LABEL: Record<ReasonCategory, string> = { 'hold-reasons': 'hold', 'close-reasons': 'close', 'rejection-reasons': 'rejection', 'reassign-reasons': 'reassign' };

export function isReasonCategory(category: string): category is ReasonCategory {
  return (REASON_CATEGORIES as readonly string[]).includes(category);
}

/** The ACTIVE value of the list matching `text` by name or code (case-insensitive), or null. */
export async function findActiveReason(db: Pick<Prisma.TransactionClient, 'masterDataValue'>, organizationId: string, category: ReasonCategory, text: string) {
  const t = text.trim();
  if (!t) return null;
  return db.masterDataValue.findFirst({
    where: { organizationId, category, status: 'Active', OR: [{ name: { equals: t, mode: 'insensitive' } }, { code: { equals: t, mode: 'insensitive' } }] },
    select: { name: true },
  });
}

/** Resolves a reason against its list: 400 REASON_NOT_IN_LIST, "Other" needs a note (stored "Other: <note>"). */
export async function resolveListReason(
  db: Pick<Prisma.TransactionClient, 'masterDataValue'>,
  organizationId: string,
  category: ReasonCategory,
  reason: string,
  note?: string | null,
): Promise<string> {
  const text = reason.trim();
  const value = await findActiveReason(db, organizationId, category, text);
  if (!value) {
    throw new BadRequestException({ code: 'REASON_NOT_IN_LIST', message: `"${text}" is not an active ${LABEL[category]} reason. Pick one from the list, or "Other" with a note.` });
  }
  if (value.name.toLowerCase() === OTHER_REASON.toLowerCase()) {
    const free = note?.trim() ?? '';
    if (free.length < 3) throw new BadRequestException({ code: 'REASON_REQUIRED', message: '"Other" needs a short note.' });
    return `${OTHER_REASON}: ${free}`;
  }
  return note?.trim() ? `${value.name}: ${note.trim()}` : value.name;
}
