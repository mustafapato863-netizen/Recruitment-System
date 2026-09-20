import type { CanonicalResumeParseResult } from './canonical-resume.schema.ts';

/**
 * Blind Review Evaluation Contracts
 * Enables human reviewers to evaluate Student vs. Teacher extractions side-by-side
 * without knowing which model produced which option.
 *
 * Rules:
 * - The shared BlindReviewSampleRecord MUST NOT contain sealedMapping or reveal provider IDs.
 * - Sealed mapping is maintained strictly in server-side API memory/storage.
 */

export type BlindReviewPreference = 'OPTION_A' | 'OPTION_B' | 'TIE' | 'BOTH_INCORRECT';

export interface BlindReviewFieldEvaluation {
  /** Field dot-path (e.g. "identity.fullName", "workHistory[uuid-1].extractedTitle") */
  readonly fieldPath: string;
  readonly preference: BlindReviewPreference;
  readonly notes?: string;
}

export interface BlindReviewSubmission {
  readonly sampleId: string;
  readonly preferredOption: BlindReviewPreference;
  readonly fieldEvaluations?: readonly BlindReviewFieldEvaluation[];
  readonly notes?: string;
  readonly evaluatorUserId: string;
  readonly evaluatedAt: string;
}

export interface BlindReviewSampleRecord {
  /** Unique review sample identifier */
  readonly sampleId: string;

  /** Multi-tenant partition ID */
  readonly organizationId: string;

  /** Document content checksum */
  readonly binaryChecksum: string;

  /** Candidate headline or brief identifier for review context */
  readonly candidateHeadline: string;

  /** Anonymized option A (never reveals provider identity) */
  readonly optionA: CanonicalResumeParseResult;

  /** Anonymized option B (never reveals provider identity) */
  readonly optionB: CanonicalResumeParseResult;

  /** Reviewer outcome once submitted */
  readonly reviewOutcome?: BlindReviewSubmission;
}
