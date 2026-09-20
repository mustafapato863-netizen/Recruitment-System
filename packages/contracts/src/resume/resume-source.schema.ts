/**
 * Browser-Safe Shared Resume Source & Normalized Document Contracts
 * Strictly contains NO Buffer, NodeJS.*, or stream types.
 * Full binary streaming accessors (BinaryDocumentSource, ResumeSource) reside in apps/api.
 */

export interface SharedResumeSourceMetadata {
  /** Upload identity in document store (optional at initial parse time) */
  readonly documentId?: string;

  /** Content identity: SHA-256 hash of the exact file bytes */
  readonly binaryChecksum: string;

  /** Normalized text content identity: SHA-256 hash of extracted text if computed */
  readonly textChecksum?: string;

  /** Original filename as uploaded by user */
  readonly fileName: string;

  /** MIME type (e.g. application/pdf, application/msword, etc.) */
  readonly mimeType: string;

  /** File size in bytes */
  readonly fileSizeBytes: number;
}

export interface NormalizedResumePage {
  readonly pageNumber: number;
  readonly text: string;
  readonly lineCount: number;
}

export interface DocumentExtractionDiagnostics {
  readonly isScanned: boolean;
  readonly hasTextLayer: boolean;
  readonly ocrApplied: boolean;
  readonly extractionDurationMs: number;
  readonly characterCount?: number;
  readonly wordCount?: number;
  readonly lineCount?: number;
  readonly pageCount?: number;
  readonly detectedLanguageHint?: string;
}

export interface NormalizedResumeDocument {
  readonly documentId?: string;
  readonly binaryChecksum: string;
  readonly textChecksum?: string;
  readonly rawText: string;
  readonly pages: readonly NormalizedResumePage[];
  readonly diagnostics: DocumentExtractionDiagnostics;
}
