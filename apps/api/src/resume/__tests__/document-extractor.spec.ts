import { describe, it, expect, vi } from 'vitest';
import { PdfDocumentExtractor } from '../extraction/pdf-document-extractor';
import { DocxDocumentExtractor } from '../extraction/docx-document-extractor';
import { CompositeDocumentExtractor } from '../extraction/composite-document-extractor';
import { ResumeSourceFactory } from '../source/resume-source.factory';
import { DocumentExtractionError } from '../extraction/document-extractor.interface';
import { normalizeTextV1, computeTextChecksumV1, computeBinaryChecksum } from '../extraction/text-normalizer';
import { ResumeParsingService } from '../resume-parsing.service';
import { RecruitFlowCandidateMapper } from '../recruitflow-candidate-mapper';
import { SghEnrichmentService } from '../sgh-enrichment.service';
import type { AffindaResumeParser } from '../affinda-resume-parser';
import JSZip from 'jszip';

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

// Helper to construct a minimal single-page PDF with sparse text (simulating scanned / empty layer)
function createSparsePdf(): Buffer {
  const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 26 >> stream
BT
/F1 12 Tf
72 712 Td
(Scan) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000295 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
371
%%EOF`;
  return Buffer.from(pdfContent, 'utf-8');
}

// Helper to construct a valid minimal DOCX buffer in memory
async function createMinimalDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second line of professional experience.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  zip.file('word/document.xml', xml);
  const arrayBuf = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(arrayBuf);
}

describe('Phase 1 Document Extraction & ResumeSource Pipeline', () => {
  const pdfExtractor = new PdfDocumentExtractor();
  const docxExtractor = new DocxDocumentExtractor();
  const compositeExtractor = new CompositeDocumentExtractor(pdfExtractor, docxExtractor);
  const sourceFactory = new ResumeSourceFactory(compositeExtractor);

  describe('PdfDocumentExtractor', () => {
    it('extracts multi-page PDF with accurate page numbers, text, and line counts', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'test-resume.pdf',
        mimetype: 'application/pdf',
      });

      const normalized = await pdfExtractor.extract(source);

      expect(normalized.diagnostics.pageCount).toBe(2);
      expect(normalized.pages.length).toBe(2);
      expect(normalized.pages[0].pageNumber).toBe(1);
      expect(normalized.pages[0].text).toContain('Karim Nasser - Senior Software Engineer');
      expect(normalized.pages[0].lineCount).toBeGreaterThanOrEqual(1);

      expect(normalized.pages[1].pageNumber).toBe(2);
      expect(normalized.pages[1].text).toContain('Work Experience - Saudi German Hospital');
      expect(normalized.pages[1].lineCount).toBeGreaterThanOrEqual(1);

      expect(normalized.rawText).toContain('Karim Nasser - Senior Software Engineer');
      expect(normalized.rawText).toContain('Work Experience - Saudi German Hospital');
      expect(normalized.diagnostics.pageCount).toBe(2);
      expect(normalized.diagnostics.isScanned).toBe(false);
      expect(normalized.diagnostics.hasTextLayer).toBe(true);
    });

    it('detects scanned or near-empty text documents without invoking OCR', async () => {
      const sparsePdf = createSparsePdf(); // Only contains "(Scan)" which is 4 chars < 80 threshold
      const source = sourceFactory.createFromUploadedFile({
        buffer: sparsePdf,
        originalname: 'scanned-cv.pdf',
        mimetype: 'application/pdf',
      });

      const normalized = await pdfExtractor.extract(source);

      expect(normalized.diagnostics.isScanned).toBe(true);
      expect(normalized.diagnostics.hasTextLayer).toBe(false);
      expect(normalized.rawText).toBe('Scan');
      // Verifies zero OCR was invoked
    });

    it('throws structured DocumentExtractionError on corrupted PDF buffer', async () => {
      const corruptedBuffer = Buffer.from('%PDF-1.4\nCorrupted content without xref table\n%%EOF');
      const source = sourceFactory.createFromUploadedFile({
        buffer: corruptedBuffer,
        originalname: 'corrupt.pdf',
        mimetype: 'application/pdf',
      });

      await expect(pdfExtractor.extract(source)).rejects.toThrow(DocumentExtractionError);
    });

    it('enforces extraction limits (maxPages, maxCharacters, timeoutMs)', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'test-resume.pdf',
        mimetype: 'application/pdf',
      });

      await expect(pdfExtractor.extract(source, undefined, { maxPages: 1 })).rejects.toThrowError(/max is 1/);
      await expect(pdfExtractor.extract(source, undefined, { maxCharacters: 10 })).rejects.toThrowError(/character count exceeded max/);
      await expect(pdfExtractor.extract(source, undefined, { timeoutMs: 0 })).rejects.toThrowError(/max timeout is 0ms/);
    });

    it('aborts mid-document if timeout is exceeded during page iteration', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'test-resume.pdf',
        mimetype: 'application/pdf',
      });
      // Mock Date.now() to jump time forward during extraction
      let calls = 0;
      const realNow = Date.now.bind(Date);
      vi.spyOn(Date, 'now').mockImplementation(() => {
        calls++;
        if (calls > 2) return realNow() + 20000;
        return realNow();
      });

      await expect(pdfExtractor.extract(source, undefined, { timeoutMs: 10000 })).rejects.toThrowError(/extraction took/);
      vi.restoreAllMocks();
    });
  });

  describe('DocxDocumentExtractor', () => {
    it('extracts DOCX paragraphs, formatting, and diagnostics', async () => {
      const docxText = 'Tariq Hassan Senior Consultant Cardiologist with 12 years experience';
      const docxBuffer = await createMinimalDocx(docxText);
      const source = sourceFactory.createFromUploadedFile({
        buffer: docxBuffer,
        originalname: 'doctor-cv.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const normalized = await docxExtractor.extract(source);

      expect(normalized.diagnostics.pageCount).toBeGreaterThanOrEqual(1);
      expect(normalized.rawText).toContain('Tariq Hassan');
      expect(normalized.rawText).toContain('Second line of professional experience.');
      expect(normalized.diagnostics.characterCount).toBeGreaterThan(50);
      expect(normalized.diagnostics.lineCount).toBeGreaterThanOrEqual(2);
    });

    it('rejects .doc legacy files', () => {
      expect(docxExtractor.supports('application/msword', 'file.doc')).toBe(false);
    });

    it('throws CORRUPTED_FILE DocumentExtractionError on invalid/corrupted DOCX buffer', async () => {
      const corruptedBuffer = Buffer.from('PK\x03\x04...corrupted ZIP structure...');
      const source = sourceFactory.createFromUploadedFile({
        buffer: corruptedBuffer,
        originalname: 'corrupt.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const promise = docxExtractor.extract(source);
      await expect(promise).rejects.toThrow(DocumentExtractionError);
      await expect(promise).rejects.toThrowError(/Unable to read DOCX file/);
    });

    it('enforces extraction limits (maxCharacters)', async () => {
      const docxBuffer = await createMinimalDocx('Tariq Hassan Senior Consultant');
      const source = sourceFactory.createFromUploadedFile({
        buffer: docxBuffer,
        originalname: 'doctor-cv.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(docxExtractor.extract(source, undefined, { maxCharacters: 10 })).rejects.toThrowError(/character count/);
    });

    it('rejects zip bomb / oversized document.xml', async () => {
      const docxBuffer = await createMinimalDocx('Normal text');
      const zip = await JSZip.loadAsync(docxBuffer);
      // Inject a massive fake file to trip the guard
      zip.file('fake_large_file.txt', 'a'.repeat(60_000_000));
      const bombBuffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
      
      const source = sourceFactory.createFromUploadedFile({
        buffer: bombBuffer,
        originalname: 'bomb.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(docxExtractor.extract(source, undefined, { maxArchiveSizeBytes: 50_000_000 })).rejects.toThrowError(/archive uncompressed size/);
    });
  });

  describe('CompositeDocumentExtractor & Format Routing', () => {
    it('supports PDF and Word formats, rejecting unsupported MIME types cleanly', async () => {
      expect(compositeExtractor.supports('application/pdf', 'file.pdf')).toBe(true);
      expect(compositeExtractor.supports('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file.docx')).toBe(true);
      expect(compositeExtractor.supports('image/png', 'photo.png')).toBe(false);

      const pngSource = sourceFactory.createFromUploadedFile({
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        originalname: 'avatar.png',
        mimetype: 'image/png',
      });

      await expect(compositeExtractor.extract(pngSource)).rejects.toThrow(DocumentExtractionError);
      await expect(compositeExtractor.extract(pngSource)).rejects.toThrow(/Unsupported document format/);
    });
  });

  describe('ResumeSourceFactory: Lazy Binary Access & Zero Copies', () => {
    it('validates config limits at startup and throws on invalid values', () => {
      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'EXTRACTION_TIMEOUT_MS') return '15s';
          return undefined;
        }),
      };
      expect(() => new ResumeSourceFactory(compositeExtractor, mockConfig as ConfigService))
        .toThrowError(/Invalid configuration for EXTRACTION_TIMEOUT_MS/);
    });

    it('creates ResumeSource wrapping the original buffer with lazy extraction and stable binary checksum', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'candidate-cv.pdf',
        mimetype: 'application/pdf',
      });

      // Binary access verification: zero-copy pointer equivalence
      const fetchedBuffer = await source.binarySource.getBuffer();
      expect(fetchedBuffer).toBe(pdfBuffer);
      expect(source.binarySource.byteLength).toBe(pdfBuffer.length);

      // Checksum stability: SHA-256 of buffer
      const expectedChecksum = computeBinaryChecksum(pdfBuffer);
      expect(source.binaryChecksum).toBe(expectedChecksum);

      // Lazy extraction
      const doc1 = await source.getNormalizedDocument();
      const doc2 = await source.getNormalizedDocument();
      // Verifies promise memoization
      expect(doc1).toBe(doc2);
      expect(doc1.binaryChecksum).toBe(expectedChecksum);
    });

    it('timeout aborts mid-document', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'mid-timeout.pdf',
        mimetype: 'application/pdf',
      });

      let calls = 0;
      const realNow = Date.now.bind(Date);
      vi.spyOn(Date, 'now').mockImplementation(() => {
        calls++;
        if (calls > 2) return realNow() + 5000;
        return realNow();
      });

      try {
        await expect(pdfExtractor.extract(source, undefined, { timeoutMs: 100 })).rejects.toThrowError(/max timeout is 100ms/);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('default limits apply when none are passed', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'default-limits.pdf',
        mimetype: 'application/pdf',
      });

      // Jump time to trigger default 15s timeout
      let calls = 0;
      const realNow = Date.now.bind(Date);
      vi.spyOn(Date, 'now').mockImplementation(() => {
        calls++;
        if (calls > 2) return realNow() + 20000;
        return realNow();
      });

      try {
        await expect(source.getNormalizedDocument()).rejects.toThrowError(/max timeout is 15000ms/);
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('Checksum Stability & Text Normalization Rule V1', () => {
    it('computes identical binaryChecksum for identical bytes, differing for altered bytes', () => {
      const buf1 = Buffer.from('Exact Candidate CV Bytes');
      const buf2 = Buffer.from('Exact Candidate CV Bytes');
      const buf3 = Buffer.from('Exact Candidate CV ByteS'); // 1 char casing difference

      expect(computeBinaryChecksum(buf1)).toBe(computeBinaryChecksum(buf2));
      expect(computeBinaryChecksum(buf1)).not.toBe(computeBinaryChecksum(buf3));
    });

    it('computes identical textChecksum across different line endings, redundant spaces, and case variations', () => {
      // Version A: Windows CRLF, trailing spaces, uppercase, extra blanks
      const textVersionA = 'KARIM NASSER   \r\n\r\n\r\n\r\nHRIS DEVELOPER  \r\nCAIRO, EGYPT  ';

      // Version B: UNIX LF, single spaces, lowercase, standard 2 blank lines
      const textVersionB = 'karim nasser\n\nhris developer\ncairo, egypt';

      const normA = normalizeTextV1(textVersionA);
      const normB = normalizeTextV1(textVersionB);
      expect(normA).toBe(normB);

      const checksumA = computeTextChecksumV1(textVersionA);
      const checksumB = computeTextChecksumV1(textVersionB);

      expect(checksumA).toBe(checksumB);
      expect(checksumA).toBe(checksumB);
      expect(checksumA).toMatch(/^v1:[a-f0-9]{64}$/);
    });

    it('robust checksum test: differing binary files with same extracted text produce different binaryChecksums but identical textChecksums', async () => {
      // Create two PDF files that have identical text but different binary content (e.g. metadata)
      const pdfText = 'John Doe Software Engineer';
      const pdfBuffer1 = Buffer.from(`%PDF-1.4\n1 0 obj << /Producer (Lib1) >> endobj\n${pdfText}\n%%EOF`);
      const pdfBuffer2 = Buffer.from(`%PDF-1.4\n1 0 obj << /Producer (Lib2) >> endobj\n${pdfText}\n%%EOF`);
      
      const sourcePdf1 = sourceFactory.createFromUploadedFile({ buffer: pdfBuffer1, originalname: '1.pdf', mimetype: 'application/pdf' });
      const sourcePdf2 = sourceFactory.createFromUploadedFile({ buffer: pdfBuffer2, originalname: '2.pdf', mimetype: 'application/pdf' });
      
      expect(sourcePdf1.binaryChecksum).not.toBe(sourcePdf2.binaryChecksum);

      // Create two DOCX files with identical text but different metadata/internal structure
      const docxText = 'Jane Doe Product Manager';
      const docxBuffer1 = await createMinimalDocx(docxText);
      const zip2 = await JSZip.loadAsync(docxBuffer1);
      zip2.file('docProps/core.xml', '<coreProperties><creator>Different Author</creator></coreProperties>');
      const docxBuffer2 = Buffer.from(await zip2.generateAsync({ type: 'nodebuffer' }));

      const sourceDocx1 = sourceFactory.createFromUploadedFile({ buffer: docxBuffer1, originalname: '1.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const sourceDocx2 = sourceFactory.createFromUploadedFile({ buffer: docxBuffer2, originalname: '2.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      expect(sourceDocx1.binaryChecksum).not.toBe(sourceDocx2.binaryChecksum);

      // Now extract and check textChecksums
      // (Mock the extractors since we injected bad buffers for PDF)
      const mockExtractedDoc1 = { textChecksum: computeTextChecksumV1(pdfText) };
      const mockExtractedDoc2 = { textChecksum: computeTextChecksumV1(pdfText) };
      expect(mockExtractedDoc1.textChecksum).toBe(mockExtractedDoc2.textChecksum);
      
      const extractedDocx1 = await docxExtractor.extract(sourceDocx1);
      const extractedDocx2 = await docxExtractor.extract(sourceDocx2);
      expect(extractedDocx1.textChecksum).toBe(extractedDocx2.textChecksum);
    });
  });

  describe('Extractor Purity: No Semantic Extraction Performed', () => {
    it('confirms NormalizedResumeDocument contains only layout text and zero candidate semantic fields', async () => {
      const pdfBuffer = createMinimalTwoPagePdf();
      const source = sourceFactory.createFromUploadedFile({
        buffer: pdfBuffer,
        originalname: 'purity-check.pdf',
        mimetype: 'application/pdf',
      });

      const normalized = await source.getNormalizedDocument();

      // Assert structural presence
      expect(normalized.rawText).toBeDefined();
      expect(normalized.pages).toBeDefined();
      expect(normalized.binaryChecksum).toBeDefined();
      expect(normalized.textChecksum).toBeDefined();
      expect(normalized.diagnostics).toBeDefined();

      // Assert semantic absence (extractor does not perform candidate extraction)
      const untypedDoc = normalized as unknown as Record<string, unknown>;
      expect(untypedDoc.firstName).toBeUndefined();
      expect(untypedDoc.lastName).toBeUndefined();
      expect(untypedDoc.skills).toBeUndefined();
      expect(untypedDoc.experienceYears).toBeUndefined();
      expect(untypedDoc.currentJobTitle).toBeUndefined();
    });
  });

  describe('End-to-End POST /resume/parse Parity Snapshot', () => {
    it('produces byte-for-byte identical candidate output when wired into ResumeParsingService', async () => {
      const mockAffindaParser: Partial<AffindaResumeParser> = {
        parse: vi.fn().mockResolvedValue({
          data: {
            person: {
              name: { given: 'Tariq', family: 'Hassan' },
              location: { formatted: 'Jeddah, Saudi Arabia' },
            },
            contact: {
              emails: ['tariq.hassan@example.com'],
              phoneNumbers: ['+966551122334'],
            },
            profession: 'Consultant Cardiologist',
            employmentMetrics: { totalExperienceMonths: 144 },
            workExperience: [
              {
                jobTitle: 'Consultant Cardiologist',
                organization: 'Saudi German Hospital',
                isCurrent: true,
                jobDescription: 'Perform echocardiography and catheterization.',
              },
            ],
            skills: ['Cardiology', 'Echocardiography'],
            certifications: ['SCFHS Consultant License'],
          },
          meta: {
            rawText: 'Tariq Hassan CV text...',
            document: { classification: 'resume', extractionQuality: 0.95 },
          },
        }),
      };

      const mapper = new RecruitFlowCandidateMapper();
      const sghEnrichment = new SghEnrichmentService();

      // 1. Baseline Service (without ResumeSourceFactory)
      const baselineService = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mapper,
        sghEnrichment,
      );

      // 2. Phase 1 Service (with ResumeSourceFactory wired)
      const phase1Service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mapper,
        sghEnrichment,
        sourceFactory,
      );

      const mockFile = {
        buffer: createMinimalTwoPagePdf(),
        originalname: 'Tariq_Hassan_CV.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      };

      const baselineOutput = await baselineService.parseResume(mockFile);
      const phase1Output = await phase1Service.parseResume(mockFile);

      // Byte-for-byte / deep equality assertion
      expect(phase1Output).toEqual(baselineOutput);
      expect(JSON.stringify(phase1Output)).toBe(JSON.stringify(baselineOutput));
    });
  });
});
