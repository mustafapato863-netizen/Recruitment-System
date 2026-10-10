import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/client';
import { domainError } from '../gates';
import { stripPay } from '../paySafety';

/** Exact wire bodies from the #11 @e2f1296 normalizer: registry codes pass through; gate 409s carry gate + missing[]. */
const wire = (status: number, body: Record<string, unknown>) => new ApiError(status, String(body.message), { statusCode: status, retryable: false, retryAfterSeconds: null, requestId: 'r', ...body }, { code: body.code as string });

describe('domainError (codes, no message matching)', () => {
  it.each([
    ['GATE_SCREEN_NOTE_MISSING', 'screen-note', ['screen note']],
    ['GATE_SCORECARD_NOT_SUBMITTED', 'scorecard', ['submitted scorecard']],
    ['GATE_OFFER_NOT_ACCEPTED', 'offer-accepted', ['accepted offer']],
    ['GATE_JOINING_CHECKS_INCOMPLETE', 'joining-checks', ['CONTRACT', 'SCFHS_LICENCE']],
    ['GATE_REJECT_REASON_REQUIRED', 'reject-reason', ['reason']],
  ])('409 %s carries gate %s and missing[]', (code, gate, missing) => {
    const d = domainError(wire(409, { code, gate, missing, message: 'whatever the server says' }));
    expect(d).toMatchObject({ code, gate: code, gateKey: gate, missing, statusCode: 409 });
    expect(new ApiError(409, 'm', { code, gate, missing }, { code }).missing).toEqual(missing);
  });
  it.each(['ROOM_URL_HOST_NOT_ALLOWED', 'INTERVIEWER_REQUIRED', 'REVISION_REASON_REQUIRED', 'OFFER_NOT_DRAFT', 'OFFER_TEMPLATE_INVALID', 'FOLLOW_UP_NOT_OWNER', 'REASON_NOT_IN_LIST', 'COMPARE_COUNT'])('passes %s through by code', (code) => {
    expect(domainError(wire(400, { code, message: 'any text' }))?.code).toBe(code);
  });
  it('a message that used to be matched is ignored without a code', () => {
    expect(domainError(wire(409, { code: 'CONFLICT', message: 'Interview needs a saved screen note.' }))).toBeNull();
    expect(domainError(wire(403, { code: 'FORBIDDEN', message: 'x' }))).toBeNull();
    expect(domainError(null)).toBeNull();
  });
});

describe('stripPay', () => {
  it('removes pay keys at any depth and keeps everything else', () => {
    const out = stripPay({ a: 1, expectedSalary: 1, nested: [{ monthlyPackage: 2, annualFixed: 3, components: [{ amount: 1 }], currency: 'EGP', packageTotal: 9, name: 'x' }], salaryCurrency: 'EGP' });
    expect(out).toEqual({ a: 1, nested: [{ name: 'x' }] });
  });
});
