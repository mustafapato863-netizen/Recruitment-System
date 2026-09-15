import { describe, expect, it } from 'vitest';
import { parseJobDescriptionText } from '../jdParser';

describe('jdParser', () => {
  const sampleSghJdText = `
Job Specifications
Communication
Location: SGH, UAE, offshore
Reporting to: Technical: Group Compensation and performance Manager, Admin: Operation manager
Liaising with: Department heads
Supervising: -
Job Summary:
Develop, maintain, and enhance HR systems and digital solutions by managing HRIS applications, developing web-based tools, automating HR processes, and administering databases to improve operational efficiency, data accuracy, and user experience.
Job Duties & Responsibilities:
Develop, customize, and maintain HR systems, portals, and web applications to support HR operations and business requirements.
Analyze HR business needs and translate them into system enhancements and technical solutions.
Design, develop, and maintain full-stack web applications that integrate with HR systems and databases.
Develop and maintain SQL databases, ensuring data integrity, performance, security, and availability within approved IT architecture.
Build automated workflows and digital solutions to streamline HR processes and reduce manual activities.
Job Requirements:
Education:
Bachelor's degree in Computer Science, Information Systems, Software Engineering, or a related field.
Professional Training: -
Experience:
3–5 years of experience in HRIS, software development, or systems administration.
Experience developing web applications using modern front-end and back-end technologies.
Strong experience in SQL database development, querying, and optimization.
Licenses: -
Equipment Operated: -
Skills & Knowledge:
SQL Database Development & Administration.
Full-Stack Web Development.
Business Process Automation.
Microsoft Power Platform or similar automation tools.
Design patterns & Solid principles.
Strong communication, interpersonal, organizational, analytical, and problem-solving skills.
Languages:
English (Mandatory)
Arabic (Mandatory)
`;

  it('parses the SGH HRIS Performance Specialist specification accurately', () => {
    const parsed = parseJobDescriptionText(sampleSghJdText, 'HRIS performance Specialist.docx');

    expect(parsed.title).toBe('HRIS Performance Specialist');
    expect(parsed.location).toBe('SGH, UAE, offshore');
    expect(parsed.department).toBe('Human Resources');
    expect(parsed.minExperienceYears).toBe(3);
    expect(parsed.jobSummary).toContain('Develop, maintain, and enhance HR systems and digital solutions');
    expect(parsed.qualifications).toContain("Bachelor's degree in Computer Science");
    expect(parsed.responsibilities).toContain('Develop, customize, and maintain HR systems');

    // Skills
    expect(parsed.requiredSkills).toContain('SQL Database Development & Administration');
    expect(parsed.requiredSkills).toContain('Full-Stack Web Development');
    expect(parsed.requiredSkills).toContain('Business Process Automation');
    expect(parsed.requiredSkills).toContain('Microsoft Power Platform or similar automation tools');

    // Languages
    expect(parsed.languages).toContain('English');
    expect(parsed.languages).toContain('Arabic');
  });

  it('handles unstructured text gracefully with keyword fallbacks', () => {
    const unstructured = `
We are looking for a Senior React Engineer with minimum 5 years experience.
Must have strong SQL, TypeScript, Docker, and Python skills.
Department: Clinical Software Engineering
Location: Riyadh Hospital
`;
    const parsed = parseJobDescriptionText(unstructured, 'Senior_React_Developer.pdf');

    expect(parsed.title).toBe('Senior React Developer');
    expect(parsed.minExperienceYears).toBe(5);
    expect(parsed.location).toBe('Riyadh Hospital');
    expect(parsed.requiredSkills).toContain('React');
    expect(parsed.requiredSkills).toContain('TypeScript');
    expect(parsed.requiredSkills).toContain('Docker');
    expect(parsed.requiredSkills).toContain('SQL');
    expect(parsed.requiredSkills).toContain('Python');
  });

  it('parses clinical healthcare job specifications correctly', () => {
    const clinicalText = `
Position Title: Senior ICU Nurse Specialist
Location: SGH Riyadh Central Hospital
Department: Critical Care Nursing
Job Purpose:
Deliver advanced critical care and clinical nursing support for high-acuity inpatient units.
Experience:
At least 4 years of relevant clinical ICU experience.
Skills & Knowledge:
Ventilator Management.
Echocardiography.
BLS and ACLS.
Patient Assessment.
Education:
Bachelor of Science in Nursing (BSN); valid SCFHS Specialist License.
Key Responsibilities:
Monitor vital signs, administer intensive medications, and coordinate multidisciplinary care.
`;
    const parsed = parseJobDescriptionText(clinicalText, 'ICU_Nurse_Spec.docx');

    expect(parsed.title).toBe('Senior ICU Nurse Specialist');
    expect(parsed.location).toBe('SGH Riyadh Central Hospital');
    expect(parsed.department).toBe('Nursing');
    expect(parsed.minExperienceYears).toBe(4);
    expect(parsed.jobSummary).toContain('Deliver advanced critical care');
    expect(parsed.requiredSkills).toContain('Ventilator Management');
    expect(parsed.requiredSkills).toContain('Echocardiography');
    expect(parsed.requiredSkills).toContain('BLS and ACLS');
    expect(parsed.qualifications).toContain('Bachelor of Science in Nursing');
  });
});
