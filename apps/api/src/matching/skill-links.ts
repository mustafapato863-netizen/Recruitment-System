import type { Prisma } from '@recruitflow/database';
import { catalogKey } from '../master-data/catalog-normalization';

/**
 * B6: link a candidate's free-text skills to library entries (case/whitespace-
 * insensitive). Adds links only; never removes links or evidence, never creates
 * library entries. Unmatched text stays in candidates.skills.
 */
export async function linkCandidateSkills(
  tx: Pick<Prisma.TransactionClient, 'masterDataValue' | 'candidateSkill'>,
  organizationId: string,
  candidateId: string,
  skills: readonly string[],
): Promise<number> {
  const keys = new Set(skills.map(catalogKey).filter(Boolean));
  if (keys.size === 0) return 0;
  const library = await tx.masterDataValue.findMany({ where: { organizationId, category: 'skills' }, select: { id: true, name: true, status: true }, orderBy: { createdAt: 'asc' } });
  const ids = new Map<string, string>();
  for (const v of [...library.filter((x) => x.status === 'Active'), ...library.filter((x) => x.status !== 'Active')]) {
    const k = catalogKey(v.name);
    if (keys.has(k) && !ids.has(k)) ids.set(k, v.id);
  }
  if (ids.size === 0) return 0;
  const res = await tx.candidateSkill.createMany({ data: [...ids.values()].map((skillId) => ({ organizationId, candidateId, skillId })), skipDuplicates: true });
  return res.count;
}
