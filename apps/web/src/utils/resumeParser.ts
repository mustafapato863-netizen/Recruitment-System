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
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{3,4})?|\+?\d{8,15}/;

const HEADER_BLACKLIST = [
  'curriculum vitae',
  'resume',
  'cv',
  'profile',
  'biodata',
  'personal details',
  'contact information',
  'contact details',
];

const KNOWN_TITLES = [
  'Data Analyst', 'Senior Data Analyst', 'Lead Data Analyst', 'Business Intelligence Analyst',
  'BI Developer', 'Data Engineer', 'Senior Data Engineer', 'Data Scientist', 'Machine Learning Engineer',
  'Software Engineer', 'Senior Software Engineer', 'Full Stack Developer', 'Full Stack Engineer',
  'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'Cloud Architect', 'Solutions Architect',
  'Product Manager', 'Project Manager', 'Technical Project Manager', 'Scrum Master',
  'QA Engineer', 'Quality Assurance Analyst', 'Automation Tester',
  'Registered Nurse', 'Staff Nurse', 'Clinical Specialist', 'Pharmacist', 'Medical Officer',
  'Physician', 'Resident Doctor', 'Healthcare Administrator', 'Medical Director',
  'Accountant', 'Senior Accountant', 'Financial Analyst', 'Auditor', 'Finance Manager',
  'HR Specialist', 'Recruiter', 'Talent Acquisition Specialist', 'HR Manager',
  'Operations Manager', 'Business Analyst', 'Marketing Specialist', 'Content Creator',
  'Sales Executive', 'Account Manager', 'Customer Success Manager', 'System Administrator',
  'Network Engineer', 'Security Engineer', 'Cybersecurity Analyst', 'Database Administrator',
];

const KNOWN_SKILLS = [
  // Data & BI
  'sql', 'python', 'r', 'power bi', 'tableau', 'excel', 'advanced excel', 'dax', 'power query',
  'data visualization', 'data modeling', 'etl', 'data warehousing', 'pandas', 'numpy', 'scikit-learn',
  'machine learning', 'deep learning', 'bigquery', 'snowflake', 'databricks', 'statistics',
  'business intelligence', 'data analysis', 'predictive modeling', 'statistical analysis',
  // Software Engineering
  'javascript', 'typescript', 'react', 'react.js', 'next.js', 'vue', 'angular', 'node.js', 'express',
  'nest.js', 'java', 'spring boot', 'c#', '.net', 'asp.net', 'c++', 'go', 'golang', 'rust', 'php',
  'laravel', 'ruby', 'ruby on rails', 'html', 'html5', 'css', 'css3', 'tailwind css', 'sass',
  'graphql', 'rest api', 'soap', 'microservices', 'websocket',
  // Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'google cloud', 'gcp', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'linux', 'bash', 'powershell',
  'nginx', 'apache', 'ansible',
  // Databases
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sql server',
  'cassandra', 'dynamodb', 'sqlite', 'prisma', 'typeorm', 'hibernate',
  // Healthcare & Clinical
  'patient care', 'electronic health records', 'ehr', 'emr', 'epic', 'cerner', 'clinical research',
  'triage', 'infection control', 'medical terminology', 'bls', 'acls', 'cpr', 'pharmacology',
  'healthcare management', 'medical billing', 'icd-10', 'hipaa',
  // Management & Methodologies
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'pmp', 'prince2', 'lean', 'six sigma',
  'stakeholder management', 'cross-functional leadership', 'budgeting', 'risk management',
  'strategic planning', 'vendor management',
  // Business & Finance
  'financial modeling', 'sap', 'oracle erp', 'quickbooks', 'ifrs', 'gaap', 'taxation',
  'auditing', 'budget forecasting', 'kpi reporting', 'cost accounting', 'variance analysis',
];

const KNOWN_LANGUAGES = [
  'Arabic', 'English', 'French', 'German', 'Spanish', 'Mandarin', 'Hindi', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'Turkish', 'Italian', 'Korean', 'Urdu', 'Dutch',
];

const KNOWN_CITIES = [
  'Cairo', 'Alexandria', 'Giza', 'Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Dubai', 'Abu Dhabi',
  'Sharjah', 'Doha', 'Kuwait City', 'Manama', 'Muscat', 'Amman', 'Beirut', 'London', 'New York',
  'Toronto', 'Berlin', 'Paris', 'Amsterdam', 'Singapore', 'Sydney', 'Melbourne', 'Istanbul',
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
  for (const line of lines.slice(0, 8)) {
    const lower = line.toLowerCase();
    if (HEADER_BLACKLIST.some((b) => lower === b || lower.startsWith(b + ':') || lower.startsWith(b + ' -'))) continue;
    if (lower.includes('@') || lower.includes('phone:') || lower.includes('email:') || lower.includes('http')) {
      const namePrefixMatch = line.match(/(?:name|candidate|full name)\s*[:|-]\s*([a-zA-Z\s]+)/i);
      if (namePrefixMatch && namePrefixMatch[1].trim().length > 2) {
        nameCandidates.push(namePrefixMatch[1].trim());
      }
      continue;
    }
    const cleanLine = line.replace(/[^a-zA-Z\s'-]/g, ' ').trim();
    const words = cleanLine.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4 && cleanLine.length >= 4 && cleanLine.length <= 40) {
      if (!KNOWN_TITLES.some(t => t.toLowerCase() === cleanLine.toLowerCase())) {
        nameCandidates.push(cleanLine);
        break;
      }
    }
  }

  let fullName = nameCandidates[0];
  if (!fullName) {
    fullName = fallbackFileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b(cv|resume|doc|pdf|profile|applicant|v1|v2|final|draft)\b/gi, '')
      .trim();
  }

  const nameParts = (fullName || 'Candidate Profile').split(/\s+/).filter(Boolean);
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
        if (
          !KNOWN_TITLES.some(t => t.toLowerCase() === part.toLowerCase()) &&
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

  // 11. Extract Certifications
  const certifications: string[] = [];
  let inCertSection = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === 'certifications' || lower === 'certificates' || lower === 'courses & licenses') {
      inCertSection = true;
      continue;
    }
    if (inCertSection) {
      if (lower.match(/^(experience|education|skills|projects|languages|work history)/)) {
        break;
      }
      if (line.length > 3 && line.length < 80) certifications.push(line);
    }
  }

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

  return {
    firstName,
    lastName,
    email: email || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@example.com`,
    phone: phone || '+20 100 000 0000',
    title: title || 'Professional',
    currentCompany,
    experienceYears: experienceYears ?? 3,
    location: location || 'Cairo, Egypt',
    skills,
    education: education || 'Bachelor Degree',
    languages: languages.length > 0 ? languages : ['English', 'Arabic'],
    certifications,
    summary,
    rawText: text.slice(0, 3000),
  };
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
