import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client';
import { canUseRequisitions, isRecruiterOnly, v2Redirect } from '../destinations';
import { permittedNavItems } from '../../components/v2/shell/navConfig';
import { bannerError, fieldError, serverFormErrors } from '../forms/serverErrors';

const REC = [{ code: 'RECRUITER' }];
const HM = [{ code: 'HIRING_MANAGER' }];

describe('#21 B2-3: Recruiter role has no requisitions', () => {
  it('recruiter-only users never get the nav item or the route, even with a stale permission', () => {
    expect(isRecruiterOnly(REC)).toBe(true);
    expect(isRecruiterOnly([...REC, ...HM])).toBe(false);
    expect(canUseRequisitions({ roles: REC, permissions: ['VACANCY_REQUEST_VIEW'] })).toBe(false);
    expect(canUseRequisitions({ roles: HM, permissions: ['VACANCY_REQUEST_VIEW'] })).toBe(true);
    expect(canUseRequisitions({ roles: HM, permissions: [] })).toBe(false);
    expect(permittedNavItems('manager', ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW'], false, true).map((i) => i.key)).not.toContain('requisitions');
    expect(permittedNavItems('manager', ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW'], false, false).map((i) => i.key)).toContain('requisitions');
    expect(v2Redirect('manager', '/vacancy-requests', { requisitions: false })).toBe('/my-work');
    expect(v2Redirect('manager', '/vacancy-requests/r1', { requisitions: false })).toBe('/my-work');
    expect(v2Redirect('manager', '/vacancy-requests', { requisitions: true })).toBeNull();
  });
});

const err400 = (body: Record<string, unknown>) =>
  new ApiError(400, 'Please correct the highlighted fields. (x)', { statusCode: 400, ...body }, { code: body.code as string, fields: body.fields as Record<string, string[]> | undefined });

describe('#23 B2-15/B2-7: 400 field + fields land inline', () => {
  it('maps fields[] (nested paths too) and a lone field to inputs; the banner keeps only what no input shows', () => {
    const e = serverFormErrors(err400({ code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'basePay', fields: { basePay: ['basePay must be a positive number'], 'allowances.0.amount': ['amount must not be less than 0'] } }));
    expect(fieldError(e, 'basePay')).toBe('basePay must be a positive number');
    expect(fieldError(e, 'allowances')).toBe('amount must not be less than 0');
    expect(bannerError(e, ['basePay', 'allowances'])).toBeNull();
    expect(bannerError(e, ['basePay'])).toBe('Please correct the highlighted fields.');
    const r = serverFormErrors(err400({ code: 'REASON_REQUIRED', message: 'Rejection reason "Other" needs a short note.', field: 'note' }));
    expect(r.code).toBe('REASON_REQUIRED');
    expect(fieldError(r, 'note')).toBe('Rejection reason "Other" needs a short note.');
    expect(serverFormErrors(new Error('offline')).message).toBe('offline');
    expect(bannerError(serverFormErrors(new Error('offline')), ['x'])).toBe('offline');
  });
});
