import { Injectable } from '@nestjs/common';
import type {
  CanonicalResumeParseResult,
  CanonicalWorkExperienceItem,
  CanonicalEducationItem,
  CanonicalProjectItem,
  CanonicalCertificationItem,
  CanonicalLanguageItem,
  ExtractedField,
  DerivedField,
  FieldProvenance,
} from '@recruitflow/contracts';
import * as crypto from 'crypto';

interface AffindaWorkExperience {
  id?: string | null;
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
  id?: string | null;
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
  grade?: {
    raw?: string | null;
    value?: string | null;
  } | null;
}

interface AffindaProject {
  id?: string | null;
  title?: string | null;
  description?: string | null;
}

interface AffindaV1Data {
  person?: {
    name?: {
      first?: string | null;
      given?: string | null;
      middle?: string | null;
      family?: string | null;
      last?: string | null;
      raw?: string | null;
    } | null;
    location?: {
      formatted?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      raw?: string | null;
    } | null;
  } | null;
  contact?: {
    emails?: Array<string | { value?: string | null }> | null;
    phoneNumbers?: Array<string | { raw?: string | null; formatted?: string | null }> | null;
  } | null;
  profession?: string | null;
  summary?: string | null;
  employmentMetrics?: {
    totalExperienceMonths?: number | string | null;
  } | null;
  workExperience?: AffindaWorkExperience[] | null;
  education?: AffindaEducation[] | null;
  skills?: Array<AffindaSkill | string> | null;
  certifications?: Array<{ name?: string | null } | string> | null;
  languages?: Array<{ name?: string | null; language?: string | null } | string> | null;
  projects?: AffindaProject[] | null;
}

@Injectable()
export class AffindaCanonicalMapper {
  private readonly defaultProvenance: FieldProvenance = {
    sourceProvider: 'affinda-v1',
    extractionMethod: 'vendor-api',
  };

