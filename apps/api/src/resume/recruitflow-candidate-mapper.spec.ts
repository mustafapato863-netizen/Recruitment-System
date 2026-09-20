import { describe, expect, it } from 'vitest';
import { RecruitFlowCandidateMapper } from './recruitflow-candidate-mapper';

describe('RecruitFlowCandidateMapper', () => {
  const mapper = new RecruitFlowCandidateMapper();

  it('maps standard Affinda v1 schema accurately', () => {
    const affindaResponse = {
      data: {
        person: {
          name: {
            given: 'Ahmed',
            family: 'Mansoor',
            raw: 'Ahmed Mansoor',
          },
          location: {
            formatted: 'Riyadh, Saudi Arabia',
            city: 'Riyadh',
            country: 'Saudi Arabia',
          },
        },
        contact: {
          emails: ['ahmed.mansoor@example.com'],
          phoneNumbers: [{ formatted: '+966 50 123 4567', raw: '0501234567' }],
        },
        profession: 'Cardiology Specialist',
        employmentMetrics: {
          totalExperienceMonths: 84, // 7 years
        },
        workExperience: [
          {
            jobTitle: 'Junior Doctor',
            organization: 'Cairo General Hospital',
            isCurrent: false,
            dates: {
              startDate: '2017-01-01',
              endDate: '2020-01-01',
              isCurrent: false,
            },
          },
          {
            jobTitle: 'Specialist Cardiologist',
            organization: 'Saudi German Hospital',
            isCurrent: true,
            jobDescription: 'Led cardiac catheterization procedures and ICU telemetry monitoring.',
            dates: {
              startDate: '2020-02-01',
              endDate: null,
              isCurrent: true,
            },
          },
        ],
        skills: [{ name: 'Cardiology' }, { name: 'Echocardiography' }, 'ECG'],
        education: [
          {
            accreditation: { education: 'Master of Science in Cardiology' },
            organization: 'Cairo University',
          },
        ],
        certifications: [{ name: 'SCFHS Specialist License' }, 'BLS Certified'],
        languages: [{ name: 'Arabic' }, { name: 'English' }],
      },
      meta: {
        rawText: 'Ahmed Mansoor CV text...',
        document: {
          classification: 'resume',
          extractionQuality: 0.92,
        },
      },
    };

    const result = mapper.map(affindaResponse);

    expect(result.firstName).toBe('Ahmed');
    expect(result.lastName).toBe('Mansoor');
    expect(result.email).toBe('ahmed.mansoor@example.com');
    expect(result.phone).toBe('+966 50 123 4567');
    expect(result.location).toBe('Riyadh, Saudi Arabia');
    expect(result.experienceYears).toBe(7);

    // Current job must be from the current workExperience entry, NOT workExperience[0]
    expect(result.title).toBe('Specialist Cardiologist');
    expect(result.currentCompany).toBe('Saudi German Hospital');

    expect(result.skills).toEqual(['Cardiology', 'Echocardiography', 'ECG']);
    expect(result.education).toContain('Master of Science in Cardiology');
    expect(result.education).toContain('Cairo University');
    expect(result.certifications).toEqual(['SCFHS Specialist License', 'BLS Certified']);
    expect(result.languages).toEqual(['Arabic', 'English']);
    expect(result.responsibilities).toContain(
      'Led cardiac catheterization procedures and ICU telemetry monitoring.',
    );
    expect(result.parserSource).toBe('affinda');
    expect(result.parsingQuality).toBe('high');
  });

  it('correctly falls back to splitting raw name when given/family are absent', () => {
    const affindaResponse = {
      data: {
        person: {
          name: {
            raw: 'Sara Al-Ghamdi',
          },
        },
        contact: {
          emails: [{ value: 'sara@example.com' }],
        },
      },
    };

    const result = mapper.map(affindaResponse);
    expect(result.firstName).toBe('Sara');
    expect(result.lastName).toBe('Al-Ghamdi');
    expect(result.email).toBe('sara@example.com');
  });

  it('selects latest work experience when isCurrent is not explicitly set', () => {
    const affindaResponse = {
      data: {
        person: { name: { given: 'Fatima', family: 'Zahra' } },
        workExperience: [
          {
            jobTitle: 'Senior Accountant',
            organization: 'Delta Corp',
            dates: { startDate: '2022-01-01', endDate: 'present' },
          },
          {
            jobTitle: 'Staff Accountant',
            organization: 'Alpha LLC',
            dates: { startDate: '2019-01-01', endDate: '2021-12-31' },
          },
        ],
      },
    };

    const result = mapper.map(affindaResponse);
    expect(result.title).toBe('Senior Accountant');
    expect(result.currentCompany).toBe('Delta Corp');
  });

  it('flags parsing quality as low for non-resume documents', () => {
    const affindaResponse = {
      data: {},
      meta: {
        document: {
          classification: 'invoice',
        },
      },
    };

    const result = mapper.map(affindaResponse);
    expect(result.parsingQuality).toBe('low');
  });
});
