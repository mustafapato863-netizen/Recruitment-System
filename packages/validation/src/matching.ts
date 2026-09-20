/**
 * Hybrid Deterministic Candidate Match Engine
 * Evaluates candidate qualifications against position/vacancy requirements.
 * Implements evidence-based semantic skill matching, competency synthesis, and partial credit.
 *
 * Architecture inspired by MatchLens (multi-facet matching, evidence ranking)
 * and semantic-resume-matcher (hybrid search + deterministic guardrails).
 */

import {
  SYNONYM_GROUPS,
  findCompetencyMapping,
} from './skill-taxonomy.ts';
import {
  rankEvidence,
  computeEvidenceStrength,
} from './evidence-ranker.ts';

export interface CandidateWorkExperienceItem {
  jobTitle?: string | undefined;
  organization?: string | undefined;
  description?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  isCurrent?: boolean | undefined;
}

export interface CandidateEducationItem {
  degree?: string | undefined;
  organization?: string | undefined;
  major?: string | undefined;
  graduationYear?: number | undefined;
}

export interface CandidateProjectItem {
  title?: string | undefined;
  description?: string | undefined;
}

export interface CandidateEvidenceChunk {
  text: string;
  source: 'Work Experience' | 'Education' | 'Projects' | 'Skills' | 'Certifications' | 'Summary' | 'Document';
  jobTitle?: string | undefined;
  organization?: string | undefined;
}

export type SkillMatchLevel =
  | 'STRONG_MATCH'
  | 'MATCH'
  | 'PARTIAL_MATCH'
  | 'WEAK_EVIDENCE'
  | 'NO_EVIDENCE';

export type SkillMatchConfidence =
  | 'strong'
  | 'match'
  | 'partial'
  | 'weak'
  | 'none';

export type SkillConfidenceLabel =
  | 'Strong Match'
  | 'Match'
  | 'Partial Match'
  | 'Weak Evidence'
  | 'No Evidence';

export type RequirementImportance =
  | 'MANDATORY'
  | 'PREFERRED'
  | 'NICE_TO_HAVE'
  | 'HARD_GATE';

export interface SkillEvidenceItem {
  skill: string;
  category: 'required' | 'preferred' | 'nice_to_have' | 'hard_gate';
  confidence: SkillMatchConfidence;
  confidenceLabel: SkillConfidenceLabel;
  matchLevel: SkillMatchLevel;
  score: number; // 0.0 to 1.0 (anchored at 1.0, 0.75, 0.5, 0.25, 0.0)
  evidence: string[]; // Quotes/technologies from CV
  reason?: string | undefined;
  source?: string | undefined; // e.g. "Work Experience / Skills"
  importance?: RequirementImportance | undefined;
  hardGatePassed?: boolean | undefined;
}

export interface CandidateMatchProfile {
  skills?: string[] | null | undefined;
  experienceYears?: number | null | undefined;
  location?: string | null | undefined;
  certifications?: string[] | null | undefined;
  currentTitle?: string | null | undefined;
  rawText?: string | null | undefined;
  summary?: string | null | undefined;
  workHistory?: CandidateWorkExperienceItem[] | string | null | undefined;
  responsibilities?: string[] | null | undefined;
  projects?: CandidateProjectItem[] | string[] | null | undefined;
  education?: string | null | undefined;
  educationHistory?: CandidateEducationItem[] | null | undefined;
  projectHistory?: CandidateProjectItem[] | null | undefined;
  evidenceChunks?: CandidateEvidenceChunk[] | null | undefined;
}

export interface PositionRequirements {
  requiredSkills?: string[] | null | undefined;
  preferredSkills?: string[] | null | undefined;
  niceToHaveSkills?: string[] | null | undefined;
  hardGateSkills?: string[] | null | undefined;
  minExperienceYears?: number | null | undefined;
  location?: string | null | undefined;
  requiredCertifications?: string[] | null | undefined;
  department?: string | null | undefined;
  qualifications?: string | null | undefined;
  requiredEducation?: string | null | undefined;
}

export type MatchLevel = 'high' | 'moderate' | 'low';
export type CertificationEvidenceStatus = 'verified' | 'provided' | 'missing' | 'not_applicable';

export interface CriteriaBreakdown {
  score: number; // 0 - 100
  matchLevel: MatchLevel;
  breakdown: {
    skills: {
      matched: string[];
      missing: string[];
      percentage: number;
      weight: number;
      weightedScore: number;
      evidenceItems?: SkillEvidenceItem[] | undefined;
      requiredPercentage?: number | undefined;
      preferredPercentage?: number | undefined;
    };
    experience: {
      actual: number;
      required: number;
      met: boolean;
      percentage: number;
      weight: number;
      weightedScore: number;
    };
    certifications: {
      matched: string[];
      missing: string[];
      met: boolean;
      percentage: number;
      weight: number;
      weightedScore: number;
      evidenceStatus: CertificationEvidenceStatus;
    };
    location: {
      actual: string;
      expected: string;
      met: boolean;
      percentage: number;
      weight: number;
      weightedScore: number;
    };
  };
  summaryText: string;
}

// Use the expanded synonym groups from the skill taxonomy module
const ALIAS_GROUPS: string[][] = SYNONYM_GROUPS;

const STOPWORDS = new Set([
  'and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'an', 'a',
  'of', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else', 'when', 'up', 'down',
  'into', 'out', 'over', 'after', 'beneath', 'under', 'above'
]);

// Composite Competency Rules for technology and responsibility inference
interface CompositeCompetencyRule {
  name: string;
  aliases: string[];
  requiredDimensions: {
    name: string;
    keywords: string[];
  }[];
  responsibilityKeywords: string[];
  relatedOnlyKeywords?: string[];
}

