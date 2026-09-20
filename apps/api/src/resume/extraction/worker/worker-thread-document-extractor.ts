import { Injectable } from '@nestjs/common';
import type { NormalizedResumeDocument } from '@recruitflow/contracts';
import type { ResumeSource } from '../../source/resume-source.interface';
import type {
  DocumentExtractor,
  ScannedDocumentThresholds,
  ExtractionLimits,
} from '../document-extractor.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ExtractionWorkerPool } from './extraction-worker-pool';

@Injectable()
export class WorkerThreadDocumentExtractor implements DocumentExtractor {
  constructor(private readonly pool: ExtractionWorkerPool) {}

  supports(mimeType: string, fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return (
      lower.endsWith('.pdf') ||
      mimeType === 'application/pdf' ||
      lower.endsWith('.docx') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  }

  async extract(
    source: ResumeSource,
    thresholds?: ScannedDocumentThresholds,
    limits?: ExtractionLimits,
  ): Promise<NormalizedResumeDocument> {
    return this.pool.extract(source, thresholds, limits);
  }
}
