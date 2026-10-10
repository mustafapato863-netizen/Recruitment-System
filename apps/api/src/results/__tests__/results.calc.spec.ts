import { describe, expect, it } from 'vitest';
import { cairoMidnight, monthRange, tile } from '../results.calc';

describe('B8 results calc', () => {
  it('tooFewToJudge when sampleSize < 5; seats exempt', () => {
    expect(tile(1, 4, 4, 'x').tooFewToJudge).toBe(true);
    expect(tile(3, 5, 5, 'x').tooFewToJudge).toBe(false);
    expect(tile(0, 2, 1, 'x', true).tooFewToJudge).toBe(false);
    expect(Object.keys(tile(1, 1, 1, 'd')).sort()).toEqual(['detail', 'of', 'sampleSize', 'tooFewToJudge', 'value']);
  });
  it('months are Cairo calendar months', () => {
    expect(cairoMidnight(2026, 10, 1).toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(cairoMidnight(2026, 1, 1).toISOString()).toBe('2025-12-31T22:00:00.000Z');
    const r = monthRange('2026-12', new Date())!;
    expect([r.firstDay, r.nextMonthFirstDay]).toEqual(['2026-12-01', '2027-01-01']);
    expect(monthRange(undefined, new Date('2026-09-30T22:30:00Z'))!.month).toBe('2026-10');
    expect(monthRange('2026-13', new Date())).toBeNull();
  });
});
