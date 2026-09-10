import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { CandidatesService } from '../candidates.service';
import type { PrismaService } from '../../database/prisma.service';
import type { AuthUser } from '@recruitflow/contracts';

describe('Candidates Export Service', () => {
  const mockCandidates = [
    {
      id: 'cnd-1',
      organizationId: 'org-1',
      candidateCode: 'CND-2026-001',
      firstName: 'Fatima',
      lastName: 'Al-Zahrani',
      email: 'fatima.zahrani@example.sa',
      phone: '+966501234567',
      currentTitle: 'Registered Nurse',
      currentCompany: 'King Faisal Hospital',
      location: 'Riyadh',
      experienceYears: 5,
      skills: ['ICU', 'BLS', 'Patient Care'],
      source: 'Direct Application',
      status: 'Active',
      consentStatus: 'Granted',
      consentCapturedAt: new Date('2026-01-15T08:30:00.000Z'),
      consentSource: 'Online Portal',
      createdAt: new Date('2026-01-15T08:30:00.000Z'),
      updatedAt: new Date('2026-01-15T08:30:00.000Z'),
    },
    {
      id: 'cnd-2',
      organizationId: 'org-1',
      candidateCode: 'CND-2026-002',
      firstName: 'Tariq',
      lastName: 'Mansoor',
      email: 'tariq.mansoor@example.sa',
      phone: '+966559876543',
      currentTitle: 'Lab Technician',
      currentCompany: 'Saudi German Hospital',
      location: 'Jeddah',
      experienceYears: 3,
      skills: ['Hematology', 'Phlebotomy'],
      source: 'Referral',
      status: 'Active',
      consentStatus: 'Granted',
      consentCapturedAt: new Date('2026-02-01T10:00:00.000Z'),
      consentSource: 'Direct Intake',
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
      updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    },
  ];

  it('generates a valid XLSX workbook with correct headers and rows', async () => {
    const mockPrisma = {
      candidate: {
        findMany: vi.fn().mockResolvedValue(mockCandidates),
      },
      codeSequence: {
        upsert: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new CandidatesService(mockPrisma);
    const buffer = await service.exportExcel('org-1', {}, { viewPii: true });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Candidates');

    const sheet = workbook.Sheets['Candidates'];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    // Verify header row
    expect(rows[0]).toEqual([
      'Candidate Code',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Current Title',
      'Current Company',
      'Location',
      'Experience (Years)',
      'Skills',
      'Source',
      'Status',
      'Consent Status',
      'Consent Captured At (UTC)',
      'Created At (UTC)',
    ]);

    // Verify first data row with viewPii = true
    expect(rows[1][0]).toBe('CND-2026-001');
    expect(rows[1][1]).toBe('Fatima');
    expect(rows[1][2]).toBe('Al-Zahrani');
    expect(rows[1][3]).toBe('fatima.zahrani@example.sa');
    expect(rows[1][4]).toBe('+966501234567');
    expect(rows[1][9]).toBe('ICU, BLS, Patient Care');
    expect(rows[1][12]).toBe('Granted');

    // Verify second data row
    expect(rows[2][0]).toBe('CND-2026-002');
    expect(rows[2][1]).toBe('Tariq');
  });

  it('masks email and phone numbers when viewPii is false', async () => {
    const mockPrisma = {
      candidate: {
        findMany: vi.fn().mockResolvedValue(mockCandidates),
      },
    } as unknown as PrismaService;

    const service = new CandidatesService(mockPrisma);
    const buffer = await service.exportExcel('org-1', {}, { viewPii: false });

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Candidates'];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    // Email should be masked (e.g. f•••••••••••••@example.sa)
    expect(rows[1][3]).toContain('•');
    expect(rows[1][3]).not.toBe('fatima.zahrani@example.sa');

    // Phone should be masked (e.g. •••••••••••67)
    expect(rows[1][4]).toContain('•');
    expect(rows[1][4]).not.toBe('+966501234567');
  });

  it('filters candidates by organizationId and query parameters', async () => {
    const findManyMock = vi.fn().mockResolvedValue([]);
    const mockPrisma = {
      candidate: { findMany: findManyMock },
    } as unknown as PrismaService;

    const service = new CandidatesService(mockPrisma);
    await service.exportExcel('org-test-42', { status: 'Active', source: 'Referral', search: 'Mansoor' }, { viewPii: true });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-test-42',
          status: 'Active',
          source: 'Referral',
          OR: expect.arrayContaining([
            { firstName: { contains: 'Mansoor', mode: 'insensitive' } },
            { lastName: { contains: 'Mansoor', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('rejects permanent candidate deletion for non-administrator roles', async () => {
    const findFirstMock = vi.fn();
    const mockPrisma = {
      candidate: { findFirst: findFirstMock },
    } as unknown as PrismaService;
    const service = new CandidatesService(mockPrisma);
    const user: AuthUser = {
      userId: 'user-1',
      organizationId: 'org-1',
      tokenVersion: 1,
      roleCodes: ['RECRUITER'],
    };

    await expect(service.deleteCandidate('org-1', 'candidate-1', user)).rejects.toThrow(
      'Only administrators can permanently delete candidate data.',
    );
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
