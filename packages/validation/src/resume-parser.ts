import type { ExtractedCandidate } from '@recruitflow/contracts';
import { detectClinicalDomain, generateAISummary } from './sgh-enrichment.ts';

export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
export const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{3,4})?|\+?\d{8,15}/;

export const HEADER_BLACKLIST = [
  'curriculum vitae',
  'resume',
  'cv',
  'profile',
  'profile summary',
  'biodata',
  'personal details',
  'contact information',
  'contact details',
  'professional summary',
  'career objective',
  'objective',
  'work experience',
  'work history',
  'experience',
  'education',
  'skills',
  'technical skills',
  'languages',
  'certifications',
];

export const KNOWN_TITLES = [
  // Clinical Physicians & Consultants (SGH Medical)
  'Consultant Cardiologist', 'Specialist Cardiologist', 'Interventional Cardiologist',
  'Consultant Orthopedic Surgeon', 'Specialist Orthopedic Surgeon', 'Orthopedic Surgeon',
  'Consultant Pediatrician', 'Specialist Pediatrician', 'Pediatric Intensive Care Specialist',
  'Consultant Dermatologist', 'Specialist Dermatologist',
  'Consultant Anesthesiologist', 'Specialist Anesthesiologist',
  'Consultant Radiologist', 'Specialist Radiologist', 'Diagnostic Radiologist',
  'Consultant Oncologist', 'Medical Oncologist', 'Surgical Oncologist',
  'Consultant Neurologist', 'Consultant Neurosurgeon',
  'Consultant Obstetrician & Gynecologist', 'Specialist OB/GYN', 'Obstetrician', 'Gynecologist',
  'Consultant General Surgeon', 'General Surgeon', 'Laparoscopic Surgeon',
  'Consultant Emergency Medicine', 'Emergency Physician', 'Trauma Specialist',
  'Consultant Internist', 'Specialist Internal Medicine', 'Endocrinologist', 'Gastroenterologist', 'Nephrologist',
  'Resident Doctor', 'Medical Officer', 'General Practitioner', 'Chief Medical Officer', 'Medical Director',
  // Nursing & Clinical Care
  'Head Nurse', 'Charge Nurse', 'Staff Nurse (ICU)', 'Staff Nurse (OR)', 'Staff Nurse (ER)',
  'Staff Nurse (NICU)', 'Staff Nurse', 'Registered Nurse', 'Clinical Nurse Specialist', 'Nurse Supervisor',
  // Pharmacy & Allied Health
  'Clinical Pharmacist', 'Hospital Pharmacist', 'Pharmacy Director', 'Pharmacovigilance Officer',
  'Medical Laboratory Scientist', 'Clinical Pathologist', 'Histotechnologist', 'Phlebotomist',
  'Infection Control Officer', 'Quality & Patient Safety Director', 'Healthcare Administrator',
  'Health Informatics Specialist', 'Clinical Systems Analyst',
  // Technology & Analytics
  'HRIS Developer', 'HRIS Performance Specialist', 'HR Systems Specialist',
  'Data Analyst', 'Senior Data Analyst', 'Lead Data Analyst', 'Business Intelligence Analyst',
  'BI Developer', 'Data Engineer', 'Senior Data Engineer', 'Data Scientist', 'Machine Learning Engineer',
  'Software Engineer', 'Senior Software Engineer', 'Full Stack Developer', 'Full Stack Engineer',
  'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'Cloud Architect', 'Solutions Architect',
  'Product Manager', 'Project Manager', 'Technical Project Manager', 'Scrum Master',
  'QA Engineer', 'Quality Assurance Analyst', 'Automation Tester',
  // Administration & Business
  'Accountant', 'Senior Accountant', 'Financial Analyst', 'Auditor', 'Finance Manager',
  'HR Specialist', 'Recruiter', 'Talent Acquisition Specialist', 'HR Manager',
  'Operations Manager', 'Business Analyst', 'Marketing Specialist', 'Content Creator',
  'Sales Executive', 'Account Manager', 'Customer Success Manager', 'System Administrator',
  'Network Engineer', 'Security Engineer', 'Cybersecurity Analyst', 'Database Administrator',
];

