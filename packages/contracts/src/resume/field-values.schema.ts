import type { FieldProvenance } from './field-provenance.schema.ts';

/**
 * Field Value Types
 * Enforces clear separation between:
 * 1. ExtractedField: verbatim text explicitly discovered in the CV
 * 2. NormalizedField: standardized taxonomy term or catalog code
 * 3. DerivedField: value computed or inferred by RecruitFlow rules
 *
 * Rules:
 * - provenance is MANDATORY on all field wrappers (Extracted/Normalized/Derived).
 * - FieldProvenance is the canonical location for sourceSnippet and pageNumber,
 *   preventing duplicated or divergent evidence properties.
 */

export interface ExtractedField<T> {
  readonly kind: 'EXTRACTED';
  /** The verbatim value discovered directly on the CV */
  readonly rawValue: T;
  /** Origin, evidence snippet, page, and confidence provenance (mandatory) */
  readonly provenance: FieldProvenance;
}

export interface NormalizedField<T, TMeta = Record<string, unknown>> {
  readonly kind: 'NORMALIZED';
  /** Standardized catalog or taxonomy representation */
  readonly normalizedValue: T;
  /** External or internal taxonomy code (e.g. O*NET code, SGH Clinical Specialty Code) */
  readonly taxonomyCode?: string;
  /** Auxiliary metadata relating to the taxonomy match */
  readonly metadata?: TMeta;
  /** Origin, evidence snippet, page, and confidence provenance (mandatory) */
  readonly provenance: FieldProvenance;
}

export interface DerivedField<T> {
  readonly kind: 'DERIVED';
  /** Value derived or computed by RecruitFlow heuristics / rules */
  readonly derivedValue: T;
  /** Explicit rule or formula name (e.g. 'sum_work_history_duration', 'date_span_subtraction') */
  readonly derivationRule: string;
  /** Supporting extracted snippets or dates used to compute this value */
  readonly supportingEvidence?: readonly string[];
  /** Origin, evidence snippet, page, and confidence provenance (mandatory) */
  readonly provenance: FieldProvenance;
}

export type AnyFieldValue<T> = ExtractedField<T> | NormalizedField<T> | DerivedField<T>;

/**
 * Unwraps the underlying value from an ExtractedField, NormalizedField, or DerivedField.
 */
export function unwrapFieldValue<T>(field: AnyFieldValue<T>): T {
  switch (field.kind) {
    case 'EXTRACTED':
      return field.rawValue;
    case 'NORMALIZED':
      return field.normalizedValue;
    case 'DERIVED':
      return field.derivedValue;
  }
}

/** Type guard for ExtractedField */
export function isExtractedField<T>(field: unknown): field is ExtractedField<T> {
  return typeof field === 'object' && field !== null && (field as { kind?: string }).kind === 'EXTRACTED';
}

/** Type guard for NormalizedField */
export function isNormalizedField<T, TMeta = Record<string, unknown>>(field: unknown): field is NormalizedField<T, TMeta> {
  return typeof field === 'object' && field !== null && (field as { kind?: string }).kind === 'NORMALIZED';
}

/** Type guard for DerivedField */
export function isDerivedField<T>(field: unknown): field is DerivedField<T> {
  return typeof field === 'object' && field !== null && (field as { kind?: string }).kind === 'DERIVED';
}
