import { errorCodes } from '@recruitflow/contracts';
import { describe, expect, it } from 'vitest';
import { planFillFromCv } from '../fill-from-cv';

describe('E3 fill-from-cv plan', () => {
  it('fills only empty fields, never overwrites, lists conflicts', () => {
    const plan = planFillFromCv(
      { firstName: 'Lina', lastName: 'Haddad', email: 'Lina@X.com', phone: null, currentTitle: '', location: 'Riyadh', certifications: [], languages: ['Arabic'], skills: ['ICU'] },
      { firstName: 'Lina', lastName: 'Hadad', email: 'lina@x.com ', phone: '0501112233', title: 'ICU Nurse', location: 'Jeddah', certifications: ['BLS', 'BLS'], languages: ['English'], skills: ['icu', 'Triage'], experienceYears: 6.4 },
    );
    expect(plan.filled.sort()).toEqual(['certifications', 'currentTitle', 'experienceYears', 'phone', 'skills']);
    expect(plan.data).toMatchObject({ currentTitle: 'ICU Nurse', phone: '0501112233', experienceYears: 6, certifications: ['BLS'], skills: ['ICU', 'Triage'] });
    expect(plan.data.phoneNormalized).toBeTruthy();
    expect(plan.data).not.toHaveProperty('firstName');
    expect(plan.data).not.toHaveProperty('email');
    expect(plan.conflicts.map((c) => c.field).sort()).toEqual(['languages', 'lastName', 'location']);
  });
  it('nothing parsed → nothing filled', () => {
    expect(planFillFromCv({ firstName: 'A', skills: [] }, {})).toEqual({ data: {}, filled: [], conflicts: [] });
  });
  it('shared code list has APPLICATION_EXISTS, COMPARE_COUNT, COMPARE_CANDIDATE_NOT_FOUND', () => {
    for (const c of ['APPLICATION_EXISTS', 'COMPARE_COUNT', 'COMPARE_CANDIDATE_NOT_FOUND']) expect(errorCodes as readonly string[]).toContain(c);
  });
});
