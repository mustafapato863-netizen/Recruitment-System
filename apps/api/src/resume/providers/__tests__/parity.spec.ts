import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { ConfigService } from '@nestjs/config';
import { RecruitFlowCandidateMapper } from '../../recruitflow-candidate-mapper';
import { AffindaCanonicalMapper } from '../affinda-canonical.mapper';
import { CanonicalToExtractedAdapter } from '../canonical-to-extracted.adapter';
import { ResumeParsingService } from '../../resume-parsing.service';
import { SghEnrichmentService } from '../../sgh-enrichment.service';
import type { AffindaResumeParser, UploadedResumeFile } from '../../affinda-resume-parser';
import type { AffindaParserProvider } from '../affinda-parser.provider';
import { LegacyParserProvider } from '../legacy-parser.provider';
import type { ResumeSourceFactory } from '../../source/resume-source.factory';
import type { ResumeSource } from '../../source/resume-source.interface';

describe('Phase 2 Parity & PII Verification', () => {
  const oldMapper = new RecruitFlowCandidateMapper();
  const newCanonicalMapper = new AffindaCanonicalMapper();
  const newAdapter = new CanonicalToExtractedAdapter();
  const sghEnrichment = new SghEnrichmentService();

  const fixturesDir = path.join(__dirname, '../../../../test/fixtures');
  let fixtures: string[] = [];

  try {
    fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
  } catch {
    // Empty if dir doesn't exist
  }

  it('verifies that at least 5 fixtures exist for testing parity', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  it('verifies that every email in every fixture uses only example.com or example.org domain', () => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

    for (const fixtureName of fixtures) {
      const content = fs.readFileSync(path.join(fixturesDir, fixtureName), 'utf8');
      const matches = [...content.matchAll(emailRegex)];

      for (const match of matches) {
        const fullEmail = match[0];
        const domain = match[1].toLowerCase();
        expect(
          domain === 'example.com' || domain === 'example.org',
          `Fixture "${fixtureName}" contains email "${fullEmail}" with non-example domain "${domain}"`,
        ).toBe(true);
      }
    }
  });

  it('verifies that affinda-missing-contact.json contains zero contact details (no email or phone)', () => {
    const payload = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'affinda-missing-contact.json'), 'utf8'),
    );
    expect(payload.data?.contact?.emails ?? []).toHaveLength(0);
    expect(payload.data?.contact?.phoneNumbers ?? []).toHaveLength(0);

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /\+?\d{8,15}/g;
    const rawText = payload.data?.rawText || '';

    expect(rawText.match(emailRegex) ?? []).toHaveLength(0);
    expect(rawText.match(phoneRegex) ?? []).toHaveLength(0);
  });

  for (const fixtureName of fixtures) {
    it(`guarantees 100% deep equality for ExtractedCandidate mapper on ${fixtureName}`, () => {
      const payload = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixtureName), 'utf8'));

      // 1. Old legacy architecture output
      const oldOutput = oldMapper.map(payload);

      // 2. New Provider architecture output (Canonical Schema -> Adapter)
      const canonical = newCanonicalMapper.map(payload);
      const newOutput = newAdapter.adapt(canonical, {
        parserSource: 'affinda',
        rawText: payload.meta?.rawText || payload.rawText,
        meta: payload.meta,
      });

      // Strict 100% deep equality on the ExtractedCandidate contract
      expect(newOutput).toEqual(oldOutput);
    });

    it(`guarantees 100% deep equality for ResumeParsingService.parseResume with flag on vs flag off on ${fixtureName}`, async () => {
      const payload = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixtureName), 'utf8'));
      const mockFile: UploadedResumeFile = {
        buffer: Buffer.from('mock resume binary data'),
        originalname: fixtureName.replace('.json', '.pdf'),
        mimetype: 'application/pdf',
      };

      // 1. Flag OFF (legacy direct Affinda flow)
      const mockAffindaParser: Partial<AffindaResumeParser> = {
        parse: vi.fn().mockResolvedValue(payload),
      };
      const mockConfigOff: Partial<ConfigService> = {
        get: vi.fn().mockReturnValue(undefined),
      };

      const serviceFlagOff = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        oldMapper,
        sghEnrichment,
        {} as AffindaParserProvider,
        {} as LegacyParserProvider,
        newCanonicalMapper,
        newAdapter,
        undefined,
        mockConfigOff as ConfigService,
      );

      const flagOffCandidate = await serviceFlagOff.parseResume(mockFile);

      // 2. Flag ON (Provider architecture flow)
      const mockAffindaProvider: Partial<AffindaParserProvider> = {
        parse: vi.fn().mockResolvedValue({
          status: 'SUCCESS',
          rawOutput: payload,
        }),
      };
      const mockLegacyProvider: Partial<LegacyParserProvider> = {
        parse: vi.fn().mockResolvedValue({
          status: 'SUCCESS',
          rawOutput: { identity: {}, professional: {}, contact: {} },
        }),
      };
      const mockSource = {
        binaryChecksum: 'mock-checksum',
        fileName: mockFile.originalname,
        getNormalizedDocument: vi.fn().mockResolvedValue({
          rawText: payload.meta?.rawText || payload.rawText || '',
        }),
      } as unknown as ResumeSource;

      const mockFactory: Partial<ResumeSourceFactory> = {
        createFromUploadedFile: vi.fn().mockReturnValue(mockSource),
      };

      const mockConfigOn: Partial<ConfigService> = {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
          return undefined;
        }),
      };

      const serviceFlagOn = new ResumeParsingService(
        mockAffindaParser as AffindaResumeParser,
        oldMapper,
        sghEnrichment,
        mockAffindaProvider as AffindaParserProvider,
        mockLegacyProvider as LegacyParserProvider,
        newCanonicalMapper,
        newAdapter,
        mockFactory as ResumeSourceFactory,
        mockConfigOn as ConfigService,
      );

      const flagOnCandidate = await serviceFlagOn.parseResume(mockFile);

      // Deep compare final enriched ExtractedCandidate between flag-on and flag-off
      expect(flagOnCandidate).toEqual(flagOffCandidate);
    });
  }

  it('enriches phone number via real LegacyParserProvider when Affinda lacks phone but text has one', async () => {
    // 1. Pick a fixture with standard data
    const basePayload = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'affinda-standard.json'), 'utf8'));

    // Strip phone numbers from Affinda payload so Affinda lacks contact phone
    const payloadWithoutPhone = JSON.parse(JSON.stringify(basePayload));
    if (payloadWithoutPhone.data?.contact) {
      payloadWithoutPhone.data.contact.phoneNumbers = [];
    }

    const testPhoneNumber = '+966551122334';
    // Document raw text contains candidate's phone number
    const rawTextWithPhone = `${payloadWithoutPhone.meta?.rawText || 'Tariq Hassan\nConsultant Cardiologist'}\nPhone: ${testPhoneNumber}\nEmail: tariq.hassan@example.com`;

    const mockFile: UploadedResumeFile = {
      buffer: Buffer.from('mock resume binary data'),
      originalname: 'affinda-standard.pdf',
      mimetype: 'application/pdf',
    };

    // 1. Flag OFF (legacy direct Affinda flow)
    const mockAffindaParser: Partial<AffindaResumeParser> = {
      parse: vi.fn().mockResolvedValue(payloadWithoutPhone),
    };
    const mockConfigOff: Partial<ConfigService> = {
      get: vi.fn().mockReturnValue(undefined),
    };

    const serviceFlagOff = new ResumeParsingService(
      mockAffindaParser as AffindaResumeParser,
      oldMapper,
      sghEnrichment,
      {} as AffindaParserProvider,
      {} as LegacyParserProvider,
      newCanonicalMapper,
      newAdapter,
      undefined,
      mockConfigOff as ConfigService,
    );

    const flagOffCandidate = await serviceFlagOff.parseResume(mockFile);

    // Flag OFF has no phone because Affinda had none and legacy flow did not enrich
    expect(flagOffCandidate.phone).toBeUndefined();

    // 2. Flag ON (Provider architecture flow with REAL LegacyParserProvider)
    const realLegacyProvider = new LegacyParserProvider();

    const mockAffindaProvider: Partial<AffindaParserProvider> = {
      parse: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        rawOutput: payloadWithoutPhone,
      }),
    };

    const mockSource = {
      binaryChecksum: 'mock-checksum',
      textChecksum: 'text-checksum',
      fileName: mockFile.originalname,
      getNormalizedDocument: vi.fn().mockResolvedValue({
        rawText: rawTextWithPhone,
      }),
    } as unknown as ResumeSource;

    const mockFactory: Partial<ResumeSourceFactory> = {
      createFromUploadedFile: vi.fn().mockReturnValue(mockSource),
    };

    const mockConfigOn: Partial<ConfigService> = {
      get: vi.fn().mockImplementation((key) => {
        if (key === 'ENABLE_PROVIDER_ARCHITECTURE') return 'true';
        return undefined;
      }),
    };

    const serviceFlagOn = new ResumeParsingService(
      mockAffindaParser as AffindaResumeParser,
      oldMapper,
      sghEnrichment,
      mockAffindaProvider as AffindaParserProvider,
      realLegacyProvider,
      newCanonicalMapper,
      newAdapter,
      mockFactory as ResumeSourceFactory,
      mockConfigOn as ConfigService,
    );

    const flagOnCandidate = await serviceFlagOn.parseResume(mockFile);

    // Assert that flag-on fills the phone from the real LegacyParserProvider
    expect(flagOnCandidate.phone).toBe(testPhoneNumber);

    // Assert every other field equals flag-off
    const { phone: _flagOnPhone, ...restFlagOn } = flagOnCandidate;
    const { phone: _flagOffPhone, ...restFlagOff } = flagOffCandidate;

    expect(restFlagOn).toEqual(restFlagOff);
  });
});
