/**
 * ATS Matching Engine & JD Extraction Contracts
 * Shared browser-safe contracts between web frontend and api backend.
 */

export interface JdKnockoutRule {
  id: string;
  field: 'experienceYears' | 'degree' | 'certification' | 'language' | 'workMode';
  operator: 'GTE' | 'EQUALS' | 'IN' | 'CONTAINS';
  value: string | number | string[];
  failureMessage?: string;
}

export interface JdCriteriaDefinition {
  version: number;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedById?: string | null;
  lockedByName?: string | null;
  minExperienceYears?: number | null;
  educationLevels?: string[]; // e.g. ["BACHELORS", "MASTERS", "DIPLOMA"]
  languages?: Array<{ language: string; minProficiency?: string }>;
  workMode?: 'On-site' | 'Hybrid' | 'Remote';
  mustHaveSkills: Array<{ id: string; name: string; masterSkillId?: string | null }>;
  niceToHaveSkills: Array<{ id: string; name: string; masterSkillId?: string | null }>;
  knockoutRules: JdKnockoutRule[];
  weights: {
    skills: number; // default 50
    experience: number; // default 30
    education: number; // default 10
    languages: number; // default 10
  };
}

export interface VacancyDocumentItem {
  id: string;
  vacancyId?: string | null;
  vacancyRequestId?: string | null;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  parserStatus: string;
  extractionText?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
}

export interface AtsSkillMatchItem {
  skillName: string;
  isMustHave: boolean;
  matched: boolean;
  evidenceSnippet?: string | null;
  sourceType?: string | null;
}

export interface AtsMatchBreakdown {
  overallScore: number; // 0-100
  knockoutsPassed: boolean;
  knockoutFailures: string[];
  mustHaveSkillsPassed: boolean;
  mustHaveMatchedCount: number;
  mustHaveTotalCount: number;
  niceToHaveMatchedCount: number;
  niceToHaveTotalCount: number;
  semanticSkillMatchPct: number;
  skillBreakdown: AtsSkillMatchItem[];
  missingKeywords: string[];
  experienceMatch: {
    actualYears: number;
    requiredYears: number;
    passed: boolean;
  };
  educationMatch: {
    actual: string[];
    required: string[];
    passed: boolean;
  };
  languagesMatch: {
    actual: string[];
    required: string[];
    passed: boolean;
  };
  calculatedAt: string;
}

export interface AtsEvaluationResult {
  applicationId: string;
  candidateId: string;
  vacancyId: string;
  atsScore: number;
  atsKnockoutPass: boolean;
  breakdown: AtsMatchBreakdown;
}

export interface CandidateJobRecommendation {
  vacancyId: string;
  vacancyCode: string;
  title: string;
  department: string | null;
  branchName: string | null;
  atsScore: number;
  mustHaveMatched: boolean;
  matchedSkillsCount: number;
  totalRequiredSkillsCount: number;
  alreadyApplied: boolean;
  existingApplicationId?: string | null;
}

export interface InterviewScorecardCriterionRating {
  criterionKey: string;
  criterionName: string;
  category?: 'SKILL' | 'COMPETENCY' | 'REQUIREMENT';
  rating: number; // 1-5
  comment?: string | null;
}
