/**
 * Job Description (JD) Document Parser
 * Parses Word (.docx), PDF (.pdf), and Text (.txt) job descriptions into structured specifications.
 */

export interface ParsedJobDescription {
  title: string;
  department: string;
  location: string;
  jobSummary: string;
  minExperienceYears: number;
  requiredSkills: string[];
  qualifications: string;
  responsibilities: string;
  languages: string[];
  rawText: string;
}

/**
 * Extract raw text from Word (.docx) ArrayBuffer using JSZip with mammoth fallback
 */
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const JSZipModule = await import('jszip');
    const JSZip = JSZipModule.default ?? JSZipModule;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const xml = await docXmlFile.async('string');
      const formatted = xml
        .replace(/<w:tab\s*\/?>/g, '\t')
        .replace(/<w:br\s*\/?>/g, '\n')
        .replace(/<\/w:tc>\s*<w:tc[^>]*>/g, ': ')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#160;|&nbsp;/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();
      if (formatted.length > 50) {
        return formatted;
      }
    }
  } catch (error) {
    console.warn('JSZip docx extraction failed, trying mammoth fallback:', error);
  }

  try {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default ?? mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result.value?.trim()) {
      return result.value;
    }
  } catch (error) {
    console.warn('Mammoth docx extraction failed, using fallback stream decode:', error);
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(arrayBuffer).replace(/[^\x20-\x7E\n\r]/g, ' ');
}

/**
 * Extract raw text from PDF ArrayBuffer using pdfjs-dist
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
      let pageText = '';
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (!('str' in item) || typeof (item as { str: unknown }).str !== 'string') continue;
        const textItem = item as { str: string; transform?: number[]; hasEOL?: boolean };
        const currentY = textItem.transform ? textItem.transform[5] : null;

        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 3) {
          pageText += '\n';
        } else if (textItem.hasEOL) {
          pageText += '\n';
        } else if (
          pageText.length > 0 &&
          !pageText.endsWith('\n') &&
          !pageText.endsWith(' ') &&
          !textItem.str.startsWith(' ')
        ) {
          pageText += ' ';
        }

        pageText += textItem.str;
        if (textItem.hasEOL && !pageText.endsWith('\n')) {
          pageText += '\n';
        }

        if (currentY !== null) {
          lastY = currentY;
        }
      }

      textPieces.push(pageText);
    }

    return textPieces.join('\n\n');
  } catch (error) {
    console.warn('PDF.js extraction failed, falling back to stream decode:', error);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(arrayBuffer);
    return text.replace(/[^\x20-\x7E\n\r]/g, ' ');
  }
}

/**
 * Extract raw text from any supported document file (.docx, .pdf, .txt)
 */
export async function extractRawTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (extension === 'docx') {
    return extractTextFromDocx(buffer);
  }
  if (extension === 'pdf') {
    return extractTextFromPdf(buffer);
  }
  return file.text();
}

/**
 * Helper to clean extracted text lines
 */
function cleanLine(line: string): string {
  return line.replace(/^[\s•\-*–\d.)]+/, '').trim();
}

/**
 * Derive title from filename as fallback or initial guess
 */
