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
const DEFAULT_MIN_CHARS_PER_PAGE = 20;

@Injectable()
export class PdfDocumentExtractor implements DocumentExtractor {
  private readonly logger = new Logger(PdfDocumentExtractor.name);

  supports(mimeType: string, fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return lowerName.endsWith('.pdf') || mimeType === 'application/pdf';
  }

  async extract(
    source: ResumeSource,
    thresholds?: ScannedDocumentThresholds,
    limits?: ExtractionLimits,
  ): Promise<NormalizedResumeDocument> {
    const startTime = Date.now();
    const buffer = await source.binarySource.getBuffer();

    const minCharsTotal = thresholds?.minCharsTotal ?? DEFAULT_MIN_CHARS_TOTAL;
    const minCharsPerPage = thresholds?.minCharsPerPage ?? DEFAULT_MIN_CHARS_PER_PAGE;

    limits = limits ?? DEFAULT_EXTRACTION_LIMITS;

    try {
      type PdfJsLib = {
        getDocument: (params: {
          data: Uint8Array;
          isEvalSupported?: boolean;
          useSystemFonts?: boolean;
          disableFontFace?: boolean;
        }) => {
          promise: Promise<{
            numPages: number;
            getPage: (pageNum: number) => Promise<{
              getTextContent: () => Promise<{
                items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>;
              }>;
              cleanup?: () => void;
            }>;
            destroy: () => Promise<void>;
          }>;
          destroy: () => Promise<void>;
        };
      };

      // Dynamic import of pdfjs-dist legacy Node-compatible build
      let pdfjsLib: PdfJsLib;
      try {
        pdfjsLib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsLib;
      } catch {
        pdfjsLib = (await import('pdfjs-dist')) as unknown as PdfJsLib;
      }

      const uint8 = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({
        data: uint8,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;
      
      try {
        const numPages: number = pdf.numPages;
        if (limits.maxPages && numPages > limits.maxPages) {
          throw new DocumentExtractionError(
            `Extraction limits exceeded: PDF has ${numPages} pages, max is ${limits.maxPages}.`,
            undefined,
            'LIMIT_EXCEEDED',
          );
        }

        const pages: NormalizedResumePage[] = [];
        let totalExtractedCharacters = 0;

        for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
          const currentDuration = Date.now() - startTime;
          if (limits.timeoutMs !== undefined && currentDuration > limits.timeoutMs) {
            await loadingTask.destroy();
            throw new DocumentExtractionError(
              `Extraction limits exceeded: extraction took ${currentDuration}ms, max timeout is ${limits.timeoutMs}ms.`,
              undefined,
              'LIMIT_EXCEEDED',
            );
          }

          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
        let pageText = '';
        let lastY: number | null = null;

        for (const item of textContent.items) {
          if (!('str' in item) || typeof item.str !== 'string') continue;
          const textItem = item as { str: string; transform?: number[]; hasEOL?: boolean };
          const currentY: number | null =
            textItem.transform && typeof textItem.transform[5] === 'number'
              ? textItem.transform[5]
              : null;

          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 3) {
            pageText += '\n';
          } else if (textItem.hasEOL) {
            pageText += '\n';
          } else if (
            pageText.length > 0 &&
            !pageText.endsWith('\n') &&
            !pageText.endsWith(' ') &&
            !textItem.str.startsWith(' ')
          ) {
            pageText += ' ';
          }

          pageText += textItem.str;
          if (textItem.hasEOL && !pageText.endsWith('\n')) {
            pageText += '\n';
          }

          if (currentY !== null) {
            lastY = currentY;
          }
        }

        const trimmedPageText = pageText.trim();
        const pageLineCount = trimmedPageText
          ? trimmedPageText.split('\n').filter((l) => l.trim().length > 0).length
          : 0;
          
        totalExtractedCharacters += trimmedPageText.length;
        
        if (limits?.maxCharacters && totalExtractedCharacters > limits.maxCharacters) {
          throw new DocumentExtractionError(
            `Extraction limits exceeded: character count exceeded max (${limits.maxCharacters}).`,
            undefined,
            'LIMIT_EXCEEDED',
          );
        }

        pages.push({
          pageNumber: pageNum,
          text: trimmedPageText,
          lineCount: pageLineCount,
        });
      }

      const rawText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
      const nonWhitespaceChars = rawText.replace(/\s+/g, '').length;
      const avgCharsPerPage = numPages > 0 ? nonWhitespaceChars / numPages : 0;

      // Scanned document detection: non-whitespace char density
      const isScanned =
        nonWhitespaceChars < minCharsTotal || avgCharsPerPage < minCharsPerPage;
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
        pageCount: numPages,
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
      } finally {
        // Ensure PDF memory is released
        if (loadingTask) {
          try {
            await loadingTask.destroy();
          } catch (destroyErr: unknown) {
            const destroyMsg = destroyErr instanceof Error ? destroyErr.message : String(destroyErr);
            this.logger.warn(`Failed to destroy PDF document: ${destroyMsg}`);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DocumentExtractionError) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`PDF extraction failed for "${source.fileName}": ${errMsg}`);
      throw new DocumentExtractionError(
        `Failed to extract text from PDF: ${errMsg || 'Unknown error'}`,
        err instanceof Error ? err : undefined,
        errMsg.includes('Invalid') || errMsg.includes('corrupt')
          ? 'CORRUPTED_FILE'
          : 'EXTRACTION_FAILED',
      );
    }
  }
}