  public map(affindaResponse: Record<string, unknown>): CanonicalResumeParseResult {
    const data: AffindaV1Data = (affindaResponse as { data?: AffindaV1Data })?.data || (affindaResponse as unknown as AffindaV1Data) || {};

    const identity: {
      firstName?: ExtractedField<string>;
      middleName?: ExtractedField<string>;
      lastName?: ExtractedField<string>;
      fullName?: ExtractedField<string>;
    } = {};
    const professional: {
      statedExperienceMonths?: ExtractedField<number>;
      derivedExperienceYears?: DerivedField<number>;
      professionalHeadline?: ExtractedField<string>;
      currentJobTitle?: ExtractedField<string>;
      currentCompany?: ExtractedField<string>;
    } = {};
    const contact: {
      email?: ExtractedField<string>;
      phone?: ExtractedField<string>;
      location?: {
        rawLocation?: ExtractedField<string>;
      };
    } = {};
    const workHistory: CanonicalWorkExperienceItem[] = [];
    const educationHistory: CanonicalEducationItem[] = [];
    const extractedSkills: Array<ExtractedField<string>> = [];
    const projects: CanonicalProjectItem[] = [];
    const certifications: CanonicalCertificationItem[] = [];
    const languages: CanonicalLanguageItem[] = [];
    let summary: ExtractedField<string> | undefined = undefined;

    // 1. Identity
    let firstName = data.person?.name?.given?.trim() || undefined;
    const middleName = data.person?.name?.middle?.trim() || undefined;
    const familyName = data.person?.name?.family?.trim() || undefined;
    let lastName = [middleName, familyName].filter(Boolean).join(' ') || undefined;

    // Fallback: if either is missing, attempt to split raw name (mirroring legacy mapper)
    if ((!firstName || !lastName) && data.person?.name?.raw) {
      const rawParts = data.person.name.raw.trim().split(/\s+/).filter(Boolean);
      if (rawParts.length > 0) {
        if (!firstName) firstName = rawParts[0];
        if (!lastName && rawParts.length > 1) lastName = rawParts.slice(1).join(' ');
      }
    }

    if (firstName) {
      identity.firstName = this.createExtracted(firstName);
    }
    if (middleName) {
      identity.middleName = this.createExtracted(middleName);
    }
    if (familyName) {
      identity.lastName = this.createExtracted(familyName);
    } else if (lastName && !middleName) {
      identity.lastName = this.createExtracted(lastName);
    }
    if (data.person?.name?.raw?.trim()) {
      identity.fullName = this.createExtracted(data.person.name.raw.trim());
    }

    // 2. Contact details
    const firstEmail = data.contact?.emails?.[0];
    let emailValue: string | undefined;
    if (typeof firstEmail === 'string') {
      emailValue = firstEmail.trim().toLowerCase();
    } else if (firstEmail && typeof firstEmail === 'object' && firstEmail.value) {
      emailValue = firstEmail.value.trim().toLowerCase();
    }
    if (emailValue) {
      contact.email = this.createExtracted(emailValue);
    }

    const firstPhone = data.contact?.phoneNumbers?.[0];
    let phoneValue: string | undefined;
    if (typeof firstPhone === 'string') {
      phoneValue = firstPhone.trim();
    } else if (firstPhone && typeof firstPhone === 'object') {
      phoneValue = firstPhone.formatted?.trim() || firstPhone.raw?.trim();
    }
    if (phoneValue) {
      contact.phone = this.createExtracted(phoneValue);
    }

    // Location
    let locationStr: string | undefined;
    if (data.person?.location?.formatted) {
      locationStr = data.person.location.formatted.trim();
    } else {
      const parts = [
        data.person?.location?.city,
        data.person?.location?.state,
        data.person?.location?.country,
      ].filter(Boolean);
      if (parts.length > 0) locationStr = parts.join(', ');
    }
    if (locationStr) {
      contact.location = {
        rawLocation: this.createExtracted(locationStr),
      };
    }

    // 3. Experience Years
    const totalMonths = data.employmentMetrics?.totalExperienceMonths;
    if (totalMonths != null && !isNaN(Number(totalMonths))) {
      professional.statedExperienceMonths = this.createExtracted(Number(totalMonths));
      const years = Number(totalMonths) / 12;
      professional.derivedExperienceYears = {
        kind: 'DERIVED',
        derivedValue: Math.max(0, Math.round(years * 10) / 10),
        derivationRule: 'total_months_division',
        provenance: this.defaultProvenance,
      };
    }

    // 4. Profession & Headline
    if (data.profession) {
      professional.professionalHeadline = this.createExtracted(data.profession.trim());
    }

    // Summary
    if (data.summary) {
      summary = this.createExtracted(data.summary.trim());
    }

    // 5. Work Experience
    const workList = data.workExperience;
    if (Array.isArray(workList) && workList.length > 0) {
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

        const startDate = entry.dateRange?.start?.date || entry.dates?.startDate || undefined;
        const endDate = entry.dateRange?.end?.date || entry.dates?.endDate || undefined;

        const resps: Array<ExtractedField<string>> = [];
        if (desc) {
          const lines = desc
            .split(/\r?\n/)
            .map((l) => l.replace(/^[•▪*–—\s-]+/, '').trim())
            .filter((l) => l.length >= 15 && l.length <= 300);
          for (const line of lines) {
            resps.push(this.createExtracted(line));
          }
        }

        const workItem: CanonicalWorkExperienceItem = {
          id: entry.id || crypto.randomUUID(),
          extractedTitle: entry.jobTitle?.trim() ? this.createExtracted(entry.jobTitle.trim()) : undefined,
          extractedCompany: entry.organization?.trim() ? this.createExtracted(entry.organization.trim()) : undefined,
          startDate: startDate ? this.createExtracted(startDate) : undefined,
          endDate: endDate ? this.createExtracted(endDate) : undefined,
          isCurrent: this.createExtracted(Boolean(isCurrent)),
          description: desc ? this.createExtracted(desc) : undefined,
          responsibilities: resps.length > 0 ? resps : undefined,
        };

        workHistory.push(workItem);
      }

      // Find current entry
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

      if (!currentEntry) {
        currentEntry = workList[0];
      }

      const title = currentEntry?.jobTitle?.trim() || data.profession?.trim() || undefined;
      const currentCompany = currentEntry?.organization?.trim() || undefined;

      if (title) {
        professional.currentJobTitle = this.createExtracted(title);
      }
      if (currentCompany) {
        professional.currentCompany = this.createExtracted(currentCompany);
      }
    } else if (data.profession?.trim()) {
      professional.currentJobTitle = this.createExtracted(data.profession.trim());
    }

