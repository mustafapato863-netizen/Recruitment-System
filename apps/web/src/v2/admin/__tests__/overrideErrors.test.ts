import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/client';
import { override403Text } from '../overrideErrors';

const e403 = (code: string, message: string) => new ApiError(403, 'Access denied: you do not have permission to perform this action.', { code, message }, { code });

describe('B2F-4 override 403 text by code (never "only an administrator")', () => {
  it('owner check (FORBIDDEN "Only the job owner or their manager…") names the real cause', () => {
    const t = override403Text(e403('FORBIDDEN', 'Only the job owner or their manager can change job status.'));
    expect(t).toMatch(/^The server refused this override: Only the job owner or their manager can change job status\./);
    expect(t).not.toMatch(/Only an administrator/);
    expect(override403Text(e403('JOB_NOT_OWNED', ''))).toMatch(/only the job owner or their manager/);
  });
  it('known codes use the server message; unknown codes say what refused', () => {
    expect(override403Text(e403('ADMIN_ONLY', ''))).toBe('This override needs the Administrator role.');
    expect(override403Text(e403('OVERRIDE_NOT_ALLOWED', 'Not for closed jobs.'))).toBe('Not for closed jobs.');
    expect(override403Text(e403('SOMETHING', 'Nope.'))).toBe('The server refused this override (SOMETHING): Nope.');
    expect(override403Text(new ApiError(403, 'x'))).toBe('The server refused this override (403). Nothing changed.');
  });
});
