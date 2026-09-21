import { Injectable } from '@nestjs/common';
import type {
  CanonicalResumeParseResult,
  CanonicalWorkExperienceItem,
  CanonicalEducationItem,
  ProviderParseResult,
  ProviderParseSuccess,
  ExtractedField,
} from '@recruitflow/contracts';
import type { ResumeParserProvider } from './resume-parser-provider.interface';
import type { ResumeSource } from '../source/resume-source.interface';
import { extractCandidateFromText } from '../../../../../packages/validation/src/resume-parser';
import { DocumentExtractionError } from '../extraction/document-extractor.interface';
import * as crypto from 'crypto';

@Injectable()
export class LegacyParserProvider implements ResumeParserProvider<Record<string, unknown>> {
  public readonly id = 'legacy-regex-v1';
  public readonly displayName = 'RecruitFlow Heuristic Engine';
  public readonly version = '1.0';
  public readonly isExternal = false;
  public readonly inputCapability = 'normalized-document';

  async parse(source: ResumeSource): Promise<ProviderParseResult<Record<string, unknown>>> {
    const startedAt = new Date().toISOString();
    const startTimeMs = Date.now();

    try {
      const doc = await source.getNormalizedDocument();
      const extracted = extractCandidateFromText(doc.rawText, source.fileName);

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTimeMs;

      const provenance = { sourceProvider: this.id, extractionMethod: 'regex-heuristic' as const };
      const createExtracted = <T>(val: T): ExtractedField<T> => ({ kind: 'EXTRACTED', rawValue: val, provenance });

      const identity = {
        firstName: extracted.firstName ? createExtracted(extracted.firstName) : undefined,
        lastName: extracted.lastName ? createExtracted(extracted.lastName) : undefined,
      };

      const contact = {
        email: extracted.email ? createExtracted(extracted.email) : undefined,
        phone: extracted.phone ? createExtracted(extracted.phone) : undefined,
        location: extracted.location ? { rawLocation: createExtracted(extracted.location) } : undefined,
      };

      const professional = {
        professionalHeadline: extracted.title ? createExtracted(extracted.title) : undefined,
        currentCompany: extracted.currentCompany ? createExtracted(extracted.currentCompany) : undefined,
        statedExperienceMonths: extracted.experienceYears != null ? createExtracted(extracted.experienceYears * 12) : undefined,
      };

      const workHistory: CanonicalWorkExperienceItem[] = [];
      if (extracted.responsibilities && extracted.responsibilities.length > 0) {
        workHistory.push({
          id: 'legacy-work-1',
          extractedTitle: extracted.title ? createExtracted(extracted.title) : undefined,
          extractedCompany: extracted.currentCompany ? createExtracted(extracted.currentCompany) : undefined,
          isCurrent: createExtracted(true),
          responsibilities: extracted.responsibilities.map((r) => createExtracted(r)),
        });
      }

      const educationHistory: CanonicalEducationItem[] = [];
      if (extracted.education) {
        educationHistory.push({
          id: 'legacy-edu-1',
          extractedDegree: createExtracted(extracted.education),
        });
      }

      const capabilities = {
        extractedSkills: extracted.skills ? extracted.skills.map((s) => createExtracted(s)) : [],
        certifications: extracted.certifications
          ? extracted.certifications.map((c) => ({ id: crypto.randomUUID(), name: createExtracted(c) }))
          : [],
        languages: extracted.languages
          ? extracted.languages.map((l) => ({ id: crypto.randomUUID(), language: createExtracted(l) }))
          : [],
        projects: [],
      };

      const canonical: CanonicalResumeParseResult = {
        identity,
        professional,
        contact,
        workHistory: workHistory.length > 0 ? workHistory : undefined,
        educationHistory: educationHistory.length > 0 ? educationHistory : undefined,
        capabilities,
        summary: extracted.summary ? createExtracted(extracted.summary) : undefined,
      };

      return {
        status: 'SUCCESS',
        providerId: this.id,
        providerVersion: this.version,
        engineType: 'regex-heuristic',
        canonicalSchemaVersion: '1.0.0',
        binaryChecksum: source.binaryChecksum,
        textChecksum: source.textChecksum,
        startedAt,
        completedAt,
        durationMs,
        rawOutput: canonical as unknown as Record<string, unknown>,
      } as ProviderParseSuccess<Record<string, unknown>>;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCode =
        error instanceof DocumentExtractionError
          ? error.code
          : ((error as { code?: string })?.code || 'INTERNAL_ERROR');
      return {
        status: 'FAILED',
        providerId: this.id,
        providerVersion: this.version,
        engineType: 'regex-heuristic',
        canonicalSchemaVersion: '1.0.0',
        binaryChecksum: source.binaryChecksum,
        textChecksum: source.textChecksum,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTimeMs,
        error: {
          message: errorMsg || 'Unknown Regex Parser error',
          code: errorCode,
          retryable: false,
        },
      };
    }
  }

  async healthCheck(): Promise<{ isHealthy: boolean; details?: string }> {
    return { isHealthy: true };
  }
}
