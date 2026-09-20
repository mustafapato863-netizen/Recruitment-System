import { describe, it, expect } from 'vitest';
import {
  evaluateSkillEvidence,
  calculateCandidateFitScore,
  type CandidateMatchProfile,
  type PositionRequirements,
} from '@recruitflow/validation';

describe('Hybrid Matching & Taxonomy Integration', () => {
  it('matches Data Engineering & ETL via taxonomy dimensions and responsibilities', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Apache Spark', 'Kafka', 'dbt', 'Snowflake', 'Python'],
      rawText: 'Senior Data Engineer: Built scalable ETL pipelines using Apache Spark and Kafka. Maintained Snowflake data warehouse with dbt transformations.',
    };

    const evidence = evaluateSkillEvidence(
      'Data Engineering & ETL',
      'required',
      candidate,
    );

    expect(['strong', 'match']).toContain(evidence.confidence);
    expect(evidence.score).toBeGreaterThanOrEqual(0.85);
    expect(evidence.evidence.length).toBeGreaterThan(0);
  });

  it('matches Cybersecurity & Information Security via taxonomy', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['SIEM', 'Splunk', 'Vulnerability Management', 'ISO 27001'],
      rawText: 'Information Security Analyst: Monitored security incidents using Splunk SIEM. Conducted vulnerability assessments and ensured ISO 27001 compliance.',
    };

    const evidence = evaluateSkillEvidence(
      'Cybersecurity & Information Security',
      'required',
      candidate,
    );

    expect(['strong', 'match']).toContain(evidence.confidence);
    expect(evidence.score).toBeGreaterThanOrEqual(0.85);
  });

  it('matches Intensive Care & Critical Care Nursing via clinical skills evidence', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Mechanical Ventilation', 'Hemodynamics', 'Arterial Line', 'BLS', 'ACLS'],
      rawText: 'ICU Staff Nurse: Managed critically ill patients in ICU, operated mechanical ventilators, and monitored hemodynamic stability.',
    };

    const evidence = evaluateSkillEvidence(
      'Intensive Care & Critical Care Nursing',
      'required',
      candidate,
    );

    expect(['strong', 'match']).toContain(evidence.confidence);
    expect(evidence.score).toBeGreaterThanOrEqual(0.85);
  });

  it('matches Healthcare Quality & Patient Safety via accreditation and quality tools', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['JCI', 'CBAHI', 'CPHQ', 'Root Cause Analysis'],
      rawText: 'Quality Coordinator: Led JCI and CBAHI accreditation surveys. Conducted root cause analyses for clinical incidents.',
    };

    const evidence = evaluateSkillEvidence(
      'Healthcare Quality & Patient Safety',
      'required',
      candidate,
    );

    expect(['strong', 'match']).toContain(evidence.confidence);
    expect(evidence.score).toBeGreaterThanOrEqual(0.85);
  });

  it('uses EvidenceRanker to find relevant text for novel skills not in taxonomy', () => {
    const candidate: CandidateMatchProfile = {
      skills: [],
      rawText: `
        Career History:
        - Spearheaded clinical trial data collection and regulatory compliance protocols for multinational studies.
        - Coordinated patient recruitment across 5 tertiary hospitals.
      `,
      responsibilities: [
        'Spearheaded clinical trial data collection and regulatory compliance protocols for multinational studies.',
      ],
    };

    const evidence = evaluateSkillEvidence(
      'Clinical Trial Regulatory Compliance',
      'required',
      candidate,
    );

    // Should find evidence via bullet ranking
    expect(['match', 'partial']).toContain(evidence.confidence);
    expect(evidence.score).toBeGreaterThanOrEqual(0.5);
    expect(evidence.evidence.some((e) => e.includes('regulatory compliance'))).toBe(true);
  });

  it('supports configurable weights in calculateCandidateFitScore', () => {
    const candidate: CandidateMatchProfile = {
      skills: ['Python', 'Django'],
      experienceYears: 10,
      location: 'Riyadh',
      certifications: [],
    };

    const requirements: PositionRequirements = {
      requiredSkills: ['Python', 'Django'],
      minExperienceYears: 5,
      location: 'Riyadh',
      requiredCertifications: ['AWS Certified'],
    };

    // Standard weights (40/25/25/10): candidate has 100% skills, 100% exp, 0% certs, 100% loc
    // Score ≈ 40 + 25 + 0 + 10 = 75
    const standardResult = calculateCandidateFitScore(candidate, requirements);
    expect(standardResult.score).toBe(75);

    // Custom weights prioritizing skills (60/20/10/10):
    // Score ≈ 60 + 20 + 0 + 10 = 90
    const customResult = calculateCandidateFitScore(candidate, requirements, {
      skills: 0.6,
      experience: 0.2,
      certifications: 0.1,
      location: 0.1,
    });
    expect(customResult.score).toBe(90);
  });
});
