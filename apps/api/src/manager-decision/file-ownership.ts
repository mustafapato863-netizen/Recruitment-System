import type { Prisma } from '@recruitflow/database';

type Tx = Pick<Prisma.TransactionClient, 'vacancyAssignment' | 'user'>;

/**
 * Owners of an application file on this base: primaryRecruiterId, taskOwnerId and the
 * job's active PRIMARY assignee (same signals as B5's reopen rule).
 * TODO(B1): once #4 merges, use file-access.ts (Vacancy.primaryRecruiterId + direct reports).
 */
export async function fileOwnerIds(tx: Tx, app: { vacancyId: string; primaryRecruiterId?: string | null; taskOwnerId?: string | null }): Promise<string[]> {
  const primary = await tx.vacancyAssignment.findMany({ where: { vacancyId: app.vacancyId, isActive: true, assignmentKind: 'PRIMARY' }, select: { userId: true } });
  return [...new Set([app.primaryRecruiterId, app.taskOwnerId, ...primary.map((p) => p.userId)].filter((x): x is string => Boolean(x)))];
}

/**
 * Who may decide for these subjects (owners): each subject's line manager (users.managerId).
 * Escalation (Mustafa): a manager who is ALSO an owner of the file is skipped, and so is an
 * inactive manager; the decision goes up to that manager's own manager, and so on.
 */
export async function escalatedManagers(tx: Tx, subjects: string[], owners: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (const subject of subjects) {
    let current = subject;
    const seen = new Set([subject]);
    for (let hop = 0; hop < 10; hop += 1) {
      const row = await tx.user.findUnique({ where: { id: current }, select: { managerId: true } });
      const managerId = row?.managerId;
      if (!managerId || seen.has(managerId)) break;
      seen.add(managerId);
      const manager = await tx.user.findUnique({ where: { id: managerId }, select: { status: true } });
      if (!owners.includes(managerId) && manager?.status === 'Active') { out.add(managerId); break; }
      current = managerId;
    }
  }
  return out;
}

/** True when the actor decides for the file: an (escalated) manager of an owner, never an owner. */
export async function isManagerOfFile(tx: Tx, owners: string[], actorUserId: string): Promise<boolean> {
  if (owners.length === 0 || owners.includes(actorUserId)) return false;
  return (await escalatedManagers(tx, owners, owners)).has(actorUserId);
}

export const isAdmin = (roleCodes: readonly string[]) => roleCodes.includes('ADMINISTRATOR');
