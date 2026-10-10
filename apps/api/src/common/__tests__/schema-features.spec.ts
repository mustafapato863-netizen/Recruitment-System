import { Prisma } from '@recruitflow/database';
import { describe, expect, it } from 'vitest';
import { HAS_VACANCY_OWNER } from '../schema-features';

describe('schema-features (stack-merge guard)', () => {
  it('HAS_VACANCY_OWNER mirrors whether the generated client has Vacancy.primaryRecruiterId', () => {
    expect(HAS_VACANCY_OWNER).toBe(Object.keys(Prisma.VacancyScalarFieldEnum).includes('primaryRecruiterId'));
  });
});
