import { Prisma } from '@recruitflow/database';

/**
 * Stack-merge guard. B1 (#4) adds Vacancy.primaryRecruiterId; branches stacked on main without B1 don't have it.
 * Code that must write/read the B1 owner checks this flag so it compiles and runs on both, and switches on
 * automatically once B1 is merged under it. TODO(B1): inline (always true) after #4 is on every branch.
 */
export const HAS_VACANCY_OWNER: boolean = 'primaryRecruiterId' in Prisma.VacancyScalarFieldEnum;
