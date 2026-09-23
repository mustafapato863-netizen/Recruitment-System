import { describe, expect, it } from 'vitest';
import { getVacancyRoleAppearance } from './VacancyCard';

describe('getVacancyRoleAppearance', () => {
  it.each([
    [{ department: 'Intensive Care', title: 'Clinical Nurse' }, 'stethoscope'],
    [{ department: 'Pharmacy', title: 'Senior Pharmacist' }, 'pill'],
    [{ department: 'Laboratory', title: 'Lab Technician' }, 'microscope'],
    [{ department: 'IT', title: 'Web Developer' }, 'code'],
    [{ department: 'Marketing', title: 'Media Buyer' }, 'megaphone'],
    [{ department: 'Finance', title: 'Accountant' }, 'calculator'],
    [{ department: 'People', title: 'Talent Recruiter' }, 'users'],
    [{ department: 'Compliance', title: 'Legal Counsel' }, 'scale'],
    [{ department: 'Operations', title: 'Facilities Coordinator' }, 'building'],
    [{ department: 'Other', title: 'General Specialist' }, 'briefcase'],
  ])('chooses an icon for the role: %j', (vacancy, icon) => {
    expect(getVacancyRoleAppearance(vacancy).icon).toBe(icon);
  });

  it('allows a caller to override automatic role matching', () => {
    expect(getVacancyRoleAppearance({ department: 'IT', title: 'Developer' }, 'report').icon).toBe('report');
  });

  it('prefers the position title when its department suggests a different icon', () => {
    expect(getVacancyRoleAppearance({ department: 'IT', title: 'Senior Media Buyer' }).icon).toBe('megaphone');
  });
});
