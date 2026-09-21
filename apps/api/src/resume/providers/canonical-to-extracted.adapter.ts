import { Injectable } from '@nestjs/common';
import {
  type CanonicalResumeParseResult,
  type ExtractedCandidate,
  type CandidateWorkExperienceItem,
  type CandidateEducationItem,
  type CandidateProjectItem,
  type CandidateEvidenceChunk,
} from '@recruitflow/contracts';
import { unwrapFieldValue } from '../../../../../packages/contracts/src/resume/index';

export interface CanonicalAdaptOptions {
  parserSource?: 'affinda' | 'legacy' | undefined;
  parsingQuality?: 'high' | 'medium' | 'low' | undefined;
  rawText?: string | undefined;
  meta?: {
    rawText?: string | null | undefined;
    document?: {
      classification?: string | { label?: string } | null | undefined;
      extractionQuality?: number | string | null | undefined;
    } | null | undefined;
  } | null | undefined;
}

@Injectable()
export class CanonicalToExtractedAdapter {
  public adapt(
    canonical: CanonicalResumeParseResult,
    sourceOrOptions: 'affinda' | 'legacy' | CanonicalAdaptOptions = 'affinda',
  ): ExtractedCandidate {
    const options: CanonicalAdaptOptions =
      typeof sourceOrOptions === 'string'
        ? { parserSource: sourceOrOptions }
        : sourceOrOptions;

    const parserSource = options.parserSource || 'affinda';

    // 1. Identity
    let firstName: string | undefined;
    if (canonical.identity.firstName) {
      firstName = unwrapFieldValue(canonical.identity.firstName);
    }

    let lastName: string | undefined;
    const middle = canonical.identity.middleName ? unwrapFieldValue(canonical.identity.middleName) : undefined;
    const family = canonical.identity.lastName ? unwrapFieldValue(canonical.identity.lastName) : undefined;
    if (middle || family) {
      lastName = [middle, family].filter(Boolean).join(' ') || undefined;
    }

    // Fallback name splitting from fullName if firstName or lastName is missing
    if ((!firstName || !lastName) && canonical.identity.fullName) {
      const rawFullName = unwrapFieldValue(canonical.identity.fullName);
      if (rawFullName) {
        const rawParts = rawFullName.trim().split(/\s+/).filter(Boolean);
        if (rawParts.length > 0) {
          if (!firstName) firstName = rawParts[0];
          if (!lastName && rawParts.length > 1) lastName = rawParts.slice(1).join(' ');
        }
      }
    }

    // 2. Contact
    let email: string | undefined;
    if (canonical.contact.email) {
      email = unwrapFieldValue(canonical.contact.email);
    }

    let phone: string | undefined;
    if (canonical.contact.phone) {
      phone = unwrapFieldValue(canonical.contact.phone);
    }

    let location: string | undefined;
    if (canonical.contact.location?.rawLocation) {
      location = unwrapFieldValue(canonical.contact.location.rawLocation);
    } else if (canonical.contact.location?.formattedAddress) {
      location = unwrapFieldValue(canonical.contact.location.formattedAddress);
    }

    // 3. Professional
    let title: string | undefined;
    if (canonical.professional.currentJobTitle) {
      title = unwrapFieldValue(canonical.professional.currentJobTitle);
    } else if (canonical.professional.professionalHeadline) {
      title = unwrapFieldValue(canonical.professional.professionalHeadline);
    }

    let currentCompany: string | undefined;
    if (canonical.professional.currentCompany) {
      currentCompany = unwrapFieldValue(canonical.professional.currentCompany);
    }

    let experienceYears: number | undefined;
    if (canonical.professional.derivedExperienceYears) {
      experienceYears = unwrapFieldValue(canonical.professional.derivedExperienceYears);
    } else if (canonical.professional.statedExperienceMonths) {
      const months = unwrapFieldValue(canonical.professional.statedExperienceMonths);
      const years = Number(months) / 12;
      experienceYears = Math.max(0, Math.round(years * 10) / 10);
    }

    // Summary (Affinda mapper leaves summary undefined so SghEnrichmentService synthesizes it)
    let summary: string | undefined;
    if (canonical.summary && parserSource === 'legacy') {
      summary = unwrapFieldValue(canonical.summary);
    }

    // 4. Work History & Responsibilities
    let workHistory: CandidateWorkExperienceItem[] | undefined;
    const responsibilities: string[] = [];

    if (canonical.workHistory && canonical.workHistory.length > 0) {
      workHistory = canonical.workHistory.map((w) => {
        const desc = w.description ? unwrapFieldValue(w.description) : undefined;
        const isCur = w.isCurrent ? Boolean(unwrapFieldValue(w.isCurrent)) : false;

        // Collect responsibilities
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

        return {
          jobTitle: w.extractedTitle ? unwrapFieldValue(w.extractedTitle) : undefined,
          organization: w.extractedCompany ? unwrapFieldValue(w.extractedCompany) : undefined,
          description: desc,
          isCurrent: isCur,
          startDate: w.startDate ? unwrapFieldValue(w.startDate) : undefined,
          endDate: w.endDate ? unwrapFieldValue(w.endDate) : undefined,
        };
      });
    }

    // 5. Education
    let educationHistory: CandidateEducationItem[] | undefined;
    let education: string | undefined;

    if (canonical.educationHistory && canonical.educationHistory.length > 0) {
      educationHistory = canonical.educationHistory.map((e) => ({
        degree: e.extractedDegree ? unwrapFieldValue(e.extractedDegree) : undefined,
        major: e.extractedMajor ? unwrapFieldValue(e.extractedMajor) : undefined,
        organization: e.extractedOrganization ? unwrapFieldValue(e.extractedOrganization) : undefined,
        startDate: e.startDate ? unwrapFieldValue(e.startDate) : undefined,
        endDate: e.endDate ? unwrapFieldValue(e.endDate) : undefined,
      }));

      const topEdu = educationHistory[0];
      if (topEdu) {
        const parts = [
          topEdu.degree,
          topEdu.major ? `in ${topEdu.major}` : '',
          topEdu.organization,
        ].filter(Boolean);
        education = parts.join(' - ') || undefined;
      }
    }

    // 6. Skills
    let skills: string[] | undefined;
    if (canonical.capabilities?.extractedSkills && canonical.capabilities.extractedSkills.length > 0) {
      skills = canonical.capabilities.extractedSkills.map((s) => unwrapFieldValue(s));
    }

    // 7. Projects
    let projects: string[] | undefined;
    let projectHistory: CandidateProjectItem[] | undefined;

    if (canonical.capabilities?.projects && canonical.capabilities.projects.length > 0) {
      projectHistory = canonical.capabilities.projects.map((p) => ({
        title: unwrapFieldValue(p.title) || undefined,
        description: p.description ? unwrapFieldValue(p.description) : undefined,
      }));

      projects = [];
      for (const pr of projectHistory) {
        const text = [pr.title, pr.description].filter(Boolean).join(': ');
        if (text) projects.push(text);
      }
    }

    // 8. Certifications
    let certifications: string[] | undefined;
    if (canonical.capabilities?.certifications && canonical.capabilities.certifications.length > 0) {
      certifications = canonical.capabilities.certifications.map((c) => unwrapFieldValue(c.name));
    }

    // 9. Languages
    let languages: string[] | undefined;
    if (canonical.capabilities?.languages && canonical.capabilities.languages.length > 0) {
      languages = canonical.capabilities.languages.map((l) => unwrapFieldValue(l.language));
    }

    // 10. Raw text
    const rawTextSource = options.rawText || options.meta?.rawText || undefined;
    const rawText = rawTextSource ? rawTextSource.slice(0, 50000) : undefined;

    // 11. Build structured evidence chunks for evidence-based matching
    const evidenceChunks: CandidateEvidenceChunk[] = [];

    // Add Work Experience chunks
    if (workHistory) {
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
    }

    // Add Project chunks
    if (projectHistory) {
      for (const pr of projectHistory) {
        const text = [pr.title, pr.description].filter(Boolean).join(': ');
        if (text) {
          evidenceChunks.push({
            text,
            source: 'Projects',
          });
        }
      }
    }

    // Add Skills chunk
    if (skills && skills.length > 0) {
      evidenceChunks.push({
        text: `Skills: ${skills.join(', ')}`,
        source: 'Skills',
      });
    }

    // Add Education chunks
    if (educationHistory) {
      for (const ed of educationHistory) {
        const parts = [ed.degree, ed.major, ed.organization].filter(Boolean);
        if (parts.length > 0) {
          evidenceChunks.push({
            text: parts.join(' in '),
            source: 'Education',
          });
        }
      }
    }

    // Add Certification chunks
    if (certifications) {
      for (const cert of certifications) {
        evidenceChunks.push({
          text: cert,
          source: 'Certifications',
        });
      }
    }

    // 12. Determine parsing quality
    let parsingQuality: 'high' | 'medium' | 'low';
    if (options.parsingQuality) {
      parsingQuality = options.parsingQuality;
    } else {
      parsingQuality = this.determineParsingQuality(options.meta || {}, {
        firstName,
        lastName,
        email,
        phone,
        title,
        skillsCount: skills?.length ?? 0,
        hasExperience: experienceYears != null && experienceYears > 0,
      });
    }

    return {
      firstName,
      lastName,
      email,
      phone,
      title,
      currentCompany,
      experienceYears,
      location,
      skills: skills && skills.length > 0 ? skills : undefined,
      education,
      educationHistory: educationHistory && educationHistory.length > 0 ? educationHistory : undefined,
      workHistory: workHistory && workHistory.length > 0 ? workHistory : undefined,
      projects: projects && projects.length > 0 ? projects : undefined,
      projectHistory: projectHistory && projectHistory.length > 0 ? projectHistory : undefined,
      evidenceChunks: evidenceChunks.length > 0 ? evidenceChunks : undefined,
      certifications: certifications && certifications.length > 0 ? certifications : undefined,
      languages: languages && languages.length > 0 ? languages : undefined,
      rawText,
      responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
      summary,
      parserSource,
      parsingQuality,
    };
  }

  private determineParsingQuality(
    meta: CanonicalAdaptOptions['meta'],
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
    const cls = meta?.document?.classification;
    const clsString =
      (typeof cls === 'object' && cls !== null && 'label' in cls
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

    const rawQuality = meta?.document?.extractionQuality;
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
