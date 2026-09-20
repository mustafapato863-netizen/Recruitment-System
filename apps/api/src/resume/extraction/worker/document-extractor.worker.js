/* global require, module */
const { parentPort } = require('node:worker_threads');
const crypto = require('node:crypto');

const DEFAULT_MIN_CHARS_TOTAL = 80;

const DEFAULT_EXTRACTION_LIMITS = {
  maxPages: 50,
  maxCharacters: 200000,
  timeoutMs: 15000,
  maxArchiveFiles: 1000,
  maxArchiveSizeBytes: 50 * 1024 * 1024,
};

function normalizeTextV1(rawText) {
  if (!rawText) return '';
  return rawText
    .normalize('NFC')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .toLowerCase()
    .trim();
}

function computeTextChecksumV1(rawText) {
  const normalized = normalizeTextV1(rawText);
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `v1:${hash}`;
}

class DocumentExtractionError extends Error {
  constructor(message, cause, code = 'EXTRACTION_FAILED') {
    super(message);
    this.name = 'DocumentExtractionError';
    this.cause = cause;
    this.code = code;
  }
}

async function extractPdf(buffer, thresholds, limits) {
  const startTime = Date.now();
  const minCharsTotal = thresholds?.minCharsTotal ?? DEFAULT_MIN_CHARS_TOTAL;
  limits = limits ?? DEFAULT_EXTRACTION_LIMITS;

  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    pdfjsLib = await import('pdfjs-dist');
  }

  const uint8 = new Uint8Array(buffer);
  let loadingTask;
  try {
    loadingTask = pdfjsLib.getDocument({
      data: uint8,
      isEvalSupported: false,
      useSystemFonts: true,
    });
  } catch (initErr) {
    throw new DocumentExtractionError(
      `PDF initialization failed: ${initErr.message || String(initErr)}`,
      initErr,
      'CORRUPTED_FILE',
    );
  }

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (loadErr) {
    throw new DocumentExtractionError(
      `PDF document loading failed: ${loadErr.message || String(loadErr)}`,
      loadErr,
      'CORRUPTED_FILE',
    );
  }

  try {
    const numPages = pdf.numPages;
    if (limits.maxPages && numPages > limits.maxPages) {
      throw new DocumentExtractionError(
        `Extraction limits exceeded: PDF has ${numPages} pages, max is ${limits.maxPages}.`,
        undefined,
        'LIMIT_EXCEEDED',
      );
    }

    const pages = [];
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
      let lastY = null;

      for (const item of textContent.items || []) {
        if (!item || typeof item.str !== 'string') continue;
        const currentY =
          item.transform && typeof item.transform[5] === 'number'
            ? item.transform[5]
            : null;

        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 3) {
          pageText += '\n';
        } else if (item.hasEOL) {
          pageText += '\n';
        } else if (
          pageText.length > 0 &&
          !pageText.endsWith('\n') &&
          !pageText.endsWith(' ') &&
          !item.str.startsWith(' ')
        ) {
          pageText += ' ';
        }

        pageText += item.str;
        if (item.hasEOL && !pageText.endsWith('\n')) {
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
      if (limits.maxCharacters && totalExtractedCharacters > limits.maxCharacters) {
        await loadingTask.destroy();
        throw new DocumentExtractionError(
          `Extraction limits exceeded: character count (${totalExtractedCharacters}) exceeded limit (${limits.maxCharacters}).`,
          undefined,
          'LIMIT_EXCEEDED',
        );
      }

      pages.push({
        pageNumber: pageNum,
        text: trimmedPageText,
        lineCount: pageLineCount,
      });

      if (typeof page.cleanup === 'function') {
        page.cleanup();
      }
    }

    const fullRawText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
    const totalNonWsChars = fullRawText.replace(/\s/g, '').length;
    const isDocumentScanned = totalNonWsChars < minCharsTotal;

    const issues = [];
    if (isDocumentScanned) {
      issues.push(`Document text density is extremely low (${totalNonWsChars} chars total). Likely a scanned or image-only PDF.`);
    }

    const textChecksum = computeTextChecksumV1(fullRawText);
    const extractionDurationMs = Date.now() - startTime;

    return {
      rawText: fullRawText,
      pages,
      binaryChecksum: '',
      textChecksum,
      diagnostics: {
        characterCount: fullRawText.length,
        wordCount: fullRawText.split(/\s+/).filter(Boolean).length,
        lineCount: fullRawText.split('\n').length,
        pageCount: pages.length,
        extractionDurationMs,
        isScanned: isDocumentScanned,
        hasTextLayer: fullRawText.length > 0,
        ocrApplied: false,
      },
    };
  } finally {
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      await loadingTask.destroy().catch(() => {});
    }
  }
}

