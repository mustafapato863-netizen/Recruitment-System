import { Injectable } from '@nestjs/common';
import type {
  ExtractedCandidate,
  CandidateWorkExperienceItem,
  CandidateEducationItem,
  CandidateProjectItem,
  CandidateEvidenceChunk,
} from '@recruitflow/contracts';

interface AffindaWorkExperience {
  jobTitle?: string | null;
  organization?: string | null;
  isCurrent?: boolean | null;
  jobDescription?: string | null;
  description?: string | null;
  dates?: {
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean | null;
  } | null;
  dateRange?: {
    start?: { date?: string | null; raw?: string | null } | null;
    end?: { date?: string | null; raw?: string | null; current?: boolean | null } | null;
    isCurrent?: boolean | null;
  } | null;
}

interface AffindaSkill {
  name?: string | null;
  type?: string | null;
}

interface AffindaEducation {
  accreditation?: {
    education?: string | null;
    inputStr?: string | null;
  } | null;
  organization?: string | null;
  major?: string | null;
  dates?: {
    startDate?: string | null;
    endDate?: string | null;
  } | null;
}

interface AffindaProject {
  title?: string | null;
  description?: string | null;
}

interface AffindaCertification {
  name?: string | null;
}

interface AffindaLanguage {
  name?: string | null;
  language?: string | null;
}

interface AffindaV1Data {
  person?: {
    name?: {
      given?: string | null;
      middle?: string | null;
      family?: string | null;
      raw?: string | null;
    } | null;
    location?: {
      formatted?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
    } | null;
  } | null;
  contact?: {
    emails?: Array<string | { value?: string }> | null;
    phoneNumbers?: Array<{ formatted?: string; raw?: string } | string> | null;
  } | null;
  profession?: string | null;
  summary?: string | null;
  employmentMetrics?: {
    totalExperienceMonths?: number | null;
  } | null;
  workExperience?: AffindaWorkExperience[] | null;
  skills?: Array<AffindaSkill | string> | null;
  education?: AffindaEducation[] | null;
  projects?: AffindaProject[] | null;
  certifications?: Array<AffindaCertification | string> | null;
  languages?: Array<AffindaLanguage | string> | null;
}

interface AffindaV1Meta {
  rawText?: string | null;
  document?: {
    classification?: string | null;
    extractionQuality?: number | string | null;
  } | null;
}

interface AffindaResponse {
  data?: AffindaV1Data | null;
  meta?: AffindaV1Meta | null;
  rawText?: string | null;
}

