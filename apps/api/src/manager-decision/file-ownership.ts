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

/** True when the actor is the line manager (users.managerId) of at least one owner and is not an owner. */
export async function isManagerOfFile(tx: Tx, owners: string[], actorUserId: string): Promise<boolean> {
  if (owners.length === 0 || owners.includes(actorUserId)) return false;
  return (await tx.user.count({ where: { id: { in: owners }, managerId: actorUserId } })) > 0;
}

export const isAdmin = (roleCodes: readonly string[]) => roleCodes.includes('ADMINISTRATOR');