async function extractDocx(buffer, thresholds, limits) {
  const startTime = Date.now();
  limits = limits ?? DEFAULT_EXTRACTION_LIMITS;

  let JSZip;
  try {
    const JSZipModule = require('jszip');
    JSZip = JSZipModule.default || JSZipModule;
  } catch (zipImportErr) {
    throw new DocumentExtractionError(`JSZip unavailable: ${zipImportErr.message}`, zipImportErr, 'EXTRACTION_FAILED');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (zipErr) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const rawText = result.value || '';
      const textChecksum = computeTextChecksumV1(rawText);
      return {
        schemaVersion: '1.0.0',
        rawText,
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          rawText,
          lines: rawText.split('\n'),
          lineCount: rawText.split('\n').length,
          characterCount: rawText.length,
          diagnostics: { isScanned: false, hasLowTextDensity: false },
        }],
        diagnostics: {
          characterCount: rawText.length,
          isScanned: false,
          hasLowTextDensity: false,
          extractionDurationMs: Date.now() - startTime,
        },
        textChecksum,
        extractedAt: new Date().toISOString(),
      };
    } catch {
      throw new DocumentExtractionError(
        `Corrupted DOCX archive: ${zipErr.message}`,
        zipErr,
        'CORRUPTED_FILE',
      );
    }
  }

  const files = Object.values(zip.files || {});
  if (limits.maxArchiveFiles && files.length > limits.maxArchiveFiles) {
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

  if (limits.maxArchiveSizeBytes && totalUncompressedSize > limits.maxArchiveSizeBytes) {
    throw new DocumentExtractionError(
      `Extraction limits exceeded: archive uncompressed size (${totalUncompressedSize} bytes) exceeds max (${limits.maxArchiveSizeBytes}).`,
      undefined,
      'LIMIT_EXCEEDED',
    );
  }

  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new DocumentExtractionError('Invalid DOCX: missing word/document.xml', undefined, 'CORRUPTED_FILE');
  }

  const xmlText = await docXmlFile.async('string');
  if (limits.maxCharacters && xmlText.length > limits.maxCharacters * 10) {
    throw new DocumentExtractionError('Extraction limits exceeded: document XML exceeds character limit', undefined, 'LIMIT_EXCEEDED');
  }

  const paragraphs = [];
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xmlText)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let textPieces = '';
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      textPieces += tMatch[1];
    }
    const cleanLine = textPieces
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
    if (cleanLine) {
      paragraphs.push(cleanLine);
    }
  }

  const rawText = paragraphs.join('\n');
  const textChecksum = computeTextChecksumV1(rawText);

  return {
    rawText,
    pages: [{
      pageNumber: 1,
      text: rawText,
      lineCount: paragraphs.length,
    }],
    binaryChecksum: '',
    textChecksum,
    diagnostics: {
      characterCount: rawText.length,
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      lineCount: paragraphs.length,
      pageCount: 1,
      extractionDurationMs: Date.now() - startTime,
      isScanned: false,
      hasTextLayer: rawText.length > 0,
      ocrApplied: false,
    },
  };
}

if (parentPort) {
  parentPort.on('message', async (message) => {
    if (!message || message.type !== 'EXTRACT') return;

    const { taskId, fileName, mimeType, buffer, thresholds, limits } = message;

    try {
      const lowerName = (fileName || '').toLowerCase();
      const isPdf = lowerName.endsWith('.pdf') || mimeType === 'application/pdf';
      const isDocx =
        lowerName.endsWith('.docx') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      let result;
      if (isPdf) {
        result = await extractPdf(buffer, thresholds, limits);
      } else if (isDocx) {
        result = await extractDocx(buffer, thresholds, limits);
      } else {
        throw new DocumentExtractionError(
          `Unsupported document format for "${fileName}". Only PDF (.pdf) and Word (.docx) files are supported.`,
          undefined,
          'UNSUPPORTED_FORMAT',
        );
      }

      parentPort.postMessage({
        type: 'EXTRACT_SUCCESS',
        taskId,
        result,
      });
    } catch (error) {
      const code =
        error instanceof DocumentExtractionError
          ? error.code
          : (error && (error.code === 'CORRUPTED_FILE' || error.code === 'UNSUPPORTED_FORMAT' || error.code === 'LIMIT_EXCEEDED'))
          ? error.code
          : 'EXTRACTION_FAILED';

      const message = error instanceof Error ? error.message : String(error);

      parentPort.postMessage({
        type: 'EXTRACT_FAILURE',
        taskId,
        error: {
          code,
          message,
        },
      });
    }
  });
}

module.exports = {
  extractPdf,
  extractDocx,
};
