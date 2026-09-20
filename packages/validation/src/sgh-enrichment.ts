export interface CandidateSummaryInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  title?: string | null | undefined;
  experienceYears?: number | undefined;
  clinicalDomain?: string | null | undefined;
  subspecialties?: string[] | undefined;
  skills?: string[] | undefined;
  certifications?: string[] | undefined;
  education?: string | null | undefined;
  currentCompany?: string | null | undefined;
}

export interface ClinicalDomainResult {
  domain: string;
  subspecialties: string[];
  confidence: number;
  keyHighlights: string[];
}

/**
 * Intelligent Clinical Domain & Subspecialty Classifier
 */
export function detectClinicalDomain(
  skills: string[],
  title?: string,
  certifications?: string[],
  rawText?: string,
  years = 0,
): ClinicalDomainResult {
  const textCombined = `${title || ''} ${(skills || []).join(' ')} ${(certifications || []).join(' ')} ${rawText || ''}`.toLowerCase();

  const domainScores: Record<string, { score: number; subspecialties: string[] }> = {
    'Cardiovascular Medicine': { score: 0, subspecialties: [] },
    'Critical Care & Emergency Medicine': { score: 0, subspecialties: [] },
    'Surgical Specialties & Perioperative': { score: 0, subspecialties: [] },
    'Dermatology & Aesthetic Medicine': { score: 0, subspecialties: [] },
    'Pediatrics & Neonatology': { score: 0, subspecialties: [] },
    'Diagnostic Radiology & Imaging': { score: 0, subspecialties: [] },
    'Clinical Pharmacy & Therapeutics': { score: 0, subspecialties: [] },
    'Pathology & Laboratory Medicine': { score: 0, subspecialties: [] },
    'Healthcare Quality, Safety & Governance': { score: 0, subspecialties: [] },
    'Nursing & Patient Care': { score: 0, subspecialties: [] },
    'Health Informatics & Software Engineering': { score: 0, subspecialties: [] },
    'Business & Administration': { score: 0, subspecialties: [] },
  };

  // Keyword rules
  const rules: { keywords: string[]; domain: keyof typeof domainScores; subspecialty: string; weight: number }[] = [
    // Cardiology
    { keywords: ['cardio', 'ecg', 'ekg', 'echocardiograph', 'catheterization', 'angioplasty', 'hemodynamics'], domain: 'Cardiovascular Medicine', subspecialty: 'Interventional Cardiology & Hemodynamics', weight: 3 },
    // Critical Care & Emergency
    { keywords: ['icu', 'nicu', 'picu', 'critical care', 'ventilator', 'mechanical ventilation', 'acls', 'atls', 'trauma', 'intubation'], domain: 'Critical Care & Emergency Medicine', subspecialty: 'Intensive Care & Mechanical Ventilation', weight: 3 },
    // Surgery
    { keywords: ['surgery', 'surgeon', 'laparoscop', 'arthroscop', 'operating room', 'perioperative', 'sterile technique'], domain: 'Surgical Specialties & Perioperative', subspecialty: 'Minimally Invasive & General Surgery', weight: 3 },
    // Dermatology
    { keywords: ['dermatol', 'laser therapy', 'skin biopsy', 'cosmetic injectables', 'botox', 'fillers', 'dermoscopy'], domain: 'Dermatology & Aesthetic Medicine', subspecialty: 'Clinical & Procedural Dermatology', weight: 3 },
    // Pediatrics
    { keywords: ['pediatric', 'neonat', 'immunization', 'child care', 'fetal', 'obstetric', 'gynecol'], domain: 'Pediatrics & Neonatology', subspecialty: 'Neonatal & Pediatric Care', weight: 3 },
    // Radiology
    { keywords: ['radiolog', 'mri', 'ct scan', 'ultrasound', 'x-ray', 'pacs', 'dicom', 'mammograph'], domain: 'Diagnostic Radiology & Imaging', subspecialty: 'Advanced Medical Imaging (CT/MRI/Ultrasound)', weight: 3 },
    // Pharmacy
    { keywords: ['pharmac', 'tpn', 'pharmacovigilance', 'chemotherapy preparation', 'iv admixture'], domain: 'Clinical Pharmacy & Therapeutics', subspecialty: 'Clinical Pharmacotherapy & IV Compounding', weight: 3 },
    // Laboratory
    { keywords: ['patholog', 'hematol', 'blood bank', 'microbiol', 'pcr', 'phlebotomy', 'biopsy'], domain: 'Pathology & Laboratory Medicine', subspecialty: 'Diagnostic Pathology & Molecular Testing', weight: 3 },
    // Quality & Governance
    { keywords: ['jci', 'cbahi', 'infection control', 'cphq', 'patient safety', 'clinical audit'], domain: 'Healthcare Quality, Safety & Governance', subspecialty: 'JCI/CBAHI Clinical Accreditation & Safety', weight: 3 },
    // Nursing
    { keywords: ['nurse', 'nursing', 'patient care', 'triage', 'medication administration', 'vital signs'], domain: 'Nursing & Patient Care', subspecialty: 'Inpatient & Acute Nursing Care', weight: 2 },
    // Health Informatics / Tech
    { keywords: ['react', 'typescript', 'software', 'developer', 'frontend', 'backend', 'full stack', 'python', 'sql', 'power bi', 'cloud', 'aws'], domain: 'Health Informatics & Software Engineering', subspecialty: 'Modern Web & Healthcare Digital Systems', weight: 3 },
    // Business
    { keywords: ['accountant', 'finance', 'recruiter', 'hr ', 'audit', 'tax', 'sales', 'marketing'], domain: 'Business & Administration', subspecialty: 'Operations & Corporate Healthcare Support', weight: 2 },
  ];

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (textCombined.includes(kw)) {
        const domainData = domainScores[rule.domain];
        if (domainData) {
          domainData.score += rule.weight;
          if (!domainData.subspecialties.includes(rule.subspecialty)) {
            domainData.subspecialties.push(rule.subspecialty);
          }
        }
      }
    }
  }

  // Find highest scoring domain
  let topDomain = 'General Healthcare Practice';
  let maxScore = 0;
  let topSubs: string[] = [];

  for (const [domain, data] of Object.entries(domainScores)) {
    if (data.score > maxScore) {
      maxScore = data.score;
      topDomain = domain;
      topSubs = data.subspecialties;
    }
  }

  // A title alone is not enough evidence to assign a specialty.
  if (maxScore === 0) {
    topDomain = 'Unclassified';
    topSubs = [];
  }

  // Build Key Highlights
  const keyHighlights: string[] = [];
  if (years > 0) keyHighlights.push(`${years}+ Years Experience`);
  if (textCombined.includes('scfhs')) keyHighlights.push('SCFHS Licensed / Registered');
  if (textCombined.includes('jci') || textCombined.includes('cbahi')) keyHighlights.push('JCI / CBAHI Accreditation');
  if (textCombined.includes('acls') || textCombined.includes('bls')) keyHighlights.push('BLS/ACLS Certified');
  if (topSubs.length > 0 && topSubs[0]) keyHighlights.push(topSubs[0]);
  if (textCombined.includes('arabic') && textCombined.includes('english')) keyHighlights.push('Bilingual (AR / EN)');

  // Confidence reflects evidence in the CV rather than a reassuring floor.
  const evidence = Math.min(100, 35 + maxScore * 5 + (certifications?.length ? 10 : 0) + (years > 0 ? 10 : 0) + (skills.length ? 10 : 0));
  const confidence = maxScore === 0 ? Math.min(55, evidence) : Math.min(98, evidence);

  return {
    domain: topDomain,
    subspecialties: topSubs.slice(0, 4),
    confidence,
    keyHighlights: keyHighlights.slice(0, 5),
  };
}

