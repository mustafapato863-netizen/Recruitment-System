import { describe, it, expect } from 'vitest';
import {
  evaluateHardGates,
  type CandidateGateProfile,
  type PositionGateRequirements,
} from '@recruitflow/validation';

describe('HardGateEvaluator', () => {
  it('passes when candidate meets all certification, experience, and domain requirements', () => {
    const candidate: CandidateGateProfile = {
      certifications: ['SCFHS Consultant', 'BLS', 'ACLS'],
      location: 'Riyadh, Saudi Arabia',
      experienceYears: 7,
      languages: ['Arabic', 'English'],
      clinicalDomain: 'Cardiology',
    };

    const requirements: PositionGateRequirements = {
      requiredCertifications: ['SCFHS', 'BLS'],
      requiredLocation: 'Riyadh',
      minimumExperience: 5,
      requiredLanguages: ['English'],
      requiredClinicalDomain: 'Cardiology',
    };

    const result = evaluateHardGates(candidate, requirements);

    expect(result.passed).toBe(true);
    expect(result.failedGates).toHaveLength(0);
    expect(result.gates.every((g) => g.passed)).toBe(true);
  });

  it('fails with blocking error when required certification is missing', () => {
    const candidate: CandidateGateProfile = {
      certifications: ['BLS'],
      location: 'Riyadh',
      experienceYears: 5,
    };

    const requirements: PositionGateRequirements = {
      requiredCertifications: ['SCFHS', 'BLS'],
    };

    const result = evaluateHardGates(candidate, requirements);

    expect(result.passed).toBe(false);
    expect(result.failedGates.length).toBeGreaterThan(0);
    expect(result.failedGates.some((f) => f.includes('SCFHS'))).toBe(true);
  });

  it('produces non-blocking warnings for location mismatch or minor experience gap', () => {
    const candidate: CandidateGateProfile = {
      certifications: ['SCFHS'],
      location: 'Cairo, Egypt',
      experienceYears: 4,
    };

    const requirements: PositionGateRequirements = {
      requiredCertifications: ['SCFHS'],
      requiredLocation: 'Riyadh',
      minimumExperience: 5,
    };

    const result = evaluateHardGates(candidate, requirements);

    // Location is non-blocking (warning) and experience 4/5 is above 60% threshold
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('Location'))).toBe(true);
  });

  it('blocks candidate whose clinical domain conflicts with required domain', () => {
    const candidate: CandidateGateProfile = {
      certifications: ['SCFHS'],
      clinicalDomain: 'Pediatrics',
    };

    const requirements: PositionGateRequirements = {
      requiredCertifications: ['SCFHS'],
      requiredClinicalDomain: 'Neurosurgery',
    };

    const result = evaluateHardGates(candidate, requirements);

    expect(result.passed).toBe(false);
    expect(result.failedGates.some((f) => f.includes('Neurosurgery'))).toBe(true);
  });
});
