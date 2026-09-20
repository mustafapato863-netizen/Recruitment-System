import type { CanonicalResumeParseResult } from './canonical-resume.schema.ts';

/**
 * Resolved Draft Contract
 * Represents the server-side ephemeral candidate draft prepared for recruiter review
 * in Stage 2 ("Validate & Edit"). Keyed by draft ID, linked to parse runs, and governed by a TTL.
 */

export type ResolvedDraftStatus = 'DRAFT' | 'COMMITTED' | 'EXPIRED' | 'ABANDONED';

/** Alias for backward compatibility and semantic clarity */
export type DraftResolutionStatus = ResolvedDraftStatus;

export interface ResolvedDraft {
  /** Unique draft UUID returned to the web client */
  readonly id: string;

  /** Multi-tenant partition ID */
  readonly organizationId: string;

  /** Content checksum of the uploaded CV */
  readonly binaryChecksum: string;
  readonly textChecksum?: string;

  /** Primary parse run ID that seeded this draft */
  readonly primaryParseRunId: string;

  /** Optional shadow parse run ID if teacher/student ran in parallel */
  readonly shadowParseRunId?: string;

  readonly status: ResolvedDraftStatus;

  /** The resolved composite candidate draft presented to the recruiter */
  readonly candidateDraft: CanonicalResumeParseResult;

  readonly createdAt: string;

  /** Expiration timestamp enforcing server-side TTL (e.g. 24 hours) */
  readonly expiresAt: string;

  /** Configured time-to-live duration in seconds */
  readonly ttlSeconds?: number;

  /** Timestamp when recruiter committed this draft into a permanent candidate */
  readonly committedAt?: string;
}
