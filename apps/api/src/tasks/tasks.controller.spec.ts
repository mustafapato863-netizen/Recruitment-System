import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parsePositiveInteger } from './tasks.controller';

describe('parsePositiveInteger', () => {
  it('accepts a bounded positive integer', () => {
    expect(parsePositiveInteger('20', 'pageSize', 100)).toBe(20);
  });

  it('rejects negative, zero, malformed and excessive values', () => {
    for (const value of ['-1', '0', 'abc', '101']) {
      expect(() => parsePositiveInteger(value, 'pageSize', 100)).toThrow(BadRequestException);
    }
  });
});
