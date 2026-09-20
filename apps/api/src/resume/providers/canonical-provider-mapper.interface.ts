import type { CanonicalResumeParseResult, ProviderParseSuccess } from '@recruitflow/contracts';
import type { ResumeSource } from '../source/resume-source.interface';

/**
 * Server-side Canonical Provider Mapper interface.
 * Maps engine-specific raw outputs to the canonical RecruitFlow schema.
 */
export interface CanonicalProviderMapper<TRawData = unknown> {
  readonly providerId: string;
  map(result: ProviderParseSuccess<TRawData>, source: ResumeSource): CanonicalResumeParseResult;
}
