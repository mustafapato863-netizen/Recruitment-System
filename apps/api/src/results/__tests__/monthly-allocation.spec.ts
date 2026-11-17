import { describe, expect, it } from 'vitest';
import { monthlyTargetWeeks } from '@recruitflow/contracts';
describe('automatic monthly allocation', () => {
  it('preserves every monthly integer total, including small targets, leap years, and DST months', () => {
    for(const month of ['2026-11', '2026-10', '2026-04', '2028-02', '2026-01', '2026-12'])
      for(const quantity of [0, 1, 2, 4, 31, 80, 101, 2147483647]) {
        const weeks = monthlyTargetWeeks(month, quantity);
        expect(weeks.reduce((sum, item) => sum + item.quantity, 0)).toBe(quantity);
        expect(weeks.every(item => Number.isInteger(item.quantity) && item.quantity >= 0 && item.days > 0 && item.days <= 7)).toBe(true);
      }
  });
  it('allocates partial weeks by calendar days instead of dividing by four', () => {
    const weeks = monthlyTargetWeeks('2026-11', 30);
    expect(weeks.map(item => item.quantity)).toEqual([1, 7, 7, 7, 7, 1]);
    expect(weeks[0]).toMatchObject({ weekStart: '2026-10-26', periodKey: '2026-W44', days: 1 });
    expect(monthlyTargetWeeks('2026-10', 31).find(item => item.periodKey === '2026-W44')?.quantity).toBe(6);
  });
  it('handles the ISO year boundary and rejects invalid input', () => {
    expect(monthlyTargetWeeks('2026-01', 31)[0]).toMatchObject({ weekStart: '2025-12-29', periodKey: '2026-W01', quantity: 4 });
    expect(monthlyTargetWeeks('2026-13', 10)).toEqual([]);
    expect(monthlyTargetWeeks('2026-11', 1.5)).toEqual([]);
  });
});