const COMPOSITE_COMPETENCY_RULES: CompositeCompetencyRule[] = [
  {
    name: 'Full-Stack Web Development',
    aliases: [
      'full stack development',
      'full stack web development',
      'full-stack developer',
      'full stack software engineering',
      'full stack engineering',
    ],
    requiredDimensions: [
      {
        name: 'frontend',
        keywords: [
          'react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'vue', 'angular',
          'svelte', 'html5', 'css3', 'tailwind', 'javascript', 'typescript',
        ],
      },
      {
        name: 'backend',
        keywords: [
          'node', 'node.js', 'nodejs', 'express', 'nest.js', 'nestjs', '.net',
          'asp.net', 'c#', 'python', 'django', 'fastapi', 'flask', 'java',
          'spring', 'spring boot', 'laravel', 'ruby on rails', 'golang', 'go',
        ],
      },
      {
        name: 'database_or_api',
        keywords: [
          'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis',
          'rest api', 'restful', 'graphql', 'prisma', 'typeorm',
        ],
      },
    ],
    responsibilityKeywords: [
      'full stack', 'full-stack', 'frontend and backend', 'front-end and back-end',
      'developed end to end', 'developed web applications', 'built web applications',
      'full-stack web applications', 'full stack web apps',
    ],
  },
  {
    name: 'SQL Database Development & Administration',
    aliases: [
      'sql database development',
      'database administration',
      'database development & administration',
      'sql development and administration',
      'rdbms administration',
      'database development and administration',
    ],
    requiredDimensions: [
      {
        name: 'sql_technology',
        keywords: [
          'sql', 'postgresql', 'postgres', 'mysql', 'sql server', 'oracle',
          't-sql', 'pl/sql', 'rdbms', 'sqlite', 'mariadb',
        ],
      },
      {
        name: 'dev_or_admin_tasks',
        keywords: [
          'administered', 'administration', 'database development', 'schema design',
          'stored procedures', 'query optimization', 'performance tuning', 'indexing',
          'backup and recovery', 'replication', 'data modeling', 'ddl', 'dml', 'dba',
          'database architecture',
        ],
      },
    ],
    responsibilityKeywords: [
      'built and administered sql databases', 'administered sql', 'database administration',
      'database development', 'managed sql databases', 'optimized database queries',
      'administered databases', 'database administrator',
    ],
  },
  {
    name: 'Business Process Automation',
    aliases: [
      'process automation',
      'workflow automation',
      'business workflow automation',
      'enterprise automation',
    ],
    requiredDimensions: [
      {
        name: 'automation_core',
        keywords: [
          'power automate', 'zapier', 'make.com', 'camunda', 'n8n', 'uipath',
          'automation anywhere', 'workflow automation', 'process automation',
          'automated workflows', 'business process automation', 'system integrations',
          'automated business processes', 'robotic process automation', 'rpa',
        ],
      },
    ],
    responsibilityKeywords: [
      'built automated workflows', 'automated workflows', 'process automation',
      'system integrations', 'automated business processes', 'workflow integrations',
      'automated business process', 'process automations',
    ],
  },
  {
    name: 'Microsoft Power Platform',
    aliases: [
      'power platform',
      'ms power platform',
      'microsoft power platform development',
      'microsoft power platform process automation',
    ],
    requiredDimensions: [
      {
        name: 'platform_tools',
        keywords: [
          'power apps', 'power automate', 'power platform', 'dataverse',
          'power pages', 'power virtual agents',
        ],
      },
    ],
    relatedOnlyKeywords: ['power bi'], // Power BI alone does not prove Power Platform automation
    responsibilityKeywords: [
      'power apps development', 'power automate flows', 'power platform solutions',
    ],
  },
  {
    name: 'Cloud DevOps & CI/CD',
    aliases: [
      'devops',
      'ci/cd',
      'cloud devops',
      'devops engineering',
      'ci cd pipelines',
    ],
    requiredDimensions: [
      {
        name: 'container_or_cloud',
        keywords: ['docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'terraform'],
      },
      {
        name: 'pipeline_tooling',
        keywords: ['ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'argo cd'],
      },
    ],
    responsibilityKeywords: [
      'ci/cd pipelines', 'deployment pipelines', 'containerized applications',
      'infrastructure as code', 'continuous integration',
    ],
  },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAlias(norm: string, alias: string): boolean {
  if (norm === alias) return true;
  const regex = new RegExp(`(?:^|\\s)${escapeRegex(alias)}(?:$|\\s)`);
  return regex.test(norm);
}

const GENERIC_SKILL_WORDS = new Set([
  'skill',
  'skills',
  'management',
  'manager',
  'strategy',
  'strategic',
  'system',
  'systems',
  'service',
  'services',
  'analysis',
  'analyst',
  'development',
  'developer',
  'engineering',
  'engineer',
  'lead',
  'leader',
  'specialist',
  'officer',
  'coordinator',
  'general',
  'support',
  'operation',
  'operations',
]);

/**
 * Direct check whether two skill strings are equivalent (exact, plural, or alias)
 */
export function areSkillsEquivalent(s1: string, s2: string): boolean {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Handle simple plurals / singulars
  if (norm1 + 's' === norm2 || norm2 + 's' === norm1) return true;
  if (norm1 + 'es' === norm2 || norm2 + 'es' === norm1) return true;

  // Check alias groups with strict word-boundary matching
  for (const group of ALIAS_GROUPS) {
    const has1 = group.some((alias) => matchesAlias(norm1, alias));
    const has2 = group.some((alias) => matchesAlias(norm2, alias));
    if (has1 && has2) return true;
  }

  // Check if both skills map to the same competency (taxonomy-based equivalence)
  const comp1 = findCompetencyMapping(s1);
  const comp2 = findCompetencyMapping(s2);
  if (comp1 && comp2 && comp1.competency === comp2.competency) return true;

  // Token-based matching for compound phrases
  const shorter = norm1.length <= norm2.length ? norm1 : norm2;
  const longer = norm1.length <= norm2.length ? norm2 : norm1;

  if (shorter.length >= 4) {
    const shorterTokens = shorter.split(/\s+/).filter(Boolean);
    const longerTokens = longer.split(/\s+/).filter(Boolean);

    if (shorterTokens.length === 1 && shorterTokens[0] && GENERIC_SKILL_WORDS.has(shorterTokens[0])) {
      return false;
    }

    const phraseRegex = new RegExp(`(?:^|\\s)${escapeRegex(shorter)}(?:$|\\s)`);
    if (phraseRegex.test(longer)) {
      if (shorterTokens.length >= 2) return true;
      if (longerTokens.length <= 3 && !GENERIC_SKILL_WORDS.has(shorter)) {
        return true;
      }
    }
  }

  return false;
}

interface ExtractedEvidenceContext {
  workResponsibilities: string[];
  workExperienceItems: Array<{ title?: string | undefined; org?: string | undefined; desc?: string | undefined }>;
  projectItems: Array<{ title?: string | undefined; desc?: string | undefined }>;
  educationItems: Array<{ degree?: string | undefined; major?: string | undefined; org?: string | undefined }>;
  candSkills: string[];
  rawText: string;
  normFullText: string;
}

function extractEvidenceContext(candidate: CandidateMatchProfile): ExtractedEvidenceContext {
  const candSkills = (candidate.skills || []).filter(Boolean) as string[];

  // 1. Structured Work Experience
  const workExperienceItems: Array<{ title?: string | undefined; org?: string | undefined; desc?: string | undefined }> = [];
  const workResponsibilities: string[] = [...(candidate.responsibilities || [])];

  if (Array.isArray(candidate.workHistory)) {
    for (const item of candidate.workHistory) {
      if (typeof item === 'object' && item !== null) {
        workExperienceItems.push({
          title: item.jobTitle,
          org: item.organization,
          desc: item.description,
        });
        if (item.description) {
          // Split description by bullets or newlines into responsibilities
          const lines = item.description.split(/(?:\r?\n|[•▪▸—–-])+/).map((s) => s.trim()).filter((s) => s.length >= 15);
          workResponsibilities.push(...lines);
        }
      }
    }
  } else if (typeof candidate.workHistory === 'string') {
    const lines = candidate.workHistory.split(/(?:\r?\n|[•▪▸—–-])+/).map((s) => s.trim()).filter((s) => s.length >= 15);
    workResponsibilities.push(...lines);
  }

  // 2. Structured Projects
  const projectItems: Array<{ title?: string | undefined; desc?: string | undefined }> = [];
  const projectSources = candidate.projectHistory || candidate.projects || [];
  if (Array.isArray(projectSources)) {
    for (const p of projectSources) {
      if (typeof p === 'object' && p !== null) {
        projectItems.push({ title: p.title, desc: p.description });
      } else if (typeof p === 'string') {
        projectItems.push({ desc: p });
      }
    }
  }

  // 3. Structured Education
  const educationItems: Array<{ degree?: string | undefined; major?: string | undefined; org?: string | undefined }> = [];
  if (Array.isArray(candidate.educationHistory)) {
    for (const ed of candidate.educationHistory) {
      if (typeof ed === 'object' && ed !== null) {
        educationItems.push({
          degree: ed.degree,
          major: ed.major,
          org: ed.organization,
        });
      }
    }
  }
  if (candidate.education) {
    educationItems.push({ degree: candidate.education });
  }

  // 4. Evidence Chunks
  if (Array.isArray(candidate.evidenceChunks)) {
    for (const chunk of candidate.evidenceChunks) {
      if (chunk.source === 'Work Experience') {
        workResponsibilities.push(chunk.text);
      } else if (chunk.source === 'Projects') {
        projectItems.push({ desc: chunk.text });
      } else if (chunk.source === 'Education') {
        educationItems.push({ degree: chunk.text });
      }
    }
  }

  // 5. Full text representation
  const rawTextParts = [
    candidate.rawText || '',
    candidate.summary || '',
    candidate.currentTitle || '',
    ...workResponsibilities,
    ...projectItems.map((p) => [p.title, p.desc].filter(Boolean).join(' ')),
    ...educationItems.map((e) => [e.degree, e.major, e.org].filter(Boolean).join(' ')),
  ];
  const rawText = rawTextParts.join('\n');
  const normFullText = normalizeText(rawText);

  return {
    workResponsibilities: Array.from(new Set(workResponsibilities)),
    workExperienceItems,
    projectItems,
    educationItems,
    candSkills,
    rawText,
    normFullText,
  };
}

/**
 * Extracts relevant clean evidence sentences/snippets from candidate text
 */
function extractRelevantEvidence(
  rawText: string,
  candidate: CandidateMatchProfile,
  keywords: string[],
): string[] {
  const sources = [
    ...(candidate.responsibilities || []),
    ...(Array.isArray(candidate.workHistory)
      ? candidate.workHistory.map((w) => typeof w === 'object' ? w.description || '' : String(w))
      : candidate.workHistory ? [candidate.workHistory] : []),
    ...(candidate.projects ? candidate.projects.map((p) => typeof p === 'object' ? `${p.title || ''} ${p.description || ''}` : String(p)) : []),
    ...(candidate.summary ? [candidate.summary] : []),
    ...(rawText ? rawText.split(/(?:\r?\n|[•▪▸—–-])+/) : []),
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 300);

  const matchedSnippets: string[] = [];
  for (const snippet of sources) {
    const norm = normalizeText(snippet);
    const hasMatch = keywords.some((kw) => {
      const normKw = normalizeText(kw);
      if (normKw.length <= 3) {
        return new RegExp(`(?:^|\\s)${escapeRegex(normKw)}(?:$|\\s)`).test(norm);
      }
      return norm.includes(normKw);
    });

    if (hasMatch && !matchedSnippets.includes(snippet)) {
      matchedSnippets.push(snippet);
      if (matchedSnippets.length >= 3) break;
    }
  }
  return matchedSnippets;
}

/**
 * Evaluates a single required, preferred, or nice-to-have skill against full candidate CV evidence
 */
export function evaluateSkillEvidence(
  reqSkill: string,
  category: 'required' | 'preferred' | 'nice_to_have' | 'hard_gate',
  candidate: CandidateMatchProfile,
): SkillEvidenceItem {
  const normReq = normalizeText(reqSkill);
  const ctx = extractEvidenceContext(candidate);
  const { candSkills, rawText, normFullText, workResponsibilities, educationItems } = ctx;

  const importance: RequirementImportance =
    category === 'hard_gate'
      ? 'HARD_GATE'
      : category === 'preferred'
        ? 'PREFERRED'
        : category === 'nice_to_have'
          ? 'NICE_TO_HAVE'
          : 'MANDATORY';

  // -------------------------------------------------------------------------
  // GUARDRAIL 1: Strict Engineering Concepts (SOLID, Design Patterns, OOP)
  // Being a software developer must NOT automatically prove these competencies.
  // They require explicit or strongly defensible evidence in CV.
  // -------------------------------------------------------------------------
  const isSolidReq = /\bsolid\b/.test(normReq) || /\bsolid principles\b/.test(normReq);
  const isDesignPatternReq = /\bdesign patterns?\b/.test(normReq);
  const isOopReq = /\boop\b/.test(normReq) || /\bobject oriented\b/.test(normReq);

  if (isSolidReq || isDesignPatternReq || isOopReq) {
    let conceptRegex: RegExp;
    let conceptName: string;

    if (isSolidReq) {
      conceptRegex = /\bsolid\b|\bsolid principles\b/i;
      conceptName = 'SOLID Principles';
    } else if (isDesignPatternReq) {
      conceptRegex = /\bdesign patterns?\b/i;
      conceptName = 'Design Patterns';
    } else {
      conceptRegex = /\boop\b|\bobject[- ]oriented\b/i;
      conceptName = 'OOP (Object-Oriented Programming)';
    }

    // Check skills list
    const foundInSkills = candSkills.find((cs) => conceptRegex.test(cs));
    // Check responsibilities / work history
    const foundInResponsibilities = workResponsibilities.filter((r) => conceptRegex.test(r));
    // Check raw text
    const foundInText = conceptRegex.test(rawText);

    if (foundInResponsibilities.length > 0) {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'strong',
        confidenceLabel: 'Strong Match',
        matchLevel: 'STRONG_MATCH',
        score: 1.0,
        evidence: foundInResponsibilities.slice(0, 2).map((r) => `"${r}"`),
        reason: `Explicit evidence of ${conceptName} demonstrated in work responsibilities`,
        source: 'Work Experience',
      };
    } else if (foundInSkills) {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'strong',
        confidenceLabel: 'Strong Match',
        matchLevel: 'STRONG_MATCH',
        score: 1.0,
        evidence: [`Skill listed in candidate profile: "${foundInSkills}"`],
        reason: `Explicit skill listed: ${conceptName}`,
        source: 'Skills',
      };
    } else if (foundInText) {
      const corroborating = extractRelevantEvidence(rawText, candidate, [conceptName]);
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'match',
        confidenceLabel: 'Match',
        matchLevel: 'MATCH',
        score: 0.75,
        evidence: corroborating.map((c) => `"${c}"`),
        reason: `Explicitly mentioned in CV text`,
        source: 'Work Experience / Profile',
      };
    } else {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'none',
        confidenceLabel: 'No Evidence',
        matchLevel: 'NO_EVIDENCE',
        score: 0.0,
        evidence: [],
        reason: `Engineering concept requires explicit or strongly defensible evidence in CV (cannot be inferred solely from developer title)`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // GUARDRAIL 2: Education / Degree Field
  // "Bachelor's degree in CS / IS / Software Engineering or related field"
  // Do NOT assume the degree field if the CV does not state it.
  // -------------------------------------------------------------------------
  const isDegreeRequirement =
    /\b(?:bachelor|master|phd|degree|doctorate|b\.?sc|b\.?s|b\.?e|b\.?tech)\b/i.test(reqSkill) &&
    /\b(?:cs|is|computer science|information systems|software engineering|information technology|it|informatics)\b/i.test(reqSkill);

  if (isDegreeRequirement) {
    const csMajors = ['computer science', 'cs', 'information systems', 'is', 'software engineering', 'computer engineering', 'informatics', 'information technology', 'it'];
    const degreeLevels = ['bachelor', 'bsc', 'bs', 'b s', 'b sc', 'b tech', 'be', 'undergraduate'];

    let foundMatchingMajor = false;
    let foundDegreeLevelWithoutMajor = false;
    let degreeEvidence = '';

    for (const ed of educationItems) {
      const fullEd = `${ed.degree || ''} ${ed.major || ''} ${ed.org || ''}`.toLowerCase();
      const hasDegreeLevel = degreeLevels.some((dl) => fullEd.includes(dl));
      const hasCsMajor = csMajors.some((m) => {
        const regex = new RegExp(`(?:^|\\s)${escapeRegex(m)}(?:$|\\s)`);
        return regex.test(fullEd) || (ed.major && normalizeText(ed.major) === m);
      });

      if (hasDegreeLevel && hasCsMajor) {
        foundMatchingMajor = true;
        degreeEvidence = [ed.degree, ed.major, ed.org].filter(Boolean).join(' - ');
        break;
      } else if (hasDegreeLevel) {
        // If an explicit major was given that is NOT CS/IS/SE (e.g. Philosophy, Arts, Commerce),
        // it's an unrelated major (NO_EVIDENCE), not an unstated major (PARTIAL_MATCH).
        const explicitMajor = ed.major?.trim();
        const isExplicitUnrelated = Boolean(explicitMajor && explicitMajor.length > 0) || /\b(?:philosophy|literature|history|accounting|finance|marketing|nursing|medicine|law|arts)\b/i.test(fullEd);

        if (!isExplicitUnrelated && !degreeEvidence) {
          foundDegreeLevelWithoutMajor = true;
          degreeEvidence = [ed.degree, ed.major, ed.org].filter(Boolean).join(' - ');
        }
      }
    }

    if (foundMatchingMajor) {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'strong',
        confidenceLabel: 'Strong Match',
        matchLevel: 'STRONG_MATCH',
        score: 1.0,
        evidence: [degreeEvidence || 'Bachelor degree in Computer Science / Software Engineering'],
        reason: 'Bachelor degree and required major verified in CV',
        source: 'Education',
      };
    } else if (foundDegreeLevelWithoutMajor) {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'partial',
        confidenceLabel: 'Partial Match',
        matchLevel: 'PARTIAL_MATCH',
        score: 0.5,
        evidence: [degreeEvidence || 'Bachelor degree recorded without specified major'],
        reason: 'Bachelor degree confirmed, but major/field of study is not stated in CV',
        source: 'Education',
      };
    } else {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'none',
        confidenceLabel: 'No Evidence',
        matchLevel: 'NO_EVIDENCE',
        score: 0.0,
        evidence: [],
        reason: 'No evidence of required degree in Computer Science, Information Systems, or Software Engineering',
        source: 'Education',
      };
    }
  }

  // -------------------------------------------------------------------------
  // GUARDRAIL 3: Automation Tools (Power Platform vs. Power BI)
  // Power BI alone must NOT prove Power Automate / Power Apps / Automation.
  // -------------------------------------------------------------------------
  const isPowerPlatformReq =
    normReq.includes('power platform') ||
    normReq.includes('power automate') ||
    normReq.includes('power apps') ||
    normReq.includes('microsoft power platform') ||
    (normReq.includes('process automation') && normReq.includes('microsoft'));

  if (isPowerPlatformReq) {
    const automationTools = ['power automate', 'power apps', 'dataverse', 'power pages', 'power virtual agents', 'zapier', 'make.com', 'n8n', 'camunda', 'uipath', 'rpa'];
    const foundAutoTools = candSkills.filter((cs) =>
      automationTools.some((at) => areSkillsEquivalent(cs, at) || normalizeText(cs).includes(at)),
    );

    const autoResponsibilities = workResponsibilities.filter((r) => {
      const normR = normalizeText(r);
      return (
        normR.includes('power automate') ||
        normR.includes('power apps') ||
        normR.includes('dataverse') ||
        normR.includes('power platform') ||
        normR.includes('zapier') ||
        normR.includes('uipath')
      );
    });

    const hasPowerBiOnly =
      candSkills.some((cs) => normalizeText(cs) === 'power bi' || normalizeText(cs).includes('power bi')) ||
      normFullText.includes('power bi');

    if (autoResponsibilities.length > 0 || foundAutoTools.length > 0) {
      const evidence: string[] = [];
      if (autoResponsibilities.length > 0) evidence.push(...autoResponsibilities.slice(0, 2).map((r) => `"${r}"`));
      if (foundAutoTools.length > 0) evidence.push(`Automation tools: ${foundAutoTools.join(', ')}`);

      return {
        skill: reqSkill,
        category,
        importance,
        confidence: autoResponsibilities.length > 0 ? 'strong' : 'match',
        confidenceLabel: autoResponsibilities.length > 0 ? 'Strong Match' : 'Match',
        matchLevel: autoResponsibilities.length > 0 ? 'STRONG_MATCH' : 'MATCH',
        score: autoResponsibilities.length > 0 ? 1.0 : 0.75,
        evidence,
        reason: 'Demonstrated process automation and Power Platform tooling',
        source: autoResponsibilities.length > 0 ? 'Work Experience / Skills' : 'Skills',
      };
    } else if (hasPowerBiOnly) {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'weak',
        confidenceLabel: 'Weak Evidence',
        matchLevel: 'WEAK_EVIDENCE',
        score: 0.25,
        evidence: ['Power BI demonstrated in candidate profile/CV'],
        reason: 'Power BI demonstrated, but lacks Power Automate / Power Apps process automation evidence',
        source: 'Skills',
      };
    } else {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'none',
        confidenceLabel: 'No Evidence',
        matchLevel: 'NO_EVIDENCE',
        score: 0.0,
        evidence: [],
        reason: 'No evidence of Microsoft Power Platform or process automation tooling',
      };
    }
  }

  // -------------------------------------------------------------------------
  // 1. Direct Skill or Alias Match in candidate skills list
  // -------------------------------------------------------------------------
  const directSkillMatch = candSkills.find((cs) => areSkillsEquivalent(cs, reqSkill));
  if (directSkillMatch) {
    const corroborating = extractRelevantEvidence(rawText, candidate, [reqSkill, directSkillMatch]);
    const evidence = [
      `Skill listed in candidate profile: "${directSkillMatch}"`,
      ...corroborating.map((s) => `"${s}"`),
    ];
    return {
      skill: reqSkill,
      category,
      importance,
      confidence: 'strong',
      confidenceLabel: 'Strong Match',
      matchLevel: 'STRONG_MATCH',
      score: 1.0,
      evidence,
      reason: `Direct skill match with profile`,
      source: corroborating.length > 0 ? 'Work Experience / Skills' : 'Skills',
    };
  }

  // -------------------------------------------------------------------------
  // 2. Composite Competency Rules & Taxonomy Matching
  // Evaluates Full-Stack Web Dev, SQL DB Dev & Admin, Process Automation, etc.
  // -------------------------------------------------------------------------
  const matchingRule = COMPOSITE_COMPETENCY_RULES.find(
    (r) =>
      normalizeText(r.name) === normReq ||
      r.aliases.some((a) => normalizeText(a) === normReq || normReq.includes(normalizeText(a))),
  );

  const taxonomyMapping = !matchingRule ? findCompetencyMapping(reqSkill) : null;

  const effectiveRule = matchingRule || (taxonomyMapping ? {
    name: taxonomyMapping.competency,
    aliases: taxonomyMapping.aliases,
    requiredDimensions: taxonomyMapping.dimensions.map((d) => ({
      name: d.name,
      keywords: d.technologies,
    })),
    responsibilityKeywords: taxonomyMapping.responsibilityPhrases,
    relatedOnlyKeywords: taxonomyMapping.relatedOnlyTechnologies,
  } : null);

  if (effectiveRule) {
    const matchedDimensions: string[] = [];
    const dimensionEvidence: string[] = [];

    for (const dim of effectiveRule.requiredDimensions) {
      const foundInSkills = candSkills.filter((cs) =>
        dim.keywords.some((kw) => areSkillsEquivalent(cs, kw)),
      );
      const foundInText = dim.keywords.filter((kw) => {
        const normKw = normalizeText(kw);
        return normKw.length <= 3
          ? new RegExp(`(?:^|\\s)${escapeRegex(normKw)}(?:$|\\s)`).test(normFullText)
          : normFullText.includes(normKw);
      });

      const uniqueFound = Array.from(new Set([...foundInSkills, ...foundInText]));
      if (uniqueFound.length > 0) {
        matchedDimensions.push(dim.name);
        dimensionEvidence.push(...uniqueFound);
      }
    }

    const respEvidence = extractRelevantEvidence(
      rawText,
      candidate,
      effectiveRule.responsibilityKeywords,
    );

    // Guardrail: Verify related-only keywords alone do not trigger match
    if (effectiveRule.relatedOnlyKeywords) {
      const hasOnlyRelated = effectiveRule.relatedOnlyKeywords.some(
        (kw) =>
          candSkills.some((cs) => areSkillsEquivalent(cs, kw)) ||
          normFullText.includes(normalizeText(kw)),
      );
      if (hasOnlyRelated && matchedDimensions.length === 0 && respEvidence.length === 0) {
        return {
          skill: reqSkill,
          category,
          importance,
          confidence: 'weak',
          confidenceLabel: 'Weak Evidence',
          matchLevel: 'WEAK_EVIDENCE',
          score: 0.25,
          evidence: [
            `Related technology demonstrated (${effectiveRule.relatedOnlyKeywords.join(', ')}), but missing core ${effectiveRule.name} tooling`,
          ],
          reason: `Only related tools found without core competency`,
          source: 'Skills',
        };
      }
    }

    const totalDims = effectiveRule.requiredDimensions.length;
    const dimRatio = matchedDimensions.length / totalDims;

    // Strong Match: Direct responsibility evidence PLUS supporting technologies
    if (respEvidence.length > 0 && dimRatio >= 0.66) {
      const evidence: string[] = [
        ...respEvidence.slice(0, 2).map((s) => `"${s}"`),
        ...(dimensionEvidence.length > 0
          ? [`Technologies demonstrated: ${Array.from(new Set(dimensionEvidence)).slice(0, 8).join(', ')}`]
          : []),
      ];
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'strong',
        confidenceLabel: 'Strong Match',
        matchLevel: 'STRONG_MATCH',
        score: 1.0,
        evidence,
        reason: 'Direct responsibility evidence plus supporting technology evidence.',
        source: 'Work Experience / Skills',
      };
    }

    // Direct responsibility alone (e.g. "built automated workflows and business process automation")
    if (respEvidence.length > 0 && totalDims <= 1) {
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'strong',
        confidenceLabel: 'Strong Match',
        matchLevel: 'STRONG_MATCH',
        score: 1.0,
        evidence: respEvidence.slice(0, 2).map((s) => `"${s}"`),
        reason: 'Direct responsibility evidence demonstrated in work experience.',
        source: 'Work Experience',
      };
    }

    // Match: All required technology dimensions demonstrated
    if (dimRatio === 1.0) {
      const evidence: string[] = [
        ...(respEvidence.length > 0 ? respEvidence.map((s) => `"${s}"`) : []),
        `Technologies demonstrated: ${Array.from(new Set(dimensionEvidence)).slice(0, 8).join(', ')}`,
      ];
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'match',
        confidenceLabel: 'Match',
        matchLevel: 'MATCH',
        score: respEvidence.length > 0 ? 1.0 : 0.9,
        evidence,
        reason: 'Demonstrated across required technology dimensions',
        source: respEvidence.length > 0 ? 'Work Experience / Skills' : 'Skills',
      };
    }

    // Partial Match: Partial technology dimensions demonstrated
    if (dimRatio >= 0.33 || respEvidence.length > 0) {
      const evidence: string[] = [];
      if (respEvidence.length > 0) evidence.push(...respEvidence.map((s) => `"${s}"`));
      if (dimensionEvidence.length > 0) {
        evidence.push(`Partial technologies demonstrated: ${Array.from(new Set(dimensionEvidence)).join(', ')}`);
      }
      return {
        skill: reqSkill,
        category,
        importance,
        confidence: 'partial',
        confidenceLabel: 'Partial Match',
        matchLevel: 'PARTIAL_MATCH',
        score: 0.5,
        evidence,
        reason: `Partial competency demonstrated (${matchedDimensions.join(', ')} met)`,
        source: respEvidence.length > 0 ? 'Work Experience' : 'Skills',
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. Evidence-Based Ranking Search (fallback for novel/unmapped competencies)
  // -------------------------------------------------------------------------
  const reqWords = normReq.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (reqWords.length > 0) {
    const projectStrings = ctx.projectItems
      .map((p) => [p.title, p.desc].filter(Boolean).join(': '))
      .filter(Boolean);

    const ranked = rankEvidence(
      reqSkill,
      rawText,
      workResponsibilities.length > 0 ? workResponsibilities : candidate.responsibilities || undefined,
      projectStrings.length > 0 ? projectStrings : undefined,
      candidate.summary || undefined,
      reqWords,
      3,
    );

    if (ranked.length > 0) {
      const { classification } = computeEvidenceStrength(ranked, reqWords.length);
      const evidenceSnippets = ranked.map((r) => `"${r.snippet}"`);

      const confidenceMap: Record<string, SkillMatchConfidence> = {
        strong: 'match',
        match: 'match',
        partial: 'partial',
        weak: 'weak',
        none: 'none',
      };
      const labelMap: Record<string, SkillConfidenceLabel> = {
        strong: 'Match',
        match: 'Match',
        partial: 'Partial Match',
        weak: 'Weak Evidence',
        none: 'No Evidence',
      };
      const matchLevelMap: Record<string, SkillMatchLevel> = {
        strong: 'MATCH',
        match: 'MATCH',
        partial: 'PARTIAL_MATCH',
        weak: 'WEAK_EVIDENCE',
        none: 'NO_EVIDENCE',
      };
      const scoreMap: Record<string, number> = {
        strong: 0.9,
        match: 0.75,
        partial: 0.5,
        weak: 0.25,
        none: 0.0,
      };
      const reasonMap: Record<string, string> = {
        strong: 'Strongly demonstrated through job responsibilities/projects in CV',
        match: 'Demonstrated through job responsibilities/projects in CV',
        partial: 'Partially demonstrated through responsibilities in CV',
        weak: 'Mentions related concepts without full competency demonstration',
        none: 'No defensible evidence found in CV',
      };

      if (classification !== 'none') {
        return {
          skill: reqSkill,
          category,
          importance,
          confidence: confidenceMap[classification] || 'match',
          confidenceLabel: labelMap[classification] || 'Match',
          matchLevel: matchLevelMap[classification] || 'MATCH',
          score: scoreMap[classification] ?? 0.75,
          evidence: evidenceSnippets,
          reason: reasonMap[classification] || 'Evidence found in CV',
          source: 'Work Experience / CV',
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. No Reasonable Evidence in CV
  // -------------------------------------------------------------------------
  return {
    skill: reqSkill,
    category,
    importance,
    confidence: 'none',
    confidenceLabel: 'No Evidence',
    matchLevel: 'NO_EVIDENCE',
    score: 0.0,
    evidence: [],
    reason: `No evidence found in skills, responsibilities, projects, or summary`,
  };
}

/**
 * Extracts recognized healthcare certifications from free-text qualifications string if array is empty
 */
function extractCertificationsFromText(text?: string | null): string[] {
  if (!text) return [];
  const normalized = normalizeText(text);
  const detected: string[] = [];

  const certKeywords = [
    'scfhs',
    'bls',
    'acls',
    'pals',
    'atls',
    'cpr',
    'board certified',
    'fellowship',
    'consultant',
    'specialist',
    'cphq',
    'pmp',
  ];

  for (const kw of certKeywords) {
    if (normalized.includes(kw)) {
      detected.push(kw.toUpperCase());
    }
  }

  return detected;
}

/**
 * Evaluates whether two location descriptions represent the same operating hub
 */
function areLocationsEquivalent(candLoc: string, reqLoc: string): boolean {
  if (!candLoc || !reqLoc) return false;

  // In Saudi German Health, the Offshore operational hub is based in Cairo, Egypt
  const normCand = normalizeText(candLoc).replace(/\boffshore\b/g, 'cairo');
  const normReq = normalizeText(reqLoc).replace(/\boffshore\b/g, 'cairo');

  if (!normCand || !normReq) return false;
  if (normCand === normReq) return true;
  if (normCand.includes(normReq) || normReq.includes(normCand)) return true;

  // Match known SGH operating cities
  const CITIES = [
    'cairo',
    'riyadh',
    'jeddah',
    'dammam',
    'madinah',
    'makkah',
    'dubai',
    'sharjah',
    'ajman',
    'alexandria',
    'giza',
  ];
  const candTokens = normCand.split(/\s+/);
  const reqTokens = normReq.split(/\s+/);

  for (const city of CITIES) {
    if (candTokens.includes(city) && reqTokens.includes(city)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates deterministic % Match Score and detailed criteria breakdown
 */
/** Optional weight configuration for different vacancy types */
export interface MatchWeights {
  skills?: number;
  experience?: number;
  certifications?: number;
  location?: number;
}

export function calculateCandidateFitScore(
  candidate: CandidateMatchProfile,
  requirements: PositionRequirements,
  weights?: MatchWeights,
): CriteriaBreakdown {
  // Allow configurable weights (default: 40/25/25/10)
  const WEIGHT_SKILLS = weights?.skills ?? 0.4;
  const WEIGHT_EXP = weights?.experience ?? 0.25;
  const WEIGHT_CERTS = weights?.certifications ?? 0.25;
  const WEIGHT_LOC = weights?.location ?? 0.1;

  // 1. Evidence-Based Skills Matching (40%)
  const rawHardSkills = (requirements.hardGateSkills || []).filter(Boolean) as string[];
  const rawReqSkills = (requirements.requiredSkills || []).filter(Boolean) as string[];
  const rawPrefSkills = (requirements.preferredSkills || []).filter(Boolean) as string[];
  const rawNiceSkills = (requirements.niceToHaveSkills || []).filter(Boolean) as string[];

  const evidenceItems: SkillEvidenceItem[] = [];

  for (const hardSkill of rawHardSkills) {
    const item = evaluateSkillEvidence(hardSkill, 'hard_gate', candidate);
    item.hardGatePassed = item.score >= 0.5;
    evidenceItems.push(item);
  }
  for (const reqSkill of rawReqSkills) {
    evidenceItems.push(evaluateSkillEvidence(reqSkill, 'required', candidate));
  }
  for (const prefSkill of rawPrefSkills) {
    evidenceItems.push(evaluateSkillEvidence(prefSkill, 'preferred', candidate));
  }
  for (const niceSkill of rawNiceSkills) {
    evidenceItems.push(evaluateSkillEvidence(niceSkill, 'nice_to_have', candidate));
  }

  // Backwards-compatible matched and missing arrays
  const matchedSkills = evidenceItems
    .filter((item) => item.score >= 0.5)
    .map((item) => item.skill);

  // A skill is only marked "Missing" when there is genuinely no reasonable evidence in the CV
  const missingSkills = evidenceItems
    .filter((item) => (item.category === 'required' || item.category === 'hard_gate') && item.score < 0.5)
    .map((item) => item.skill);

  // Calculate percentage with partial credit and preferred skill weighting
  let skillsPercentage = 100;
  const requiredItems = evidenceItems.filter((i) => i.category === 'required' || i.category === 'hard_gate');
  const preferredItems = evidenceItems.filter(
    (i) => i.category === 'preferred' || i.category === 'nice_to_have',
  );

  let requiredPercentage = 100;
  let preferredPercentage: number | undefined;

  if (requiredItems.length > 0) {
    const requiredScoreSum = requiredItems.reduce((acc, curr) => acc + curr.score, 0);
    requiredPercentage = Math.round((requiredScoreSum / requiredItems.length) * 100);

    if (preferredItems.length > 0) {
      const preferredScoreSum = preferredItems.reduce((acc, curr) => acc + curr.score, 0);
      preferredPercentage = Math.round((preferredScoreSum / preferredItems.length) * 100);

      // Preferred skills act as differentiators without penalizing the mandatory required benchmark
      const prefBonus = (preferredScoreSum / preferredItems.length) * 15;
      skillsPercentage = Math.min(100, Math.round(requiredPercentage * 0.95 + prefBonus * 0.33));
      skillsPercentage = Math.max(requiredPercentage, skillsPercentage);
    } else {
      skillsPercentage = requiredPercentage;
    }
  } else if (preferredItems.length > 0) {
    const preferredScoreSum = preferredItems.reduce((acc, curr) => acc + curr.score, 0);
    skillsPercentage = Math.round((preferredScoreSum / preferredItems.length) * 100);
  } else {
    // If no skills explicitly required, give 100% if candidate has skills, else 85% baseline
    const candSkills = (candidate.skills || []).filter(Boolean);
    skillsPercentage = candSkills.length > 0 ? 100 : 85;
  }

  const weightedScoreSkills = Math.round(skillsPercentage * WEIGHT_SKILLS);

  // 2. Experience Matching (25%)
  const actualExp = Math.max(0, candidate.experienceYears ?? 0);
  const requiredExp = Math.max(0, requirements.minExperienceYears ?? 0);

  let expPercentage = 100;
  let expMet = true;

  if (requiredExp > 0) {
    if (actualExp >= requiredExp) {
      expPercentage = 100;
      expMet = true;
    } else if (actualExp > 0) {
      expPercentage = Math.min(95, Math.round((actualExp / requiredExp) * 100));
      expMet = false;
    } else {
      expPercentage = 0;
      expMet = false;
    }
  }
  const weightedScoreExp = Math.round(expPercentage * WEIGHT_EXP);

  // 3. Certifications / Licenses Matching (25%)
  let reqCerts = (requirements.requiredCertifications || []).filter(Boolean) as string[];
  if (reqCerts.length === 0 && requirements.qualifications) {
    reqCerts = extractCertificationsFromText(requirements.qualifications);
  }

  const candCerts = (candidate.certifications || []).filter(Boolean) as string[];
  let matchedCerts: string[] = [];
  let missingCerts: string[] = [];
  let certPercentage: number;
  let certMet: boolean;
  let certificationEvidenceStatus: CertificationEvidenceStatus;

  if (reqCerts.length > 0) {
    matchedCerts = reqCerts.filter((rc) =>
      candCerts.some((cc) => areSkillsEquivalent(cc, rc)),
    );
    missingCerts = reqCerts.filter((rc) => !matchedCerts.includes(rc));
    certPercentage = Math.round((matchedCerts.length / reqCerts.length) * 100);
    certMet = missingCerts.length === 0;
    certificationEvidenceStatus = certMet ? 'provided' : 'missing';
  } else {
    certPercentage = candCerts.length > 0 ? 100 : 0;
    certMet = false;
    certificationEvidenceStatus = candCerts.length > 0 ? 'provided' : 'not_applicable';
  }
  const weightedScoreCerts = Math.round(certPercentage * WEIGHT_CERTS);

  // 4. Location Matching (10%)
  const candLoc = (candidate.location || '').trim();
  const reqLoc = (requirements.location || '').trim();

  let locPercentage = 100;
  let locMet = true;

  if (reqLoc && !['remote', 'any', 'all branches'].includes(reqLoc.toLowerCase())) {
    if (!candLoc) {
      locPercentage = 50; // Unknown candidate location -> neutral relocation assumption
      locMet = false;
    } else if (areLocationsEquivalent(candLoc, reqLoc)) {
      locPercentage = 100;
      locMet = true;
    } else {
      locPercentage = 40; // Different city/country (relocation required)
      locMet = false;
    }
  }
  const weightedScoreLoc = Math.round(locPercentage * WEIGHT_LOC);

  // Overall Score Calculation (Clamped 0 - 100)
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      weightedScoreSkills + weightedScoreExp + weightedScoreCerts + weightedScoreLoc,
    ),
  );

  let matchLevel: MatchLevel = 'low';
  if (totalScore >= 80) {
    matchLevel = 'high';
  } else if (totalScore >= 60) {
    matchLevel = 'moderate';
  }

  // Generate dynamic summary
  let summaryText: string;
  if (matchLevel === 'high') {
    summaryText = `Strong candidate match (${totalScore}%). Exceeds or meets primary skill and qualification benchmarks.`;
  } else if (matchLevel === 'moderate') {
    summaryText = `Good potential match (${totalScore}%). Meets core competencies with minor experience or certification gap.`;
  } else {
    summaryText = `Below target benchmark (${totalScore}%). Significant gaps identified in mandatory skills or experience.`;
  }

  return {
    score: totalScore,
    matchLevel,
    breakdown: {
      skills: {
        matched: matchedSkills,
        missing: missingSkills,
        percentage: skillsPercentage,
        weight: WEIGHT_SKILLS,
        weightedScore: weightedScoreSkills,
        evidenceItems,
        requiredPercentage,
        preferredPercentage,
      },
      experience: {
        actual: actualExp,
        required: requiredExp,
        met: expMet,
        percentage: expPercentage,
        weight: WEIGHT_EXP,
        weightedScore: weightedScoreExp,
      },
      certifications: {
        matched: matchedCerts,
        missing: missingCerts,
        met: certMet,
        percentage: certPercentage,
        weight: WEIGHT_CERTS,
        weightedScore: weightedScoreCerts,
        evidenceStatus: certificationEvidenceStatus,
      },
      location: {
        actual: candLoc || 'Not specified',
        expected: reqLoc || 'Flexible / Any',
        met: locMet,
        percentage: locPercentage,
        weight: WEIGHT_LOC,
        weightedScore: weightedScoreLoc,
      },
    },
    summaryText,
  };
}
