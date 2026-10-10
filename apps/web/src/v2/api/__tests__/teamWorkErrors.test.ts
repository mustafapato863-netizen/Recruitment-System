import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/client';
import { reassignError } from '../teamWork';

describe('#23 reassign 400 fields go on the inputs', () => {
  it('toUserId → New primary recruiter; reason → Reason; codes still win when no field is named', () => {
    const fields = { toUserId: ['toUserId must be a UUID'] };
    expect(reassignError(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'toUserId', fields }, { code: 'VALIDATION_ERROR', fields }))).toMatchObject({ field: 'to', text: 'toUserId must be a UUID' });
    expect(reassignError(new ApiError(400, 'x', { statusCode: 400, code: 'REASSIGN_REASON_REQUIRED', message: 'A reason is required to reassign files.', field: 'reason' }, { code: 'REASSIGN_REASON_REQUIRED' }))).toMatchObject({ field: 'reason' });
    expect(reassignError(new ApiError(409, 'Closed files do not move.', { statusCode: 409, code: 'REASSIGN_FILE_CLOSED', message: 'Closed files do not move.' }, { code: 'REASSIGN_FILE_CLOSED' })).code).toBe('REASSIGN_FILE_CLOSED');
  });
});

describe('#23 603d44d REASSIGN_TARGET_NOT_IN_TEAM', () => {
  it('lands on the new-owner input (via field and via code)', () => {
    const msg = 'Pick someone from your own team (your reports and their reports).';
    expect(reassignError(new ApiError(400, msg, { statusCode: 400, code: 'REASSIGN_TARGET_NOT_IN_TEAM', field: 'toUserId', message: msg }, { code: 'REASSIGN_TARGET_NOT_IN_TEAM' }))).toMatchObject({ field: 'to', text: msg });
    expect(reassignError(new ApiError(400, msg, { statusCode: 400, code: 'REASSIGN_TARGET_NOT_IN_TEAM', message: msg }, { code: 'REASSIGN_TARGET_NOT_IN_TEAM' }))).toMatchObject({ field: 'to' });
  });
});
