import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/client';
import { gateFromError } from '../gates';
import { stripPay } from '../paySafety';

/** Exact wire bodies from #11's normalizer: GATE_* is not in the registry, so code = CONFLICT and gate/missing are dropped. */
const wire = (status: number, code: string, message: string) => new ApiError(status, message, { statusCode: status, code, message, retryable: false, retryAfterSeconds: null, requestId: 'r' }, { code });

describe('gateFromError (#11 pass-through finding)', () => {
  it.each([
    ['Interview needs a saved screen note.', 'GATE_SCREEN_NOTE_MISSING'],
    ['Offer needs a submitted interview scorecard.', 'GATE_SCORECARD_NOT_SUBMITTED'],
    ['Pre-Hire needs an accepted offer.', 'GATE_OFFER_NOT_ACCEPTED'],
    ['Joined needs ID, contract and SCFHS licence checked. Missing: contract, SCFHS licence.', 'GATE_JOINING_CHECKS_INCOMPLETE'],
    ['Rejected needs a reason from the rejection reasons list.', 'GATE_REJECT_REASON_REQUIRED'],
    ['"Too far" is not in the rejection reasons list.', 'GATE_REJECT_REASON_REQUIRED'],
  ])('409 CONFLICT "%s" → %s', (message, code) => {
    const d = gateFromError(wire(409, 'CONFLICT', message));
    expect(d?.code).toBe(code);
    expect(d?.gate).toBe(code);
  });
  it('recovers the missing joining checks from the message', () => {
    expect(gateFromError(wire(409, 'CONFLICT', 'Joined needs ID, contract and SCFHS licence checked. Missing: contract, SCFHS licence.'))?.missing).toEqual(['contract', 'SCFHS licence']);
  });
  it('uses a raw GATE_* code and missing[] when Backend passes them through', () => {
    const e = new ApiError(409, 'x', { code: 'GATE_JOINING_CHECKS_INCOMPLETE', gate: 'Joining checks', message: 'x', missing: ['ID'] }, { code: 'GATE_JOINING_CHECKS_INCOMPLETE' });
    expect(gateFromError(e)).toMatchObject({ code: 'GATE_JOINING_CHECKS_INCOMPLETE', missing: ['ID'] });
  });
  it.each([
    ['The meeting link must be on an approved meeting host (teams.microsoft.com).', 'ROOM_URL_HOST_NOT_ALLOWED'],
    ['The meeting link must use https.', 'ROOM_URL_NOT_HTTPS'],
    ['Add at least one interviewer (an internal user).', 'INTERVIEWER_REQUIRED'],
    ['A reason is required to revise a scorecard.', 'REVISION_REASON_REQUIRED'],
  ])('400 VALIDATION_ERROR "%s" → %s', (message, code) => {
    expect(gateFromError(wire(400, 'VALIDATION_ERROR', message))?.code).toBe(code);
  });
  it('ignores unrelated errors', () => {
    expect(gateFromError(wire(409, 'CONFLICT', 'The request conflicts with the current state of the resource.'))).toBeNull();
    expect(gateFromError(null)).toBeNull();
  });
});

describe('stripPay', () => {
  it('removes pay keys at any depth and keeps everything else', () => {
    const out = stripPay({ a: 1, expectedSalary: 1, nested: [{ monthlyPackage: 2, annualFixed: 3, components: [{ amount: 1 }], currency: 'EGP', packageTotal: 9, name: 'x' }], salaryCurrency: 'EGP' });
    expect(out).toEqual({ a: 1, nested: [{ name: 'x' }] });
  });
});
