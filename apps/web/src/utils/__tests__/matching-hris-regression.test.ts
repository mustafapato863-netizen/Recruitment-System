import { describe, it, expect } from 'vitest';
import {
  evaluateSkillEvidence,
  calculateCandidateFitScore,
  type CandidateMatchProfile,
  type PositionRequirements,
} from '@recruitflow/validation';

describe('Karim Nasser HRIS Developer Regression Test Suite', () => {
  // Candidate Profile: Karim Nasser (HRIS Developer)
  // Based on the real CV with rich structured evidence from Affinda
  const hrisCandidate: CandidateMatchProfile = {
    currentTitle: 'HRIS Developer',
    experienceYears: 5,
    location: 'Cairo, Egypt',
    skills: [
      'React.js',
      'Next.js',
      'Node.js',
      '.NET',
      'SQL',
      'PostgreSQL',
      'Power BI',
      'TypeScript',
      'Tailwind CSS',
    ],
    workHistory: [
      {
        jobTitle: 'HRIS Developer',
        organization: 'Northwind Health Group',
        description:
          'Design, develop and maintain full-stack HR web applications using React.js, Next.js, Node.js, and .NET. Built, optimized, and administered SQL databases, stored procedures, and schema migrations for HRIS systems. Built automated workflows and business process automation for employee onboarding and performance appraisals. Developed executive dashboards connecting to SQL data warehouses using Power BI.',
        isCurrent: true,
      },
    ],
    responsibilities: [
      'Design, develop and maintain full-stack HR web applications using React.js, Next.js, Node.js, and .NET.',
      'Built, optimized, and administered SQL databases, stored procedures, and schema migrations for HRIS systems.',
      'Built automated workflows and business process automation for employee onboarding and performance appraisals.',
      'Developed executive dashboards connecting to SQL data warehouses using Power BI.',
    ],
    projects: [
      {
        title: 'Performance Appraisal System',
        description: 'Full-stack web application for annual hospital employee performance evaluations with automated approval workflows.',
      },
    ],
    education: 'Bachelor of Science in Computer Science, Nile Delta University',
    educationHistory: [
      {
        degree: 'Bachelor of Science',
        major: 'Computer Science',
        organization: 'Nile Delta University',
      },
    ],
    certifications: ['Microsoft Certified: Data Analyst Associate'],
    rawText: `
      Karim Nasser
      HRIS Developer
      Northwind Health Group | Cairo, Egypt

      Experience:
      - Design, develop and maintain full-stack HR web applications using React.js, Next.js, Node.js, and .NET.
      - Built, optimized, and administered SQL databases, stored procedures, and schema migrations for HRIS systems.
      - Built automated workflows and business process automation for employee onboarding and performance appraisals.
      - Developed executive dashboards connecting to SQL data warehouses using Power BI.

      Skills:
      React.js, Next.js, Node.js, .NET, SQL, PostgreSQL, Power BI, TypeScript, Tailwind CSS

      Education:
      Bachelor of Science in Computer Science, Nile Delta University
    `,
  };

  // 1. SQL Database Development & Administration -> Strong/Direct Evidence
  it('1. finds strong/direct evidence for SQL Database Development & Administration', () => {
    const evidence = evaluateSkillEvidence(
      'SQL Database Development & Administration',
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('STRONG_MATCH');
    expect(evidence.score).toBe(1.0);
    expect(evidence.evidence.length).toBeGreaterThan(0);
    expect(evidence.evidence.some((e) => e.toLowerCase().includes('administered sql databases'))).toBe(true);
    expect(evidence.source).toContain('Work Experience');
  });

  // 2. Full-Stack Web Development -> Strong/Direct Evidence
  it('2. finds strong/direct evidence for Full-Stack Web Development', () => {
    const evidence = evaluateSkillEvidence(
      'Full-Stack Web Development',
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('STRONG_MATCH');
    expect(evidence.score).toBe(1.0);
    expect(evidence.evidence.length).toBeGreaterThan(0);
    expect(evidence.evidence.some((e) => e.toLowerCase().includes('full-stack hr web applications'))).toBe(true);
    expect(evidence.source).toContain('Work Experience');
  });

  // 3. Business Process Automation -> Strong/Direct Evidence
  it('3. finds strong/direct evidence for Business Process Automation', () => {
    const evidence = evaluateSkillEvidence(
      'Business Process Automation',
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('STRONG_MATCH');
    expect(evidence.score).toBe(1.0);
    expect(evidence.evidence.length).toBeGreaterThan(0);
    expect(evidence.evidence.some((e) => e.toLowerCase().includes('automated workflows'))).toBe(true);
    expect(evidence.source).toContain('Work Experience');
  });

  // 4. SOLID Principles -> Match ONLY if explicitly present in the CV
  it('4. returns NO_EVIDENCE for SOLID Principles when absent from CV (developer title alone does NOT prove it)', () => {
    const evidence = evaluateSkillEvidence(
      'SOLID Principles',
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('NO_EVIDENCE');
    expect(evidence.confidence).toBe('none');
    expect(evidence.score).toBe(0.0);
    expect(evidence.reason).toContain('Engineering concept requires explicit or strongly defensible evidence');

    // Test with updated CV containing explicit SOLID mention
    const candidateWithSolid: CandidateMatchProfile = {
      ...hrisCandidate,
      skills: [...(hrisCandidate.skills || []), 'SOLID Principles'],
    };
    const evidenceWithSolid = evaluateSkillEvidence(
      'SOLID Principles',
      'required',
      candidateWithSolid,
    );
    expect(evidenceWithSolid.matchLevel).toBe('STRONG_MATCH');
    expect(evidenceWithSolid.score).toBe(1.0);
  });

  // 5. Design Patterns -> Match ONLY if explicitly present in the CV
  it('5. returns NO_EVIDENCE for Design Patterns when absent from CV', () => {
    const evidence = evaluateSkillEvidence(
      'Design Patterns',
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('NO_EVIDENCE');
    expect(evidence.confidence).toBe('none');
    expect(evidence.score).toBe(0.0);

    // Test with updated CV containing explicit Design Patterns mention
    const candidateWithPatterns: CandidateMatchProfile = {
      ...hrisCandidate,
      workHistory: [
        {
          jobTitle: 'HRIS Developer',
          organization: 'Northwind Health Group',
          description: 'Applied Gang of Four Design Patterns (Factory, Strategy, Observer) in core HRIS services.',
        },
      ],
      responsibilities: [
        'Applied Gang of Four Design Patterns (Factory, Strategy, Observer) in core HRIS services.',
      ],
    };
    const evidenceWithPatterns = evaluateSkillEvidence(
      'Design Patterns',
      'required',
      candidateWithPatterns,
    );
    expect(evidenceWithPatterns.matchLevel).toBe('STRONG_MATCH');
    expect(evidenceWithPatterns.score).toBe(1.0);
  });

  // 6. OOP -> Match ONLY if explicitly present in the CV
  it('6. returns NO_EVIDENCE for OOP when absent from CV', () => {
    const evidence = evaluateSkillEvidence(
      'OOP',
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('NO_EVIDENCE');
    expect(evidence.confidence).toBe('none');
    expect(evidence.score).toBe(0.0);

    // Test with updated CV containing explicit OOP mention
    const candidateWithOop: CandidateMatchProfile = {
      ...hrisCandidate,
      skills: [...(hrisCandidate.skills || []), 'Object-Oriented Programming (OOP)'],
    };
    const evidenceWithOop = evaluateSkillEvidence(
      'OOP',
      'required',
      candidateWithOop,
    );
    expect(evidenceWithOop.matchLevel).toBe('STRONG_MATCH');
    expect(evidenceWithOop.score).toBe(1.0);
  });

  // 7. Microsoft Power Platform or similar automation tools
  // -> Do NOT claim a full match merely because Power BI exists. Evaluate actual automation-tool evidence.
  it('7. evaluates actual automation-tool evidence and does NOT claim full match merely because Power BI exists', () => {
    const evidence = evaluateSkillEvidence(
      'Microsoft Power Platform or similar automation tools',
      'required',
      hrisCandidate,
    );

    // Must NOT be STRONG_MATCH or MATCH merely from Power BI
    expect(evidence.matchLevel).not.toBe('STRONG_MATCH');
    expect(evidence.score).toBeLessThanOrEqual(0.25);
    expect(evidence.reason).toContain('Power BI demonstrated, but lacks Power Automate / Power Apps process automation evidence');

    // When actual Power Platform automation tools are present, it matches
    const candidateWithPowerApps: CandidateMatchProfile = {
      ...hrisCandidate,
      skills: [...(hrisCandidate.skills || []), 'Power Apps', 'Power Automate'],
      responsibilities: [
        ...(hrisCandidate.responsibilities || []),
        'Built automated approval workflows using Power Automate flows and Power Apps.',
      ],
    };
    const evidenceWithPowerApps = evaluateSkillEvidence(
      'Microsoft Power Platform or similar automation tools',
      'required',
      candidateWithPowerApps,
    );
    expect(evidenceWithPowerApps.matchLevel).toBe('STRONG_MATCH');
    expect(evidenceWithPowerApps.score).toBe(1.0);
  });

  // 8. Bachelor's degree in CS / IS / Software Engineering or related field
  // -> Do NOT assume the degree field if the CV does not state it.
  it('8. verifies degree major and does NOT assume CS/IS/Software Engineering if unstated in CV', () => {
    // Karim has explicit Computer Science major
    const evidence = evaluateSkillEvidence(
      "Bachelor's degree in CS / IS / Software Engineering or related field",
      'required',
      hrisCandidate,
    );

    expect(evidence.matchLevel).toBe('STRONG_MATCH');
    expect(evidence.score).toBe(1.0);
    expect(evidence.source).toBe('Education');

    // Candidate with unstated field (e.g. "Bachelor's Degree, Nile Delta University")
    const candidateUnstatedMajor: CandidateMatchProfile = {
      ...hrisCandidate,
      education: "Bachelor's Degree, Nile Delta University",
      educationHistory: [
        {
          degree: "Bachelor's Degree",
          organization: 'Nile Delta University',
        },
      ],
    };

    const evidenceUnstated = evaluateSkillEvidence(
      "Bachelor's degree in CS / IS / Software Engineering or related field",
      'required',
      candidateUnstatedMajor,
    );

    // Must NOT be STRONG_MATCH because field is unstated
    expect(evidenceUnstated.matchLevel).toBe('PARTIAL_MATCH');
    expect(evidenceUnstated.score).toBe(0.5);
    expect(evidenceUnstated.reason).toContain('field of study is not stated');

    // Candidate with completely unrelated degree (e.g. Bachelor of Arts in Philosophy)
    const candidateUnrelatedMajor: CandidateMatchProfile = {
      ...hrisCandidate,
      education: 'Bachelor of Arts in Philosophy',
      educationHistory: [
        {
          degree: 'Bachelor of Arts',
          major: 'Philosophy',
          organization: 'Nile Delta University',
        },
      ],
    };

    const evidenceUnrelated = evaluateSkillEvidence(
      "Bachelor's degree in CS / IS / Software Engineering or related field",
      'required',
      candidateUnrelatedMajor,
    );
    expect(evidenceUnrelated.matchLevel).toBe('NO_EVIDENCE');
    expect(evidenceUnrelated.score).toBe(0.0);
  });

  // Full Scorecard Integration Test against HR Systems Specialist JD
  it('evaluates full HR Systems Specialist JD requirement-by-requirement', () => {
    const hrisJdRequirements: PositionRequirements = {
      requiredSkills: [
        'SQL Database Development & Administration',
        'Full-Stack Web Development',
        'Business Process Automation',
        'SOLID Principles',
        'Design Patterns',
        'OOP',
        'Microsoft Power Platform or similar automation tools',
        "Bachelor's degree in CS / IS / Software Engineering or related field",
      ],
      preferredSkills: ['TypeScript', 'Tailwind CSS'],
      minExperienceYears: 4,
      location: 'Cairo, Egypt',
    };

    const result = calculateCandidateFitScore(hrisCandidate, hrisJdRequirements);

    expect(result.breakdown.skills.evidenceItems).toBeDefined();
    const items = result.breakdown.skills.evidenceItems || [];

    // Check individual criteria results
    const sqlItem = items.find((i) => i.skill === 'SQL Database Development & Administration');
    expect(sqlItem?.matchLevel).toBe('STRONG_MATCH');
    expect(sqlItem?.score).toBe(1.0);

    const fullStackItem = items.find((i) => i.skill === 'Full-Stack Web Development');
    expect(fullStackItem?.matchLevel).toBe('STRONG_MATCH');
    expect(fullStackItem?.score).toBe(1.0);

    const bpaItem = items.find((i) => i.skill === 'Business Process Automation');
    expect(bpaItem?.matchLevel).toBe('STRONG_MATCH');
    expect(bpaItem?.score).toBe(1.0);

    const solidItem = items.find((i) => i.skill === 'SOLID Principles');
    expect(solidItem?.matchLevel).toBe('NO_EVIDENCE');
    expect(solidItem?.score).toBe(0.0);

    const dpItem = items.find((i) => i.skill === 'Design Patterns');
    expect(dpItem?.matchLevel).toBe('NO_EVIDENCE');
    expect(dpItem?.score).toBe(0.0);

    const oopItem = items.find((i) => i.skill === 'OOP');
    expect(oopItem?.matchLevel).toBe('NO_EVIDENCE');
    expect(oopItem?.score).toBe(0.0);

    const powerPlatformItem = items.find((i) => i.skill === 'Microsoft Power Platform or similar automation tools');
    expect(powerPlatformItem?.matchLevel).toBe('WEAK_EVIDENCE');
    expect(powerPlatformItem?.score).toBe(0.25);

    const degreeItem = items.find((i) => i.skill === "Bachelor's degree in CS / IS / Software Engineering or related field");
    expect(degreeItem?.matchLevel).toBe('STRONG_MATCH');
    expect(degreeItem?.score).toBe(1.0);

    // Preferred skills match cleanly
    const tsItem = items.find((i) => i.skill === 'TypeScript');
    expect(tsItem?.matchLevel).toBe('STRONG_MATCH');
    expect(tsItem?.category).toBe('preferred');

    // Experience requirement met (5 yrs vs 4 required)
    expect(result.breakdown.experience.met).toBe(true);
    expect(result.breakdown.location.met).toBe(true);
  });
});