    // 6. Education
    if (Array.isArray(data.education) && data.education.length > 0) {
      for (const edu of data.education) {
        const degree =
          edu.accreditation?.education?.trim() ||
          edu.accreditation?.inputStr?.trim() ||
          undefined;

        educationHistory.push({
          id: edu.id || crypto.randomUUID(),
          extractedDegree: degree ? this.createExtracted(degree) : undefined,
          extractedMajor: edu.major?.trim() ? this.createExtracted(edu.major.trim()) : undefined,
          extractedOrganization: edu.organization?.trim() ? this.createExtracted(edu.organization.trim()) : undefined,
          startDate: edu.dates?.startDate ? this.createExtracted(edu.dates.startDate) : undefined,
          endDate: edu.dates?.endDate ? this.createExtracted(edu.dates.endDate) : undefined,
          gradeOrGpa: (edu.grade?.value || edu.grade?.raw) ? this.createExtracted(edu.grade.value || edu.grade.raw!) : undefined,
        });
      }
    }

    // 7. Skills (deduplicated)
    const skillsSet = new Set<string>();
    if (Array.isArray(data.skills)) {
      for (const item of data.skills) {
        const skillName = typeof item === 'string' ? item : item?.name;
        if (skillName && typeof skillName === 'string' && skillName.trim().length > 0) {
          skillsSet.add(skillName.trim());
        }
      }
    }
    for (const skill of skillsSet) {
      extractedSkills.push(this.createExtracted(skill));
    }

    // 8. Projects
    if (Array.isArray(data.projects) && data.projects.length > 0) {
      for (const pr of data.projects) {
        const title = pr.title?.trim() || undefined;
        const description = pr.description?.trim() || undefined;
        if (title || description) {
          projects.push({
            id: crypto.randomUUID(),
            title: this.createExtracted(title || ''),
            description: description ? this.createExtracted(description) : undefined,
          });
        }
      }
    }

    // 9. Certifications (deduplicated)
    const certsSet = new Set<string>();
    if (Array.isArray(data.certifications)) {
      for (const item of data.certifications) {
        const certName = typeof item === 'string' ? item : item?.name;
        if (certName && typeof certName === 'string' && certName.trim().length > 0) {
          certsSet.add(certName.trim());
        }
      }
    }
    for (const cert of certsSet) {
      certifications.push({
        id: crypto.randomUUID(),
        name: this.createExtracted(cert),
      });
    }

    // 10. Languages (deduplicated)
    const langSet = new Set<string>();
    if (Array.isArray(data.languages)) {
      for (const item of data.languages) {
        const langName = typeof item === 'string' ? item : (item?.name || item?.language);
        if (langName && typeof langName === 'string' && langName.trim().length > 0) {
          langSet.add(langName.trim());
        }
      }
    }
    for (const lang of langSet) {
      languages.push({
        id: crypto.randomUUID(),
        language: this.createExtracted(lang),
      });
    }

    return {
      identity,
      professional,
      contact,
      workHistory,
      educationHistory,
      capabilities: {
        extractedSkills,
        certifications,
        languages,
        projects,
      },
      summary,
    } as CanonicalResumeParseResult;
  }

  private createExtracted<T>(value: T): ExtractedField<T> {
    return {
      kind: 'EXTRACTED',
      rawValue: value,
      provenance: this.defaultProvenance,
    };
  }
}
