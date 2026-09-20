/**
 * Parser Provider Types & Result Discriminated Union
 * Shared across frontend and backend.
 * Full parser implementation interfaces (ResumeParserProvider, CanonicalProviderMapper)
 * reside in apps/api because they depend on Node.js-backed ResumeSource.
 */

export type ProviderInputCapability = 'original-file' | 'normalized-document' | 'both';

export type ProviderErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNREADABLE_DOCUMENT'
  | 'TIMEOUT'
  | 'MODEL_UNAVAILABLE'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

export interface ProviderParseError {
  /** Descriptive error message */
  readonly message: string;
  /** Standardized machine-readable error code */
  readonly code?: ProviderErrorCode | string;
  /** Flag indicating whether the same request may be retried */
  readonly retryable: boolean;
  /** Additional diagnostic context (safe for logging, no credentials) */
  readonly details?: Record<string, unknown>;
}

export interface EngineLineage {
  /** Identifier of the parser provider that executed the run */
  readonly providerId: string;
  /** Software or API version of the provider */
  readonly providerVersion: string;
  /** Underlying engine architecture */
  readonly engineType: 'external-api' | 'local-llm' | 'regex-heuristic';
  /** Model name or checkpoint (e.g. "qwen2.5-7b-instruct-q4") */
  readonly modelIdentifier?: string | undefined;
  /** Model release or quantization version */
  readonly modelVersion?: string | undefined;
  /** Prompt template identifier */
  readonly promptTemplateId?: string | undefined;
  /** Prompt template version or SHA */
  readonly promptVersion?: string | undefined;
  /** Canonical schema specification version */
  readonly canonicalSchemaVersion: string;
  /** Field resolver logic version */
  readonly resolverVersion?: string | undefined;
}

export interface BaseProviderParseMetadata extends EngineLineage {
  /** Content checksum of the input document (SHA-256) */
  readonly binaryChecksum: string;
  readonly textChecksum?: string | undefined;

  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

export interface ProviderParseSuccess<TRawData = unknown> extends BaseProviderParseMetadata {
  readonly status: 'SUCCESS';
  /** Untouched raw data returned by the model or engine */
  readonly rawOutput: TRawData;
}

export interface ProviderParseFailure extends BaseProviderParseMetadata {
  readonly status: 'FAILED';
  /** Structured error descriptor mandatory upon failure */
  readonly error: ProviderParseError;
}

/**
 * Strict discriminated union for provider execution outcomes.
 * A success MUST carry rawOutput; a failure MUST carry error.
 */
export type ProviderParseResult<TRawData = unknown> =
  | ProviderParseSuccess<TRawData>
  | ProviderParseFailure;
