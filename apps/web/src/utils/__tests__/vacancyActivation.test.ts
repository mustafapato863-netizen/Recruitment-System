import { describe, expect, it } from 'vitest';
import { getBlockingReasons, isReadyToActivate, type VacancyForActivationCheck } from '../vacancyActivation';

describe('vacancyActivation utility', () => {
  const completeVacancy: VacancyForActivationCheck = {
    id: 'vac-1',
    title: 'Senior ICU Nurse',
    jobSummary: 'Lead ICU operations and clinical care.',
    department: 'Critical Care',
    location: 'Riyadh Hospital',
    branchId: 'branch-1',
    approvedHeadcount: 2,
    requiredSkills: ['ICU', 'Ventilator Management'],
    primaryRecruiterId: 'rec-1',
    recruiter: { name: 'Sarah Ahmed' },
  };

  it('returns empty blocking reasons and ready for a complete vacancy', () => {
    const reasons = getBlockingReasons(completeVacancy);
    expect(reasons).toHaveLength(0);
    expect(isReadyToActivate(completeVacancy)).toBe(true);
  });

  it('detects all 6 blocking reasons when all required fields are missing', () => {
    const emptyVacancy: VacancyForActivationCheck = {
      id: 'vac-empty',
      title: 'Empty Vacancy',
      jobSummary: '',
      department: '',
      location: '',
      branchId: null,
      approvedHeadcount: 0,
      requiredSkills: [],
      primaryRecruiterId: null,
      recruiter: { name: 'Unassigned' },
    };

    const reasons = getBlockingReasons(emptyVacancy);
    expect(reasons).toHaveLength(6);
    expect(isReadyToActivate(emptyVacancy)).toBe(false);

    const keys = reasons.map((r) => r.key);
    expect(keys).toContain('jobSummary');
    expect(keys).toContain('recruiter');
    expect(keys).toContain('department');
    expect(keys).toContain('location');
    expect(keys).toContain('headcount');
    expect(keys).toContain('skills');

    const recruiterReason = reasons.find((r) => r.key === 'recruiter');
    expect(recruiterReason?.isRecruiterAction).toBe(true);
    expect(recruiterReason?.action).toBe('assignRecruiter');
  });

  it('falls back to position.requiredSkills when vacancy.requiredSkills is empty', () => {
    const vacWithPositionSkills: VacancyForActivationCheck = {
      ...completeVacancy,
      requiredSkills: [],
      position: {
        id: 'pos-1',
        title: 'Senior ICU Nurse',
        requiredSkills: ['EHR', 'ACLS'],
      },
    };

    const reasons = getBlockingReasons(vacWithPositionSkills);
    expect(reasons.some((r) => r.key === 'skills')).toBe(false);
    expect(isReadyToActivate(vacWithPositionSkills)).toBe(true);
  });

  it('falls back to position.skills when position.requiredSkills is also missing', () => {
    const vacWithPositionSkillsArray: VacancyForActivationCheck = {
      ...completeVacancy,
      requiredSkills: [],
      position: {
        id: 'pos-1',
        title: 'Senior ICU Nurse',
        skills: ['Basic Life Support'],
      },
    };

    const reasons = getBlockingReasons(vacWithPositionSkillsArray);
    expect(reasons.some((r) => r.key === 'skills')).toBe(false);
    expect(isReadyToActivate(vacWithPositionSkillsArray)).toBe(true);
  });

  it('identifies primary recruiter from active assignments array', () => {
    const vacWithAssignments: VacancyForActivationCheck = {
      ...completeVacancy,
      primaryRecruiterId: null,
      recruiter: { name: 'Unassigned' },
      assignments: [
        {
          roleCode: 'RECRUITER',
          assignmentKind: 'PRIMARY',
          isActive: true,
        },
      ],
    };

    const reasons = getBlockingReasons(vacWithAssignments);
    expect(reasons.some((r) => r.key === 'recruiter')).toBe(false);
  });
});
