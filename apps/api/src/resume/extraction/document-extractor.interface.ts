import type { NormalizedResumeDocument } from '@recruitflow/contracts';
import type { ResumeSource } from '../source/resume-source.interface';

export interface ScannedDocumentThresholds {
  /** Minimum non-whitespace character count across the entire document (default: 80) */
  readonly minCharsTotal?: number;
  /** Minimum average non-whitespace characters per page (default: 20) */
  readonly minCharsPerPage?: number;
}

export interface ExtractionLimits {
  readonly maxPages?: number;
  readonly maxCharacters?: number;
  readonly timeoutMs?: number;
  readonly maxArchiveFiles?: number;
  readonly maxArchiveSizeBytes?: number;
}

export const DEFAULT_EXTRACTION_LIMITS: Required<ExtractionLimits> = {
  maxPages: 50,
  maxCharacters: 200_000,
  timeoutMs: 15_000,
  maxArchiveFiles: 1000,
  maxArchiveSizeBytes: 50 * 1024 * 1024, // 50MB
};

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
    public readonly code: 'UNSUPPORTED_FORMAT' | 'CORRUPTED_FILE' | 'EXTRACTION_FAILED' | 'LIMIT_EXCEEDED' = 'EXTRACTION_FAILED',
  ) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

export interface DocumentExtractor {
  /**
   * Determines whether this extractor supports the given file format.
   */
  supports(mimeType: string, fileName: string): boolean;

  /**
   * Extracts text, page structure, and diagnostics from the given resume source.
   */
  extract(
    source: ResumeSource,
    thresholds?: ScannedDocumentThresholds,
    limits?: ExtractionLimits,
  ): Promise<NormalizedResumeDocument>;
}
