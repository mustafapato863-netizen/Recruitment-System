import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/client';
import { reqError } from '../requisitions';

describe('#23 603d44d ASSIGNEE_NOT_IN_TEAM', () => {
  it('lands on the assignee input (via field and via code)', () => {
    const msg = 'Pick someone from your own team (your reports and their reports).';
    expect(reqError(new ApiError(400, msg, { statusCode: 400, code: 'ASSIGNEE_NOT_IN_TEAM', field: 'assignedEmployeeId', message: msg }, { code: 'ASSIGNEE_NOT_IN_TEAM' })).inline).toEqual({ assignee: msg });
    expect(reqError(new ApiError(400, msg, { statusCode: 400, code: 'ASSIGNEE_NOT_IN_TEAM', message: msg }, { code: 'ASSIGNEE_NOT_IN_TEAM' })).field).toBe('assignee');
  });
});