@Injectable()
export class RecruitFlowCandidateMapper {
  /**
   * Map raw Affinda v1 schema response to RecruitFlow ExtractedCandidate.
   * Preserves rich work experience, projects, education, and section evidence.
   */
  map(affindaResponse: AffindaResponse | Record<string, unknown>): ExtractedCandidate {
    const data: AffindaV1Data = (affindaResponse as AffindaResponse)?.data || (affindaResponse as AffindaV1Data) || {};
    const meta: AffindaV1Meta = (affindaResponse as AffindaResponse)?.meta || {};

    // 1. Name extraction
    let firstName = data.person?.name?.given?.trim() || undefined;
    const middleName = data.person?.name?.middle?.trim() || undefined;
    const familyName = data.person?.name?.family?.trim() || undefined;
    let lastName = [middleName, familyName].filter(Boolean).join(' ') || undefined;

    // Fallback: if either is missing, attempt to split raw name
    if ((!firstName || !lastName) && data.person?.name?.raw) {
      const rawParts = data.person.name.raw.trim().split(/\s+/).filter(Boolean);
      if (rawParts.length > 0) {
        if (!firstName) firstName = rawParts[0];
        if (!lastName && rawParts.length > 1) lastName = rawParts.slice(1).join(' ');
      }
    }

    // 2. Contact details
    let email: string | undefined;
    const firstEmail = data.contact?.emails?.[0];
    if (typeof firstEmail === 'string') {
      email = firstEmail.trim().toLowerCase();
    } else if (firstEmail && typeof firstEmail === 'object' && firstEmail.value) {
      email = firstEmail.value.trim().toLowerCase();
    }

    let phone: string | undefined;
    const firstPhone = data.contact?.phoneNumbers?.[0];
    if (typeof firstPhone === 'string') {
      phone = firstPhone.trim();
    } else if (firstPhone && typeof firstPhone === 'object') {
      phone = firstPhone.formatted?.trim() || firstPhone.raw?.trim();
    }

    // 3. Location
    let location: string | undefined;
    if (data.person?.location?.formatted) {
      location = data.person.location.formatted.trim();
    } else {
      const parts = [
        data.person?.location?.city,
        data.person?.location?.state,
        data.person?.location?.country,
      ].filter(Boolean);
      if (parts.length > 0) location = parts.join(', ');
    }

    // 4. Experience Years from employmentMetrics.totalExperienceMonths
    let experienceYears: number | undefined;
    const totalMonths = data.employmentMetrics?.totalExperienceMonths;
    if (totalMonths != null && !isNaN(Number(totalMonths))) {
      const years = Number(totalMonths) / 12;
      experienceYears = Math.max(0, Math.round(years * 10) / 10);
    }

    // 5. Rich Work Experience
    const { title, currentCompany, responsibilities, workHistory } = this.extractWorkExperience(
      data.workExperience,
      data.profession,
    );

    // 6. Skills
    const skillsSet = new Set<string>();
    if (Array.isArray(data.skills)) {
      for (const item of data.skills) {
        const skillName = typeof item === 'string' ? item : item?.name;
        if (skillName && typeof skillName === 'string' && skillName.trim().length > 0) {
          skillsSet.add(skillName.trim());
        }
      }
    }
    const skills = Array.from(skillsSet);

    // 7. Education
    const { education, educationHistory } = this.extractEducation(data.education);

    // 8. Projects
    const { projects, projectHistory } = this.extractProjects(data.projects);

    // 9. Certifications
    const certsSet = new Set<string>();
    if (Array.isArray(data.certifications)) {
      for (const item of data.certifications) {
        const certName = typeof item === 'string' ? item : item?.name;
        if (certName && typeof certName === 'string' && certName.trim().length > 0) {
          certsSet.add(certName.trim());
        }
      }
    }
    const certifications = Array.from(certsSet);

    // 10. Languages
    const langSet = new Set<string>();
    if (Array.isArray(data.languages)) {
      for (const item of data.languages) {
        const langName =
          typeof item === 'string'
            ? item
            : (item?.name || item?.language);
        if (langName && typeof langName === 'string' && langName.trim().length > 0) {
          langSet.add(langName.trim());
        }
      }
    }
    const languages = Array.from(langSet);

    // 11. Raw text (retained only for matching / evidence verification)
    const rawText = (meta?.rawText || (affindaResponse as Record<string, unknown>)?.rawText as string) || undefined;

    // 12. Build structured evidence chunks for evidence-based matching
    const evidenceChunks: CandidateEvidenceChunk[] = [];

    // Add Work Experience chunks
    for (const we of workHistory) {
      const parts = [
        we.jobTitle ? `Role: ${we.jobTitle}` : '',
        we.organization ? `Organization: ${we.organization}` : '',
        we.description || '',
      ].filter(Boolean);
      if (parts.length > 0) {
        evidenceChunks.push({
          text: parts.join(' - '),
          source: 'Work Experience',
          jobTitle: we.jobTitle,
          organization: we.organization,
        });
      }
    }

    // Add Project chunks
    for (const pr of projectHistory) {
      const text = [pr.title, pr.description].filter(Boolean).join(': ');
      if (text) {
        evidenceChunks.push({
          text,
          source: 'Projects',
        });
      }
    }

    // Add Skills chunk
    if (skills.length > 0) {
      evidenceChunks.push({
        text: `Skills: ${skills.join(', ')}`,
        source: 'Skills',
      });
    }

    // Add Education chunks
    for (const ed of educationHistory) {
      const parts = [ed.degree, ed.major, ed.organization].filter(Boolean);
      if (parts.length > 0) {
        evidenceChunks.push({
          text: parts.join(' in '),
          source: 'Education',
        });
      }
    }

    // Add Certification chunks
    for (const cert of certifications) {
      evidenceChunks.push({
        text: cert,
        source: 'Certifications',
      });
    }

    // 13. Determine parsing quality
    const parsingQuality = this.determineParsingQuality(meta, {
      firstName,
      lastName,
      email,
      phone,
      title,
      skillsCount: skills.length,
      hasExperience: experienceYears != null && experienceYears > 0,
    });

    return {
      firstName,
      lastName,
      email,
      phone,
      title,
      currentCompany,
      experienceYears,
      location,
      skills: skills.length > 0 ? skills : undefined,
      education,
      educationHistory: educationHistory.length > 0 ? educationHistory : undefined,
      workHistory: workHistory.length > 0 ? workHistory : undefined,
      projects: projects.length > 0 ? projects : undefined,
      projectHistory: projectHistory.length > 0 ? projectHistory : undefined,
      evidenceChunks: evidenceChunks.length > 0 ? evidenceChunks : undefined,
      certifications: certifications.length > 0 ? certifications : undefined,
      languages: languages.length > 0 ? languages : undefined,
      rawText: rawText ? rawText.slice(0, 50000) : undefined,
      responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
      parserSource: 'affinda',
      parsingQuality,
    };
  }

