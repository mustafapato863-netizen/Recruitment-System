import { Injectable, Logger, Optional } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { AffindaResumeParser } from './affinda-resume-parser';
import { RecruitFlowCandidateMapper } from './recruitflow-candidate-mapper';
import { SghEnrichmentService } from './sgh-enrichment.service';
import { ResumeSourceFactory } from './source/resume-source.factory';
import { AffindaParserProvider } from './providers/affinda-parser.provider';
import { LegacyParserProvider } from './providers/legacy-parser.provider';
import { AffindaCanonicalMapper } from './providers/affinda-canonical.mapper';
import { CanonicalToExtractedAdapter } from './providers/canonical-to-extracted.adapter';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { UploadedResumeFile } from './affinda-resume-parser';
import type { ResumeSource } from './source/resume-source.interface';
import type { CanonicalAdaptOptions } from './providers/canonical-to-extracted.adapter';
import type { ExtractedCandidate, CanonicalResumeParseResult } from '@recruitflow/contracts';
import { mergeCanonicalResults } from './providers/canonical-merger';
import { fileInvalid, integrationUnavailable } from '../common/errors/api-error';

@Injectable()
export class ResumeParsingService {
  private readonly logger = new Logger(ResumeParsingService.name);

  constructor(
    private readonly affindaParser: AffindaResumeParser,
    private readonly candidateMapper: RecruitFlowCandidateMapper,
    private readonly sghEnrichment: SghEnrichmentService,
    private readonly affindaProvider: AffindaParserProvider,
    private readonly legacyProvider: LegacyParserProvider,
    private readonly affindaCanonicalMapper: AffindaCanonicalMapper,
    private readonly canonicalToExtractedAdapter: CanonicalToExtractedAdapter,
    @Optional() private readonly resumeSourceFactory?: ResumeSourceFactory,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Complete resume intake parsing pipeline:
   * 1. Initialize lazy ResumeSource abstraction (Phase 1)
   * 2. If ENABLE_PROVIDER_ARCHITECTURE is true, run Provider flow.
   * 3. Else, preserve direct Affinda mapping, with local extraction on failure.
   * 4. Enrich with SGH healthcare domain rules & clinical summary
   */
  async parseResume(file: UploadedResumeFile): Promise<ExtractedCandidate> {
    this.logger.log(`Starting parsing pipeline for resume: ${file.originalname}`);

    // Phase 1: Initialize ResumeSource abstraction if factory is available and enabled
    const isExtractorEnabled = this.configService?.get<string>('ENABLE_DOCUMENT_EXTRACTOR') === 'true';
    const isProviderArchitectureEnabled = this.configService?.get<string>('ENABLE_PROVIDER_ARCHITECTURE') === 'true';

    let resumeSource: ResumeSource | null = null;
    if (this.resumeSourceFactory && (isExtractorEnabled || isProviderArchitectureEnabled)) {
      try {
        resumeSource = this.resumeSourceFactory.createFromUploadedFile(file);
        this.logger.debug(`ResumeSource initialized with binaryChecksum: ${resumeSource.binaryChecksum}`);
      } catch (extractorErr: unknown) {
        const msg = extractorErr instanceof Error ? extractorErr.message : String(extractorErr);
        this.logger.warn(`ResumeSource creation skipped on error: ${msg}`);
      }
    }

    let mapped: ExtractedCandidate;

    if (isProviderArchitectureEnabled && resumeSource) {
      // Phase 2 Provider Flow
      this.logger.log('Routing through Phase 2 Provider Architecture');
      
      const affindaRes = await this.affindaProvider.parse(resumeSource);
      let canonicalResult: CanonicalResumeParseResult;
      let usedSource: 'affinda' | 'legacy' = 'affinda';
      let meta: CanonicalAdaptOptions['meta'] = undefined;
      let rawText: string | undefined;

      if (affindaRes.status === 'SUCCESS') {
        const rawOutput = affindaRes.rawOutput as Record<string, unknown>;
        canonicalResult = this.affindaCanonicalMapper.map(rawOutput);
        meta = (rawOutput.meta as CanonicalAdaptOptions['meta']) || undefined;
        const metaObj = rawOutput.meta as { rawText?: string } | undefined;
        rawText = metaObj?.rawText || (typeof rawOutput.rawText === 'string' ? rawOutput.rawText : undefined);
      } else {
        this.logger.warn(`Affinda provider failed: ${affindaRes.error.message}. Falling back to Legacy Regex Provider.`);
        const fallback = await this.parseLocally(resumeSource);
        canonicalResult = fallback.canonical;
        usedSource = 'legacy';
        rawText = fallback.rawText;
      }

      // Legacy runs only when Affinda fails or a required contact field (email or phone) is missing
      const missingContact = !canonicalResult.contact?.email || !canonicalResult.contact?.phone;
      if (affindaRes.status === 'SUCCESS' && missingContact) {
        try {
          const legacyRes = await this.legacyProvider.parse(resumeSource);
          if (legacyRes.status === 'SUCCESS') {
            canonicalResult = mergeCanonicalResults(
              canonicalResult,
              legacyRes.rawOutput as unknown as CanonicalResumeParseResult,
            );
          }
        } catch (legacyErr: unknown) {
          const msg = legacyErr instanceof Error ? legacyErr.message : String(legacyErr);
          this.logger.warn(`Legacy fallback enrichment skipped: ${msg}`);
        }
      }

      mapped = this.canonicalToExtractedAdapter.adapt(canonicalResult, {
        parserSource: usedSource,
        meta,
        rawText,
      });
    } else {
      // Legacy Flow
      this.logger.log('Routing through legacy direct Affinda Flow');
      mapped = await this.parseDirectWithFallback(file, resumeSource);
    }

    // Step 3: SGH clinical domain & summary enrichment
    const enriched = this.sghEnrichment.enrich(mapped);

    this.logger.log(
      `Successfully parsed candidate: ${enriched.firstName} ${enriched.lastName} (${enriched.title || 'No Title'}) [Quality: ${enriched.parsingQuality}]`,
    );

    return enriched;
  }

  private async parseDirectWithFallback(
    file: UploadedResumeFile,
    source: ResumeSource | null,
  ): Promise<ExtractedCandidate> {
    let rawAffinda: Record<string, unknown>;
    try {
      rawAffinda = await this.affindaParser.parse(file);
    } catch {
      this.logger.warn('External resume processing unavailable; attempting local document extraction.');
      // Construct lazily so successful flag-off requests keep their existing behavior.
      if (!source && this.resumeSourceFactory) {
        try {
          source = this.resumeSourceFactory.createFromUploadedFile(file);
        } catch {
          throw integrationUnavailable('CV processing is temporarily unavailable. Please retry shortly.');
        }
      }
      if (!source) {
        throw integrationUnavailable('CV processing is temporarily unavailable. Please retry shortly.');
      }
      const fallback = await this.parseLocally(source);
      return this.canonicalToExtractedAdapter.adapt(fallback.canonical, {
        parserSource: 'legacy',
        rawText: fallback.rawText,
      });
    }
    // Mapping errors are not provider outages and must not silently trigger fallback.
    return this.candidateMapper.map(rawAffinda);
  }

  private async parseLocally(source: ResumeSource): Promise<{
    canonical: CanonicalResumeParseResult;
    rawText: string;
  }> {
    const result = await this.legacyProvider.parse(source);
    if (result.status === 'FAILED') {
      if (result.error.code === 'UNSUPPORTED_FORMAT' && source.fileName.toLowerCase().endsWith('.doc')) {
        throw integrationUnavailable('This Word (.doc) file needs the CV processing service. Retry later or save it as DOCX or a searchable PDF.');
      }
      if (result.error.code === 'CORRUPTED_FILE' || result.error.code === 'UNSUPPORTED_FORMAT') {
        throw fileInvalid('The CV file could not be read. Upload a valid PDF or Word (.docx) file.');
      }
      // Never expose raw provider errors, document contents or internal paths.
      throw integrationUnavailable('CV processing is temporarily unavailable or exceeded its limits. Retry or try a smaller file.');
    }
    const doc = await source.getNormalizedDocument();
    if (!doc.rawText.trim()) {
      throw fileInvalid('No readable text was found in this CV. It may be scanned; upload a searchable PDF or a Word (.docx) copy.');
    }
    return {
      canonical: result.rawOutput as unknown as CanonicalResumeParseResult,
      rawText: doc.rawText,
    };
  }
}
