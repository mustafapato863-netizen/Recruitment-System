import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DECISION_OUTCOME, monthlyBase } from '../offer-decision.service';

describe('B7 base pay for the band check', () => {
  it('counts Salary components only (allowances and benefits excluded), annual / 12', () => {
    expect(monthlyBase([
      { type: 'Salary', amount: 12000, currency: 'aed', frequency: 'Monthly' },
      { type: 'Allowance', amount: 5000, currency: 'AED', frequency: 'Monthly' },
      { type: 'Benefit', amount: 900, currency: 'AED', frequency: 'Monthly' },
    ])).toEqual({ amount: 12000, currency: 'AED' });
    expect(monthlyBase([{ type: 'Salary', amount: 120000, currency: 'EGP', frequency: 'Annual' }])).toEqual({ amount: 10000, currency: 'EGP' });
    expect(monthlyBase([{ type: 'Allowance', amount: 5000, currency: 'AED', frequency: 'Monthly' }])).toBeNull();
    expect(() => monthlyBase([{ type: 'Salary', amount: 1, currency: 'AED', frequency: null }, { type: 'Salary', amount: 1, currency: 'EGP', frequency: null }])).toThrow();
  });
  it('maps decisions to B5 version states', () => {
    expect(DECISION_OUTCOME.Approve.version).toBe('Approved');
    expect(DECISION_OUTCOME.RequestChanges.version).toBe('Changes Requested');
    expect(DECISION_OUTCOME.Reject.version).toBe('Withdrawn');
  });
  it('one pay rule (B0a x B7): offers and screening salary both go through canSeePay (OFFER_PAY_VIEW)', () => {
    const offers = readFileSync(join(__dirname, '../../offers/offers.controller.ts'), 'utf8');
    const screening = readFileSync(join(__dirname, '../../screening/screening.controller.ts'), 'utf8');
    const rule = readFileSync(join(__dirname, '../../common/access/pay-visibility.ts'), 'utf8');
    expect(rule).toContain("PAY_VIEW_PERMISSION = 'OFFER_PAY_VIEW'");
    for (const src of [offers, screening]) {
      expect(src).toContain('canSeePay(');
      expect(src).not.toContain("'VIEW_CURRENT_SALARY'");
    }
  });
});