  /**
   * Determine the current job title and employer based on current workExperience entry.
   * Primarily checks: workExperience[].dateRange.end.current === true
   */
  private extractWorkExperience(
    workList?: AffindaWorkExperience[] | null,
    fallbackProfession?: string | null,
  ): {
    title?: string | undefined;
    currentCompany?: string | undefined;
    responsibilities: string[];
    workHistory: CandidateWorkExperienceItem[];
  } {
    const responsibilities: string[] = [];
    const workHistory: CandidateWorkExperienceItem[] = [];

    if (!Array.isArray(workList) || workList.length === 0) {
      return {
        title: fallbackProfession?.trim() || undefined,
        currentCompany: undefined,
        responsibilities,
        workHistory,
      };
    }

    for (const entry of workList) {
      const desc = entry.jobDescription?.trim() || entry.description?.trim() || undefined;

      const isCurrent =
        entry.dateRange?.end?.current === true ||
        entry.dateRange?.isCurrent === true ||
        entry.isCurrent === true ||
        entry.dates?.isCurrent === true ||
        (entry.dateRange?.start && !entry.dateRange?.end?.date) ||
        (entry.dates?.startDate && !entry.dates?.endDate) ||
        (typeof entry.dates?.endDate === 'string' &&
          ['present', 'current', 'now'].includes(entry.dates.endDate.toLowerCase().trim()));

      workHistory.push({
        jobTitle: entry.jobTitle?.trim() || undefined,
        organization: entry.organization?.trim() || undefined,
        description: desc,
        isCurrent: Boolean(isCurrent),
        startDate: entry.dateRange?.start?.date || entry.dates?.startDate || undefined,
        endDate: entry.dateRange?.end?.date || entry.dates?.endDate || undefined,
      });

      // Collect responsibilities/descriptions across entries
      if (desc) {
        const lines = desc
          .split(/\r?\n/)
          .map((l) => l.replace(/^[•▪*–—\s-]+/, '').trim())
          .filter((l) => l.length >= 15 && l.length <= 300);
        for (const line of lines) {
          if (!responsibilities.includes(line)) {
            responsibilities.push(line);
            if (responsibilities.length >= 25) break;
          }
        }
      }
    }

    // Find the CURRENT entry (primarily: dateRange.end.current === true)
    let currentEntry: AffindaWorkExperience | undefined = workList.find((w) => {
      if (w.dateRange?.end?.current === true) return true;
      if (w.dateRange?.isCurrent === true) return true;
      if (w.isCurrent === true) return true;
      if (w.dates?.isCurrent === true) return true;
      if (w.dateRange?.start && !w.dateRange?.end?.date) return true;
      if (w.dates?.startDate && !w.dates?.endDate) return true;
      if (typeof w.dates?.endDate === 'string') {
        const lowerEnd = w.dates.endDate.toLowerCase().trim();
        return lowerEnd === 'present' || lowerEnd === 'current' || lowerEnd === 'now';
      }
      return false;
    });

    // If no entry is explicitly marked current, pick the first entry
    if (!currentEntry) {
      currentEntry = workList[0];
    }

    const title = currentEntry?.jobTitle?.trim() || fallbackProfession?.trim() || undefined;
    const currentCompany = currentEntry?.organization?.trim() || undefined;

    return { title, currentCompany, responsibilities, workHistory };
  }

