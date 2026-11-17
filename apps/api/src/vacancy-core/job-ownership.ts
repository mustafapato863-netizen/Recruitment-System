import type { Prisma } from '@recruitflow/database';

/**
 * A job is owned by this user when they are the vacancy's primary recruiter
 * or they hold an active PRIMARY assignment. My Work and Open jobs (?mine=true)
 * both use this predicate.
 */
export function ownedVacancyWhere(userId: string): Prisma.VacancyWhereInput {
  return {
    OR: [
      { primaryRecruiterId: userId },
      {
        assignments: {
          some: { userId, isActive: true, assignmentKind: 'PRIMARY' },
        },
      },
    ],
  };
}
