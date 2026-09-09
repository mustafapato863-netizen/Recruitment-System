import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { BulkImportService } from '../bulk-import.service';
import type { PrismaService } from '../../database/prisma.service';
import type { ImportService } from '../import.service';
import type { VacancyCoreService } from '../../vacancy-core/vacancy-core.service';
import type { MasterDataService } from '../../master-data/master-data.service';

describe('BulkImportService', () => {
  const mockPrisma = {
    candidate: { findMany: vi.fn() },
    branch: { findMany: vi.fn() },
    position: { findMany: vi.fn() },
    legalEntity: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    vacancy: { findMany: vi.fn() },
    vacancyRequest: { findMany: vi.fn() },
    candidateImportJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    candidateImportRow: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;

  const mockImportService = {} as ImportService;
  const mockVacancyCore = {} as VacancyCoreService;
  const mockMasterData = {} as MasterDataService;

  const createService = () => new BulkImportService(
    mockPrisma,
    mockImportService,
    mockVacancyCore,
    mockMasterData,
  );

  describe('Template Generation', () => {
    it('generates a valid XLSX workbook template for candidates with expected headers', () => {
      const service = createService();
      const buffer = service.template('candidates');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Candidates');

      const sheet = workbook.Sheets['Candidates'];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      const headers = rows[0];

      expect(headers).toContain('First Name');
      expect(headers).toContain('Last Name');
      expect(headers).toContain('Email');
      expect(headers).toContain('Phone');
      expect(headers).toContain('Skills');
    });

    it('generates a valid XLSX template for vacancy requests', () => {
      const service = createService();
      const buffer = service.template('vacancy-requests');

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Vacancy Requests');

      const sheet = workbook.Sheets['Vacancy Requests'];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      const headers = rows[0];

      expect(headers).toContain('Position Code');
      expect(headers).toContain('Branch Code');
      expect(headers).toContain('Requested Headcount');
    });

    it('generates valid XLSX templates for master data entities', () => {
      const service = createService();

      const leBuffer = service.template('legal-entities');
      const leWb = XLSX.read(leBuffer, { type: 'buffer' });
      expect(leWb.SheetNames).toContain('Legal Entities');

      const brBuffer = service.template('branches');
      const brWb = XLSX.read(brBuffer, { type: 'buffer' });
      expect(brWb.SheetNames).toContain('Branches');
      const brRows = XLSX.utils.sheet_to_json<string[]>(brWb.Sheets['Branches'], { header: 1 });
      expect(brRows[0]).toEqual(['Code', 'Name', 'Country', 'City', 'Status']);

      const posBuffer = service.template('positions');
      const posWb = XLSX.read(posBuffer, { type: 'buffer' });
      expect(posWb.SheetNames).toContain('Positions');
    });
  });

  describe('Formula Rejection & Security', () => {
    it('rejects workbooks containing formula cells with clear error message', () => {
      const service = createService();

      // Create a workbook with an Excel formula
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ['First Name', 'Last Name', 'Email'],
        ['John', 'Doe', 'john@example.sa'],
      ]);
      // Inject formula into cell
      sheet['C2'] = { t: 's', v: 'malicious', f: 'HYPERLINK("http://evil.com")' };

      XLSX.utils.book_append_sheet(workbook, sheet, 'Candidates');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      expect(() => {
        service.inspect('candidates', buffer, 'test.xlsx');
      }).toThrow(/Formula cells are not accepted/i);
    });

    it('rejects empty workbooks', () => {
      const service = createService();
      expect(() => {
        service.inspect('candidates', Buffer.from(''), 'empty.xlsx');
      }).toThrow(/uploaded workbook is empty/i);
    });

    it('rejects unsupported file formats', () => {
      const service = createService();
      expect(() => {
        service.inspect('candidates', Buffer.from('dummy content'), 'resume.pdf');
      }).toThrow(/Only \.xlsx, \.xls, and \.csv files are supported/i);
    });
  });

  describe('Worksheet Inspection', () => {
    it('inspects valid workbook and detects missing required columns', () => {
      const service = createService();

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ['First Name', 'Phone'], // Missing Last Name and Email
        ['Ahmed', '+966500000000'],
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Candidates');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const result = service.inspect('candidates', buffer, 'candidates.xlsx');
      expect(result.fileName).toBe('candidates.xlsx');
      expect(result.sheets[0].name).toBe('Candidates');
      expect(result.sheets[0].rowCount).toBe(1);
      expect(result.warnings.some((w) => w.includes('required columns are missing'))).toBe(true);
    });

    it('inspects workbook with all required columns without missing column warning', () => {
      const service = createService();

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ['First Name', 'Last Name', 'Email', 'Phone'],
        ['Amina', 'Al-Sayed', 'amina@example.sa', '+966501112233'],
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Candidates');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const result = service.inspect('candidates', buffer, 'candidates.xlsx');
      expect(result.warnings.length).toBe(0);
      expect(result.sheets[0].rowCount).toBe(1);
    });
  });

  describe('Error Report Generation', () => {
    it('generates a formatted error report workbook with row numbers and failure details', async () => {
      const mockJob = {
        id: 'job-err-1',
        organizationId: 'org-1',
        dataset: 'candidates',
        status: 'Review',
        rows: [],
      };

      const mockErrorRows = [
        {
          id: 'row-1',
          jobId: 'job-err-1',
          rowNumber: 2,
          result: 'Invalid',
          details: 'A valid Email is required.',
          rawData: { firstName: 'Khalid', lastName: 'Otaibi', email: 'invalid-email' },
        },
        {
          id: 'row-2',
          jobId: 'job-err-1',
          rowNumber: 3,
          result: 'Duplicate',
          details: 'Email already exists in this organization.',
          rawData: { firstName: 'Sarah', lastName: 'Najjar', email: 'sarah@example.sa' },
        },
      ];

      vi.mocked(mockPrisma.candidateImportJob.findFirst).mockResolvedValue(mockJob);
      vi.mocked(mockPrisma.candidateImportRow.findMany).mockResolvedValue(mockErrorRows);

      const service = createService();
      const buffer = await service.getErrorReport('org-1', 'candidates', 'job-err-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Import Errors');

      const sheet = workbook.Sheets['Import Errors'];
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      expect(data[0][0]).toBe('Row');
      expect(data[0][1]).toBe('Result');
      expect(data[0][2]).toBe('Details');

      expect(data[1][0]).toBe(2);
      expect(data[1][1]).toBe('Invalid');
      expect(data[1][2]).toBe('A valid Email is required.');

      expect(data[2][0]).toBe(3);
      expect(data[2][1]).toBe('Duplicate');
    });
  });
});
