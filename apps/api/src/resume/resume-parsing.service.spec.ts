import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ResumeParsingService } from './resume-parsing.service';
import type { AffindaResumeParser } from './affinda-resume-parser';
import { RecruitFlowCandidateMapper } from './recruitflow-candidate-mapper';
import { SghEnrichmentService } from './sgh-enrichment.service';
import type { ConfigService } from '@nestjs/config';
import type { ResumeSourceFactory } from './source/resume-source.factory';
import type { AffindaParserProvider } from './providers/affinda-parser.provider';
import type { LegacyParserProvider } from './providers/legacy-parser.provider';
import type { AffindaCanonicalMapper } from './providers/affinda-canonical.mapper';
import type { CanonicalToExtractedAdapter } from './providers/canonical-to-extracted.adapter';

describe('ResumeParsingService', () => {
  let mockProviderDeps: [
    AffindaParserProvider,
    LegacyParserProvider,
    AffindaCanonicalMapper,
    CanonicalToExtractedAdapter,
  ];

  beforeEach(() => {
    mockProviderDeps = [
      {} as AffindaParserProvider,
      {} as LegacyParserProvider,
      {} as AffindaCanonicalMapper,
      {} as CanonicalToExtractedAdapter,
    ];
  });

  it('orchestrates parsing, mapping, and SGH clinical enrichment end-to-end', async () => {
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
          employmentMetrics: { totalExperienceMonths: 144 }, // 12 years
          workExperience: [
            {
              jobTitle: 'Consultant Cardiologist',
              organization: 'Saudi German Hospital',
              isCurrent: true,
              jobDescription: 'Perform echocardiography and cardiac catheterization.',
            },
          ],
          skills: ['Cardiology', 'Echocardiography', 'Catheterization', 'Angioplasty'],
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
    const service = new ResumeParsingService(
      mockAffindaParser as AffindaResumeParser,
      mapper,
      sghEnrichment,
      ...mockProviderDeps
    );

    const mockFile = {
      buffer: Buffer.from('mock resume content'),
      originalname: 'Tariq_Hassan_CV.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    };

    const result = await service.parseResume(mockFile);

    expect(result.firstName).toBe('Tariq');
    expect(result.lastName).toBe('Hassan');
    expect(result.title).toBe('Consultant Cardiologist');
    expect(result.experienceYears).toBe(12);
    expect(result.parserSource).toBe('affinda');
    expect(result.parsingQuality).toBe('high');

    // SGH enrichment assertions
    expect(result.clinicalDomain).toBe('Cardiovascular Medicine');
    expect(result.subspecialties).toContain('Interventional Cardiology & Hemodynamics');
    expect(result.keyHighlights).toContain('12+ Years Experience');
    expect(result.keyHighlights).toContain('SCFHS Licensed / Registered');
    expect(result.summary).toContain('Tariq Hassan is a Consultant Cardiologist');
    expect(result.summary).toContain('Cardiovascular Medicine');
  });

  it('propagates errors when Affinda parsing fails', async () => {
    const mockAffindaParser: Partial<AffindaResumeParser> = {
      parse: vi.fn().mockRejectedValue(new Error('Affinda API authentication failed')),
    };

    const mapper = new RecruitFlowCandidateMapper();
    const sghEnrichment = new SghEnrichmentService();
    const service = new ResumeParsingService(
      mockAffindaParser as AffindaResumeParser,
      mapper,
      sghEnrichment,
      ...mockProviderDeps
    );

    const mockFile = {
      buffer: Buffer.from('mock resume content'),
      originalname: 'broken.pdf',
      mimetype: 'application/pdf',
      size: 500,
    };

    await expect(service.parseResume(mockFile)).rejects.toThrow(
      'Affinda API authentication failed',
    );
  });

  describe('Feature Flag: ENABLE_DOCUMENT_EXTRACTOR', () => {
    let mockAffindaParser: Partial<AffindaResumeParser>;
    let mockMapper: RecruitFlowCandidateMapper;
    let mockEnrichment: SghEnrichmentService;
    let mockFactory: Partial<ResumeSourceFactory>;
    const mockFile = {
      buffer: Buffer.from('mock resume content'),
      originalname: 'Tariq_Hassan_CV.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    };

    beforeEach(() => {
      mockAffindaParser = {
        parse: vi.fn().mockResolvedValue({
          data: { person: {}, contact: {}, workExperience: [] },
          meta: { document: {} },
        }),
      };
      mockMapper = new RecruitFlowCandidateMapper();
      mockEnrichment = new SghEnrichmentService();
      mockFactory = {
        createFromUploadedFile: vi.fn().mockReturnValue({ binaryChecksum: 'mock-checksum' }),
      };
    });

    it('defaults to false when ConfigService returns undefined or is absent', async () => {
      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockReturnValue(undefined),
      };
      const serviceWithConfig = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        ...mockProviderDeps,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      await serviceWithConfig.parseResume(mockFile);
      expect(mockFactory.createFromUploadedFile).not.toHaveBeenCalled();

      const serviceNoConfig = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        ...mockProviderDeps,
        mockFactory as ResumeSourceFactory,
        undefined,
      );

      await serviceNoConfig.parseResume(mockFile);
      expect(mockFactory.createFromUploadedFile).not.toHaveBeenCalled();
    });

    it('skips extraction when ENABLE_DOCUMENT_EXTRACTOR is "false"', async () => {
      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockReturnValue('false'),
      };
      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        ...mockProviderDeps,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      await service.parseResume(mockFile);
      expect(mockFactory.createFromUploadedFile).not.toHaveBeenCalled();
    });

    it('wraps the uploaded file with ResumeSourceFactory when ENABLE_DOCUMENT_EXTRACTOR is "true"', async () => {
      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
           if (key === 'ENABLE_DOCUMENT_EXTRACTOR') return 'true';
           return undefined;
        }),
      };
      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        ...mockProviderDeps,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      await service.parseResume(mockFile);
      expect(mockFactory.createFromUploadedFile).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('Feature Flag: ENABLE_PROVIDER_ARCHITECTURE', () => {
    let mockAffindaParser: Partial<AffindaResumeParser>;
    let mockMapper: RecruitFlowCandidateMapper;
    let mockEnrichment: SghEnrichmentService;
    let mockFactory: Partial<ResumeSourceFactory>;
    let mockAffindaProvider: Partial<AffindaParserProvider>;
    let mockLegacyProvider: Partial<LegacyParserProvider>;
    let mockAffindaCanonicalMapper: Partial<AffindaCanonicalMapper>;
    let mockAdapter: Partial<CanonicalToExtractedAdapter>;
    const mockFile = {
      buffer: Buffer.from('mock resume content'),
      originalname: 'Tariq_Hassan_CV.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    };
    const mockSource = {
      binaryChecksum: 'mock-checksum',
      getNormalizedDocument: vi.fn().mockResolvedValue({ rawText: 'Extracted text' }),
    };

    beforeEach(() => {
      mockAffindaParser = {
        parse: vi.fn().mockResolvedValue({
          data: { person: { name: { given: 'Legacy', family: 'User' } }, contact: {}, workExperience: [] },
          meta: { document: {} },
        }),
      };
      mockMapper = new RecruitFlowCandidateMapper();
      mockEnrichment = new SghEnrichmentService();
      mockFactory = {
        createFromUploadedFile: vi.fn().mockReturnValue(mockSource),
      };
      mockAffindaProvider = {
        parse: vi.fn().mockResolvedValue({
          status: 'SUCCESS',
          rawOutput: { data: { person: { name: { given: 'Provider', family: 'User' } } } },
        }),
      };
      mockLegacyProvider = {
        parse: vi.fn().mockResolvedValue({
          status: 'SUCCESS',
          rawOutput: { identity: {} },
        }),
      };
      mockAffindaCanonicalMapper = {
        map: vi.fn().mockReturnValue({ identity: {}, professional: {}, contact: {} }),
      };
      mockAdapter = {
        adapt: vi.fn().mockReturnValue({
          firstName: 'Provider',
          lastName: 'User',
          parserSource: 'affinda',
          parsingQuality: 'high',
        }),
      };
    });

    it('routes through provider architecture when ENABLE_PROVIDER_ARCHITECTURE is "true"', async () => {
      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      const result = await service.parseResume(mockFile);

      expect(mockAffindaProvider.parse).toHaveBeenCalledWith(mockSource);
      expect(mockAffindaCanonicalMapper.map).toHaveBeenCalled();
      expect(mockLegacyProvider.parse).toHaveBeenCalledWith(mockSource);
      expect(mockAdapter.adapt).toHaveBeenCalled();
      expect(result.firstName).toBe('Provider');
      expect(mockAffindaParser.parse).not.toHaveBeenCalled();
    });

    it('falls back to Legacy provider when Affinda provider fails under ENABLE_PROVIDER_ARCHITECTURE="true"', async () => {
      mockAffindaProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Affinda timeout' },
      });

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      await service.parseResume(mockFile);

      expect(mockAffindaProvider.parse).toHaveBeenCalledWith(mockSource);
      expect(mockLegacyProvider.parse).toHaveBeenCalledWith(mockSource);
      expect(mockAdapter.adapt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parserSource: 'legacy' }),
      );
    });

    it('strictly checks string "true" and stays on legacy path for invalid truthy values like "1" or "yes"', async () => {
      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return '1';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      const result = await service.parseResume(mockFile);

      expect(mockAffindaParser.parse).toHaveBeenCalledWith(mockFile);
      expect(mockAffindaProvider.parse).not.toHaveBeenCalled();
      expect(result.firstName).toBe('Legacy');
    });

    it('does NOT run legacy provider when Affinda succeeds and has both email and phone', async () => {
      mockAffindaCanonicalMapper.map = vi.fn().mockReturnValue({
        identity: {},
        professional: {},
        contact: {
          email: { kind: 'EXTRACTED', rawValue: 'tariq@example.com' },
          phone: { kind: 'EXTRACTED', rawValue: '+966551122334' },
        },
      });

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      await service.parseResume(mockFile);

      expect(mockAffindaProvider.parse).toHaveBeenCalledWith(mockSource);
      expect(mockAffindaCanonicalMapper.map).toHaveBeenCalled();
      // Since contact has both email and phone, legacy provider must NOT run!
      expect(mockLegacyProvider.parse).not.toHaveBeenCalled();
    });

    it('throws HttpException with FILE_INVALID (400) when Affinda fails and legacy extraction reports CORRUPTED_FILE', async () => {
      mockAffindaProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Affinda unavailable' },
      });
      mockLegacyProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Corrupted document stream', code: 'CORRUPTED_FILE' },
      });

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      try {
        await service.parseResume(mockFile);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        const httpErr = err as { getStatus?: () => number; getResponse?: () => { code?: string; message?: string } };
        expect(httpErr.getStatus?.()).toBe(400);
        expect(httpErr.getResponse?.().code).toBe('FILE_INVALID');
      }
    });

    it('throws HttpException with FILE_INVALID (400) when Affinda fails and legacy extraction reports UNSUPPORTED_FORMAT', async () => {
      mockAffindaProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Affinda 500 error' },
      });
      mockLegacyProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Unsupported format', code: 'UNSUPPORTED_FORMAT' },
      });

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      try {
        await service.parseResume(mockFile);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        const httpErr = err as { getStatus?: () => number; getResponse?: () => { code?: string; message?: string } };
        expect(httpErr.getStatus?.()).toBe(400);
        expect(httpErr.getResponse?.().code).toBe('FILE_INVALID');
      }
    });

    it('throws HttpException with INTEGRATION_UNAVAILABLE (503, retryable true) when Affinda has network/timeout/5xx and legacy fails with non-file error', async () => {
      mockAffindaProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Affinda network timeout (504 Gateway Timeout)' },
      });
      mockLegacyProvider.parse = vi.fn().mockResolvedValue({
        status: 'FAILED',
        error: { message: 'Regex heuristic failed', code: 'INTERNAL_ERROR' },
      });

      const mockConfig: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const service = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        mockMapper,
        mockEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        mockAffindaCanonicalMapper as AffindaCanonicalMapper,
        mockAdapter as CanonicalToExtractedAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfig as ConfigService,
      );

      try {
        await service.parseResume(mockFile);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        const httpErr = err as {
          getStatus?: () => number;
          getResponse?: () => { code?: string; message?: string; retryable?: boolean };
        };
        expect(httpErr.getStatus?.()).toBe(503);
        expect(httpErr.getResponse?.().code).toBe('INTEGRATION_UNAVAILABLE');
        expect(httpErr.getResponse?.().retryable).toBe(true);
      }
    });
  });
});