/**
 * Intelligent AI Executive Summary Synthesis Engine
 * Generates an executive clinical or professional summary reflecting SGH standards.
 */
export function generateAISummary(candidate: CandidateSummaryInput): string {
  const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'The candidate';
  const title = candidate.title?.trim();
  const years = candidate.experienceYears;
  const domain = candidate.clinicalDomain && candidate.clinicalDomain !== 'Unclassified' ? candidate.clinicalDomain : undefined;
  const subspecialties = candidate.subspecialties?.length ? candidate.subspecialties.join(', ') : undefined;
  const topSkills = (candidate.skills || []).slice(0, 4).join(', ');
  const certs = (candidate.certifications || []).slice(0, 3).join(', ');
  const company = candidate.currentCompany?.trim();

  const hasClinicalFocus = Boolean(domain && !domain.includes('Software') && !domain.includes('Business'));
  const experience = years === undefined ? 'experience history not provided' : `${years} year${years === 1 ? '' : 's'} of experience`;
  const identity = title ? `${title} with ${experience}` : experience;
  const organization = company ? ` at ${company}` : '';

  if (hasClinicalFocus) {
    let summaryText = `${fullName} is a ${identity}${organization}${domain ? ` in ${domain}` : ''}`;
    if (subspecialties) {
      summaryText += `, with CV evidence of ${subspecialties}.`;
    } else {
      summaryText += '.';
    }

    if (topSkills) {
      summaryText += ` Demonstrates rigorous clinical proficiency in ${topSkills}.`;
    }

    if (certs) {
      summaryText += ` Credentialed with ${certs}.`;
    }

    return summaryText;
  }

  // Technical / Administrative Track
  let techSummary = `${fullName} is a ${identity}${organization}${domain ? ` in ${domain}` : ''}.`;
  if (topSkills) {
    techSummary += ` Highly skilled in ${topSkills}.`;
  }
  if (certs) {
    techSummary += ` Holds professional credentials including ${certs}.`;
  }
  return techSummary;
}
