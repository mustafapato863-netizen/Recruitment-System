/**
 * Field Review & Recruiter Correction Contracts
 * Captures explicit human supervision during the "Validate & Edit" stage.
 *
 * Rule:
 * fieldId MUST reference stable item IDs, NEVER array indexes:
 * e.g. "identity.lastName", "workHistory[uuid-1234].extractedTitle", "educationHistory[uuid-5678].extractedDegree".
 */

export type FieldReviewStatus =
  | 'CONFIRMED'   // Recruiter explicitly confirmed the machine prediction as correct
  | 'EDITED'      // Recruiter altered the machine prediction
  | 'REJECTED'    // Recruiter removed or rejected the machine prediction
  | 'UNREVIEWED'  // Field was present but not explicitly touched by the recruiter
  | 'NOT_SHOWN';  // Field was not presented in the UI

export interface FieldReviewRecord {
  /**
   * Field identifier referencing stable entity/item IDs, NEVER array indexes.
   * Example: "identity.lastName", "workHistory[uuid-1234].extractedTitle"
   */
  readonly fieldId: string;

  /** Multi-tenant organization identity */
  readonly organizationId: string;

  /** Parse run ID that produced the initial prediction */
  readonly parseRunId: string;

  /** Server-authoritative initial value before recruiter review (prevents client tampering) */
  readonly initialValue: unknown;

  /** Final confirmed value after recruiter review */
  readonly finalValue: unknown;

  /** Human review action taken */
  readonly reviewStatus: FieldReviewStatus;

  /** User ID of the recruiter */
  readonly reviewerUserId: string;

  /** ISO timestamp of review */
  readonly reviewedAt: string;
}

export interface FieldCorrectionLineage {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly modelIdentifier?: string;
  readonly promptVersion?: string;
}

export interface FieldCorrectionRecord {
  /**
   * Field identifier referencing stable item IDs, NEVER array indexes.
   * Example: "identity.lastName", "workHistory[uuid-1234].extractedTitle"
   */
  readonly fieldId: string;

  /** Multi-tenant organization identity */
  readonly organizationId: string;

  /** Origin parse run ID */
  readonly parseRunId: string;

  /** Initial machine predicted value */
  readonly initialValue: unknown;

  /** Final value confirmed by recruiter */
  readonly correctedValue: unknown;

  /** Review status */
  readonly reviewStatus: FieldReviewStatus;

  /** Engine lineage that generated the incorrect or edited prediction */
  readonly lineage: FieldCorrectionLineage;

  /** Machine confidence at time of prediction if known */
  readonly confidenceAtPrediction?: number;

  /** Recruiter who performed the correction */
  readonly reviewerUserId: string;

  /** ISO timestamp */
  readonly reviewedAt: string;
}