  private extractEducation(eduList?: AffindaEducation[] | null): {
    education?: string | undefined;
    educationHistory: CandidateEducationItem[];
  } {
    const educationHistory: CandidateEducationItem[] = [];
    if (!Array.isArray(eduList) || eduList.length === 0) {
      return { education: undefined, educationHistory };
    }

    for (const item of eduList) {
      const degree =
        item.accreditation?.education?.trim() ||
        item.accreditation?.inputStr?.trim() ||
        undefined;
      const major = item.major?.trim() || undefined;
      const organization = item.organization?.trim() || undefined;

      educationHistory.push({
        degree,
        major,
        organization,
        startDate: item.dates?.startDate || undefined,
        endDate: item.dates?.endDate || undefined,
      });
    }

    const topEdu = educationHistory[0];
    let education: string | undefined;
    if (topEdu) {
      const parts = [
        topEdu.degree,
        topEdu.major ? `in ${topEdu.major}` : '',
        topEdu.organization,
      ].filter(Boolean);
      education = parts.join(' - ') || undefined;
    }

    return { education, educationHistory };
  }

  private extractProjects(projList?: AffindaProject[] | null): {
    projects: string[];
    projectHistory: CandidateProjectItem[];
  } {
    const projects: string[] = [];
    const projectHistory: CandidateProjectItem[] = [];

    if (!Array.isArray(projList) || projList.length === 0) {
      return { projects, projectHistory };
    }

    for (const pr of projList) {
      const title = pr.title?.trim() || undefined;
      const description = pr.description?.trim() || undefined;
      projectHistory.push({ title, description });
      const text = [title, description].filter(Boolean).join(': ');
      if (text) projects.push(text);
    }

    return { projects, projectHistory };
  }

  /**
   * Evaluate extraction quality using document metadata and field presence.
   */
  private determineParsingQuality(
    meta: AffindaV1Meta,
    fields: {
      firstName?: string | undefined;
      lastName?: string | undefined;
      email?: string | undefined;
      phone?: string | undefined;
      title?: string | undefined;
      skillsCount: number;
      hasExperience: boolean;
    },
  ): 'high' | 'medium' | 'low' {
    const cls = meta.document?.classification;
    const clsString = (typeof cls === 'object' && cls !== null && 'label' in cls
      ? String((cls as { label?: unknown }).label)
      : cls) as string | undefined;
    const classification = clsString?.toLowerCase() || '';

    if (
      classification &&
      !classification.includes('resume') &&
      !classification.includes('cv') &&
      !classification.includes('profile')
    ) {
      return 'low';
    }

    const rawQuality = meta.document?.extractionQuality;
    if (rawQuality != null && !isNaN(Number(rawQuality))) {
      const qScore = Number(rawQuality);
      if (qScore < 0.4) return 'low';
      if (qScore >= 0.8 && fields.firstName && (fields.email || fields.phone)) {
        return 'high';
      }
    }

    const hasName = Boolean(fields.firstName && fields.lastName);
    const hasContact = Boolean(fields.email || fields.phone);
    const hasDetails = fields.skillsCount >= 3 || fields.hasExperience || Boolean(fields.title);

    if (hasName && hasContact && hasDetails) {
      return 'high';
    }

    if (hasName || hasContact) {
      return 'medium';
    }

    return 'low';
  }
}
