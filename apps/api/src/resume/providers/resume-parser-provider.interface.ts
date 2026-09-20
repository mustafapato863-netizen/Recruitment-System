import type { ProviderInputCapability, ProviderParseResult } from '@recruitflow/contracts';
import type { ResumeSource } from '../source/resume-source.interface';

/**
 * Server-side Resume Parser Provider interface.
 * Implemented by engine adapters (Affinda, Local AI, Legacy Regex).
 */
export interface ResumeParserProvider<TRawData = unknown> {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly isExternal: boolean;
  readonly inputCapability: ProviderInputCapability;

  parse(source: ResumeSource): Promise<ProviderParseResult<TRawData>>;
  healthCheck(): Promise<{ isHealthy: boolean; details?: string }>;
}
