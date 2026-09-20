import { describe, expect, it } from 'vitest';
import { mergeCanonicalResults } from '../canonical-merger';
import type { CanonicalResumeParseResult, ExtractedField } from '@recruitflow/contracts';

describe('mergeCanonicalResults (Phase 2 Legacy Fallback Rule)', () => {
  const dummyProvenance = { sourceProvider: 'test', extractionMethod: 'human-input' as const };
  const extracted = <T>(val: T): ExtractedField<T> => ({
    kind: 'EXTRACTED',
    rawValue: val,
    provenance: dummyProvenance,
  });

  it('allows legacy parser to fill missing email and phone ONLY (location is NOT filled)', () => {
    const primary: CanonicalResumeParseResult = {
      identity: { firstName: extracted('Omar') },
      professional: {},
      contact: {},
    };

    const fallback: CanonicalResumeParseResult = {
      identity: { firstName: extracted('ShouldNotUse') },
      professional: {},
      contact: {
        email: extracted('omar.ali@example.com'),
        phone: extracted('+201012345678'),
        location: { rawLocation: extracted('Cairo, Egypt') },
      },
    };

    const merged = mergeCanonicalResults(primary, fallback);

    expect(merged.contact.email?.rawValue).toBe('omar.ali@example.com');
    expect(merged.contact.phone?.rawValue).toBe('+201012345678');
    // Location must NOT be filled from fallback
    expect(merged.contact.location).toBeUndefined();
  });

  it('does NOT overwrite existing contact info in primary', () => {
    const primary: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {
        email: extracted('primary@example.com'),
        phone: extracted('+966500000000'),
        location: { rawLocation: extracted('Riyadh, Saudi Arabia') },
      },
    };

    const fallback: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {
        email: extracted('fallback@example.com'),
        phone: extracted('+123456789'),
        location: { rawLocation: extracted('Cairo, Egypt') },
      },
    };

    const merged = mergeCanonicalResults(primary, fallback);

    expect(merged.contact.email?.rawValue).toBe('primary@example.com');
    expect(merged.contact.phone?.rawValue).toBe('+966500000000');
    expect(merged.contact.location?.rawLocation?.rawValue).toBe('Riyadh, Saudi Arabia');
  });

  it('STRICT RULE: legacy parser does NOT append skills or fill summary', () => {
    const primary: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {},
      capabilities: {
        extractedSkills: [extracted('React'), extracted('TypeScript')],
      },
      summary: undefined,
    };

    const fallback: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {},
      capabilities: {
        extractedSkills: [
          extracted('Node.js'),
          extracted('PostgreSQL'),
        ],
      },
      summary: extracted('Fallback summary text that should NOT be used'),
    };

    const merged = mergeCanonicalResults(primary, fallback);

    // Skills must strictly remain primary's skills (no append)
    const skillNames = merged.capabilities?.extractedSkills?.map((s) => s.rawValue);
    expect(skillNames).toEqual(['React', 'TypeScript']);

    // Summary must remain undefined (strictly primary)
    expect(merged.summary).toBeUndefined();
  });

  it('STRICT RULE: legacy parser NEVER fills firstName, lastName, middleName, or fullName', () => {
    const primary: CanonicalResumeParseResult = {
      identity: {}, // missing all identity fields
      professional: {},
      contact: {},
    };

    const fallback: CanonicalResumeParseResult = {
      identity: {
        firstName: extracted('John'),
        middleName: extracted('William'),
        lastName: extracted('Doe'),
        fullName: extracted('John William Doe'),
      },
      professional: {},
      contact: {},
    };

    const merged = mergeCanonicalResults(primary, fallback);

    expect(merged.identity.firstName).toBeUndefined();
    expect(merged.identity.middleName).toBeUndefined();
    expect(merged.identity.lastName).toBeUndefined();
    expect(merged.identity.fullName).toBeUndefined();
  });

  it('STRICT RULE: legacy parser NEVER fills title, currentCompany, or experienceYears', () => {
    const primary: CanonicalResumeParseResult = {
      identity: {},
      professional: {}, // missing title, company, experience
      contact: {},
    };

    const fallback: CanonicalResumeParseResult = {
      identity: {},
      professional: {
        currentJobTitle: extracted('HRIS Developer'),
        currentCompany: extracted('Tech Corp'),
        professionalHeadline: extracted('Senior HRIS Developer'),
        statedExperienceMonths: extracted(72),
        derivedExperienceYears: {
          kind: 'DERIVED',
          derivedValue: 6,
          derivationRule: 'total_months_division',
          provenance: dummyProvenance,
        },
      },
      contact: {},
    };

    const merged = mergeCanonicalResults(primary, fallback);

    expect(merged.professional.currentJobTitle).toBeUndefined();
    expect(merged.professional.currentCompany).toBeUndefined();
    expect(merged.professional.professionalHeadline).toBeUndefined();
    expect(merged.professional.statedExperienceMonths).toBeUndefined();
    expect(merged.professional.derivedExperienceYears).toBeUndefined();
  });

  it('STRICT RULE: legacy parser NEVER creates or adds workHistory or educationHistory entries', () => {
    const primary: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {},
      workHistory: [], // empty primary history
      educationHistory: [], // empty primary education
    };

    const fallback: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {},
      workHistory: [
        {
          id: 'legacy-work-1',
          extractedTitle: extracted('Developer'),
          extractedCompany: extracted('Legacy Inc'),
        },
      ],
      educationHistory: [
        {
          id: 'legacy-edu-1',
          extractedDegree: extracted('BSc'),
        },
      ],
    };

    const merged = mergeCanonicalResults(primary, fallback);

    expect(merged.workHistory).toHaveLength(0);
    expect(merged.educationHistory).toHaveLength(0);
  });

  it('matches entries by company/title and fills dates ONLY on confident match (tested with three Affinda jobs missing dates)', () => {
    // 3 Affinda jobs missing dates
    const primary: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {},
      workHistory: [
        {
          id: 'job-1',
          extractedTitle: extracted('HRIS Developer'),
          extractedCompany: extracted('Saudi German Health'),
          startDate: undefined,
          endDate: undefined,
        },
        {
          id: 'job-2',
          extractedTitle: extracted('Sales Analyst & Planning'),
          extractedCompany: extracted('Fambeef Company'),
          startDate: undefined,
          endDate: undefined,
        },
        {
          id: 'job-3',
          extractedTitle: extracted('Data Entry Specialist'),
          extractedCompany: extracted('Mass Company'),
          startDate: undefined,
          endDate: undefined,
        },
      ],
    };

    // Fallback has:
    // - A matching entry for Job 1: 'HRIS Developer' at 'Saudi German Health'
    // - An unmatched entry (different company & title entirely: 'Unrelated Bakery')
    // - A matching entry for Job 3: 'Data Entry' at 'Mass Company'
    // Job 2 has NO matching fallback entry.
    const fallback: CanonicalResumeParseResult = {
      identity: {},
      professional: {},
      contact: {},
      workHistory: [
        {
          id: 'fallback-job-1',
          extractedTitle: extracted('HRIS Developer'),
          extractedCompany: extracted('Saudi German Health'),
          startDate: extracted('2026-05-01'),
          endDate: extracted('Present'),
        },
        {
          id: 'fallback-unrelated',
          extractedTitle: extracted('Head Baker'),
          extractedCompany: extracted('Unrelated Bakery'),
          startDate: extracted('2010-01-01'),
          endDate: extracted('2012-01-01'),
        },
        {
          id: 'fallback-job-3',
          extractedTitle: extracted('Data Entry'),
          extractedCompany: extracted('Mass Company'),
          startDate: extracted('2022-02-01'),
          endDate: extracted('2022-04-01'),
        },
      ],
    };

    const merged = mergeCanonicalResults(primary, fallback);

    expect(merged.workHistory).toHaveLength(3);

    // Job 1: Confident match -> dates filled
    expect(merged.workHistory![0].startDate?.rawValue).toBe('2026-05-01');
    expect(merged.workHistory![0].endDate?.rawValue).toBe('Present');

    // Job 2: NO confident match -> dates remain undefined (NOT copied from fallback[0]!)
    expect(merged.workHistory![1].startDate).toBeUndefined();
    expect(merged.workHistory![1].endDate).toBeUndefined();

    // Job 3: Confident match -> dates filled
    expect(merged.workHistory![2].startDate?.rawValue).toBe('2022-02-01');
    expect(merged.workHistory![2].endDate?.rawValue).toBe('2022-04-01');
  });
});
