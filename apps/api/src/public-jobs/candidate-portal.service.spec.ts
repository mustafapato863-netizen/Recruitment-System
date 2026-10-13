import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CandidatePortalService, PORTAL_LINK_UNUSABLE, type PortalTokenPayload } from './candidate-portal.service';
import { PublicApplicationDto } from './public-jobs.dto';
import { validationExceptionFactory } from '../common/errors/validation-exception';
import { DocumentScannerService } from '../documents/document-scanner.service';

const payloadA: PortalTokenPayload = {
  kind: 'portal',
  applicationId: 'app-a',
  candidateId: 'cand-a',
  organizationId: 'org-1',
  expiresAt: Date.now() + 60_000,
  nonce: 'nonce-a',
};

function appRow(code: string, nonce: string, revokedAt: string | null = null) {
  return {
    applicationCode: code,
    stage: 'Applied',
    candidate: {
      firstName: code.endsWith('A') ? 'One' : 'Two',
      metadata: { portal: { grants: [{ nonce, applicationId: code === 'APP-A' ? 'app-a' : 'app-b', expiresAt: new Date(Date.now() + 60_000).toISOString(), revokedAt }] } },
    },
    vacancy: {
      vacancyCode: 'VAC-2026-P8',
      status: 'Open',
      position: { title: 'Phase 8 Sample' },
      organization: { code: 'SGH', name: 'Sample' },
    },
  };
}

describe('CandidatePortalService', () => {
  const auditLog = { findMany: vi.fn(), create: vi.fn() };
  const candidateDocument = { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() };
  const application = { findFirst: vi.fn() };
  const candidate = { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() };
  const joiningCheck = { create: vi.fn(), update: vi.fn() };
  const prisma = { auditLog, candidateDocument, application, candidate, joiningCheck };
  const storage = { put: vi.fn() };
  let service: CandidatePortalService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.findMany.mockResolvedValue([]);
    auditLog.create.mockResolvedValue({ id: 'audit-1' });
    candidateDocument.findMany.mockResolvedValue([]);
    candidateDocument.findFirst.mockResolvedValue(null);
    application.findFirst.mockImplementation(async ({ where }: { where: { candidateId: string } }) => {
      if (where.candidateId === 'cand-a') return appRow('APP-A', 'nonce-a');
      if (where.candidateId === 'cand-b') return appRow('APP-B', 'nonce-b');
      return null;
    });
    service = new CandidatePortalService(
      prisma as never,
      new DocumentScannerService(),
      storage as never,
    );
  });

  it('opens only the application bound to the token', async () => {
    const tokenA = service.sign(payloadA);
    const tokenB = service.sign({ ...payloadA, applicationId: 'app-b', candidateId: 'cand-b', nonce: 'nonce-b' });
    const viewA = await service.view(tokenA);
    const viewB = await service.view(tokenB);
    expect(viewA.applicationCode).toBe('APP-A');
    expect(viewB.applicationCode).toBe('APP-B');
    expect(JSON.stringify(viewA)).not.toContain('APP-B');
    expect(JSON.stringify(viewB)).not.toContain('APP-A');
  });

  it('an expired link does not read another person\'s file', async () => {
    const token = service.sign({ ...payloadA, expiresAt: Date.now() - 1000 });
    await expect(service.fileStatus(token, '11111111-1111-4111-8111-111111111111')).rejects.toThrow(PORTAL_LINK_UNUSABLE);
    expect(candidateDocument.findFirst).not.toHaveBeenCalled();
    expect(application.findFirst).not.toHaveBeenCalled();
  });

  it('a revoked link does not read another person\'s file', async () => {
    application.findFirst.mockResolvedValue(appRow('APP-A', 'nonce-a', new Date().toISOString()));
    const token = service.sign(payloadA);
    await expect(service.fileStatus(token, '22222222-2222-4222-8222-222222222222')).rejects.toThrow(PORTAL_LINK_UNUSABLE);
    expect(candidateDocument.findFirst).not.toHaveBeenCalled();
  });

  it('denies a document that belongs to someone else', async () => {
    const token = service.sign(payloadA);
    await expect(service.fileStatus(token, '33333333-3333-4333-8333-333333333333')).rejects.toThrow(/not available/i);
    expect(candidateDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333', candidateId: 'cand-a' }),
    }));
  });

  it('keeps a candidate upload awaiting verification and does not complete checks', async () => {
    auditLog.findMany.mockResolvedValue([{ reason: 'Passport copy' }]);
    storage.put.mockResolvedValue({ storageKey: 'org/cand/file.pdf', provider: 'local-private' });
    candidateDocument.create.mockResolvedValue({
      id: 'doc-1',
      documentType: 'Passport copy',
      fileName: 'phase8.pdf',
      scanStatus: 'AwaitingVerification',
    });
    const pdf = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const result = await service.upload(service.sign(payloadA), 'Passport copy', {
      buffer: pdf,
      originalname: 'phase8.pdf',
      mimetype: 'application/pdf',
      size: pdf.length,
    });
    expect(result).toMatchObject({
      scanStatus: 'AwaitingVerification',
      awaitingVerification: true,
      joiningCheckCompleted: false,
      licenceCheckCompleted: false,
    });
    expect(result).not.toHaveProperty('storageKey');
    expect(candidateDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scanStatus: 'AwaitingVerification' }),
    }));
    expect(joiningCheck.create).not.toHaveBeenCalled();
    expect(joiningCheck.update).not.toHaveBeenCalled();
  });

  it('rejects a zip archive', async () => {
    auditLog.findMany.mockResolvedValue([{ reason: 'Passport copy' }]);
    const pdf = Buffer.from('%PDF-1.1\n');
    await expect(service.upload(service.sign(payloadA), 'Passport copy', {
      buffer: pdf,
      originalname: 'papers.zip',
      mimetype: 'application/zip',
      size: pdf.length,
    })).rejects.toThrow(/ZIP/i);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('a generic contact does not look up a candidate', async () => {
    const result = await service.contact('Phase Eight', 'Please send a new link.');
    expect(result.message).toMatch(/does not open an application/i);
    expect(candidate.findMany).not.toHaveBeenCalled();
    expect(candidate.findFirst).not.toHaveBeenCalled();
    expect(application.findFirst).not.toHaveBeenCalled();
  });
});

describe('public application consent', () => {
  it('does not accept an application missing the required privacy consent', async () => {
    const dto = plainToInstance(PublicApplicationDto, {
      firstName: 'Phase',
      lastName: 'Eight',
      email: 'phase8.missing@recruitflow.local',
      consentAccepted: false,
    });
    const errors = await validate(dto);
    const body = validationExceptionFactory(errors).getResponse() as {
      code: string;
      message: string;
      field?: string;
      fields?: Record<string, string[]>;
    };
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Please correct the highlighted fields.',
      field: 'consentAccepted',
    });
    expect(body.fields?.consentAccepted.join(' ')).toMatch(/consentAccepted must be true/i);
  });
});
