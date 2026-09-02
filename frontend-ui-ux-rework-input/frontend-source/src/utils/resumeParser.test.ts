import { describe, it, expect } from 'vitest';
import { extractCandidateFromText } from './resumeParser';

describe('extractCandidateFromText', () => {
  it('extracts full structured candidate profile from resume text', () => {
    const resumeText = `
      Mustafa Zain
      Data Analyst
      Email: mustafazainhom9@gmail.com
      Phone: +20 1111680029
      Location: Cairo, Egypt

      Professional Summary
      Results-driven Data Analyst with 5+ years of experience in data visualization, business intelligence, and ETL pipelines.

      Work Experience
      Data Analyst | Saudi German Health | 2021 - Present
      - Built automated Power BI dashboards and SQL reporting queries.
      - Developed Python models for patient flow analytics.

      Education
      Bachelor of Science in Computer Science, Cairo University

      Technical Skills
      Python, SQL, Power BI, Tableau, Excel, DAX, PostgreSQL, ETL, Statistics

      Languages
      Arabic (Native), English (Fluent)

      Certifications
      Microsoft Certified: Data Analyst Associate
    `;

    const extracted = extractCandidateFromText(resumeText, 'MUSTAFA_ZAIN_DATA_ANALYST_CV.PDF');

    expect(extracted.firstName).toBe('Mustafa');
    expect(extracted.lastName).toBe('Zain');
    expect(extracted.email).toBe('mustafazainhom9@gmail.com');
    expect(extracted.phone).toBe('+20 1111680029');
    expect(extracted.title).toBe('Data Analyst');
    expect(extracted.currentCompany).toContain('Saudi German Health');
    expect(extracted.location).toBe('Cairo, Egypt');
    expect(extracted.experienceYears).toBe(5);
    expect(extracted.education).toContain('Computer Science');
    expect(extracted.skills).toEqual(expect.arrayContaining(['Python', 'Sql', 'Power Bi', 'Tableau', 'Excel']));
    expect(extracted.languages).toEqual(expect.arrayContaining(['English', 'Arabic']));
    expect(extracted.certifications?.length).toBeGreaterThan(0);
    expect(extracted.summary).toContain('Results-driven Data Analyst');
  });

  it('falls back cleanly when minimal fields are present', () => {
    const minimalText = `
      John Doe
      johndoe@example.com
      +1 555-0199
    `;

    const extracted = extractCandidateFromText(minimalText, 'John_Doe_Resume.docx');

    expect(extracted.firstName).toBe('John');
    expect(extracted.lastName).toBe('Doe');
    expect(extracted.email).toBe('johndoe@example.com');
    expect(extracted.phone).toBe('+1 555-0199');
    expect(extracted.title).toBeDefined();
    expect(extracted.skills).toBeDefined();
  });
});
