import { describe, it, expect } from 'vitest';
import {
  validateParsingPolicyConfig,
  unwrapFieldValue,
  isExtractedField,
  isNormalizedField,
  isDerivedField,
  type ResumeParsingPolicyConfig,
  type ExtractedField,
  type NormalizedField,
  type DerivedField,
  type FieldProvenance,
} from '@recruitflow/contracts';

describe('Resume Contracts: Parsing Policy Validator & Field Value Unwrapping', () => {
  const dummyProvenance: FieldProvenance = {
    sourceProvider: 'test-provider',
    extractionMethod: 'structured-llm',
    confidence: 0.95,
    confidenceSource: 'provider',
  };

  const createBaseConfig = (): ResumeParsingPolicyConfig => ({
    primaryProviderId: 'local-llm',
    teacherEnabled: true,
    registeredProviders: [
      { providerId: 'local-llm', role: 'student', isEnabled: true },
      { providerId: 'affinda-teacher', role: 'teacher', isEnabled: true },
    ],
    teacherSamplingRate: 0.1,
    teacherTriggers: ['RANDOM_SAMPLE', 'ON_OBSERVABLE_UNCERTAINTY'],
    uncertaintySignals: {
      requireVerifiedFullName: true,
      requireContactMethod: true,
      requireJobTitle: true,
      requireWorkHistoryDates: true,
      derivedConfidenceFloor: 0.7,
    },
    shadowMode: true,
    monthlyTeacherCostCapUsd: 500,
    dailyCostCapUsd: 25,
    deduplicateByChecksum: true,
  });

  describe('validateParsingPolicyConfig', () => {
    it('rule: valid config passes validation with no errors', () => {
      const config = createBaseConfig();
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rule: rejects missing primary provider ID', () => {
      const config = {
        ...createBaseConfig(),
        primaryProviderId: '',
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('primaryProviderId must be configured.');
    });

    it('rule: rejects unregistered primary provider', () => {
      const config = {
        ...createBaseConfig(),
        primaryProviderId: 'unregistered-model',
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Primary provider "unregistered-model" is not registered.');
    });

    it('rule: rejects disabled primary provider', () => {
      const config: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        registeredProviders: [
          { providerId: 'local-llm', role: 'student', isEnabled: false },
          { providerId: 'affinda-teacher', role: 'teacher', isEnabled: true },
        ],
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Primary provider "local-llm" is disabled.');
    });

    it('rule: rejects teacher primary when teacher is disabled', () => {
      const config: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        primaryProviderId: 'affinda-teacher',
        teacherEnabled: false,
        teacherTriggers: [],
        registeredProviders: [
          { providerId: 'local-llm', role: 'student', isEnabled: true },
          { providerId: 'affinda-teacher', role: 'teacher', isEnabled: true },
        ],
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('primaryProviderId cannot be a teacher when teacherEnabled is false.');
    });

    it('rule: rejects duplicate providerIds in registeredProviders', () => {
      const config: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        registeredProviders: [
          { providerId: 'local-llm', role: 'student', isEnabled: true },
          { providerId: 'local-llm', role: 'student', isEnabled: true },
          { providerId: 'affinda-teacher', role: 'teacher', isEnabled: true },
        ],
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate providerId registered: "local-llm".');
    });

    it('rule: rejects more than one teacher provider registered', () => {
      const config: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        registeredProviders: [
          { providerId: 'local-llm', role: 'student', isEnabled: true },
          { providerId: 'affinda-teacher', role: 'teacher', isEnabled: true },
          { providerId: 'secondary-teacher', role: 'teacher', isEnabled: true },
        ],
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('More than one teacher provider registered (2 found). At most one teacher is permitted.');
    });

    it('rule: rejects teacherEnabled without an enabled teacher registered', () => {
      const config: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        teacherEnabled: true,
        registeredProviders: [
          { providerId: 'local-llm', role: 'student', isEnabled: true },
          { providerId: 'affinda-teacher', role: 'teacher', isEnabled: false },
        ],
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('teacherEnabled is true, but no registered and enabled provider has role "teacher".');
    });

    it('rule: rejects teacher triggers while teacher is disabled', () => {
      const config: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        teacherEnabled: false,
        registeredProviders: [
          { providerId: 'local-llm', role: 'student', isEnabled: true },
        ],
        teacherTriggers: ['RANDOM_SAMPLE'],
      };
      const result = validateParsingPolicyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('teacherTriggers cannot be configured when teacherEnabled is false.');
    });

    it('rule: rejects teacher sampling rate out of range', () => {
      const configLow = {
        ...createBaseConfig(),
        teacherSamplingRate: -0.1,
      };
      expect(validateParsingPolicyConfig(configLow).isValid).toBe(false);
      expect(validateParsingPolicyConfig(configLow).errors).toContain('teacherSamplingRate must be between 0.0 and 1.0.');

      const configHigh = {
        ...createBaseConfig(),
        teacherSamplingRate: 1.25,
      };
      expect(validateParsingPolicyConfig(configHigh).isValid).toBe(false);
      expect(validateParsingPolicyConfig(configHigh).errors).toContain('teacherSamplingRate must be between 0.0 and 1.0.');
    });

    it('rule: rejects derived confidence floor out of range', () => {
      const configLow: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        uncertaintySignals: {
          ...createBaseConfig().uncertaintySignals,
          derivedConfidenceFloor: -0.05,
        },
      };
      expect(validateParsingPolicyConfig(configLow).isValid).toBe(false);
      expect(validateParsingPolicyConfig(configLow).errors).toContain('uncertaintySignals.derivedConfidenceFloor must be between 0.0 and 1.0.');

      const configHigh: ResumeParsingPolicyConfig = {
        ...createBaseConfig(),
        uncertaintySignals: {
          ...createBaseConfig().uncertaintySignals,
          derivedConfidenceFloor: 1.5,
        },
      };
      expect(validateParsingPolicyConfig(configHigh).isValid).toBe(false);
      expect(validateParsingPolicyConfig(configHigh).errors).toContain('uncertaintySignals.derivedConfidenceFloor must be between 0.0 and 1.0.');
    });

    it('rule: rejects negative cost caps', () => {
      const configDaily = {
        ...createBaseConfig(),
        dailyCostCapUsd: -5,
      };
      expect(validateParsingPolicyConfig(configDaily).isValid).toBe(false);
      expect(validateParsingPolicyConfig(configDaily).errors).toContain('dailyCostCapUsd cannot be negative.');

      const configMonthly = {
        ...createBaseConfig(),
        monthlyTeacherCostCapUsd: -100,
      };
      expect(validateParsingPolicyConfig(configMonthly).isValid).toBe(false);
      expect(validateParsingPolicyConfig(configMonthly).errors).toContain('monthlyTeacherCostCapUsd cannot be negative.');
    });
  });

  describe('unwrapFieldValue', () => {
    it('unwraps ExtractedField rawValue correctly', () => {
      const field: ExtractedField<string> = {
        kind: 'EXTRACTED',
        rawValue: 'Senior HRIS Analyst',
        provenance: dummyProvenance,
      };

      expect(isExtractedField(field)).toBe(true);
      expect(isNormalizedField(field)).toBe(false);
      expect(isDerivedField(field)).toBe(false);
      expect(unwrapFieldValue(field)).toBe('Senior HRIS Analyst');
    });

    it('unwraps NormalizedField normalizedValue correctly', () => {
      const field: NormalizedField<string> = {
        kind: 'NORMALIZED',
        normalizedValue: 'HR Information Systems',
        taxonomyCode: 'HR-101',
        provenance: dummyProvenance,
      };

      expect(isExtractedField(field)).toBe(false);
      expect(isNormalizedField(field)).toBe(true);
      expect(isDerivedField(field)).toBe(false);
      expect(unwrapFieldValue(field)).toBe('HR Information Systems');
    });

    it('unwraps DerivedField derivedValue correctly', () => {
      const field: DerivedField<number> = {
        kind: 'DERIVED',
        derivedValue: 72,
        derivationRule: 'sum_work_history_duration',
        supportingEvidence: ['2018-01-01 to 2024-01-01'],
        provenance: dummyProvenance,
      };

      expect(isExtractedField(field)).toBe(false);
      expect(isNormalizedField(field)).toBe(false);
      expect(isDerivedField(field)).toBe(true);
      expect(unwrapFieldValue(field)).toBe(72);
    });
  });
});
