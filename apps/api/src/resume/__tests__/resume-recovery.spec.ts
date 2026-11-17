import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import JSZip from 'jszip';
import { AffindaResumeParser, type UploadedResumeFile } from '../affinda-resume-parser';
import { ResumeParsingService } from '../resume-parsing.service';
import { RecruitFlowCandidateMapper } from '../recruitflow-candidate-mapper';
import { SghEnrichmentService } from '../sgh-enrichment.service';
import { ResumeSourceFactory } from '../source/resume-source.factory';
import { CompositeDocumentExtractor } from '../extraction/composite-document-extractor';
import { PdfDocumentExtractor } from '../extraction/pdf-document-extractor';
import { DocxDocumentExtractor } from '../extraction/docx-document-extractor';
import { AffindaParserProvider } from '../providers/affinda-parser.provider';
import { LegacyParserProvider } from '../providers/legacy-parser.provider';
import { AffindaCanonicalMapper } from '../providers/affinda-canonical.mapper';
import { CanonicalToExtractedAdapter } from '../providers/canonical-to-extracted.adapter';
import { GENERIC_503_MESSAGE, normalizeError } from '../../common/errors/error-normalizer';

const TEXT = 'Name: Fictional Tester\nEmail: synthetic@example.com\nRegistered Nurse with five years of clinical experience in patient care and patient safety.';

function pdf(text = TEXT): UploadedResumeFile {
  const stream = `BT /F1 12 Tf 72 712 Td ${text.split('\n').map((line) => `(${line}) Tj 0 -20 Td`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >> stream\n${stream}\nendstream`,
  ];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(content)); content += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const buffer = Buffer.from(content);
  return { buffer, originalname: 'synthetic.pdf', mimetype: 'application/pdf', size: buffer.length };
}

function service(providerFlag: string | undefined, apiKey?: string) {
  // Explicit configuration; never read environment files or use live credentials.
  const config = { get: (key: string) => ({ ENABLE_PROVIDER_ARCHITECTURE: providerFlag, AFFINDA_API_KEY: apiKey }[key]) } as unknown as ConfigService;
  const affinda = new AffindaResumeParser(config);
  const factory = new ResumeSourceFactory(new CompositeDocumentExtractor(new PdfDocumentExtractor(), new DocxDocumentExtractor()), config);
  return new ResumeParsingService(affinda, new RecruitFlowCandidateMapper(), new SghEnrichmentService(),
    new AffindaParserProvider(affinda), new LegacyParserProvider(), new AffindaCanonicalMapper(), new CanonicalToExtractedAdapter(), factory, config);
}

afterEach(() => vi.restoreAllMocks());

describe.each([undefined, 'false', 'true'])('CV recovery with provider flag %s', (providerFlag) => {
  it('reads a valid PDF with the real local libraries when no external API key exists', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    const parsed = await service(providerFlag).parseResume(pdf());
    expect(parsed).toMatchObject({ firstName: 'Fictional', lastName: 'Tester', email: 'synthetic@example.com', parserSource: 'legacy' });
    expect(parsed.rawText).toContain('Registered Nurse');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an image-only/empty text layer with useful guidance instead of creating a fake profile', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    const failure = await service(providerFlag).parseResume(pdf('')).catch(normalizeError);
    expect(failure).toMatchObject({ statusCode: 400, code: 'FILE_INVALID', message: expect.stringMatching(/No readable text.*searchable PDF/) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a safe file error for corrupt PDF bytes', async () => {
    const failure = await service(providerFlag).parseResume({ ...pdf(), buffer: Buffer.from('not a pdf') }).catch(normalizeError);
    expect(failure).toMatchObject({ statusCode: 400, code: 'FILE_INVALID' });
    expect(failure.message).not.toContain('Invalid PDF structure');
  });

  it('keeps legacy DOC unavailability distinct from file corruption', async () => {
    const failure = await service(providerFlag).parseResume({ ...pdf(), originalname: 'synthetic.doc', mimetype: 'application/msword' }).catch(normalizeError);
    expect(failure).toMatchObject({ statusCode: 503, code: 'INTEGRATION_UNAVAILABLE', retryable: true, message: GENERIC_503_MESSAGE });
  });

  it('recovers a real DOCX locally', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${TEXT.split('\n').map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const parsed = await service(providerFlag).parseResume({ buffer, originalname: 'synthetic.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: buffer.length });
    expect(parsed).toMatchObject({ email: 'synthetic@example.com', parserSource: 'legacy' });
  });
});

it.each([401, 429, 500])('recovers from external HTTP %s using local PDF extraction', async (status) => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status }));
  const parsed = await service(undefined, 'synthetic-test-key').parseResume(pdf());
  expect(parsed).toMatchObject({ email: 'synthetic@example.com', parserSource: 'legacy' });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it.each([new TypeError('Network unavailable'), new DOMException('Request timed out', 'TimeoutError')])('recovers from external network/timeout errors: %s', async (failure) => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(failure);
  expect(await service(undefined, 'synthetic-test-key').parseResume(pdf())).toMatchObject({ email: 'synthetic@example.com', parserSource: 'legacy' });
});
