import type { SharedResumeSourceMetadata, NormalizedResumeDocument } from '@recruitflow/contracts';
import type { BinaryDocumentSource } from './binary-document-source.interface';

/**
 * Server-side ResumeSource interface extending browser-safe metadata
 * with Node.js lazy binary streaming and document extraction capability.
 */
export interface ResumeSource extends SharedResumeSourceMetadata {
  readonly binarySource: BinaryDocumentSource;
  normalizedDocument?: NormalizedResumeDocument;
  getNormalizedDocument(): Promise<NormalizedResumeDocument>;
}
