/**
 * HardGateEvaluator — Formal hard-gate layer for binary eligibility checks.
 *
 * Runs BEFORE skill scoring to reject ineligible candidates immediately.
 * Inspired by sliday (hard gates → then score) and semantic-resume-matcher
 * (deterministic recruiter guardrails).
 *
 * Hard gates are BINARY: pass or fail. A failed hard gate means the candidate
 * should not proceed to skill scoring at all (or should be flagged with
 * an eligibility warning).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HardGateResult {
  gate: string;
  passed: boolean;
  reason: string;
  /** When true, this is an absolute blocker. When false, it's a warning. */
  blocking: boolean;
}

export interface HardGateEvaluation {
  /** Overall pass/fail — false if ANY blocking gate failed */
  passed: boolean;
  /** Individual gate results */
  gates: HardGateResult[];
  /** Summary of failed gates */
  failedGates: string[];
  /** Summary of warnings (non-blocking failures) */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Gate Input Types
// ---------------------------------------------------------------------------

export interface CandidateGateProfile {
  certifications?: string[];
  location?: string;
  nationality?: string;
  languages?: string[];
  experienceYears?: number;
  education?: string;
  visaStatus?: string;
  clinicalDomain?: string;
  subspecialties?: string[];
}

export interface PositionGateRequirements {
  /** Required certifications (hard blocker if missing) */
  requiredCertifications?: string[];
  /** Required location or country */
  requiredLocation?: string;
  /** Minimum experience years */
  minimumExperience?: number;
  /** Required education level */
  requiredEducation?: string;
  /** Required languages */
  requiredLanguages?: string[];
  /** Required nationality or visa eligibility */
  requiredNationality?: string;
  /** Required clinical domain (for medical positions) */
  requiredClinicalDomain?: string;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function norm(text?: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normArray(arr?: string[]): string[] {
  return (arr || []).map((s) => norm(s)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Gate Evaluators
// ---------------------------------------------------------------------------

function evaluateCertificationGate(
  candidateCerts: string[],
  requiredCerts: string[],
): HardGateResult[] {
  const results: HardGateResult[] = [];
  const normCandidateCerts = normArray(candidateCerts);

  for (const reqCert of requiredCerts) {
    const normReqCert = norm(reqCert);
    const found = normCandidateCerts.some((cc) =>
      cc.includes(normReqCert) || normReqCert.includes(cc),
    );

    results.push({
      gate: `Certification: ${reqCert}`,
      passed: found,
      reason: found
        ? `Candidate has "${reqCert}" or equivalent certification`
        : `Candidate is missing required certification: "${reqCert}"`,
      blocking: true,
    });
  }

  return results;
}

function evaluateLocationGate(
  candidateLocation?: string,
  requiredLocation?: string,
): HardGateResult | null {
  if (!requiredLocation) return null;

  const normCandLoc = norm(candidateLocation);
  const normReqLoc = norm(requiredLocation);

  if (!normCandLoc) {
    return {
      gate: `Location: ${requiredLocation}`,
      passed: false,
      reason: `Candidate location unknown; required: "${requiredLocation}"`,
      blocking: false, // Warning only — location might be in additional data
    };
  }

  const passed = normCandLoc.includes(normReqLoc) || normReqLoc.includes(normCandLoc);

  return {
    gate: `Location: ${requiredLocation}`,
    passed,
    reason: passed
      ? `Candidate is in/near "${requiredLocation}"`
      : `Candidate is in "${candidateLocation}"; position requires "${requiredLocation}"`,
    blocking: false, // Location is usually a warning, not hard block
  };
}

function evaluateExperienceGate(
  candidateYears?: number,
  minimumYears?: number,
): HardGateResult | null {
  if (minimumYears == null || minimumYears <= 0) return null;

  if (candidateYears == null) {
    return {
      gate: `Minimum Experience: ${minimumYears} years`,
      passed: false,
      reason: `Candidate experience years unknown; minimum required: ${minimumYears} years`,
      blocking: false,
    };
  }

  const passed = candidateYears >= minimumYears;

  return {
    gate: `Minimum Experience: ${minimumYears} years`,
    passed,
    reason: passed
      ? `Candidate has ${candidateYears} years experience (minimum: ${minimumYears})`
      : `Candidate has ${candidateYears} years experience; minimum required: ${minimumYears}`,
    blocking: minimumYears > 0 && candidateYears < minimumYears * 0.6, // Block only if way below threshold
  };
}

function evaluateLanguageGate(
  candidateLanguages?: string[],
  requiredLanguages?: string[],
): HardGateResult[] {
  if (!requiredLanguages || requiredLanguages.length === 0) return [];

  const results: HardGateResult[] = [];
  const normCandLangs = normArray(candidateLanguages);

  for (const reqLang of requiredLanguages) {
    const normReqLang = norm(reqLang);
    const found = normCandLangs.some((cl) =>
      cl.includes(normReqLang) || normReqLang.includes(cl),
    );

    results.push({
      gate: `Language: ${reqLang}`,
      passed: found,
      reason: found
        ? `Candidate speaks "${reqLang}"`
        : `Candidate may not speak "${reqLang}"`,
      blocking: false, // Language is usually a preference
    });
  }

  return results;
}

function evaluateClinicalDomainGate(
  candidateDomain?: string,
  candidateSubspecialties?: string[],
  requiredDomain?: string,
): HardGateResult | null {
  if (!requiredDomain) return null;

  const normCandDomain = norm(candidateDomain);
  const normReqDomain = norm(requiredDomain);
  const normSubs = normArray(candidateSubspecialties);

  const domainMatch = normCandDomain.includes(normReqDomain) || normReqDomain.includes(normCandDomain);
  const subMatch = normSubs.some((sub) => sub.includes(normReqDomain) || normReqDomain.includes(sub));

  const passed = domainMatch || subMatch;

  return {
    gate: `Clinical Domain: ${requiredDomain}`,
    passed,
    reason: passed
      ? `Candidate's clinical domain matches "${requiredDomain}"`
      : `Candidate's domain "${candidateDomain || 'unknown'}" does not match required "${requiredDomain}"`,
    blocking: true, // Clinical domain is a hard requirement
  };
}

// ---------------------------------------------------------------------------
// Main Evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates all hard gates for a candidate against position requirements.
 *
 * @returns HardGateEvaluation with overall pass/fail and individual gate results
 */
export function evaluateHardGates(
  candidate: CandidateGateProfile,
  requirements: PositionGateRequirements,
): HardGateEvaluation {
  const gates: HardGateResult[] = [];

  // 1. Certification gates
  if (requirements.requiredCertifications && requirements.requiredCertifications.length > 0) {
    gates.push(
      ...evaluateCertificationGate(
        candidate.certifications || [],
        requirements.requiredCertifications,
      ),
    );
  }

  // 2. Location gate
  const locGate = evaluateLocationGate(candidate.location, requirements.requiredLocation);
  if (locGate) gates.push(locGate);

  // 3. Experience gate
  const expGate = evaluateExperienceGate(candidate.experienceYears, requirements.minimumExperience);
  if (expGate) gates.push(expGate);

  // 4. Language gates
  gates.push(
    ...evaluateLanguageGate(candidate.languages, requirements.requiredLanguages),
  );

  // 5. Clinical domain gate
  const clinGate = evaluateClinicalDomainGate(
    candidate.clinicalDomain,
    candidate.subspecialties,
    requirements.requiredClinicalDomain,
  );
  if (clinGate) gates.push(clinGate);

  // Compute overall result
  const failedBlockingGates = gates.filter((g) => !g.passed && g.blocking);
  const failedNonBlockingGates = gates.filter((g) => !g.passed && !g.blocking);

  return {
    passed: failedBlockingGates.length === 0,
    gates,
    failedGates: failedBlockingGates.map((g) => `${g.gate}: ${g.reason}`),
    warnings: failedNonBlockingGates.map((g) => `${g.gate}: ${g.reason}`),
  };
}
