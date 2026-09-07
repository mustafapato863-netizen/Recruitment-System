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
    expect(extracted.summary).toBeDefined();
    expect(extracted.aiSummaryConfidence).toBeGreaterThanOrEqual(85);
  });

  it('extracts clinical subspecialties, medical licenses, and synthesizes executive summary for healthcare professionals', () => {
    const medicalResume = `
      Dr. Tamer Radwan
      Consultant Cardiologist
      Email: tamer.radwan@sgh.med.sa
      Phone: +966 50 123 4567
      Location: Riyadh, Saudi Arabia

      Experience: 12 years of clinical cardiology experience

      Work History
      Consultant Cardiologist | Saudi German Hospital Riyadh | 2018 - Present
      - Managed cardiac catheterization lab and performed diagnostic coronary angiograms.
      - Conducted transthoracic and transesophageal echocardiography.

      Core Competencies
      Interventional Cardiology, Echocardiography, Cardiac Catheterization, Hemodynamics, ECG, Code Blue Response

      Licenses & Certifications
      SCFHS Consultant License
      Fellow of the Royal College of Surgeons (FRCS)
      Advanced Cardiac Life Support (ACLS)
      Basic Life Support (BLS)

      Languages: Arabic, English
    `;

    const extracted = extractCandidateFromText(medicalResume, 'Dr_Tamer_Radwan_Cardiologist.pdf');

    expect(extracted.firstName).toBe('Tamer');
    expect(extracted.lastName).toBe('Radwan');
    expect(extracted.title).toBe('Consultant Cardiologist');
    expect(extracted.clinicalDomain).toBe('Cardiovascular Medicine');
    expect(extracted.experienceYears).toBe(12);
    expect(extracted.skills).toEqual(expect.arrayContaining(['Echocardiography', 'Cardiac Catheterization', 'Ecg']));
    expect(extracted.certifications).toEqual(expect.arrayContaining(['SCFHS Consultant License', 'Advanced Cardiac Life Support (ACLS)', 'Basic Life Support (BLS)']));
    expect(extracted.subspecialties?.length).toBeGreaterThan(0);
    expect(extracted.keyHighlights).toEqual(expect.arrayContaining(['12+ Years Experience', 'SCFHS Licensed / Registered', 'BLS/ACLS Certified']));
    expect(extracted.summary).toContain('Tamer Radwan');
    expect(extracted.summary).toContain('Saudi German Health');
    expect(extracted.aiSummaryConfidence).toBeGreaterThanOrEqual(90);
  });

  it('detects ICU nursing competencies and builds SGH quality-compliant summary', () => {
    const nurseResume = `
      Mona El-Shenawy
      Staff Nurse (ICU)
      Email: mona.shenawy@example.com
      Phone: +966 54 111 3355
      Location: Jeddah, Saudi Arabia
      5 years of experience in intensive care units

      Skills: Critical Care, ICU, Ventilator Management, Hemodynamic Monitoring, Sepsis Management, Triage

      Certifications:
      SCFHS Registered Nurse
      ACLS Certified
      BLS Certified
    `;

    const extracted = extractCandidateFromText(nurseResume, 'Mona_Shenawy_ICU.pdf');

    expect(extracted.title).toBe('Staff Nurse (ICU)');
    expect(extracted.clinicalDomain).toBe('Critical Care & Emergency Medicine');
    expect(extracted.subspecialties).toContain('Intensive Care & Mechanical Ventilation');
    expect(extracted.skills).toEqual(expect.arrayContaining(['Critical Care', 'Icu', 'Ventilator Management']));
    expect(extracted.summary).toContain('Mona El-Shenawy');
    expect(extracted.summary).toContain('Saudi German Health');
  });
});

