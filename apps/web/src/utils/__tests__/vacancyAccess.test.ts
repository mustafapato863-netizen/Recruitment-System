import { describe, expect, it } from 'vitest';
import { isForbiddenError, isOwnershipDenied, isRedactedVacancy, partitionVacancies, redactedSeats, redactedSite, redactedTitle, unwrapList } from '../vacancyAccess';
import { forbidden, jobNotOwnedBody, redactedJob, redactedJobSparse } from '../../test/fixtures/b1';

const full = { id: 'vac-1', title: 'ICU Nurse', status: 'Open' };

describe('B1 vacancy access helpers', () => {
  it('discriminates redacted jobs by redacted: true only', () => {
    expect(isRedactedVacancy(redactedJob)).toBe(true);
    expect(isRedactedVacancy(full)).toBe(false);
    expect(isRedactedVacancy({ ...full, redacted: false })).toBe(false);
    expect(isRedactedVacancy(null)).toBe(false);
  });

  it('partitions mixed lists and skips junk', () => {
    const { full: f, redacted } = partitionVacancies([full, redactedJob, null as never, redactedJobSparse]);
    expect(f.map((v) => v.id)).toEqual(['vac-1']);
    expect(redacted.map((v) => v.id)).toEqual(['vac-other-1', 'vac-other-2']);
  });

  it('unwraps array and { data } envelopes', () => {
    expect(unwrapList([full])).toHaveLength(1);
    expect(unwrapList({ data: [full] })).toHaveLength(1);
    expect(unwrapList(null)).toEqual([]);
  });

  it('never crashes on missing fields', () => {
    expect(redactedTitle(redactedJobSparse)).toBe('Untitled job');
    expect(redactedSite(redactedJobSparse)).toBe('Site not shared');
    expect(redactedSeats({ ...redactedJobSparse, seats: undefined as never })).toEqual({ filled: 0, target: 0 });
  });

  it('detects 403 and ownership denials', () => {
    expect(isForbiddenError(forbidden())).toBe(true);
    expect(isOwnershipDenied(forbidden(jobNotOwnedBody))).toBe(true);
    expect(isOwnershipDenied(Object.assign(new Error('x'), { statusCode: 403, code: 'ACCOUNT_LOCKED' }))).toBe(false);
    expect(isForbiddenError(Object.assign(new Error('x'), { statusCode: 401 }))).toBe(false);
  });
});
