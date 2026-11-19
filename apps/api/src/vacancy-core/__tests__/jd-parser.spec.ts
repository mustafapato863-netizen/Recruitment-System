import { describe, expect, it } from 'vitest';
import { JdParserService } from '../jd-parser.service';

describe('JdParserService', () => {
  const parser = new JdParserService();

  it('extracts experience years from various common phrasing patterns', () => {
    const text1 = 'We are seeking a Senior Nurse with at least 5 years of experience in ICU.';
    expect(parser.parseJdText(text1).minExperienceYears).toBe(5);

    const text2 = 'Qualifications: 7+ years relevant experience in full-stack software development.';
    expect(parser.parseJdText(text2).minExperienceYears).toBe(7);

    const text3 = 'Role details:\nExperience: 4 years\nLocation: Riyadh';
    expect(parser.parseJdText(text3).minExperienceYears).toBe(4);

    const text4 = 'Fresh graduate entry-level position with no experience required.';
    expect(parser.parseJdText(text4).minExperienceYears).toBe(0); // Explicit entry-level role
  });

  it('leaves unspecified experience unknown instead of inventing a hiring gate', () => {
    const result = parser.parseJdText('Registered Nurse: BLS and patient care; training available.');
    expect(result.minExperienceYears).toBeNull();
    expect(result.knockoutRules.some((rule) => rule.field === 'experienceYears')).toBe(false);
  });

  it('extracts must-have vs nice-to-have skills based on section headings', () => {
    const jdText = `
Job Title: Senior Clinical Specialist
About Us: Saudi German Health is a leading healthcare group.

Required Skills:
- Patient Care
- BLS
- ACLS
- Infection Control

Nice to Have:
- JCI Accreditation
- Healthcare Quality
- Project Management
`;

    const res = parser.parseJdText(jdText);
    const mustSkillNames = res.mustHaveSkills.map((s) => s.name);
    const niceSkillNames = res.niceToHaveSkills.map((s) => s.name);

    expect(mustSkillNames).toContain('Patient Care');
    expect(mustSkillNames).toContain('BLS');
    expect(mustSkillNames).toContain('ACLS');
    expect(mustSkillNames).toContain('Infection Control');

    expect(niceSkillNames).toContain('JCI Accreditation');
    expect(niceSkillNames).toContain('Healthcare Quality');
    expect(niceSkillNames).toContain('Project Management');

    // No overlaps between must-have and nice-to-have
    for (const name of mustSkillNames) {
      expect(niceSkillNames).not.toContain(name);
    }
  });

  it('preserves existing vacancy skills in must-have set', () => {
    const jdText = 'Looking for a developer with NestJS experience.';
    const res = parser.parseJdText(jdText, ['TypeScript', 'PostgreSQL']);
    const mustSkillNames = res.mustHaveSkills.map((s) => s.name);

    expect(mustSkillNames).toContain('TypeScript');
    expect(mustSkillNames).toContain('PostgreSQL');
    expect(mustSkillNames).toContain('NestJS');
  });

  it('extracts education degree requirements and creates education knockout rule', () => {
    const jdText = `
Position: Medical Director
Requirements:
- Must hold an MD or MBBS from an accredited institution.
- Master's degree in Hospital Administration preferred.
- 10+ years of experience.
`;

    const res = parser.parseJdText(jdText);
    expect(res.educationLevels).toContain('DOCTORATE');
    expect(res.educationLevels).toContain('MASTERS');

    const eduKnockout = res.knockoutRules.find((r) => r.field === 'degree');
    expect(eduKnockout).toBeDefined();
    expect(eduKnockout?.operator).toBe('IN');
    expect(eduKnockout?.value).toEqual(expect.arrayContaining(['DOCTORATE', 'MASTERS']));
  });

  it('extracts languages accurately', () => {
    const jdText = 'Bilingual fluency in English and Arabic is mandatory for patient communication.';
    const res = parser.parseJdText(jdText);

    const langNames = res.languages?.map((l) => l.language) || [];
    expect(langNames).toContain('English');
    expect(langNames).toContain('Arabic');
  });

  it('detects work modes: Remote, Hybrid, and On-site', () => {
    expect(parser.parseJdText('This is a 100% remote software developer position.').workMode).toBe('Remote');
    expect(parser.parseJdText('Role is hybrid (3 days on-site, 2 days remote).').workMode).toBe('Hybrid');
    expect(parser.parseJdText('On-site hospital clinical shift work in Jeddah.').workMode).toBe('On-site');
  });

  it('initializes default weights, version, and unlocked state', () => {
    const res = parser.parseJdText('Nurse position with 2 years of experience.');
    expect(res.version).toBe(1);
    expect(res.isLocked).toBe(false);
    expect(res.lockedAt).toBeNull();
    expect(res.lockedById).toBeNull();
    expect(res.weights).toEqual({
      skills: 50,
      experience: 30,
      education: 10,
      languages: 10,
    });
  });
});
