/**
 * Pure Deterministic Candidate Match Engine
 * Evaluates candidate qualifications against position/vacancy requirements.
 */

export interface CandidateMatchProfile {
  skills?: string[] | null;
  experienceYears?: number | null;
  location?: string | null;
  certifications?: string[] | null;
  currentTitle?: string | null;
}

export interface PositionRequirements {
  requiredSkills?: string[] | null;
  minExperienceYears?: number | null;
  location?: string | null;
  requiredCertifications?: string[] | null;
  department?: string | null;
  qualifications?: string | null;
}

export type MatchLevel = 'high' | 'moderate' | 'low';

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

// Healthcare and IT skill alias mappings for intelligent fuzzy matching
const ALIAS_GROUPS: string[][] = [
  ['ehr', 'emr', 'electronic health records', 'electronic medical records'],
  ['icu', 'intensive care unit', 'critical care'],
  ['cpr', 'cardiopulmonary resuscitation'],
  ['bls', 'basic life support'],
  ['acls', 'advanced cardiovascular life support'],
  ['pals', 'pediatric advanced life support'],
  ['scfhs', 'saudi commission for health specialties', 'saudi medical council'],
  ['nicu', 'neonatal intensive care'],
  ['picu', 'pediatric intensive care'],
  ['or', 'operating room', 'surgical suite', 'perioperative'],
  ['er', 'emergency room', 'ed', 'emergency department'],
  ['ts', 'typescript'],
  ['js', 'javascript'],
  ['react', 'reactjs', 'react.js'],
  ['node', 'nodejs', 'node.js'],
  ['postgres', 'postgresql'],
  ['qa', 'quality assurance', 'software testing'],
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areSkillsEquivalent(s1: string, s2: string): boolean {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check alias groups
  for (const group of ALIAS_GROUPS) {
    const has1 = group.some((alias) => norm1 === alias || norm1.includes(alias));
    const has2 = group.some((alias) => norm2 === alias || norm2.includes(alias));
    if (has1 && has2) return true;
  }

  return false;
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
 * Calculates deterministic % Match Score and detailed criteria breakdown
 */
export function calculateCandidateFitScore(
  candidate: CandidateMatchProfile,
  requirements: PositionRequirements,
): CriteriaBreakdown {
  const WEIGHT_SKILLS = 0.4;
  const WEIGHT_EXP = 0.25;
  const WEIGHT_CERTS = 0.25;
  const WEIGHT_LOC = 0.1;

  // 1. Skills Matching (40%)
  const rawCandidateSkills = (candidate.skills || []).filter(Boolean);
  const rawReqSkills = (requirements.requiredSkills || []).filter(Boolean);

  let matchedSkills: string[] = [];
  let missingSkills: string[] = [];
  let skillsPercentage = 100;

  if (rawReqSkills.length > 0) {
    matchedSkills = rawReqSkills.filter((reqSkill) =>
      rawCandidateSkills.some((candSkill) => areSkillsEquivalent(candSkill, reqSkill)),
    );
    missingSkills = rawReqSkills.filter(
      (reqSkill) => !matchedSkills.includes(reqSkill),
    );
    skillsPercentage = Math.round((matchedSkills.length / rawReqSkills.length) * 100);
  } else {
    // If no skills explicitly required, give 100% if candidate has skills, else 85% baseline
    skillsPercentage = rawCandidateSkills.length > 0 ? 100 : 85;
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
  let reqCerts = (requirements.requiredCertifications || []).filter(Boolean);
  if (reqCerts.length === 0 && requirements.qualifications) {
    reqCerts = extractCertificationsFromText(requirements.qualifications);
  }

  const candCerts = (candidate.certifications || []).filter(Boolean);
  let matchedCerts: string[] = [];
  let missingCerts: string[] = [];
  let certPercentage = 100;
  let certMet = true;

  if (reqCerts.length > 0) {
    matchedCerts = reqCerts.filter((rc) =>
      candCerts.some((cc) => areSkillsEquivalent(cc, rc)),
    );
    missingCerts = reqCerts.filter((rc) => !matchedCerts.includes(rc));
    certPercentage = Math.round((matchedCerts.length / reqCerts.length) * 100);
    certMet = missingCerts.length === 0;
  } else {
    // No certs strictly specified
    certPercentage = candCerts.length > 0 ? 100 : 90;
    certMet = true;
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
    } else {
      const normCand = normalizeText(candLoc);
      const normReq = normalizeText(reqLoc);
      if (normCand.includes(normReq) || normReq.includes(normCand)) {
        locPercentage = 100;
        locMet = true;
      } else {
        locPercentage = 40; // Different city/country (relocation required)
        locMet = false;
      }
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

  // Generate dynamic clinical/ATS summary
  let summaryText = '';
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
