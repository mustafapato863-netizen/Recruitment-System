# Phase 1 Implementation Plan: ResumeSource & DocumentExtractor

> **Status**: PLAN ONLY — Awaiting User Approval  
> **Phase**: Phase 1 of 12  
> **Scope**: `ResumeSourceFactory`, lazy `BinaryDocumentSource`, server-side `DocumentExtractor` (`PdfDocumentExtractor`, `DocxDocumentExtractor`), `NormalizedResumeDocument`, deterministic checksums (`binaryChecksum` and `textChecksum` Rule V1).  
> **Constraint**: No provider changes, no Affinda changes, no DB, no local model, no UI changes. Zero modifications to the `POST /resume/parse` response payload.

---

## 1. Pre-Planning Discovery & Current Architecture Audit

### 1.1 Where Text is Extracted from PDF/DOCX Today
- **In `apps/api`**: **Currently NOWHERE.**
  - [apps/api/src/resume/resume.controller.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/resume.controller.ts#L32-L56): `parseResume` accepts uploaded file via Multer in memory and forwards `file` directly to `ResumeParsingService`.
  - [apps/api/src/resume/resume-parsing.service.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/resume-parsing.service.ts#L23-L40): Passes `file` directly to `this.affindaParser.parse(file)`.
  - [apps/api/src/resume/affinda-resume-parser.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/affinda-resume-parser.ts#L23-L67): Transmits the raw binary buffer directly to the external Affinda API (`POST https://resume-parser.affinda.com/v1/resumes/parse`) via multipart HTTP form-data.
  - Zero local text extraction currently takes place on the backend API server.
- **In `apps/web`**: **Extracted in the browser** using client-side JavaScript libraries:
  - [apps/web/src/utils/resumeParser.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/utils/resumeParser.ts):
    - **PDF Extraction** (Lines 300–360, `extractTextFromPdf`): Uses **`pdfjs-dist`** (`^6.2.108`) with coordinate-aware vertical spacing (`item.transform[5]` delta > 3) and `hasEOL` token detection, falling back to stream decoding.
    - **DOCX Extraction** (Lines 366–410, `extractTextFromDocx`): Uses **`jszip`** (`^3.10.1`) to parse and clean `word/document.xml`, falling back to **`mammoth`** (`^1.12.1`) (`mammoth.extractRawText`), with a final `TextDecoder` fallback.
    - **Extraction Pipeline** (Lines 1017–1032, `parseResumeFile`): Routes by extension and runs regex/heuristic rule extraction (`extractCandidateFromText`).
  - [apps/web/src/utils/jdParser.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/utils/jdParser.ts):
    - **Job Description PDF Extraction** (Lines 69–107, `extractTextFromPdf`): Also uses **`pdfjs-dist`** in the browser.

### 1.2 Full Current Path of `POST /resume/parse`
1. **Controller**:
   - [apps/api/src/resume/resume.controller.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/resume.controller.ts#L32-L56):
     - Route: `POST /resume/parse`
     - Decorators: `@UseGuards(JwtAuthGuard)`, `@RequirePermissions('CANDIDATE_EDIT')`, `@AuditAction('RESUME_PARSE')`
     - Interceptor: `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))` (Multer memory storage)
     - Validates buffer presence (line 43) and extension (`.pdf`, `.doc`, `.docx`, lines 47–53).
     - Calls: `this.resumeParsingService.parseResume(file)` (line 55).
2. **Service**:
   - [apps/api/src/resume/resume-parsing.service.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/resume-parsing.service.ts#L23-L40):
     - Step 1 (Line 27): `rawAffinda = await this.affindaParser.parse(file)`
     - Step 2 (Line 30): `mapped = this.candidateMapper.map(rawAffinda)`
     - Step 3 (Line 33): `enriched = this.sghEnrichment.enrich(mapped)`
     - Returns: `enriched` (`ExtractedCandidate`)
3. **Affinda Remote Parser & Fallback**:
   - [apps/api/src/resume/affinda-resume-parser.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/affinda-resume-parser.ts#L23-L67):
     - Dispatches HTTP POST to `https://resume-parser.affinda.com/v1/resumes/parse`.
     - If Affinda fails (HTTP 4xx/5xx or timeout), an `Error` is thrown and propagates to NestJS.
     - On frontend ([apps/web/src/hooks/useCVIntakeFlow.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/hooks/useCVIntakeFlow.ts#L274-L279) and [CandidateDocumentsPage.tsx](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/pages/CandidateDocumentsPage.tsx#L88-L91)), the `catch` block falls back to browser-side `parseResumeFile(file)` (`parserSource: 'legacy'`).
4. **Response Shape**:
   - Returns `ExtractedCandidate` directly to the client browser (contract defined in `packages/contracts/src/candidate.ts`).

### 1.3 Multer Buffer Creation & Copy Lifecycle
- **Creation Point**:
  - In [apps/api/src/resume/resume.controller.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/resume.controller.ts#L35-L39), `FileInterceptor('file')` uses Multer's default `MemoryStorage`.
  - Multer reads the incoming multipart HTTP stream from the network socket and buffers the chunks in RAM as a single Node.js `Buffer`: `file.buffer`.
- **Buffer Copies in One Request**:
  - **Buffer Instance 1 (Primary in-memory buffer)**: Created by Multer in Node RAM (`file.buffer`).
  - In `ResumeParsingService.parseResume(file)`: `file.buffer` is passed by reference (zero copies).
  - In `AffindaResumeParser.parse(file)`:
    - `new Uint8Array(file.buffer)` creates a typed array view over the existing memory (zero copies).
    - `new Blob([uint8Array])` wraps the memory view.
  - **Buffer Instance 2 (Transient network serialization copy)**: During `fetch(...)`, Node's `undici` client serializes the multipart form chunks into outgoing TCP socket buffers.
  - **Total**: Exactly **1 persistent buffer in memory** throughout the request lifecycle, plus **1 transient wire serialization buffer**. Zero disk copies.

### 1.4 Existing Tests Covering this Path
- **API Unit Tests**:
  - [apps/api/src/resume/resume-parsing.service.spec.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/resume-parsing.service.spec.ts):
    - `orchestrates parsing, mapping, and SGH clinical enrichment end-to-end` (lines 8–71)
    - `propagates errors when Affinda parsing fails` (lines 73–96)
  - [apps/api/src/resume/recruitflow-candidate-mapper.spec.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/api/src/resume/recruitflow-candidate-mapper.spec.ts):
    - Tests Affinda response mapping to `ExtractedCandidate`.
- **Web Tests**:
  - [apps/web/src/utils/resumeParser.test.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/utils/resumeParser.test.ts): 5 tests covering client-side text parsing.
  - [apps/web/src/utils/__tests__/matching-hris-regression.test.ts](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/utils/__tests__/matching-hris-regression.test.ts): 9 regression tests for matching engine integration.
  - [apps/web/src/components/intake/CVParsedEditor.test.tsx](file:///d:/Projects/Recruitment%20Workflow%20System/apps/web/src/components/intake/CVParsedEditor.test.tsx): 2 tests verifying UI editor intake flow.

---

## 2. Phase 1 Technical Specification

### 2.1 Goal
Introduce a zero-copy, server-side document extraction and abstraction layer (`ResumeSourceFactory`, `PdfDocumentExtractor`, `DocxDocumentExtractor`) in `apps/api` producing `NormalizedResumeDocument` with deterministic checksums (`binaryChecksum` and `textChecksum`), while keeping the live `POST /resume/parse` HTTP response byte-for-byte identical to today.

### 2.2 Scope
1. **`ResumeSourceFactory` (`apps/api/src/resume/source/resume-source.factory.ts`)**:
   - Takes `UploadedResumeFile` (`buffer`, `originalname`, `mimetype`, `size`).
   - Computes `binaryChecksum`: SHA-256 of the raw buffer (`crypto.createHash('sha256').update(file.buffer).digest('hex')`).
   - Wraps `file.buffer` in a lazy `BinaryDocumentSource`:
     - `byteLength: file.buffer.length`
     - `getBuffer(): Promise<Buffer>` resolves `file.buffer` directly (zero memory copies).
     - `openStream(): NodeJS.ReadableStream` returns `Readable.from(file.buffer)` on demand.
   - Attaches lazy `getNormalizedDocument(): Promise<NormalizedResumeDocument>` invoking registered extractors on first call and caching the result.
2. **`DocumentExtractor` Abstraction & Implementations (`apps/api/src/resume/extraction/`)**:
   - **`DocumentExtractor` Interface**:
     ```ts
     export interface DocumentExtractor {
       supports(mimeType: string, fileName: string): boolean;
       extract(source: ResumeSource): Promise<NormalizedResumeDocument>;
     }
     ```
   - **`PdfDocumentExtractor`**:
     - Adapts `pdfjs-dist` text extraction for server-side Node.js.
     - Iterates pages 1..N, extracts `page.getTextContent()`.
     - Applies coordinate-aware vertical line spacing (`deltaY > 3`) and `hasEOL` token detection.
     - Builds `NormalizedResumePage` array with 1-indexed page numbers, extracted text, and line counts.
   - **`DocxDocumentExtractor`**:
     - Uses `mammoth` / `jszip` to extract document XML text, paragraphs, and tables.
   - **`CompositeDocumentExtractor` / Registry**:
     - Inspects MIME type and file extension, delegating extraction accordingly.
3. **`NormalizedResumeDocument` Structure**:
   - Implements `@recruitflow/contracts` schema: `rawText`, `pages`, `pageCount`, `binaryChecksum`, `textChecksum`, `diagnostics`.
4. **Deterministic `textChecksum` Normalization (`Rule V1`)**:
   - Normalization sequence before hashing:
     1. `rawText.normalize('NFC')` (Unicode normalization).
     2. `replace(/\r\n|\r/g, '\n')` (Canonical LF line endings).
     3. `replace(/[ \t]+$/gm, '')` (Strip trailing line whitespace).
     4. `replace(/[ \t]+/g, ' ')` (Collapse horizontal whitespace).
     5. `replace(/\n{3,}/g, '\n\n')` (Clamp multiple blank lines to two).
     6. `.toLowerCase()` (Case folding).
     7. `.trim()` (Trim leading and trailing whitespace).
   - Formatted as: `v1:<sha256_hex>`.
5. **`isScanned` / `hasTextLayer` Detection**:
   - Configurable threshold (default: 80 characters total or < 20 chars/page).
   - If character count < threshold: `isScanned: true`, `hasTextLayer: false`.
   - **STRICTLY NO OCR**: If scanned, extractor returns diagnostics with available text. Zero external or local OCR is invoked.

### 2.3 Non-Goals
- No provider changes (Affinda and legacy regex parsers stay intact).
- No database changes (zero Prisma schema edits or migrations).
- No local AI or LLM model integration.
- No UI modifications.
- Zero change to the `/resume/parse` HTTP response payload.

### 2.4 Wiring & Request Path
- `ResumeSourceFactory` and `CompositeDocumentExtractor` are registered as providers in `ResumeModule`.
- In `ResumeParsingService.parseResume(file)`:
  - Constructs `const resumeSource = this.resumeSourceFactory.create(file)`.
  - Runs extraction diagnostics in the request lifecycle without altering the downstream Affinda pipeline.
  - Calls `affindaParser.parse(file)` and returns `ExtractedCandidate` with exact parity.
- The HTTP response of `POST /resume/parse` remains **byte-for-byte identical to today**.

### 2.5 Dependencies on Phase 0 Contracts
- From `@recruitflow/contracts`:
  - `SharedResumeSourceMetadata`
  - `NormalizedResumeDocument`
  - `NormalizedResumePage`
  - `DocumentExtractionDiagnostics`
- From `apps/api` internal interfaces:
  - `ResumeSource`
  - `BinaryDocumentSource`

### 2.6 Test Plan (`apps/api/src/resume/__tests__/document-extractor.spec.ts`)
1. **PDF Extraction**: Multi-page PDF text extraction with correct page splitting and line counts.
2. **DOCX Extraction**: Paragraph and table extraction from DOCX buffers.
3. **Scanned / Near-Empty Document**: Asserts `isScanned: true`, `hasTextLayer: false`, zero OCR processes spawned.
4. **Corrupted Buffer**: Graceful error handling via `DocumentExtractionError` without crashing the process.
5. **Unsupported Extension**: Rejects unsupported file types cleanly.
6. **Checksum Stability**:
   - Same bytes produce identical `binaryChecksum`. Single byte change produces different `binaryChecksum`.
   - Re-formatted text with differing CRLF, multiple spaces, and casing produces identical `textChecksum` (`Rule V1`).
7. **Extractor Purity**: Asserts zero semantic candidate fields are extracted (pure layout text and diagnostics only).
8. **End-to-End Snapshot**: Validates that `POST /resume/parse` output before and after wiring matches deeply.

### 2.7 Exit Criteria
1. `ResumeSourceFactory` wraps uploaded files into lazy `ResumeSource` with zero extra buffer copies.
2. `PdfDocumentExtractor` and `DocxDocumentExtractor` generate valid `NormalizedResumeDocument` objects.
3. `binaryChecksum` and `textChecksum` produce stable, deterministic hashes.
4. Scanned documents properly flagged without OCR.
5. `pnpm --filter @recruitflow/api build` passes with 0 errors.
6. `pnpm --filter @recruitflow/web typecheck` passes with 0 errors.
7. Both test suites pass (`apps/api` and `apps/web`).
8. Response of `POST /resume/parse` verified byte-for-byte identical to baseline.

### 2.8 Rollback Strategy
- Config switch `ENABLE_DOCUMENT_EXTRACTOR` in `ResumeParsingService`.
- If `ENABLE_DOCUMENT_EXTRACTOR=false`, the service skips `ResumeSourceFactory` and executes the legacy direct-buffer Affinda path with zero overhead.

### 2.9 Architectural Risks & Mitigations
| Risk | Potential Impact | Architecture Mitigation |
|---|---|---|
| **Node vs Browser `pdfjs-dist` Divergence** | Inconsistent line breaks between client fallback and server extraction. | Use identical coordinate-aware line detection (`deltaY > 3` and `hasEOL`) in `PdfDocumentExtractor`. |
| **Large File Memory Spikes** | Heavy PDF with large images causes Node OOM. | Extractor queries `page.getTextContent()` only, never rendering canvas or decoding embedded bitmap streams. |
| **Malformed DOCX XML** | Corrupted XML structures cause unhandled parser errors. | Wrap extraction in try-catch returning structured `DocumentExtractionError` with fallback text decoding. |

---

*This specification is committed in the repository at `docs/architecture/phase-1-plan.md`.*
