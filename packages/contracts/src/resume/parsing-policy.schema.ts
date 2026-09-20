/**
 * Resume Parsing Policy & Orchestration Configuration Contracts
 */

export type ProviderRole = 'teacher' | 'student' | 'fallback';

export interface ProviderRegistration {
  readonly providerId: string;
  readonly role: ProviderRole;
  readonly isEnabled: boolean;
}

export type TeacherTrigger =
  | 'RANDOM_SAMPLE'
  | 'ON_VALIDATION_FAILURE'
  | 'ON_OBSERVABLE_UNCERTAINTY'
  | 'ON_MISSING_CRITICAL_FIELDS';

/**
 * Observable uncertainty signals model.
 * Replaces fabricated single-number confidence with verifiable structural signals.
 */
export interface ObservableUncertaintySignalsConfig {
  /** Flag if candidate full name could not be verified in document header/contact lines */
  readonly requireVerifiedFullName: boolean;

  /** Flag if at least one contact channel (email or valid phone) is missing */
  readonly requireContactMethod: boolean;

  /** Flag if current job title is absent or unverified in source text */
  readonly requireJobTitle: boolean;

  /** Flag if total experience cannot be determined from work history dates */
  readonly requireWorkHistoryDates: boolean;

  /**
   * Derived statistical confidence floor [0.0 - 1.0].
   * Explicitly designated as a RecruitFlow-derived score, never an engine-native fact.
   */
  readonly derivedConfidenceFloor?: number;
}

export interface ResumeParsingPolicyConfig {
  /** Primary parser to execute on every incoming CV */
  readonly primaryProviderId: string;

  /** Master switch: if false, external teacher parser is never called (100% local operation) */
  readonly teacherEnabled: boolean;

  /** Registered providers and their configured roles */
  readonly registeredProviders: readonly ProviderRegistration[];

  /** Sampling rate [0.0 - 1.0] for routine benchmarking against the teacher */
  readonly teacherSamplingRate: number;

  /** Active triggers that warrant invoking the teacher parser */
  readonly teacherTriggers: readonly TeacherTrigger[];

  /** Observable uncertainty criteria */
  readonly uncertaintySignals: ObservableUncertaintySignalsConfig;

  /**
   * Shadow mode execution flag.
   * If true, teacher executes asynchronously in the background via DB polling worker
   * and never blocks or fails the recruiter's parse draft.
   */
  readonly shadowMode: boolean;

  /** Enforce strict schema extraction mode for local model (no hallucinations / delimiter isolation) */
  readonly strictExtractionMode?: boolean;

  /** Multi-tenant isolation rule: disallow cross-organization data aggregation by default */
  readonly allowCrossOrgTraining?: boolean;

  // Cost and Deduplication Guardrails (runtime spend is tracked in DB, not config)
  readonly monthlyTeacherCostCapUsd?: number;
  readonly dailyCostCapUsd?: number;

  /** If true, the system will never re-bill the teacher for an identical binaryChecksum */
  readonly deduplicateByChecksum: boolean;
}

/**
 * Pure validation function rejecting impossible policy combinations.
 */
export function validateParsingPolicyConfig(config: ResumeParsingPolicyConfig): {
  readonly isValid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];

  // 1. Primary provider validation
  if (!config.primaryProviderId) {
    errors.push('primaryProviderId must be configured.');
  }

  // 2. Duplicate provider ID detection
  const seenIds = new Set<string>();
  for (const reg of config.registeredProviders) {
    if (seenIds.has(reg.providerId)) {
      errors.push(`Duplicate providerId registered: "${reg.providerId}".`);
    }
    seenIds.add(reg.providerId);
  }

  const primary = config.registeredProviders.find((p) => p.providerId === config.primaryProviderId);
  if (!primary) {
    errors.push(`Primary provider "${config.primaryProviderId}" is not registered.`);
  } else if (!primary.isEnabled) {
    errors.push(`Primary provider "${config.primaryProviderId}" is disabled.`);
  }

  if (primary?.role === 'teacher' && !config.teacherEnabled) {
    errors.push('primaryProviderId cannot be a teacher when teacherEnabled is false.');
  }

  // 3. Teacher constraints
  const teacherProviders = config.registeredProviders.filter((p) => p.role === 'teacher');
  if (teacherProviders.length > 1) {
    errors.push(`More than one teacher provider registered (${teacherProviders.length} found). At most one teacher is permitted.`);
  }

  if (config.teacherEnabled) {
    const enabledTeacher = teacherProviders.find((p) => p.isEnabled);
    if (!enabledTeacher) {
      errors.push('teacherEnabled is true, but no registered and enabled provider has role "teacher".');
    }
  } else {
    if (config.teacherTriggers && config.teacherTriggers.length > 0) {
      errors.push('teacherTriggers cannot be configured when teacherEnabled is false.');
    }
  }

  // 4. Numeric range validations
  if (config.teacherSamplingRate < 0 || config.teacherSamplingRate > 1) {
    errors.push('teacherSamplingRate must be between 0.0 and 1.0.');
  }

  if (
    config.uncertaintySignals?.derivedConfidenceFloor !== undefined &&
    (config.uncertaintySignals.derivedConfidenceFloor < 0 || config.uncertaintySignals.derivedConfidenceFloor > 1)
  ) {
    errors.push('uncertaintySignals.derivedConfidenceFloor must be between 0.0 and 1.0.');
  }

  if (config.dailyCostCapUsd !== undefined && config.dailyCostCapUsd < 0) {
    errors.push('dailyCostCapUsd cannot be negative.');
  }

  if (config.monthlyTeacherCostCapUsd !== undefined && config.monthlyTeacherCostCapUsd < 0) {
    errors.push('monthlyTeacherCostCapUsd cannot be negative.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
