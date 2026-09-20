import { describe, expect, it, afterEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ExtractionWorkerPool } from '../extraction-worker-pool';
import { WorkerThreadDocumentExtractor } from '../worker-thread-document-extractor';
import { CompositeDocumentExtractor } from '../../composite-document-extractor';
import { PdfDocumentExtractor } from '../../pdf-document-extractor';
import { DocxDocumentExtractor } from '../../docx-document-extractor';
import { DocumentExtractionError } from '../../document-extractor.interface';
import type { ResumeSource } from '../../../source/resume-source.interface';
import type { BinaryDocumentSource } from '../../../source/binary-document-source.interface';

// Helper to construct a valid minimal 2-page PDF buffer in memory
function createMinimalTwoPagePdf(): Buffer {
  const stream1 = `BT
/F1 12 Tf
72 712 Td
(Karim Nasser - Senior Software Engineer) Tj
0 -20 Td
(Building enterprise human resource information systems with TypeScript and PostgreSQL) Tj
ET`;
  const stream2 = `BT
/F1 12 Tf
72 712 Td
(Work Experience - Saudi German Hospital) Tj
0 -20 Td
(Architected candidate matching engine and full-stack workflow automation systems) Tj
ET`;

  const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${stream1.length} >> stream
${stream1}
endstream
endobj
6 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >> endobj
7 0 obj << /Length ${stream2.length} >> stream
${stream2}
endstream
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000123 00000 n 
0000000232 00000 n 
0000000303 00000 n 
0000000485 00000 n 
0000000594 00000 n 
trailer << /Size 8 /Root 1 0 R >>
startxref
780
%%EOF`;
  return Buffer.from(pdfContent, 'utf-8');
}

describe('WorkerThreadDocumentExtractor & ExtractionWorkerPool', () => {
  let pool: ExtractionWorkerPool | null = null;

  afterEach(async () => {
    if (pool) {
      await pool.onModuleDestroy();
      pool = null;
    }
  });

  const createMockSource = (buffer: Buffer, fileName: string, mimeType: string): ResumeSource => {
    const binarySource: BinaryDocumentSource = {
      byteLength: buffer.length,
      getBuffer: async () => buffer,
      openStream: () => {
        throw new Error('Not used');
      },
    };

    return {
      binaryChecksum: 'mock-binary-checksum',
      fileName,
      mimeType,
      fileSizeBytes: buffer.length,
      binarySource,
      getNormalizedDocument: async () => {
        throw new Error('Not used');
      },
    };
  };

  it('initializes the configured number of workers in the pool', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 2 });
    expect(pool.activeWorkerCount).toBe(2);
    expect(pool.busyWorkerCount).toBe(0);
    expect(pool.queuedCount).toBe(0);
  });

  it('extracts text from a multi-page PDF in a worker thread', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 1 });
    const extractor = new WorkerThreadDocumentExtractor(pool);

    expect(extractor.supports('application/pdf', 'cv.pdf')).toBe(true);

    const validPdf = createMinimalTwoPagePdf();
    const source = createMockSource(validPdf, 'Karim_Nasser_CV.pdf', 'application/pdf');
    const result = await extractor.extract(source);

    expect(result.diagnostics.pageCount).toBe(2);
    expect(result.rawText).toContain('Karim Nasser');
    expect(result.rawText).toContain('Saudi German Hospital');
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[1].pageNumber).toBe(2);
  });

  it('rejects with CORRUPTED_FILE on corrupted PDF buffer', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 1 });
    const extractor = new WorkerThreadDocumentExtractor(pool);

    const corruptBuffer = Buffer.from('%PDF-1.4 corrupt content that is definitely not valid PDF');
    const source = createMockSource(corruptBuffer, 'corrupt.pdf', 'application/pdf');

    await expect(extractor.extract(source)).rejects.toThrow(DocumentExtractionError);

    try {
      await extractor.extract(source);
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DocumentExtractionError);
      expect((err as DocumentExtractionError).code).toBe('CORRUPTED_FILE');
    }
  });

  it('rejects with UNSUPPORTED_FORMAT on unsupported file format', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 1 });
    const extractor = new WorkerThreadDocumentExtractor(pool);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const source = createMockSource(pngBuffer, 'avatar.png', 'image/png');

    try {
      await extractor.extract(source);
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DocumentExtractionError);
      expect((err as DocumentExtractionError).code).toBe('UNSUPPORTED_FORMAT');
    }
  });

  it('queues tasks when all workers are busy and processes sequentially', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 1 });
    const extractor = new WorkerThreadDocumentExtractor(pool);

    const validPdf = createMinimalTwoPagePdf();
    const source1 = createMockSource(validPdf, 'cv1.pdf', 'application/pdf');
    const source2 = createMockSource(validPdf, 'cv2.pdf', 'application/pdf');
    const source3 = createMockSource(validPdf, 'cv3.pdf', 'application/pdf');

    // Run 3 extractions concurrently on a 1-worker pool
    const [res1, res2, res3] = await Promise.all([
      extractor.extract(source1),
      extractor.extract(source2),
      extractor.extract(source3),
    ]);

    expect(res1.rawText).toContain('Karim Nasser');
    expect(res2.rawText).toContain('Karim Nasser');
    expect(res3.rawText).toContain('Karim Nasser');
  });

  it('rejects with LIMIT_EXCEEDED when queue size is exceeded', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 1, maxQueueSize: 1 });
    const extractor = new WorkerThreadDocumentExtractor(pool);

    const validPdf = createMinimalTwoPagePdf();
    const source = createMockSource(validPdf, 'cv.pdf', 'application/pdf');

    // Task 1 occupies the worker
    const p1 = extractor.extract(source);
    // Task 2 occupies the queue (1 slot)
    const p2 = extractor.extract(source);
    // Task 3 exceeds queue capacity (maxQueueSize: 1)
    const p3 = extractor.extract(source);

    await expect(p3).rejects.toThrow(DocumentExtractionError);
    try {
      await p3;
    } catch (err: unknown) {
      expect((err as DocumentExtractionError).code).toBe('LIMIT_EXCEEDED');
    }

    // Await p1 and p2 so they finish cleanly
    await Promise.all([p1, p2]);
  });

  it('executes hard thread kill via worker.terminate() when timeoutMs is exceeded', async () => {
    pool = new ExtractionWorkerPool(undefined, { poolSize: 1 });
    const extractor = new WorkerThreadDocumentExtractor(pool);

    const validPdf = createMinimalTwoPagePdf();
    const source = createMockSource(validPdf, 'cv.pdf', 'application/pdf');

    // Set an ultra-short timeout of 1ms so timeout triggers hard kill
    try {
      await extractor.extract(source, undefined, { timeoutMs: 1 });
      expect.unreachable('Should have timed out');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DocumentExtractionError);
      expect((err as DocumentExtractionError).code).toBe('LIMIT_EXCEEDED');
      expect((err as DocumentExtractionError).message).toContain('hard thread termination');
    }

    // Verify pool replenished the terminated worker and can process subsequent requests
    const res = await extractor.extract(source, undefined, { timeoutMs: 15_000 });
    expect(res.rawText).toContain('Karim Nasser');
  });

  describe('CompositeDocumentExtractor Integration & Feature Flag', () => {
    it('delegates to WorkerThreadDocumentExtractor when ENABLE_WORKER_DOCUMENT_EXTRACTOR is "true"', async () => {
      pool = new ExtractionWorkerPool(undefined, { poolSize: 1 });
      const workerExtractor = new WorkerThreadDocumentExtractor(pool);

      const mockPdfExtractor = new PdfDocumentExtractor();
      const mockDocxExtractor = new DocxDocumentExtractor();

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_WORKER_DOCUMENT_EXTRACTOR') return 'true';
          return undefined;
        }),
      };

      const composite = new CompositeDocumentExtractor(
        mockPdfExtractor,
        mockDocxExtractor,
        workerExtractor,
        mockConfig as ConfigService,
      );

      const validPdf = createMinimalTwoPagePdf();
      const source = createMockSource(validPdf, 'cv.pdf', 'application/pdf');
      const res = await composite.extract(source);

      expect(res.rawText).toContain('Karim Nasser');
    });

    it('stays on in-process extractors when ENABLE_WORKER_DOCUMENT_EXTRACTOR is false/unset', async () => {
      const mockPdfExtractor = new PdfDocumentExtractor();
      const mockDocxExtractor = new DocxDocumentExtractor();

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockReturnValue(undefined),
      };

      const composite = new CompositeDocumentExtractor(
        mockPdfExtractor,
        mockDocxExtractor,
        undefined,
        mockConfig as ConfigService,
      );

      const validPdf = createMinimalTwoPagePdf();
      const source = createMockSource(validPdf, 'cv.pdf', 'application/pdf');
      const res = await composite.extract(source);

      expect(res.rawText).toContain('Karim Nasser');
    });
  });
});
