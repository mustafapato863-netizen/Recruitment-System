import { describe, expect, it } from 'vitest';
import { formatPersonName, getInitials, initials, splitPersonIdentity } from '../userIdentity';

describe('shared person identity', () => {
  it('strips honorific prefixes before computing initials', () => {
    expect(formatPersonName('Dr. Hassan Ali')).toBe('Hassan Ali');
    expect(getInitials('Dr. Hassan Ali')).toBe('HA');
    expect(initials('Dr. Hassan Ali')).toBe('HA');
  });

  it('separates parenthetical job titles from the displayed name', () => {
    expect(splitPersonIdentity('Omar Hassan (Hiring Mgr)')).toEqual({
      displayName: 'Omar Hassan',
      jobTitle: 'Hiring Manager',
    });
    expect(splitPersonIdentity('Lady (Nursing Recruiter)', 'Recruiter')).toEqual({
      displayName: 'Lady',
      jobTitle: 'Nursing Recruiter',
    });
    expect(getInitials('Lady (Nursing Recruiter)')).toBe('L');
  });

  it('preserves embedded job titles but does not parse a parenthetical name as a role', () => {
    expect(splitPersonIdentity('Ahmed Mahmoud (HR Director)', 'Talent Acquisition Lead')).toEqual({
      displayName: 'Ahmed Mahmoud',
      jobTitle: 'HR Director',
    });
    expect(splitPersonIdentity('John (Jack)', 'Recruiter')).toEqual({
      displayName: 'John (Jack)',
      jobTitle: 'Recruiter',
    });
  });
});
