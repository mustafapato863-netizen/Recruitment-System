import { Injectable, Logger } from '@nestjs/common';
import type {
  NormalizedResumeDocument,
  NormalizedResumePage,
  DocumentExtractionDiagnostics,
} from '@recruitflow/contracts';
import type { ResumeSource } from '../source/resume-source.interface';
import {
  type DocumentExtractor,
  type ScannedDocumentThresholds,
  type ExtractionLimits,
  DocumentExtractionError,
  DEFAULT_EXTRACTION_LIMITS,
} from './document-extractor.interface';
import { computeTextChecksumV1 } from './text-normalizer';

const DEFAULT_MIN_CHARS_TOTAL = 80;

async function withTimeout<T>(promise: Promise<T>, timeoutMs?: number, label = 'operation'): Promise<T> {
  if (timeoutMs === undefined || timeoutMs <= 0) return promise;
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DocumentExtractionError(
      `Extraction limits exceeded: ${label} took longer than max timeout of ${timeoutMs}ms.`,
      undefined,
      'LIMIT_EXCEEDED',
    )), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

@Injectable()
export class DocxDocumentExtractor implements DocumentExtractor {
  private readonly logger = new Logger(DocxDocumentExtractor.name);

  supports(mimeType: string, fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return (
      lower.endsWith('.docx') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  }

  async extract(
    source: ResumeSource,
    thresholds?: ScannedDocumentThresholds,
    limits?: ExtractionLimits,
  ): Promise<NormalizedResumeDocument> {
    const startTime = Date.now();
    const buffer = await source.binarySource.getBuffer();
    const minCharsTotal = thresholds?.minCharsTotal ?? DEFAULT_MIN_CHARS_TOTAL;
    limits = limits ?? DEFAULT_EXTRACTION_LIMITS;

    let extractedText = '';

    // Strategy 1: JSZip word/document.xml extraction (direct XML structure parsing)
    try {
      type ZipFileEntry = {
        dir?: boolean;
        _data?: {
          uncompressedSize?: number | null;
        };
      };
      type ZipInstance = {
        files: Record<string, ZipFileEntry>;
        file: (name: string) => { async: (type: string) => Promise<string> } | null;
      };
      type JSZipLoader = {
        loadAsync: (b: Buffer) => Promise<ZipInstance>;
      };

      const JSZipModule = await import('jszip');
      const JSZip = ((JSZipModule as { default?: JSZipLoader }).default ?? JSZipModule) as unknown as JSZipLoader;
      const zip = await withTimeout<ZipInstance>(JSZip.loadAsync(buffer), limits.timeoutMs, 'zip loading');
      
      const files: ZipFileEntry[] = Object.values(zip.files);
      if (limits.maxArchiveFiles !== undefined && files.length > limits.maxArchiveFiles) {
        throw new DocumentExtractionError(
          `Extraction limits exceeded: archive contains ${files.length} files, max is ${limits.maxArchiveFiles}.`,
          undefined,
          'LIMIT_EXCEEDED',
        );
      }
      
      let totalUncompressedSize = 0;
      for (const file of files) {
        if (file.dir) continue;
        const size = file._data?.uncompressedSize;
        if (size === undefined || size === null) {
          throw new DocumentExtractionError(
            `Extraction limits exceeded: archive entry missing uncompressed size (unsafe).`,
            undefined,
            'LIMIT_EXCEEDED',
          );
        }
        totalUncompressedSize += size;
      }
      if (limits.maxArchiveSizeBytes !== undefined && totalUncompressedSize > limits.maxArchiveSizeBytes) {
        throw new DocumentExtractionError(
          `Extraction limits exceeded: archive uncompressed size (${totalUncompressedSize} bytes) exceeds max (${limits.maxArchiveSizeBytes}).`,
          undefined,
          'LIMIT_EXCEEDED',
        );
      }

      const docXmlFile = zip.file('word/document.xml');

      if (docXmlFile) {
        const remainingTime = limits.timeoutMs ? Math.max(0, limits.timeoutMs - (Date.now() - startTime)) : undefined;
        const xml: string = await withTimeout(docXmlFile.async('string'), remainingTime, 'xml extraction');
        
        if (limits.maxCharacters && xml.length > limits.maxCharacters * 2) {
           // Preliminary check before regexes
           this.logger.debug(`XML string size (${xml.length}) very large, could exceed character limit.`);
        }

        const formatted = xml
          .replace(/<w:tab\s*\/?>/g, '\t')
          .replace(/<w:br\s*\/?>/g, '\n')
          .replace(/<\/w:tc>\s*<w:tc[^>]*>/g, ': ')
          .replace(/<\/w:tr>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#160;|&nbsp;/g, ' ')
          .replace(/\n\s*\n+/g, '\n\n')
          .trim();

        if (formatted.length > 50) {
          extractedText = formatted;
        }
      }
    } catch (zipErr: unknown) {
      if (zipErr instanceof DocumentExtractionError) {
        throw zipErr;
      }
      const msg = zipErr instanceof Error ? zipErr.message : String(zipErr);
      this.logger.debug(`JSZip docx extraction failed, trying mammoth fallback: ${msg}`);
    }

    // Strategy 2: Mammoth extraction fallback
    if (!extractedText) {
      try {
        type MammothModule = {
          extractRawText: (opts: { buffer: Buffer }) => Promise<{ value?: string }>;
        };
        const mammothImport = await import('mammoth');
        const mammoth = ((mammothImport as { default?: MammothModule }).default ?? mammothImport) as unknown as MammothModule;
        const remainingTime = limits?.timeoutMs ? Math.max(0, limits.timeoutMs - (Date.now() - startTime)) : undefined;
        const result = await withTimeout<{ value?: string }>(mammoth.extractRawText({ buffer }), remainingTime, 'mammoth extraction');
        if (result.value?.trim()) {
          extractedText = result.value.trim();
        }
      } catch (mammothErr: unknown) {
        if (mammothErr instanceof DocumentExtractionError) {
          throw mammothErr;
        }
        const msg = mammothErr instanceof Error ? mammothErr.message : String(mammothErr);
        this.logger.debug(`Mammoth docx extraction failed: ${msg}`);
      }
    }

    // Throw CORRUPTED_FILE if standard extraction produced nothing
    if (!extractedText) {
      throw new DocumentExtractionError(
        'Unable to read DOCX file. The file may be corrupted or in an unsupported format.',
        undefined,
        'CORRUPTED_FILE',
      );
    }

    if (limits?.maxCharacters && extractedText.length > limits.maxCharacters) {
      throw new DocumentExtractionError(
        `Extraction limits exceeded: character count (${extractedText.length}) is greater than max (${limits.maxCharacters}).`,
        undefined,
        'LIMIT_EXCEEDED',
      );
    }


    // Page decomposition: for DOCX, split on form-feed \f or treat as continuous document
    const pageChunks = extractedText.includes('\f')
      ? extractedText.split('\f').filter(Boolean)
      : [extractedText];

    const pages: NormalizedResumePage[] = pageChunks.map((chunk, index) => {
      const pageText = chunk.trim();
      const lineCount = pageText
        ? pageText.split('\n').filter((l) => l.trim().length > 0).length
        : 0;
      return {
        pageNumber: index + 1,
        text: pageText,
        lineCount,
      };
    });

    const rawText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
    const nonWhitespaceChars = rawText.replace(/\s+/g, '').length;
    const isScanned = nonWhitespaceChars < minCharsTotal;
    const hasTextLayer = !isScanned;

    const lineCount = pages.reduce((acc, p) => acc + p.lineCount, 0);
    const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
    const durationMs = Date.now() - startTime;

    if (limits?.timeoutMs !== undefined && durationMs > limits.timeoutMs) {
      throw new DocumentExtractionError(
        `Extraction limits exceeded: extraction took ${durationMs}ms, max timeout is ${limits.timeoutMs}ms.`,
        undefined,
        'LIMIT_EXCEEDED',
      );
    }

    const diagnostics: DocumentExtractionDiagnostics = {
      characterCount: rawText.length,
      wordCount,
      lineCount,
      pageCount: pages.length,
      extractionDurationMs: durationMs,
      isScanned,
      hasTextLayer,
      ocrApplied: false,
    };

    const textChecksum = computeTextChecksumV1(rawText);

    return {
      rawText,
      pages,
      binaryChecksum: source.binaryChecksum,
      textChecksum,
      diagnostics,
    };
  }
}
