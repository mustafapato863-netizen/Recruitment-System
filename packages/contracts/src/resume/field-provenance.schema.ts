/**
 * Field Provenance Contracts
 * Provides complete origin tracking for extracted, normalized, or derived candidate fields.
 * Prevents fabricated confidence scores by distinguishing native provider confidence
 * from derived or human-verified confidence.
 */

export type ConfidenceSource =
  | 'provider'    // Native probability or score from the engine itself
  | 'derived'     // Calculated by RecruitFlow heuristics (e.g., regex exact match)
  | 'calibrated'  // Adjusted based on historical field accuracy
  | 'human';      // Verified or edited by a human recruiter

export type ExtractionMethod =
  | 'structured-llm'
  | 'vendor-api'
  | 'regex-heuristic'
  | 'layout-ocr'
  | 'human-input';

export interface BoundingBox {
  readonly pageNumber: number;
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

export interface TextOffset {
  readonly startChar: number;
  readonly endChar: number;
}

export interface FieldProvenance {
  /** Identifier of the provider or subsystem that produced this field */
  readonly sourceProvider: string;

  /** Resume section where the evidence was located */
  readonly sourceSection?: 'header' | 'summary' | 'workExperience' | 'education' | 'skills' | 'certifications' | 'contact';

  /** Context snippet from the CV supporting this field (canonical location for text evidence) */
  readonly sourceSnippet?: string;

  /** Document page number where the evidence was located (1-indexed, canonical location) */
  readonly pageNumber?: number;

  /** Visual bounding box if coordinates are provided by layout OCR / visual model */
  readonly boundingBox?: BoundingBox;

  /** Exact character offset within normalized text if available */
  readonly textOffset?: TextOffset;

  /**
   * Genuine confidence [0.0 - 1.0].
   * MUST be left undefined if the parser provider does not natively yield a confidence score.
   */
  readonly confidence?: number;

  /** The origin or nature of the confidence value */
  readonly confidenceSource?: ConfidenceSource;

  /** Mechanism used to extract or produce the field */
  readonly extractionMethod: ExtractionMethod;
}
