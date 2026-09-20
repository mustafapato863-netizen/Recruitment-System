import type { CanonicalResumeParseResult } from './canonical-resume.schema.ts';
import type { EngineLineage, ProviderParseError } from './parser-provider.schema.ts';

/**
 * Parse Run Contract
 * Represents an immutable audit record of a single parser execution against a document.
 * Does NOT duplicate the original CV binary, referencing binaryChecksum and optional documentId.
 */

export type ParseRunRetentionTier = 'HOT' | 'PRUNED' | 'ARCHIVED';

export type ParseRunStatus = 'SUCCESS' | 'FAILED';

export interface ParseRunTelemetry {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly extractedFieldsCount: number;
  readonly disagreementsCount?: number;
}

export interface BaseParseRunRecord extends EngineLineage {
  /** Unique execution UUID */
  readonly id: string;

  /** Multi-tenant organization identity */
  readonly organizationId: string;

  /** Content checksum (SHA-256) of the document */
  readonly binaryChecksum: string;
  readonly textChecksum?: string;

  /** Upload identity in document store (populated if/when document is persisted) */
  readonly documentId?: string;

  /** Linked candidate entity if candidate was ingested */
  readonly candidateId?: string;

  readonly startedAt: string;
  readonly completedAt: string;
  readonly executionDurationMs: number;

  /** Current retention lifecycle tier */
  readonly retentionTier: ParseRunRetentionTier;

  /** Permanent lightweight execution telemetry and metrics */
  readonly telemetry: ParseRunTelemetry;
}

export interface SuccessfulParseRunRecord extends BaseParseRunRecord {
  readonly status: 'SUCCESS';
  /**
   * Raw provider response payload.
   * Retained temporarily in 'HOT' tier according to tenant-configured retention policy.
   * Purged in 'PRUNED' and 'ARCHIVED' tiers.
   */
  readonly rawOutputPayload?: unknown;

  /**
   * Mapped canonical result.
   * Present in 'HOT' and 'PRUNED' tiers.
   * Purged in 'ARCHIVED' tier.
   */
  readonly canonicalResult?: CanonicalResumeParseResult;
}

export interface FailedParseRunRecord extends BaseParseRunRecord {
  readonly status: 'FAILED';
  /** Structured error descriptor mandatory upon failure */
  readonly error: ProviderParseError;
}

/**
 * Strict discriminated union for ParseRun outcomes.
 */
export type ParseRunRecord = SuccessfulParseRunRecord | FailedParseRunRecord;

/** Alias for backward compatibility */
export type ResumeParseRun = ParseRunRecord;
