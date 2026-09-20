import { Injectable, Optional } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { CompositeDocumentExtractor } from '../extraction/composite-document-extractor';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { Readable } from 'node:stream';
import type { NormalizedResumeDocument } from '@recruitflow/contracts';
import type { BinaryDocumentSource } from './binary-document-source.interface';
import type { ResumeSource } from './resume-source.interface';
import type { UploadedResumeFile } from '../affinda-resume-parser';
import { computeBinaryChecksum } from '../extraction/text-normalizer';

import { DEFAULT_EXTRACTION_LIMITS, type ExtractionLimits } from '../extraction/document-extractor.interface';

@Injectable()
export class ResumeSourceFactory {
  private readonly limits: ExtractionLimits;

  constructor(
    private readonly extractor: CompositeDocumentExtractor,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.limits = {
      maxPages: this.parseLimit('EXTRACTION_MAX_PAGES', DEFAULT_EXTRACTION_LIMITS.maxPages),
      maxCharacters: this.parseLimit('EXTRACTION_MAX_CHARACTERS', DEFAULT_EXTRACTION_LIMITS.maxCharacters),
      timeoutMs: this.parseLimit('EXTRACTION_TIMEOUT_MS', DEFAULT_EXTRACTION_LIMITS.timeoutMs),
      maxArchiveFiles: this.parseLimit('EXTRACTION_MAX_ARCHIVE_FILES', DEFAULT_EXTRACTION_LIMITS.maxArchiveFiles),
      maxArchiveSizeBytes: this.parseLimit('EXTRACTION_MAX_ARCHIVE_BYTES', DEFAULT_EXTRACTION_LIMITS.maxArchiveSizeBytes),
    };
  }

  private parseLimit(key: string, defaultValue: number): number {
    const raw = this.configService?.get<string | number>(key);
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    const val = Number(raw);
    if (Number.isNaN(val) || !Number.isInteger(val) || val <= 0) {
      throw new Error(`Invalid configuration for ${key}: must be a positive integer, got "${raw}"`);
    }
    return val;
  }

  /**
   * Constructs a lazy ResumeSource instance wrapping the incoming uploaded file.
   * PDF extraction explicitly copies this buffer to prevent pdf.js from detaching the shared upload buffer.
   */
  createFromUploadedFile(file: UploadedResumeFile): ResumeSource {
    const binaryChecksum = computeBinaryChecksum(file.buffer);

    // Lazy zero-copy binary document accessor
    const binarySource: BinaryDocumentSource = {
      byteLength: file.buffer.length,
      getBuffer: async () => file.buffer, // Direct reference, zero memory duplication
      openStream: () => Readable.from(file.buffer),
    };

    let cachedNormalizedDocPromise: Promise<NormalizedResumeDocument> | null = null;
    let cachedDoc: NormalizedResumeDocument | null = null;

    const resumeSource = {
      binaryChecksum,
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSizeBytes: file.size ?? file.buffer.length,
      binarySource,
      get textChecksum() {
        return cachedDoc?.textChecksum;
      },
      getNormalizedDocument: () => {
        if (!cachedNormalizedDocPromise) {
          cachedNormalizedDocPromise = this.extractor.extract(resumeSource, undefined, this.limits).then((doc) => {
            cachedDoc = doc;
            resumeSource.normalizedDocument = doc;
            return doc;
          });
        }
        return cachedNormalizedDocPromise;
      },
    } as ResumeSource;

    return resumeSource;
  }
}
