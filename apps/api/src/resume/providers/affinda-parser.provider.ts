import { Injectable, Logger } from '@nestjs/common';
import type { ProviderParseResult, ProviderParseSuccess } from '@recruitflow/contracts';
import type { ResumeParserProvider } from './resume-parser-provider.interface';
import type { ResumeSource } from '../source/resume-source.interface';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AffindaResumeParser } from '../affinda-resume-parser';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Injectable()
export class AffindaParserProvider implements ResumeParserProvider<Record<string, unknown>> {
  public readonly id = 'affinda-v1';
  public readonly displayName = 'Affinda Resume Engine';
  public readonly version = '1.0';
  public readonly isExternal = true;
  public readonly inputCapability = 'original-file';

  private readonly logger = new Logger(AffindaParserProvider.name);

  constructor(private readonly affindaClient: AffindaResumeParser) {}

  async parse(source: ResumeSource): Promise<ProviderParseResult<Record<string, unknown>>> {
    const startedAt = new Date().toISOString();
    const startTimeMs = Date.now();

    try {
      const buffer = await source.binarySource.getBuffer();
      const rawOutput = await this.affindaClient.parse({
        buffer,
        originalname: source.fileName,
        mimetype: source.mimeType,
      });

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTimeMs;

      return {
        status: 'SUCCESS',
        providerId: this.id,
        providerVersion: this.version,
        engineType: 'external-api',
        canonicalSchemaVersion: '1.0.0',
        binaryChecksum: source.binaryChecksum,
        textChecksum: source.textChecksum,
        startedAt,
        completedAt,
        durationMs,
        rawOutput,
      } as ProviderParseSuccess<Record<string, unknown>>;
    } catch (error: unknown) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTimeMs;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`AffindaProvider parse failed: ${errorMsg}`);

      return {
        status: 'FAILED',
        providerId: this.id,
        providerVersion: this.version,
        engineType: 'external-api',
        canonicalSchemaVersion: '1.0.0',
        binaryChecksum: source.binaryChecksum,
        textChecksum: source.textChecksum,
        startedAt,
        completedAt,
        durationMs,
        error: {
          message: errorMsg || 'Unknown Affinda API error',
          code: 'INTERNAL_ERROR',
          retryable: false,
        },
      };
    }
  }

  async healthCheck(): Promise<{ isHealthy: boolean; details?: string }> {
    return { isHealthy: true };
  }
}
