import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResumeController } from './resume.controller';
import { ResumeParsingService } from './resume-parsing.service';
import { AffindaResumeParser } from './affinda-resume-parser';
import { RecruitFlowCandidateMapper } from './recruitflow-candidate-mapper';
import { SghEnrichmentService } from './sgh-enrichment.service';
import { PdfDocumentExtractor } from './extraction/pdf-document-extractor';
import { DocxDocumentExtractor } from './extraction/docx-document-extractor';
import { CompositeDocumentExtractor } from './extraction/composite-document-extractor';
import { ResumeSourceFactory } from './source/resume-source.factory';
import { AffindaParserProvider } from './providers/affinda-parser.provider';
import { LegacyParserProvider } from './providers/legacy-parser.provider';
import { AffindaCanonicalMapper } from './providers/affinda-canonical.mapper';
import { CanonicalToExtractedAdapter } from './providers/canonical-to-extracted.adapter';
import { ExtractionWorkerPool } from './extraction/worker/extraction-worker-pool';
import { WorkerThreadDocumentExtractor } from './extraction/worker/worker-thread-document-extractor';

@Module({
  imports: [ConfigModule],
  controllers: [ResumeController],
  providers: [
    ResumeParsingService,
    AffindaResumeParser,
    RecruitFlowCandidateMapper,
    SghEnrichmentService,
    // Phase 1 Document Extraction Providers
    PdfDocumentExtractor,
    DocxDocumentExtractor,
    CompositeDocumentExtractor,
    ResumeSourceFactory,
    ExtractionWorkerPool,
    WorkerThreadDocumentExtractor,
    // Phase 2 Provider Architecture
    AffindaParserProvider,
    LegacyParserProvider,
    AffindaCanonicalMapper,
    CanonicalToExtractedAdapter,
  ],
  exports: [
    ResumeParsingService,
    ResumeSourceFactory,
    CompositeDocumentExtractor,
    PdfDocumentExtractor,
    DocxDocumentExtractor,
    ExtractionWorkerPool,
    WorkerThreadDocumentExtractor,
    AffindaParserProvider,
    LegacyParserProvider,
    AffindaCanonicalMapper,
    CanonicalToExtractedAdapter,
  ],
})
export class ResumeModule {}
