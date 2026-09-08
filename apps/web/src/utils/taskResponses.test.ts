import { describe, expect, it } from 'vitest';
import { getTaskRows } from './taskResponses';

const task = { id: 'task-1', status: 'Open' } as never;

describe('getTaskRows', () => {
  it('normalizes paginated task responses', () => {
    expect(getTaskRows({ data: [task], total: 1, page: 1, pageSize: 20 })).toEqual([task]);
  });

  it('keeps compatibility with array responses', () => {
    expect(getTaskRows([task])).toEqual([task]);
  });
});
