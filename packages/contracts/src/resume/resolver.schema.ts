import type { CanonicalResumeParseResult } from './canonical-resume.schema.ts';
import type { ResumeComparisonReport } from './comparison.schema.ts';

/**
 * Field Resolver Contracts
 * Governs the arbitration and synthesis of competing provider outputs into a single candidate draft.
 */

export type FieldResolutionStrategy =
  | 'DETERMINISTIC_PASS'
  | 'SOURCE_TEXT_VERIFIED'
  | 'HISTORICAL_PROVIDER_WEIGHT'
  | 'CONFIDENCE_PRIORITY'
  | 'PRIMARY_FALLBACK'
  | 'ESCALATE_TO_RECRUITER';

/** Semantic alias for FieldResolutionStrategy */
export type ResolutionStrategy = FieldResolutionStrategy;

export interface ResolverInputs {
  readonly primaryParseRunId: string;
  readonly shadowParseRunId?: string;
  readonly primaryResult: CanonicalResumeParseResult;
  readonly shadowResult?: CanonicalResumeParseResult;
  readonly comparisonReport?: ResumeComparisonReport;
}

export interface FieldResolutionDecision<T = unknown> {
  /** Field dot-path (e.g. "identity.fullName", "workHistory[uuid-1].extractedTitle") */
  readonly fieldPath: string;

  /** Arbitrated value chosen by the resolver */
  readonly selectedValue?: T;

  /** Strategy applied to reach this resolution */
  readonly strategy: FieldResolutionStrategy;

  /** Identity of the provider whose prediction was selected */
  readonly winningProviderId: string;

  /** Flag indicating whether the providers actively disagreed */
  readonly conflictDetected: boolean;

  /**
   * Flag indicating whether this field requires special recruiter scrutiny
   * (e.g. name conflict, high-variance dates).
   */
  readonly requiresHumanReview: boolean;

  /** Human-readable explanation of why this decision was made */
  readonly reason: string;
}

export interface DraftResolutionReport {
  readonly draftId: string;
  readonly organizationId: string;
  readonly binaryChecksum: string;
  readonly resolvedAt: string;
  readonly decisions: Record<string, FieldResolutionDecision>;
  readonly hasUnresolvedConflicts: boolean;
  readonly requiresHumanReview: boolean;
}
