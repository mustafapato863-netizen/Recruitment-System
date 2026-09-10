import { StreamableFile } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { MasterDataBulkImportController } from '../bulk-import.controller';
import type { BulkImportService } from '../bulk-import.service';

describe('MasterDataBulkImportController template download', () => {
  it('returns the workbook as a binary stream instead of JSON-serializing the Buffer', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Code', 'Name']]), 'Branches');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const service = { template: vi.fn().mockReturnValue(buffer) } as unknown as BulkImportService;
    const controller = new MasterDataBulkImportController(service);

    const response = controller.template('branches');

    expect(response).toBeInstanceOf(StreamableFile);
    expect(response.getHeaders()).toMatchObject({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  });
});
