import { Injectable, Logger, Optional } from '@nestjs/common';
import type { NormalizedResumeDocument } from '@recruitflow/contracts';
import type { ResumeSource } from '../source/resume-source.interface';
import {
  type DocumentExtractor,
  type ScannedDocumentThresholds,
  type ExtractionLimits,
  DocumentExtractionError,
} from './document-extractor.interface';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { PdfDocumentExtractor } from './pdf-document-extractor';
import { DocxDocumentExtractor } from './docx-document-extractor';
import { WorkerThreadDocumentExtractor } from './worker/worker-thread-document-extractor';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Injectable()
export class CompositeDocumentExtractor implements DocumentExtractor {
  private readonly logger = new Logger(CompositeDocumentExtractor.name);
  private readonly extractors: readonly DocumentExtractor[];

  constructor(
    pdfExtractor: PdfDocumentExtractor,
    docxExtractor: DocxDocumentExtractor,
    @Optional() private readonly workerExtractor?: WorkerThreadDocumentExtractor,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.extractors = [pdfExtractor, docxExtractor];
  }

  supports(mimeType: string, fileName: string): boolean {
    return this.extractors.some((ext) => ext.supports(mimeType, fileName));
  }

  async extract(
    source: ResumeSource,
    thresholds?: ScannedDocumentThresholds,
    limits?: ExtractionLimits,
  ): Promise<NormalizedResumeDocument> {
    const { fileName, mimeType } = source;

    const isWorkerEnabled =
      this.configService?.get<string>('ENABLE_WORKER_DOCUMENT_EXTRACTOR') === 'true';
    if (isWorkerEnabled && this.workerExtractor && this.workerExtractor.supports(mimeType, fileName)) {
      this.logger.debug(`Routing extraction for "${fileName}" to worker thread pool.`);
      return this.workerExtractor.extract(source, thresholds, limits);
    }

    const extractor = this.extractors.find((ext) => ext.supports(mimeType, fileName));

    if (!extractor) {
      this.logger.warn(`No extractor registered for file "${fileName}" (MIME: ${mimeType})`);
      throw new DocumentExtractionError(
        `Unsupported document format for "${fileName}". Only PDF (.pdf) and Word (.docx) files are supported.`,
        undefined,
        'UNSUPPORTED_FORMAT',
      );
    }

    return extractor.extract(source, thresholds, limits);
  }
}
