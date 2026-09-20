import { describe, it, expect } from 'vitest';
import {
  calculateCandidateFitScore,
  type CandidateMatchProfile,
  type PositionRequirements,
} from '@recruitflow/validation';

describe('calculateCandidateFitScore', () => {
  it('computes 100% fit score for a fully qualified candidate matching all criteria', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['ICU', 'Critical Care', 'Ventilator Management', 'BLS'],
      experienceYears: 6,
      location: 'Riyadh, Saudi Arabia',
      certifications: ['SCFHS Consultant', 'BLS', 'ACLS'],
      currentTitle: 'Senior ICU Specialist',
    };

    const requirements: PositionRequirements = {
      requiredSkills: ['ICU', 'Critical Care', 'Ventilator Management'],
      minExperienceYears: 5,
      location: 'Riyadh',
      requiredCertifications: ['SCFHS', 'BLS'],
      department: 'Intensive Care Unit',
    };

    const result = calculateCandidateFitScore(candidate, requirements);

    expect(result.score).toBe(100);
    expect(result.matchLevel).toBe('high');
    expect(result.breakdown.skills.percentage).toBe(100);
    expect(result.breakdown.skills.missing).toHaveLength(0);
    expect(result.breakdown.experience.met).toBe(true);
    expect(result.breakdown.certifications.met).toBe(true);
    expect(result.breakdown.location.met).toBe(true);
    expect(result.summaryText).toContain('Strong candidate match');
  });

  it('correctly matches healthcare acronyms and synonyms (e.g. EHR vs Electronic Health Records)', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Electronic Health Records', 'Intensive Care Unit', 'Pediatric Intensive Care'],
      experienceYears: 4,
      location: 'Jeddah',
      certifications: ['Saudi Commission for Health Specialties', 'Basic Life Support'],
    };

    const requirements: PositionRequirements = {
      requiredSkills: ['EHR', 'ICU', 'PICU'],
      minExperienceYears: 3,
      location: 'Jeddah',
      requiredCertifications: ['SCFHS', 'BLS'],
    };

    const result = calculateCandidateFitScore(candidate, requirements);

    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.matchLevel).toBe('high');
    expect(result.breakdown.skills.matched).toEqual(expect.arrayContaining(['EHR', 'ICU', 'PICU']));
    expect(result.breakdown.skills.missing).toHaveLength(0);
    expect(result.breakdown.certifications.met).toBe(true);
  });

  it('calculates proportional score for partial experience and missing skills', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Python', 'SQL'], // Missing TypeScript, React, Docker
      experienceYears: 2, // Required is 4
      location: 'Dammam', // Required is Riyadh (relocation)
      certifications: [],
    };

    const requirements: PositionRequirements = {
      requiredSkills: ['Python', 'TypeScript', 'React', 'Docker'],
      minExperienceYears: 4,
      location: 'Riyadh',
      requiredCertifications: ['AWS Certified Developer'],
    };

    const result = calculateCandidateFitScore(candidate, requirements);

    expect(result.score).toBeLessThan(60);
    expect(result.matchLevel).toBe('low');
    expect(result.breakdown.skills.matched).toContain('Python');
    expect(result.breakdown.skills.missing).toEqual(['TypeScript', 'React', 'Docker']);
    expect(result.breakdown.skills.percentage).toBe(25); // 1 out of 4 = 25%
    expect(result.breakdown.experience.met).toBe(false);
    expect(result.breakdown.experience.actual).toBe(2);
    expect(result.breakdown.experience.required).toBe(4);
    expect(result.breakdown.location.met).toBe(false);
    expect(result.summaryText).toContain('Below target benchmark');
  });

  it('gracefully handles empty criteria and extracts certifications from free-text qualifications', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Patient Care', 'Phlebotomy'],
      experienceYears: 3,
      location: 'Riyadh',
      certifications: ['BLS', 'ACLS'],
    };

    const requirements: PositionRequirements = {
      requiredSkills: [],
      minExperienceYears: 2,
      location: 'Riyadh',
      qualifications: 'Must hold active BLS certification and SCFHS registration.',
    };

    const result = calculateCandidateFitScore(candidate, requirements);

    expect(result.score).toBeGreaterThan(60);
    expect(result.breakdown.certifications.matched).toContain('BLS');
    expect(result.breakdown.certifications.missing).toContain('SCFHS');
  });

  it('does not claim licensure compliance when no certification evidence exists', () => {
    const result = calculateCandidateFitScore(
      { skills: ['SQL'], experienceYears: 3, certifications: [] },
      { requiredSkills: ['SQL'], minExperienceYears: 2 },
    );

    expect(result.breakdown.certifications.evidenceStatus).toBe('not_applicable');
    expect(result.breakdown.certifications.percentage).toBe(0);
    expect(result.breakdown.certifications.met).toBe(false);
  });

  it('prevents false-positive skill matching between unrelated domains (e.g. Data/HRIS candidate vs Talent Acquisition role)', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Sql', 'Python', 'Power Bi', 'Excel', 'Dax', 'Power Query', 'Data Visualization', 'R', 'Go'],
      experienceYears: 5,
      location: 'Cairo, Egypt',
      certifications: [],
      currentTitle: 'HRIS Performance Specialist',
    };

    const requirements: PositionRequirements = {
      requiredSkills: [
        'Talent Acquisition Strategy',
        'Competency-Based Interviewing',
        'Recruitment Analytics & KPI Management',
        'Stakeholder Management',
        'Negotiation & Influencing Skills',
      ],
      minExperienceYears: 3,
      location: 'Offshore',
      requiredCertifications: ["Bachelor's degree in BA, HR or related field."],
    };

    const result = calculateCandidateFitScore(candidate, requirements);

    // Candidate does not possess talent acquisition skills; score must reflect a clear skill gap
    expect(result.breakdown.skills.matched).toEqual([]);
    expect(result.breakdown.skills.missing).toHaveLength(5);
    expect(result.breakdown.skills.percentage).toBe(0);
    expect(result.breakdown.skills.weightedScore).toBe(0);
    expect(result.matchLevel).toBe('low');
    expect(result.score).toBeLessThan(40);
  });

  it('correctly recognises Offshore and Cairo as a local location match without relocation required', () => {
    const offshoreResult = calculateCandidateFitScore(
      { skills: ['Python'], location: 'Cairo, Egypt' },
      { requiredSkills: ['Python'], location: 'Offshore' },
    );

    expect(offshoreResult.breakdown.location.met).toBe(true);
    expect(offshoreResult.breakdown.location.percentage).toBe(100);
    expect(offshoreResult.breakdown.location.weightedScore).toBe(10);

    const crossCityResult = calculateCandidateFitScore(
      { skills: ['Python'], location: 'Cairo, Egypt' },
      { requiredSkills: ['Python'], location: 'Riyadh, Saudi Arabia' },
    );

    expect(crossCityResult.breakdown.location.met).toBe(false);
    expect(crossCityResult.breakdown.location.percentage).toBe(40);
  });

  describe('Evidence-Based Semantic Skill Matching (Cases A through H)', () => {
    it('Case A: Exact skill wording produces Strong Match (1.0) with evidence', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['Full-Stack Web Development', 'Docker'],
        rawText: 'Full-Stack Web Development engineer with 5 years experience.',
      };
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['Full-Stack Web Development'],
      });

      expect(result.breakdown.skills.matched).toContain('Full-Stack Web Development');
      expect(result.breakdown.skills.missing).toHaveLength(0);
      expect(result.breakdown.skills.percentage).toBe(100);

      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(evidence?.confidence).toBe('strong');
      expect(evidence?.confidenceLabel).toBe('Strong Match');
      expect(evidence?.score).toBe(1.0);
      expect(evidence?.evidence.length).toBeGreaterThan(0);
    });

    it('Case B: Synonym / equivalent wording produces Strong Match (1.0)', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['Relational Database Management System'],
        rawText: 'Experienced in Relational Database Management System architecture and design.',
      };
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['RDBMS'],
      });

      expect(result.breakdown.skills.matched).toContain('RDBMS');
      expect(result.breakdown.skills.missing).toHaveLength(0);
      expect(result.breakdown.skills.percentage).toBe(100);

      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(evidence?.confidence).toBe('strong');
      expect(evidence?.score).toBe(1.0);
    });

    it('Case C: Skill demonstrated through job responsibilities without exact skill listed', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['PostgreSQL'],
        rawText: `
          Senior Database Specialist
          - Built and administered SQL databases across high-availability clusters.
          - Designed complex schemas, stored procedures, and performed query optimization and backup recovery.
        `,
      };
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['SQL Database Development & Administration'],
      });

      expect(result.breakdown.skills.matched).toContain('SQL Database Development & Administration');
      expect(result.breakdown.skills.missing).toHaveLength(0);
      expect(result.breakdown.skills.percentage).toBeGreaterThanOrEqual(85);

      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(['match', 'strong']).toContain(evidence?.confidence);
      expect(evidence?.evidence.some((e) => e.toLowerCase().includes('administered sql databases'))).toBe(true);
    });

    it('Case D: Skill inferred from a comprehensive technology stack', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['React', 'Next.js', 'Node.js', 'Express', 'PostgreSQL', 'REST APIs'],
        rawText: 'Developed robust web applications using React and Next.js on frontend with Node.js and PostgreSQL backend.',
      };
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['Full-Stack Web Development'],
      });

      expect(result.breakdown.skills.matched).toContain('Full-Stack Web Development');
      expect(result.breakdown.skills.missing).toHaveLength(0);
      expect(result.breakdown.skills.percentage).toBeGreaterThanOrEqual(90);

      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(evidence?.confidence).toBe('match');
      expect(evidence?.evidence.some((e) => e.includes('React') && e.includes('Node'))).toBe(true);
    });

    it('Case E: Partial evidence preserves partial credit without scoring 0%', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['React', 'HTML5', 'CSS3', 'Tailwind'],
        rawText: 'Frontend developer creating responsive user interfaces with React and Tailwind CSS.',
      };
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['Full-Stack Web Development'],
      });

      // Partial credit (50%), not 0%
      expect(result.breakdown.skills.percentage).toBe(50);
      expect(result.breakdown.skills.matched).toContain('Full-Stack Web Development');

      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(evidence?.confidence).toBe('partial');
      expect(evidence?.confidenceLabel).toBe('Partial Match');
      expect(evidence?.score).toBe(0.5);
    });

    it('Case F: Completely absent skill is marked Missing with 0% credit', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['React', 'Node.js'],
        rawText: 'Software developer specializing in web technologies.',
      };
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['Interventional Cardiology'],
      });

      expect(result.breakdown.skills.missing).toContain('Interventional Cardiology');
      expect(result.breakdown.skills.matched).not.toContain('Interventional Cardiology');
      expect(result.breakdown.skills.percentage).toBe(0);

      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(evidence?.confidence).toBe('none');
      expect(evidence?.confidenceLabel).toBe('No Evidence');
      expect(evidence?.score).toBe(0.0);
    });

    it('Case G: Missing preferred skill does not penalize candidate like a mandatory requirement', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['SQL', 'Python'],
        rawText: 'Data analyst skilled in SQL querying and Python data analysis.',
      };

      // Candidate meets both required skills, but lacks the preferred skill
      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['SQL', 'Python'],
        preferredSkills: ['Kubernetes'],
      });

      // Both required skills are met (100% required percentage)
      expect(result.breakdown.skills.requiredPercentage).toBe(100);
      expect(result.breakdown.skills.percentage).toBeGreaterThanOrEqual(95);
      expect(result.breakdown.skills.missing).not.toContain('Kubernetes');

      const prefEvidence = result.breakdown.skills.evidenceItems?.find(
        (i) => i.skill === 'Kubernetes',
      );
      expect(prefEvidence?.category).toBe('preferred');
      expect(prefEvidence?.confidence).toBe('none');
    });

    it('Case H: Similar but NOT equivalent skill does not produce a confirmed match (Power BI vs Power Platform Automation)', () => {
      const candidate: CandidateMatchProfile = {
        skills: ['Power BI', 'SQL', 'Excel'],
        rawText: 'Built Power BI reports and executive dashboards connecting to SQL data warehouses.',
      };

      const result = calculateCandidateFitScore(candidate, {
        requiredSkills: ['Microsoft Power Platform Process Automation'],
      });

      // Power BI alone should not match Power Platform Process Automation
      expect(result.breakdown.skills.percentage).toBeLessThan(40);
      const evidence = result.breakdown.skills.evidenceItems?.[0];
      expect(['weak', 'none']).toContain(evidence?.confidence);
      expect(evidence?.confidence).not.toBe('match');
      expect(evidence?.confidence).not.toBe('strong');
    });
  });
});
