import type { BlindReviewSampleRecord } from '@recruitflow/contracts';

/**
 * Server-only unblinded / sealed mapping contract.
 * Kept strictly inside apps/api to ensure the client browser never learns
 * which model corresponds to Option A or Option B until the review is permanently locked.
 */
export interface SealedProviderMapping {
  readonly optionAProviderId: string;
  readonly optionBProviderId: string;
}

export interface SealedBlindReviewRecord extends BlindReviewSampleRecord {
  /** Sealed mapping containing true provider identities */
  readonly sealedMapping: SealedProviderMapping;
}
