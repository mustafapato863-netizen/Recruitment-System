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
  const library = await tx.masterDataValue.findMany({ where: { organizationId, category: 'skills', status: 'Active' }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } });
  const ids = new Map<string, string>();
  for (const v of library) {
    const k = catalogKey(v.name);
    if (keys.has(k) && !ids.has(k)) ids.set(k, v.id);
  }
  if (ids.size === 0) return 0;
  const res = await tx.candidateSkill.createMany({ data: [...ids.values()].map((skillId) => ({ organizationId, candidateId, skillId })), skipDuplicates: true });
  return res.count;
}

/** Evidence that still proves a skill after the recruiter removes it from the profile list. */
export const DURABLE_EVIDENCE = new Set(['CV_TEXT', 'SCORECARD', 'SCREENING_NOTE']);

/**
 * A link still counts when CV, scorecard, or screening evidence proves it,
 * when the caller did not supply a profile list, or when the name is still on that list.
 */
export function isSkillLinkActive(
  profileSkills: readonly string[] | undefined,
  skillName: string,
  evidence: ReadonlyArray<{ sourceType: string }>,
): boolean {
  if (evidence.some((item) => DURABLE_EVIDENCE.has(item.sourceType))) return true;
  if (!Array.isArray(profileSkills)) return true;
  return profileSkills.some((s) => catalogKey(s) === catalogKey(skillName));
}

/**
 * Align CandidateSkill rows with a recruiter profile update.
 * Links active library skills that were added. Rows that left `skills` without
 * CV, scorecard, or screening evidence are reported and left in place so audit
 * history stays. Readers hide those links.
 */
export async function syncCandidateSkills(
  tx: Pick<Prisma.TransactionClient, 'masterDataValue' | 'candidateSkill'>,
  organizationId: string,
  candidateId: string,
  skills: readonly string[],
): Promise<{ linked: number; removed: number; unlinkedIds: string[] }> {
  const linked = await linkCandidateSkills(tx, organizationId, candidateId, skills);
  const unlinkedIds: string[] = [];
  if (typeof tx.candidateSkill.findMany === 'function') {
    const rows = await tx.candidateSkill.findMany({
      where: { organizationId, candidateId },
      select: {
        id: true,
        skill: { select: { name: true } },
        evidence: { select: { sourceType: true } },
      },
    });
    for (const row of rows) {
      if (!isSkillLinkActive(skills, row.skill.name, row.evidence)) unlinkedIds.push(row.id);
    }
  }
  return { linked, removed: unlinkedIds.length, unlinkedIds };
}
