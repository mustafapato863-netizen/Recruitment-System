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
});