export const FILE_NAME_NOISE = /\b(?:cv|resume|curriculum vitae|profile|biodata|applicant|candidate|document|doc|pdf|final|draft|updated|copy|version|v\d+)\b/gi;
export const ROLE_WORDS = new Set([
  'analyst', 'architect', 'assistant', 'accountant', 'coordinator', 'consultant', 'developer', 'director',
  'engineer', 'executive', 'intern', 'manager', 'nurse', 'officer', 'physician', 'recruiter', 'scientist',
  'specialist', 'supervisor', 'surgeon', 'technician', 'administrator', 'lead', 'senior', 'junior',
]);
export const TITLE_LEAD_WORDS = new Set([
  'data', 'software', 'project', 'business', 'financial', 'marketing', 'technical', 'clinical',
  'quality', 'network', 'system', 'systems', 'machine', 'registered', 'general', 'staff', 'full', 'front',
  'back', 'chief', 'medical', 'seo', 'senior', 'junior', 'lead', 'hr', 'hris',
]);

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeRoleWord(value: string): string {
  return value.toLowerCase().replace(/[.’'()]/g, '');
}

export function normalizeNameText(value: string): string {
  return value
    .replace(/[_|•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripKnownTitleFromName(value: string): string {
  let cleaned = normalizeNameText(value);
  const titleList = [...KNOWN_TITLES].sort((a, b) => b.length - a.length);
  for (const title of titleList) {
    const titlePattern = new RegExp(
      `(?:^|[\\s,:;()\\[\\]\\-])${escapeRegExp(title)}(?=$|[\\s,:;()\\[\\]\\-])`,
      'giu',
    );
    cleaned = cleaned.replace(titlePattern, ' ');
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  const roleIndex = words.findIndex((word, index) => index >= 2 && ROLE_WORDS.has(normalizeRoleWord(word)));
  if (roleIndex >= 2) {
    const prevWord = words[roleIndex - 1];
    const previousWord = prevWord ? normalizeRoleWord(prevWord) : '';
    const suffixStart = TITLE_LEAD_WORDS.has(previousWord) ? roleIndex - 1 : roleIndex;
    cleaned = words.slice(0, suffixStart).join(' ');
  }
  return normalizeNameText(cleaned);
}

export function stripLeadingJobTitle(value: string): string {
  let cleaned = normalizeNameText(value);
  const titleList = [...KNOWN_TITLES].sort((a, b) => b.length - a.length);
  for (const title of titleList) {
    const titlePattern = new RegExp(`^${escapeRegExp(title)}(?:$|[\\s,:;()\\[\\]\\-|])`, 'iu');
    if (titlePattern.test(cleaned)) {
      cleaned = cleaned.replace(titlePattern, '').trim();
      return cleaned;
    }
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  let index = 0;
  let hasRole = false;
  while (index < words.length) {
    const normalized = normalizeRoleWord(words[index] || '');
    if (ROLE_WORDS.has(normalized)) {
      hasRole = true;
      index += 1;
      continue;
    }
    if (TITLE_LEAD_WORDS.has(normalized) && index < 3) {
      index += 1;
      continue;
    }
    break;
  }
  return hasRole && words.length - index >= 2 ? words.slice(index).join(' ') : cleaned;
}

export function truncateNameAtKnownTitle(value: string): string {
  const normalized = normalizeNameText(value);
  const titleList = [...KNOWN_TITLES].sort((a, b) => b.length - a.length);
  for (const title of titleList) {
    const titlePattern = new RegExp(
      `(?:^|[\\s,:;()\\[\\]\\-])${escapeRegExp(title)}(?=$|[\\s,:;()\\[\\]\\-])`,
      'iu',
    );
    const match = normalized.match(titlePattern);
    if (match?.index !== undefined) {
      return normalized.slice(0, match.index).replace(/[\\s,;:()-]+$/g, '').trim();
    }
  }
  return normalized;
}

export function isLikelyPersonName(value: string): boolean {
  const cleaned = normalizeNameText(value)
    .replace(/^[\s,;:()-]+|[\s,;:()-]+$/g, '')
    .trim();
  if (!cleaned || cleaned.length < 4 || cleaned.length > 80) return false;
  if (/[\d@]/.test(cleaned)) return false;
  const lower = cleaned.toLowerCase();
  if (HEADER_BLACKLIST.some((header) => lower === header || lower.startsWith(`${header}:`))) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (words.some((word) => !/^\p{L}[\p{L}\p{M}'’-]*$/u.test(word))) return false;
  const roleWordCount = words.filter((word) => ROLE_WORDS.has(normalizeRoleWord(word))).length;
  return roleWordCount === 0;
}

export function extractNameCandidate(line: string): string | undefined {
  const explicitMatch = line.match(/(?:name|candidate|full name)\s*[:|-]\s*(.+)$/iu);
  const source = explicitMatch?.[1] || line;
  const cleaned = stripKnownTitleFromName(truncateNameAtKnownTitle(stripLeadingJobTitle(source)))
    .replace(FILE_NAME_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(?:dr|doctor|prof|professor|eng|nurse|mr|mrs|ms)\b\.?\s*/iu, '')
    .replace(/^[\s,;:()-]+|[\s,;:()-]+$/g, '')
    .trim();
  return isLikelyPersonName(cleaned) ? cleaned : undefined;
}

export const KNOWN_SKILLS = [
  // 1. Healthcare & Clinical - Cardiology & Vascular
  'cardiology', 'interventional cardiology', 'echocardiography', 'cardiac catheterization',
  'electrophysiology', 'ecg', 'ekg', 'stress testing', 'hemodynamics', 'cardiac pacing', 'angioplasty',
  // 2. Critical Care, ICU & Emergency
  'critical care', 'intensive care unit', 'icu', 'nicu', 'picu', 'ventilator management',
  'mechanical ventilation', 'hemodynamic monitoring', 'arterial line insertion', 'central venous catheter',
  'advanced airway management', 'endotracheal intubation', 'cpr', 'bls', 'acls', 'atls', 'pals', 'nrp',
  'emergency triage', 'trauma resuscitation', 'sepsis management', 'code blue response', 'patient care',
  // 3. Surgery & Perioperative Care
  'general surgery', 'laparoscopic surgery', 'minimally invasive surgery', 'orthopedic surgery',
  'arthroscopy', 'joint replacement', 'trauma surgery', 'pre-operative assessment', 'post-operative care',
  'or protocol', 'operating room management', 'sterile technique', 'surgical scrubbing',
  // 4. Dermatology & Aesthetic Medicine
  'clinical dermatology', 'cosmetic dermatology', 'laser therapy', 'skin biopsy', 'cryotherapy',
  'dermoscopy', 'phototherapy', 'botox & dermal fillers', 'cosmetic injectables',
  // 5. Pediatrics & Women\'s Health
  'pediatrics', 'neonatology', 'pediatric intensive care', 'child immunization',
  'developmental assessment', 'obstetrics', 'gynecology', 'labor & delivery', 'c-section',
  'fetal heart monitoring', 'antenatal care', 'pelvic ultrasound',
  // 6. Diagnostic Radiology & Imaging
  'radiology', 'mri', 'ct scan', 'computed tomography', 'diagnostic ultrasound', 'x-ray',
  'fluoroscopy', 'mammography', 'interventional radiology', 'pacs', 'ris', 'dicom',
  // 7. Pharmacy & Therapeutics
  'clinical pharmacy', 'pharmacotherapy', 'pharmacovigilance', 'total parenteral nutrition', 'tpn',
  'antimicrobial stewardship', 'adverse drug reactions', 'chemotherapy preparation', 'iv admixture', 'pharmacology',
  // 8. Laboratory & Pathology
  'clinical pathology', 'histopathology', 'hematology', 'blood banking', 'transfusion medicine',
  'microbiology', 'molecular diagnostics', 'pcr testing', 'flow cytometry', 'elisa', 'phlebotomy',
  // 9. Healthcare Quality, Accreditation & Systems
  'jci accreditation', 'joint commission international', 'cbahi', 'saudi moh regulations',
  'patient safety goals', 'ipsg', 'infection control', 'root cause analysis', 'clinical audit',
  'healthcare quality management', 'cphq', 'electronic health records', 'ehr', 'emr', 'epic systems', 'cerner',
  'medical terminology', 'medical billing', 'icd-10', 'hipaa', 'healthcare management',
  // 10. Data & BI
  'sql', 'python', 'r', 'power bi', 'tableau', 'excel', 'advanced excel', 'dax', 'power query',
  'data visualization', 'data modeling', 'etl', 'data warehousing', 'pandas', 'numpy', 'scikit-learn',
  'machine learning', 'deep learning', 'bigquery', 'snowflake', 'databricks', 'statistics',
  'business intelligence', 'data analysis', 'predictive modeling', 'statistical analysis',
  // 11. Software Engineering
  'javascript', 'typescript', 'react', 'react.js', 'next.js', 'vue', 'angular', 'node.js', 'express',
  'nest.js', 'java', 'spring boot', 'c#', '.net', 'asp.net', 'c++', 'go', 'golang', 'rust', 'php',
  'laravel', 'ruby', 'ruby on rails', 'html', 'html5', 'css', 'css3', 'tailwind css', 'sass',
  'graphql', 'rest api', 'soap', 'microservices', 'websocket',
  'solid principles', 'design patterns', 'object-oriented programming', 'oop',
  // 12. Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'google cloud', 'gcp', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'linux', 'bash', 'powershell',
  'nginx', 'apache', 'ansible',
  // 13. Databases
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sql server',
  'cassandra', 'dynamodb', 'sqlite', 'prisma', 'typeorm', 'hibernate',
  // 14. Management & Methodologies
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'pmp', 'prince2', 'lean', 'six sigma',
  'stakeholder management', 'cross-functional leadership', 'budgeting', 'risk management',
  'strategic planning', 'vendor management',
  // 15. Business & Finance
  'financial modeling', 'sap', 'oracle erp', 'quickbooks', 'ifrs', 'gaap', 'taxation',
  'auditing', 'budget forecasting', 'kpi reporting', 'cost accounting', 'variance analysis',
];

export const KNOWN_CERTIFICATIONS_LIST = [
  'SCFHS Consultant License', 'SCFHS Specialist License', 'SCFHS Registered Nurse', 'SCFHS Pharmacist',
  'Saudi Commission for Health Specialties (SCFHS)', 'SCFHS Verified',
  'American Board Certified', 'Arab Board of Health Specializations',
  'Fellow of the Royal College of Surgeons (FRCS)', 'Member of the Royal College of Physicians (MRCP)',
  'Basic Life Support (BLS)', 'Advanced Cardiac Life Support (ACLS)',
  'Pediatric Advanced Life Support (PALS)', 'Advanced Trauma Life Support (ATLS)',
  'Neonatal Resuscitation Program (NRP)', 'Certified Professional in Healthcare Quality (CPHQ)',
  'Certified in Infection Control (CIC)', 'JCI Quality Certified', 'Lean Six Sigma Black Belt',
  'PMP', 'Scrum Master', 'AWS Certified Solutions Architect', 'Microsoft Certified',
];

export const KNOWN_LANGUAGES = [
  'Arabic', 'English', 'French', 'German', 'Spanish', 'Mandarin', 'Hindi', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'Turkish', 'Italian', 'Korean', 'Urdu', 'Dutch',
];

export const KNOWN_CITIES = [
  'Cairo', 'Alexandria', 'Giza', 'Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Mecca', 'Medina',
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Doha', 'Kuwait City', 'Manama', 'Muscat', 'Amman', 'Beirut',
  'London', 'New York', 'Toronto', 'Berlin', 'Paris', 'Amsterdam', 'Singapore', 'Sydney', 'Melbourne', 'Istanbul',
];

export const KNOWN_COUNTRIES = [
  'Egypt', 'Saudi Arabia', 'KSA', 'United Arab Emirates', 'UAE', 'Qatar', 'Kuwait', 'Bahrain',
  'Oman', 'Jordan', 'Lebanon', 'United Kingdom', 'UK', 'United States', 'USA', 'Canada',
  'Germany', 'France', 'Australia', 'Turkey', 'India', 'Pakistan',
];

/**
 * Parse structured candidate information from document raw text
 */
export function extractCandidateFromText(text: string, fallbackFileName: string): ExtractedCandidate {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const textLower = text.toLowerCase();

  // 1. Extract Email
  const emailMatch = text.match(EMAIL_REGEX);
  const email = emailMatch ? emailMatch[0].trim().toLowerCase() : undefined;

  // 2. Extract Phone
  const phoneMatch = text.match(PHONE_REGEX);
  let phone = phoneMatch ? phoneMatch[0].trim() : undefined;
  if (phone && phone.length < 7) phone = undefined;

  // 3. Extract Name from top lines
  const nameCandidates: string[] = [];
  for (const line of lines.slice(0, 20)) {
    const lower = line.toLowerCase();
    const isHeader = HEADER_BLACKLIST.some((b) => lower === b || lower.startsWith(`${b}:`) || lower.startsWith(`${b} -`));
    if (isHeader) continue;

    // A labelled name can share a contact line; inspect it before skipping email/phone lines.
    const labelledName = extractNameCandidate(line);
    if (labelledName && /(?:name|candidate|full name)\s*[:|-]/iu.test(line)) {
      nameCandidates.push(labelledName);
      break;
    }

    if (lower.includes('@') || lower.includes('phone:') || lower.includes('email:') || lower.includes('http')) continue;

    const candidate = extractNameCandidate(line);
    if (candidate) {
      nameCandidates.push(candidate);
      break;
    }
  }

  const fileNameCandidate = extractNameCandidate(
    fallbackFileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
  );
  let fullName = nameCandidates[0] || fileNameCandidate || 'Candidate Profile';

  fullName = fullName.replace(/^(?:dr|doctor|prof|professor|eng|nurse|mr|mrs|ms)\b\.?\s*/iu, '').trim();

  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Candidate';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Applicant';

  // 4. Extract Job Title / Position
  let title: string | undefined;
  // Check from top lines (first 15 lines)
  for (const line of lines.slice(0, 15)) {
    const lower = line.toLowerCase();
    const matchedKnown = KNOWN_TITLES.find((t) => {
      const tLow = t.toLowerCase();
      return (
        lower === tLow ||
        lower.startsWith(`${tLow} `) ||
        lower.startsWith(`${tLow}|`) ||
        lower.startsWith(`${tLow} -`) ||
        lower.includes(` ${tLow} `) ||
        lower.includes(` ${tLow}|`) ||
        lower.includes(` ${tLow} -`)
      );
    });
    if (matchedKnown) {
      title = matchedKnown;
      break;
    }
    const titlePrefixMatch = line.match(/(?:title|position|role|headline|current role)\s*[:|-]\s*([a-zA-Z\s/&-]+)/i);
    if (titlePrefixMatch?.[1] && titlePrefixMatch[1].trim().length > 2) {
      title = titlePrefixMatch[1].trim();
      break;
    }
  }

  // If still no title, inspect filename for title cues
  if (!title) {
    const fileLower = fallbackFileName.toLowerCase().replace(/[-_]+/g, ' ');
    const matchedFileTitle = KNOWN_TITLES.find((t) => fileLower.includes(t.toLowerCase()));
    if (matchedFileTitle) {
      title = matchedFileTitle;
    }
  }

  // 5. Extract Current / Recent Company
  let currentCompany: string | undefined;

  // First check the EXPERIENCE / WORK EXPERIENCE section
  let inExperience = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const upper = line.toUpperCase();
    if (
      upper === 'EXPERIENCE' ||
      upper === 'WORK EXPERIENCE' ||
      upper === 'PROFESSIONAL EXPERIENCE' ||
      upper === 'WORK HISTORY'
    ) {
      inExperience = true;
      continue;
    }
    if (
      inExperience &&
      (upper === 'EDUCATION' ||
        upper === 'SKILLS' ||
        upper === 'PROJECTS' ||
        upper === 'CERTIFICATIONS' ||
        upper === 'LANGUAGES')
    ) {
      break;
    }

    if (inExperience) {
      const explicitMatch = line.match(/(?:at|company|organization|employer|workplace)\s*[:|-]\s*([a-zA-Z0-9\s&,.-]+)/i);
      if (explicitMatch?.[1] && explicitMatch[1].trim().length >= 3 && explicitMatch[1].trim().length <= 60) {
        currentCompany = explicitMatch[1].trim();
        break;
      }
      if (line.includes('|')) {
        const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          const cleanedPart = part
            .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—to]+\s*(?:Present|Current|Now|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i, '')
            .replace(/\b(?:20\d\d|19\d\d)\s*[-–—to]+\s*(?:Present|Current|Now|20\d\d|19\d\d)/i, '')
            .trim();

          const lowerCleaned = cleanedPart.toLowerCase();
          const lowerName = fullName.toLowerCase();
          const firstNameLower = firstName.toLowerCase();
          const isTitle = KNOWN_TITLES.some((t) => t.toLowerCase() === lowerCleaned);
          const isCityExact = KNOWN_CITIES.some((c) => lowerCleaned === c.toLowerCase() || lowerCleaned.startsWith(`${c.toLowerCase()},`));
          const isCountryExact = KNOWN_COUNTRIES.some((c) => lowerCleaned === c.toLowerCase());

          if (
            cleanedPart.length >= 3 &&
            cleanedPart.length <= 60 &&
            !isTitle &&
            !isCityExact &&
            !isCountryExact &&
            !lowerCleaned.includes(lowerName) &&
            !lowerCleaned.includes(firstNameLower) &&
            !lowerCleaned.includes('official internal title') &&
            !lowerCleaned.includes('phone') &&
            !lowerCleaned.includes('@')
          ) {
            currentCompany = cleanedPart;
            break;
          }
        }
        if (currentCompany) break;
      }
    }
  }

  // Fallback: search anywhere outside experience section if still not found
  if (!currentCompany) {
    for (const line of lines) {
      if (!line) continue;
      const companyMatch = line.match(/(?:at|company|organization|employer|workplace)\s*[:|-]\s*([a-zA-Z0-9\s&,.-]+)/i);
      if (companyMatch?.[1] && companyMatch[1].trim().length >= 3 && companyMatch[1].trim().length <= 60) {
        currentCompany = companyMatch[1].trim();
        break;
      }
      if (line.includes('|')) {
        const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          const cleanedPart = part
            .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—to]+\s*(?:Present|Current|Now|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i, '')
            .replace(/\b(?:20\d\d|19\d\d)\s*[-–—to]+\s*(?:Present|Current|Now|20\d\d|19\d\d)/i, '')
            .trim();

          const lowerCleaned = cleanedPart.toLowerCase();
          const lowerName = fullName.toLowerCase();
          const firstNameLower = firstName.toLowerCase();
          const isTitle = KNOWN_TITLES.some((t) => t.toLowerCase() === lowerCleaned);
          const isCityExact = KNOWN_CITIES.some((c) => lowerCleaned === c.toLowerCase() || lowerCleaned.startsWith(`${c.toLowerCase()},`));
          const isCountryExact = KNOWN_COUNTRIES.some((c) => lowerCleaned === c.toLowerCase());

          if (
            cleanedPart.length >= 3 &&
            cleanedPart.length <= 60 &&
            !isTitle &&
            !isCityExact &&
            !isCountryExact &&
            !lowerCleaned.includes(lowerName) &&
            !lowerCleaned.includes(firstNameLower) &&
            !lowerCleaned.includes('official internal title') &&
            !lowerCleaned.includes('phone') &&
            !lowerCleaned.includes('@')
          ) {
            currentCompany = cleanedPart;
            break;
          }
        }
        if (currentCompany) break;
      }
    }
  }

  // 6. Extract Experience Years
  let experienceYears: number | undefined;
  const expMatch = textLower.match(/(\d+)(?:\+| years?)(?: of)? experience/i) || textLower.match(/experience\s*[:|-]?\s*(\d+)\+?\s*years?/i);
  if (expMatch && expMatch[1]) {
    const parsedExp = parseInt(expMatch[1], 10);
    if (parsedExp > 0 && parsedExp <= 40) experienceYears = parsedExp;
  }

  // If no explicit number, calculate from year spans in text (e.g. 2018 - 2024, 2019 - Present, Jan 2020 – Dec 2021)
  if (experienceYears === undefined) {
    const monthPattern = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*';
    const yearMatches = Array.from(
      text.matchAll(
        new RegExp(
          `(?:${monthPattern})?(19\\d\\d|20\\d\\d)\\s*[-–—to]+\\s*(?:${monthPattern})?(19\\d\\d|20\\d\\d|present|current|now)`,
          'gi',
        ),
      ),
    );
    if (yearMatches.length > 0) {
      let earliestYear = 2026;
      const currentYear = new Date().getFullYear();
      for (const m of yearMatches) {
        const startStr = m[1];
        if (!startStr) continue;
        const start = parseInt(startStr, 10);
        if (start < earliestYear && start >= 1990) {
          earliestYear = start;
        }
      }
      if (earliestYear < currentYear) {
        experienceYears = Math.min(35, currentYear - earliestYear);
      }
    }
  }

  // 7. Extract Location
  let location: string | undefined;
  for (const city of KNOWN_CITIES) {
    if (textLower.includes(city.toLowerCase())) {
      const country = KNOWN_COUNTRIES.find((c) => textLower.includes(c.toLowerCase()));
      location = country ? `${city}, ${country}` : city;
      break;
    }
  }
  if (!location) {
    for (const line of lines.slice(0, 15)) {
      const lower = line.toLowerCase();
      if (lower.startsWith('location:') || lower.startsWith('address:') || lower.startsWith('city:')) {
        const parts = line.split(':');
        if (parts[1]) {
          location = parts[1].trim();
          break;
        }
      }
    }
  }

  // 8. Extract Skills (Dictionary + Dynamic section analysis)
  const skillsSet = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
    if (regex.test(text)) {
      const formatted = skill
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      skillsSet.add(formatted);
    }
  }

  // Dynamic parse from "SKILLS" section
  let inSkillsSection = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === 'skills' || lower === 'technical skills' || lower === 'core competencies' || lower === 'key skills') {
      inSkillsSection = true;
      continue;
    }
    if (inSkillsSection) {
      if (lower.match(/^(experience|education|work history|projects|languages|certifications|references)/)) {
        break;
      }
      const rawSkills = line.split(/[,•|/·\t]+/).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 50);
      for (const s of rawSkills) {
        if (!HEADER_BLACKLIST.some((b) => s.toLowerCase().includes(b))) {
          skillsSet.add(s.charAt(0).toUpperCase() + s.slice(1));
        }
      }
    }
  }

  const skills = Array.from(skillsSet).slice(0, 40);

  // 9. Extract Education
  let education: string | undefined;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.match(/\b(bachelor|master|b\.sc|m\.sc|phd|diploma|bba|mba|degree|faculty of|university|college|institute)\b/i)) {
      if (line.length >= 5 && line.length <= 100 && !lower.includes('experience')) {
        education = line;
        break;
      }
    }
  }

  // 10. Extract Languages
  const languages: string[] = [];
  for (const lang of KNOWN_LANGUAGES) {
    if (textLower.includes(lang.toLowerCase())) {
      languages.push(lang);
    }
  }

  // 11. Extract Certifications (Section parse + Dictionary scan)
  const certSet = new Set<string>();
  let inCertSection = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === 'certifications' || lower === 'certificates' || lower === 'courses & licenses' || lower === 'licenses & credentials') {
      inCertSection = true;
      continue;
    }
    if (inCertSection) {
      if (lower.match(/^(experience|education|skills|projects|languages|work history)/)) {
        break;
      }
      if (line.length > 3 && line.length < 80) certSet.add(line.trim());
    }
  }

  // Scan for known high-value certifications throughout the document
  for (const knownCert of KNOWN_CERTIFICATIONS_LIST) {
    const escaped = knownCert.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
    if (regex.test(text)) {
      certSet.add(knownCert);
    }
  }
  // Check for common acronyms (SCFHS, BLS, ACLS, ATLS, PALS, CPHQ, MRCP, FRCS)
  if (/\bscfhs\b/i.test(text)) certSet.add('SCFHS License / Registration');
  if (/\bacls\b/i.test(text)) certSet.add('ACLS Certified');
  if (/\bbls\b/i.test(text)) certSet.add('BLS Certified');
  if (/\bpals\b/i.test(text)) certSet.add('PALS Certified');
  if (/\batls\b/i.test(text)) certSet.add('ATLS Certified');
  if (/\bcphq\b/i.test(text)) certSet.add('CPHQ Certified');
  if (/\bmrcp\b/i.test(text)) certSet.add('MRCP Credentialed');
  if (/\bfrcs\b/i.test(text)) certSet.add('FRCS Credentialed');

  const certifications = Array.from(certSet).slice(0, 10);

  // 12. Extract Summary / Bio
  let summary: string | undefined;
  let inSummarySection = false;
  const summaryLines: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === 'summary' || lower === 'professional summary' || lower === 'profile' || lower === 'about me' || lower === 'executive summary') {
      inSummarySection = true;
      continue;
    }
    if (inSummarySection) {
      if (lower.match(/^(experience|education|skills|projects|languages|certifications|work history)/)) {
        break;
      }
      summaryLines.push(line);
      if (summaryLines.length >= 4) break;
    }
  }
  if (summaryLines.length > 0) {
    summary = summaryLines.join(' ');
  }

  // 13. Extract Work Experience Responsibilities & Projects
  const responsibilities: string[] = [];
  let inExpSection = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.match(/^(work experience|experience|employment history|work history|professional experience)\b/i)) {
      inExpSection = true;
      continue;
    }
    if (inExpSection) {
      if (lower.match(/^(education|skills|certifications|languages|references|personal details)\b/i)) {
        break;
      }
      const trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('▪') || trimmed.startsWith('*') || (trimmed.length > 20 && trimmed.length < 250)) {
        const cleaned = trimmed.replace(/^[•▪*–—\s-]+/, '').trim();
        if (cleaned.length >= 20 && !responsibilities.includes(cleaned)) {
          responsibilities.push(cleaned);
          if (responsibilities.length >= 20) break;
        }
      }
    }
  }

  // 14. Clinical Subspecialty & Domain Detection
  const { domain: clinicalDomain, subspecialties, confidence: aiSummaryConfidence, keyHighlights } =
    detectClinicalDomain(skills, title, certifications, text, experienceYears ?? 0);

  // 15. Auto-generate AI Summary if missing or too brief
  const finalTitle = title || undefined;
  if (!summary || summary.trim().length < 40) {
    summary = generateAISummary({
      firstName,
      lastName,
      title: finalTitle,
      experienceYears,
      clinicalDomain,
      subspecialties,
      skills,
      certifications,
      education,
      currentCompany,
    });
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    title: finalTitle,
    currentCompany,
    experienceYears,
    location,
    skills,
    education,
    languages: languages.length > 0 ? languages : [],
    certifications,
    summary,
    clinicalDomain,
    subspecialties,
    aiSummaryConfidence,
    keyHighlights,
    responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
    rawText: text.slice(0, 25000),
    parserSource: 'legacy',
    parsingQuality: firstName && lastName && (email || phone) ? 'medium' : 'low',
  };
}
