export interface ExtractedCandidate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  currentCompany?: string;
  rawText?: string;
  skills?: string[];
  experienceYears?: number;
  location?: string;
  education?: string;
  certifications?: string[];
  languages?: string[];
  summary?: string;
  clinicalDomain?: string;
  subspecialties?: string[];
  aiSummaryConfidence?: number;
  keyHighlights?: string[];
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{3,4})?|\+?\d{8,15}/;

const HEADER_BLACKLIST = [
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

const KNOWN_TITLES = [
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

const FILE_NAME_NOISE = /\b(?:cv|resume|curriculum vitae|profile|biodata|applicant|candidate|document|doc|pdf|final|draft|updated|copy|version|v\d+)\b/gi;
const ROLE_WORDS = new Set([
  'analyst', 'architect', 'assistant', 'accountant', 'coordinator', 'consultant', 'developer', 'director',
  'engineer', 'executive', 'intern', 'manager', 'nurse', 'officer', 'physician', 'recruiter', 'scientist',
  'specialist', 'supervisor', 'surgeon', 'technician', 'administrator', 'lead', 'senior', 'junior',
]);
const TITLE_LEAD_WORDS = new Set([
  'data', 'software', 'project', 'business', 'financial', 'marketing', 'technical', 'clinical',
  'quality', 'network', 'system', 'machine', 'registered', 'general', 'staff', 'full', 'front',
  'back', 'chief', 'medical', 'seo', 'senior', 'junior', 'lead',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeRoleWord(value: string): string {
  return value.toLowerCase().replace(/[.’'()]/g, '');
}

function normalizeNameText(value: string): string {
  return value
    .replace(/[_|•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripKnownTitleFromName(value: string): string {
  let cleaned = normalizeNameText(value);
  const titleList = [...KNOWN_TITLES].sort((a, b) => b.length - a.length);
  for (const title of titleList) {
    const titlePattern = new RegExp(
      `(?:^|[\\s,:;()\\[\\]\\-])${escapeRegExp(title)}(?=$|[\\s,:;()\\[\\]\\-])`,
      'giu',
    );
    cleaned = cleaned.replace(titlePattern, ' ');
  }

  // Catch titles outside the curated dictionary, such as "Senior SEO Specialist".
  // Once a role word appears after at least two name tokens, treat the trailing phrase
  // as a title and keep the preceding person name.
  const words = cleaned.split(/\s+/).filter(Boolean);
  const roleIndex = words.findIndex((word, index) => index >= 2 && ROLE_WORDS.has(normalizeRoleWord(word)));
  if (roleIndex >= 2) {
    const previousWord = normalizeRoleWord(words[roleIndex - 1]);
    const suffixStart = TITLE_LEAD_WORDS.has(previousWord) ? roleIndex - 1 : roleIndex;
    cleaned = words.slice(0, suffixStart).join(' ');
  }
  return normalizeNameText(cleaned);
}

function stripLeadingJobTitle(value: string): string {
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

function truncateNameAtKnownTitle(value: string): string {
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

function isLikelyPersonName(value: string): boolean {
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

function extractNameCandidate(line: string): string | undefined {
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

const KNOWN_SKILLS = [
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

const KNOWN_CERTIFICATIONS_LIST = [
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

const KNOWN_LANGUAGES = [
  'Arabic', 'English', 'French', 'German', 'Spanish', 'Mandarin', 'Hindi', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'Turkish', 'Italian', 'Korean', 'Urdu', 'Dutch',
];

const KNOWN_CITIES = [
  'Cairo', 'Alexandria', 'Giza', 'Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Mecca', 'Medina',
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Doha', 'Kuwait City', 'Manama', 'Muscat', 'Amman', 'Beirut',
  'London', 'New York', 'Toronto', 'Berlin', 'Paris', 'Amsterdam', 'Singapore', 'Sydney', 'Melbourne', 'Istanbul',
];

const KNOWN_COUNTRIES = [
  'Egypt', 'Saudi Arabia', 'KSA', 'United Arab Emirates', 'UAE', 'Qatar', 'Kuwait', 'Bahrain',
  'Oman', 'Jordan', 'Lebanon', 'United Kingdom', 'UK', 'United States', 'USA', 'Canada',
  'Germany', 'France', 'Australia', 'Turkey', 'India', 'Pakistan',
];

/**
 * Extract raw text from PDF ArrayBuffer
 */
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
      } catch {
        // Fallback
      }
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const textPieces: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings: string[] = [];
      for (const item of textContent.items) {
        if ('str' in item && typeof (item as { str: unknown }).str === 'string') {
          pageStrings.push((item as { str: string }).str);
        }
      }
      textPieces.push(pageStrings.join(' '));
    }

    return textPieces.join('\n');
  } catch (error) {
    console.warn('PDF.js extraction failed, attempting stream scan fallback:', error);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(arrayBuffer);
    return text.replace(/[^\x20-\x7E\n\r]/g, ' ');
  }
}

/**
 * Extract raw text from Word (.docx) ArrayBuffer
 */
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default ?? mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.warn('Mammoth docx extraction failed:', error);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(arrayBuffer).replace(/[^\x20-\x7E\n\r]/g, ' ');
  }
}

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
  // Check from top lines (first 12 lines)
  for (const line of lines.slice(0, 12)) {
    const lower = line.toLowerCase();
    const matchedKnown = KNOWN_TITLES.find(t => lower === t.toLowerCase() || lower.includes(t.toLowerCase()));
    if (matchedKnown) {
      title = matchedKnown;
      break;
    }
    const titlePrefixMatch = line.match(/(?:title|position|role|headline|current role)\s*[:|-]\s*([a-zA-Z\s/&-]+)/i);
    if (titlePrefixMatch && titlePrefixMatch[1].trim().length > 2) {
      title = titlePrefixMatch[1].trim();
      break;
    }
  }

  // If still no title, inspect filename for title cues
  if (!title) {
    const fileLower = fallbackFileName.toLowerCase().replace(/[-_]+/g, ' ');
    const matchedFileTitle = KNOWN_TITLES.find(t => fileLower.includes(t.toLowerCase()));
    if (matchedFileTitle) {
      title = matchedFileTitle;
    }
  }

  // 5. Extract Current / Recent Company
  let currentCompany: string | undefined;
  for (const line of lines) {
    const companyMatch = line.match(/(?:at|company|organization|employer|workplace)\s*[:|-]\s*([a-zA-Z0-9\s&,.-]+)/i);
    if (companyMatch && companyMatch[1].trim().length >= 3 && companyMatch[1].trim().length <= 60) {
      currentCompany = companyMatch[1].trim();
      break;
    }
    if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        const normalizedPart = normalizeNameText(part).toLowerCase();
        const normalizedName = normalizeNameText(fullName).toLowerCase();
        const partWithoutTitle = normalizeNameText(
          stripKnownTitleFromName(truncateNameAtKnownTitle(part)),
        ).toLowerCase();
        if (
          !KNOWN_TITLES.some(t => t.toLowerCase() === part.toLowerCase()) &&
          normalizedPart !== normalizedName &&
          partWithoutTitle !== normalizedName &&
          !part.match(/\b(20\d\d|19\d\d|present|current|experience|education|work)\b/i) &&
          part.length >= 3 &&
          part.length <= 50
        ) {
          currentCompany = part;
          break;
        }
      }
      if (currentCompany) break;
    }
  }

  // Some CV templates place the candidate name and title beside the employer field.
  // Do not persist that repeated identity string as an organisation.
  if (currentCompany) {
    const normalizedCompany = normalizeNameText(currentCompany).toLowerCase();
    const normalizedName = normalizeNameText(fullName).toLowerCase();
    const companyWithoutTitle = normalizeNameText(
      stripKnownTitleFromName(truncateNameAtKnownTitle(currentCompany)),
    ).toLowerCase();
    if (normalizedCompany === normalizedName || companyWithoutTitle === normalizedName) {
      currentCompany = undefined;
    }
  }

  // 6. Extract Experience Years
  let experienceYears: number | undefined;
  const expMatch = textLower.match(/(\d+)(?:\+| years?)(?: of)? experience/i) || textLower.match(/experience\s*[:|-]?\s*(\d+)\+?\s*years?/i);
  if (expMatch && expMatch[1]) {
    const parsedExp = parseInt(expMatch[1], 10);
    if (parsedExp > 0 && parsedExp <= 40) experienceYears = parsedExp;
  }

  // If no explicit number, calculate from year spans in text (e.g. 2018 - 2024, 2019 - Present)
  if (experienceYears === undefined) {
    const yearMatches = Array.from(text.matchAll(/\b(200\d|201\d|202[0-6])\s*[-–—to]+\s*(present|current|now|202[0-6])/gi));
    if (yearMatches.length > 0) {
      let earliestYear = 2026;
      const currentYear = new Date().getFullYear();
      for (const m of yearMatches) {
        const start = parseInt(m[1], 10);
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
      const country = KNOWN_COUNTRIES.find(c => textLower.includes(c.toLowerCase()));
      location = country ? `${city}, ${country}` : city;
      break;
    }
  }
  if (!location) {
    for (const line of lines.slice(0, 15)) {
      const lower = line.toLowerCase();
      if (lower.startsWith('location:') || lower.startsWith('address:') || lower.startsWith('city:')) {
        location = line.split(':')[1].trim();
        break;
      }
    }
  }

  // 8. Extract Skills (Dictionary + Dynamic section analysis)
  const skillsSet = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    // Word boundary check to avoid partial false positives
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
    if (regex.test(text)) {
      // Capitalize nicely
      const formatted = skill
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
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
      const rawSkills = line.split(/[,•|/·\t]+/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 30);
      for (const s of rawSkills) {
        if (!HEADER_BLACKLIST.some(b => s.toLowerCase().includes(b))) {
          skillsSet.add(s.charAt(0).toUpperCase() + s.slice(1));
        }
      }
    }
  }

  const skills = Array.from(skillsSet).slice(0, 20);

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

  // 13. Clinical Subspecialty & Domain Detection
  const { domain: clinicalDomain, subspecialties, confidence: aiSummaryConfidence, keyHighlights } =
    detectClinicalDomain(skills, title, certifications, text, experienceYears ?? 0);

  // 14. Auto-generate AI Summary if missing or too brief
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
    rawText: text.slice(0, 3000),
  };
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
): { domain: string; subspecialties: string[]; confidence: number; keyHighlights: string[] } {
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
        domainScores[rule.domain].score += rule.weight;
        if (!domainScores[rule.domain].subspecialties.includes(rule.subspecialty)) {
          domainScores[rule.domain].subspecialties.push(rule.subspecialty);
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
  if (topSubs.length > 0) keyHighlights.push(topSubs[0]);
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
export function generateAISummary(candidate: Partial<ExtractedCandidate>): string {
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

/**
 * Main entrypoint to parse candidate files (PDF & Word)
 */
export async function parseResumeFile(file: File): Promise<ExtractedCandidate> {
  const arrayBuffer = await file.arrayBuffer();
  const fileNameLower = file.name.toLowerCase();
  let text: string;

  if (fileNameLower.endsWith('.pdf')) {
    text = await extractTextFromPdf(arrayBuffer);
  } else if (fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc')) {
    text = await extractTextFromDocx(arrayBuffer);
  } else {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    text = decoder.decode(arrayBuffer);
  }

  return extractCandidateFromText(text, file.name);
}
