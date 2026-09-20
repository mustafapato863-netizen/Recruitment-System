import type { ExtractedField, NormalizedField, DerivedField } from './field-values.schema.ts';

/**
 * Canonical Resume Schema
 * Defines the single internal truth representation for parsed resume data in RecruitFlow.
 *
 * Rules:
 * 1. Zero rawText: prevents unredacted CV copies in ParseRun and Gold datasets.
 * 2. Zero evidenceChunks: downstream matching engine derives evidence chunks on demand.
 * 3. Zero root fieldProvenance dictionary: provenance is attached directly to each Extracted/Normalized/DerivedField.
 * 4. Work history, education, and projects carry stable item IDs.
 * 5. Dates, descriptions, locations, and summaries are provenance-capable fields.
 * 6. isCurrent is provenance-capable (ExtractedField<boolean> | DerivedField<boolean>), not an ungrounded boolean.
 */

export interface CanonicalCandidateIdentity {
  readonly firstName?: ExtractedField<string> | undefined;
  readonly middleName?: ExtractedField<string> | undefined;
  readonly lastName?: ExtractedField<string> | undefined;
  readonly fullName?: ExtractedField<string> | DerivedField<string> | undefined;
}

export interface CanonicalCandidateProfessional {
  /** Explicit job title verbatim as stated on the CV (e.g. "HRIS Developer") */
  readonly currentJobTitle?: ExtractedField<string> | undefined;

  /** Normalized taxonomy occupation (e.g. "HR Systems & Software Engineering") */
  readonly normalizedOccupation?: NormalizedField<string> | undefined;

  /** Current or most recent employer */
  readonly currentCompany?: ExtractedField<string> | undefined;

  /** Professional summary headline as stated on the CV */
  readonly professionalHeadline?: ExtractedField<string> | undefined;

  /** Explicitly stated experience duration on CV (e.g. "6+ years") */
  readonly statedExperienceMonths?: ExtractedField<number> | undefined;

  /** Total experience computed from work history timelines */
  readonly derivedExperienceMonths?: DerivedField<number> | undefined;

  /** Normalized experience years for matching and filtering */
  readonly derivedExperienceYears?: DerivedField<number> | undefined;
}

export interface CanonicalCandidateLocation {
  readonly rawLocation?: ExtractedField<string> | undefined;
  readonly normalizedCity?: NormalizedField<string> | undefined;
  readonly normalizedCountry?: NormalizedField<string> | undefined;
  readonly formattedAddress?: DerivedField<string> | ExtractedField<string> | undefined;
}

export interface CanonicalCandidateContact {
  readonly email?: ExtractedField<string> | undefined;
  readonly phone?: ExtractedField<string> | undefined;
  readonly location?: CanonicalCandidateLocation | undefined;
}

export interface CanonicalWorkExperienceItem {
  readonly id: string; // Stable UUID within the parsed document
  readonly extractedTitle?: ExtractedField<string> | undefined;
  readonly normalizedTitle?: NormalizedField<string> | undefined;
  readonly extractedCompany?: ExtractedField<string> | undefined;
  readonly startDate?: ExtractedField<string> | undefined;
  readonly endDate?: ExtractedField<string> | undefined;
  readonly isCurrent?: ExtractedField<boolean> | DerivedField<boolean> | undefined;
  readonly location?: ExtractedField<string> | undefined;
  readonly description?: ExtractedField<string> | undefined;
  readonly responsibilities?: Array<ExtractedField<string>> | undefined;
}

/** Alias for CanonicalWorkExperienceItem */
export type CanonicalWorkHistoryItem = CanonicalWorkExperienceItem;

export interface CanonicalEducationItem {
  readonly id: string; // Stable UUID
  readonly extractedDegree?: ExtractedField<string> | undefined;
  readonly normalizedDegreeLevel?: NormalizedField<string> | undefined; // e.g. 'BACHELORS' | 'MASTERS' | 'DOCTORATE' | 'DIPLOMA'
  readonly extractedMajor?: ExtractedField<string> | undefined;
  readonly normalizedMajor?: NormalizedField<string> | undefined;
  readonly extractedOrganization?: ExtractedField<string> | undefined;
  readonly startDate?: ExtractedField<string> | undefined;
  readonly endDate?: ExtractedField<string> | undefined;
  readonly gradeOrGpa?: ExtractedField<string> | undefined;
}

export interface CanonicalProjectItem {
  readonly id: string; // Stable UUID
  readonly title: ExtractedField<string>;
  readonly description?: ExtractedField<string> | undefined;
  readonly technologiesOrSkills?: Array<ExtractedField<string>> | undefined;
}

export interface CanonicalCertificationItem {
  readonly id: string; // Stable UUID
  readonly name: ExtractedField<string>;
  readonly issuer?: ExtractedField<string> | undefined;
  readonly issueDate?: ExtractedField<string> | undefined;
  readonly expiryDate?: ExtractedField<string> | undefined;
}

export interface CanonicalLanguageItem {
  readonly id: string; // Stable UUID
  readonly language: ExtractedField<string>;
  readonly proficiency?: ExtractedField<string> | NormalizedField<string> | undefined;
}

export interface CanonicalCandidateCapabilities {
  readonly extractedSkills?: Array<ExtractedField<string>> | undefined;
  readonly normalizedSkills?: Array<NormalizedField<string>> | undefined;
  readonly certifications?: CanonicalCertificationItem[] | undefined;
  readonly languages?: CanonicalLanguageItem[] | undefined;
  readonly projects?: CanonicalProjectItem[] | undefined;
}

export interface CanonicalResumeParseResult {
  readonly identity: CanonicalCandidateIdentity;
  readonly professional: CanonicalCandidateProfessional;
  readonly contact: CanonicalCandidateContact;

  readonly workHistory?: CanonicalWorkExperienceItem[] | undefined;
  readonly educationHistory?: CanonicalEducationItem[] | undefined;
  readonly capabilities?: CanonicalCandidateCapabilities | undefined;

  /** Executive or candidate summary, provenance-capable */
  readonly summary?: ExtractedField<string> | DerivedField<string> | undefined;
}