function titleFromFileName(fileName: string): string {
  let base = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const cvMatch = base.match(/\b(?:cv|resume)\b\s*(.*)/i);
  if (cvMatch?.[1] && cvMatch[1].trim().length > 2) {
    base = cvMatch[1].trim();
  } else {
    base = base.replace(/\b(?:cv|resume)\b/gi, '').trim();
  }
  return base
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Parse structured job description fields from raw text
 */
export function parseJobDescriptionText(text: string, fileName?: string): ParsedJobDescription {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Title Extraction
  let title = fileName ? titleFromFileName(fileName) : 'New Requisition';
  const titleMatch = normalized.match(
    /(?:Job Title|Position Title|Title|Position)\s*[:\t]?\s*([^\n\r]+)/i,
  );
  if (titleMatch?.[1]?.trim() && titleMatch[1].trim().length < 80) {
    title = cleanLine(titleMatch[1].trim());
  }
  title = title.replace(/\b(?:cv|resume)\b/gi, '').trim().slice(0, 120);

  // 2. Location Extraction (Sanitized and capped to 80 chars)
  let location = 'SGH Hospital';
  const locationMatch = normalized.match(
    /(?:Location|Work Location|Hospital Branch|Branch)\s*[:\t]?\s*([^\n\r]+)/i,
  );
  if (locationMatch?.[1]?.trim()) {
    location = cleanLine(locationMatch[1].trim())
      .replace(/\boffshore\b/gi, 'Cairo')
      .slice(0, 80);
  }


  // 3. Department Extraction
  let department = 'Clinical Services';
  const deptMatch = normalized.match(
    /(?:Department|Clinical Specialty|Reporting to|Liaising with)\s*[:\t]?\s*([^\n\r]+)/i,
  );
  if (deptMatch?.[1]?.trim()) {
    const rawDept = cleanLine(deptMatch[1].trim());
    // If reporting to a Manager, extract cleaner department name
    if (rawDept.toLowerCase().includes('compensation') || rawDept.toLowerCase().includes('od') || rawDept.toLowerCase().includes('hr')) {
      department = 'Human Resources';
    } else if (rawDept.toLowerCase().includes('nurs')) {
      department = 'Nursing';
    } else if (rawDept.toLowerCase().includes('pharm')) {
      department = 'Pharmacy';
    } else if (rawDept.toLowerCase().includes('it') || rawDept.toLowerCase().includes('software') || rawDept.toLowerCase().includes('systems')) {
      department = 'Information Technology';
    } else {
      department = rawDept.slice(0, 60);
    }
  }

  // 4. Job Summary Extraction
  let jobSummary = '';
  const summaryRegex =
    /(?:Job Summary|Position Summary|Core Purpose|Role Overview|Job Purpose|Summary)\s*[:\t]?\s*([\s\S]*?)(?=(?:(?:\n\s*(?:Job Duties|Duties & Responsibilities|Key Duties|Responsibilities|Key Responsibilities|Job Requirements|Requirements|Education|Qualifications|Experience))|$))/i;
  const summaryMatch = normalized.match(summaryRegex);
  if (summaryMatch?.[1]?.trim()) {
    jobSummary = summaryMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(' ')
      .trim();
  }

  // 5. Min Experience Years Extraction
  let minExperienceYears = 3;
  const directYearsMatch =
    normalized.match(/(?:minimum|min|at least)\s*(\d+)\s*years?/i) ||
    normalized.match(/(\d+)\s*(?:–|-|to)\s*(\d+)?\s*years?(?:\s+of)?\s*(?:relevant\s+)?experience/i) ||
    normalized.match(/(\d+)\+?\s*years?(?:\s+of)?\s*(?:relevant\s+)?experience/i);

  if (directYearsMatch?.[1]) {
    minExperienceYears = parseInt(directYearsMatch[1], 10) || 3;
  } else {
    const expSectionMatch = normalized.match(
      /(?:Experience|Min Experience|Relevant Experience)\s*[:\t]?\s*([\s\S]*?)(?=(?:Licenses|Equipment|Skills|Languages|Personality|$))/i,
    );
    if (expSectionMatch?.[1]) {
      const sectionYears =
        expSectionMatch[1].match(/(\d+)\s*(?:–|-|to)\s*(\d+)?\s*years?/i) ||
        expSectionMatch[1].match(/(\d+)\+?\s*years?/i);
      if (sectionYears?.[1]) {
        minExperienceYears = parseInt(sectionYears[1], 10) || 3;
      }
    }
  }

  // 6. Skills & Knowledge Extraction
  const requiredSkills: string[] = [];
  const skillsRegex =
    /(?:^|\n)\s*(?:Skills & Knowledge|Skills|Key Skills|Required Skills|Technical Skills|Competencies)\s*[:\t\n]\s*([\s\S]*?)(?=(?:(?:^|\n)\s*(?:Languages|Personality|Travel|Organizational Approval|Approved by|Department|Location|Education|Experience)|$))/i;
  const skillsMatch = normalized.match(skillsRegex);
  if (skillsMatch?.[1]?.trim()) {
    const rawSkillsLines = skillsMatch[1]
      .split(/\n|;|\./)
      .map((s) => cleanLine(s))
      .filter((s) => s.length > 1 && s.length < 80);

    for (const item of rawSkillsLines) {
      // Avoid generic phrases or boilerplate
      if (
        item.toLowerCase().includes('must have integrity') ||
        item.toLowerCase().includes('ability to maintain confidentiality') ||
        item.toLowerCase().includes('willing to work')
      ) {
        continue;
      }
      if (!requiredSkills.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
        requiredSkills.push(item);
      }
    }
  }

  // If no skills found in designated block, scan for prominent technology & domain keywords
  if (requiredSkills.length === 0) {
    const commonKeywords = [
      'SQL',
      'Full-Stack Web Development',
      'Business Process Automation',
      'Microsoft Power Platform',
      'Power BI',
      'Python',
      'TypeScript',
      'React',
      'Docker',
      'ICU',
      'Critical Care',
      'BLS',
      'ACLS',
      'Pharmacology',
      'HRIS',
      'Oracle HCM',
      'Database Administration',
    ];
    for (const kw of commonKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(normalized)) {
        requiredSkills.push(kw);
      }
    }
  }

  // 7. Qualifications / Education Extraction
  let qualifications = '';
  const eduRegex =
    /(?:Education|Qualifications|Academic Requirements|Licensure)\s*[:\t]?\s*([\s\S]*?)(?=(?:(?:\n\s*(?:Professional Training|Experience|Skills|Licenses))|$))/i;
  const eduMatch = normalized.match(eduRegex);
  if (eduMatch?.[1]?.trim()) {
    qualifications = eduMatch[1]
      .split('\n')
      .map((l) => cleanLine(l))
      .filter((l) => l.length > 0)
      .join('; ');
  }

  // 8. Duties & Responsibilities Extraction
  let responsibilities = '';
  const respRegex =
    /(?:Job Duties & Responsibilities|Responsibilities|Key Duties|Main Responsibilities)\s*[:\t]?\s*([\s\S]*?)(?=(?:(?:\n\s*(?:Job Requirements|Requirements|Education|Qualifications|Experience|Skills & Knowledge|Skills|Competencies))|$))/i;
  const respMatch = normalized.match(respRegex);
  if (respMatch?.[1]?.trim()) {
    responsibilities = respMatch[1]
      .split('\n')
      .map((l) => cleanLine(l))
      .filter((l) => l.length > 0)
      .join('\n');
  }

  // 9. Languages Extraction
  const languages: string[] = [];
  if (/English\s*\(Mandatory\)|English/i.test(normalized)) languages.push('English');
  if (/Arabic\s*\(Mandatory\)|Arabic/i.test(normalized)) languages.push('Arabic');

  return {
    title,
    department,
    location,
    jobSummary,
    minExperienceYears,
    requiredSkills,
    qualifications,
    responsibilities,
    languages,
    rawText: normalized,
  };
}

/**
 * End-to-end extraction from a File object
 */
export async function parseJobDescriptionFile(file: File): Promise<ParsedJobDescription> {
  const rawText = await extractRawTextFromFile(file);
  return parseJobDescriptionText(rawText, file.name);
}
