import type { CanonicalResumeParseResult } from './canonical-resume.schema.ts';
import type { FieldCorrectionRecord } from './field-review.schema.ts';

/**
 * Privacy-Preserving Gold Dataset Contracts
 * Rules:
 * 1. Zero raw canonical profile in gold records.
 * 2. Uses paired de-identified placeholders ([NAME_1], [EMAIL_1], [ORG_1])
 *    synchronized between redactedTrainingText and deidentifiedGroundTruth.
 * 3. Distinguishes humanVerifiedFields from machineOnlyFields.
 * 4. Carries redactionMapVersion and explicit governance flags.
 * 5. Multi-tenant isolation: allowCrossOrgTraining is strictly false by default.
 * 6. Supports versioned held-out evaluation splits (TRAIN, VALIDATION, HELD_OUT_TEST).
 */

export type TrainingConsentBasis = 'CONSENT' | 'LEGITIMATE_INTEREST' | 'CONTRACT';

export type DatasetSplit = 'TRAIN' | 'VALIDATION' | 'HELD_OUT_TEST';

export interface DeidentifiedEntityPlaceholder {
  readonly placeholderToken: string; // e.g. '[NAME_1]', '[EMAIL_1]'
  readonly entityType: 'NAME' | 'EMAIL' | 'PHONE' | 'ORGANIZATION' | 'LOCATION';
  readonly originalCharLength?: number;
}

export interface GoldDatasetGovernance {
  readonly legalBasis: TrainingConsentBasis;
  readonly consentGrantedForModelTraining: boolean;
  /** ISO timestamp required only when legalBasis === 'CONSENT' */
  readonly consentTimestamp?: string;
  readonly dataRetentionExpiresAt: string;
  /** Multi-tenant isolation: false by default, strictly prevents leaking training data across tenants */
  readonly allowCrossOrgTraining: boolean;
}

export interface GoldDatasetRecord {
  /** Unique dataset record identifier */
  readonly id: string;

  /** Multi-tenant partition ID */
  readonly organizationId: string;

  /** Content checksum (SHA-256) of the original resume */
  readonly binaryChecksum: string;

  /** Reference to original document in secure document store (following document retention rules) */
  readonly sourceDocumentId?: string;

  /** Dataset split partition */
  readonly datasetSplit: DatasetSplit;

  /** Frozen dataset version (e.g. "v1.0.0-heldout") */
  readonly datasetVersion: string;

  /**
   * Sanitized CV text prepared specifically for model training.
   * Direct contact PII is replaced with tokens (e.g. [NAME_1], [EMAIL_1]).
   */
  readonly redactedTrainingText: string;

  /** Version of the redaction algorithm and token mapping */
  readonly redactionMapVersion: string;

  /** Explicit list of placeholders mapped in this document */
  readonly placeholders?: readonly DeidentifiedEntityPlaceholder[];

  /**
   * De-identified ground truth:
   * Values contain matching paired placeholders ([NAME_1], etc.) rather than real raw PII.
   */
  readonly deidentifiedGroundTruth: CanonicalResumeParseResult;

  /** Field-level corrections using paired placeholders */
  readonly deidentifiedCorrections: readonly FieldCorrectionRecord[];

  /** Field paths that were explicitly verified or edited by the human recruiter */
  readonly humanVerifiedFields: readonly string[];

  /** Field paths that were accepted implicitly without explicit verification */
  readonly machineOnlyFields: readonly string[];

  /** Consent and data protection governance metadata */
  readonly governance: GoldDatasetGovernance;

  readonly metadata: {
    readonly recruiterUserId: string;
    readonly approvedAt: string;
    readonly schemaVersion: string;
    readonly promptVersionUsed?: string;
  };
}
