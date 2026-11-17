import { describe, expect, it } from 'vitest';
import { bucketJoinedBySite, buildTeamFunnel, cairoMidnight, monthRange, parseCairoDateBound, tile } from '../results.calc';

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
  it('team funnel step percent is of the previous step, and a screen note counts as screened', () => {
    const steps = buildTeamFunnel([
      { stage: 'Applied', history: [], screenNote: true, offerSent: false, joined: false },
      { stage: 'Interview', history: ['Screening', 'Interview'], screenNote: false, offerSent: false, joined: false },
      { stage: 'Joined', history: ['Offer', 'Joined'], screenNote: false, offerSent: true, joined: true },
      { stage: 'Screening', history: [], screenNote: false, offerSent: true, joined: false },
    ]);
    expect(steps.map((step) => [step.label, step.count, step.stepPercent])).toEqual([
      ['Applications', 4, null],
      ['Screened', 4, 100],
      ['Interviewed', 2, 50],
      ['Offered', 2, 100],
      ['Joined', 1, 50],
    ]);
    expect(buildTeamFunnel([])[0]).toEqual({ label: 'Applications', count: 0, stepPercent: null });
    expect(buildTeamFunnel([])[1]!.stepPercent).toBeNull();
  });

  it('joined seats keep the three largest sites and sum the rest as Other', () => {
    expect(bucketJoinedBySite([
      { siteId: 'd', site: 'Dammam', joined: 1 },
      { siteId: 'r', site: 'Riyadh', joined: 4 },
      { siteId: 'j', site: 'Jeddah', joined: 2 },
      { siteId: 'm', site: 'Makkah', joined: 2 },
      { siteId: 'x', site: 'Empty', joined: 0 },
    ])).toEqual([
      { siteId: 'r', site: 'Riyadh', joined: 4 },
      { siteId: 'j', site: 'Jeddah', joined: 2 },
      { siteId: 'm', site: 'Makkah', joined: 2 },
      { siteId: null, site: 'Other', joined: 1 },
    ]);
    expect(bucketJoinedBySite([
      { siteId: 'b', site: 'Jeddah', joined: 1 },
      { siteId: 'a', site: 'Riyadh', joined: 1 },
    ])).toEqual([
      { siteId: 'b', site: 'Jeddah', joined: 1 },
      { siteId: 'a', site: 'Riyadh', joined: 1 },
    ]);
  });

  it('R03: parseCairoDateBound resolves date-only end bounds to next-day Cairo midnight so last-day daytime records are included', () => {
    const start = parseCairoDateBound('2026-10-01', 'start');
    const end = parseCairoDateBound('2026-10-31', 'end');
    expect(start?.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(end?.toISOString()).toBe('2026-10-31T22:00:00.000Z');
    const lastDayRecord = new Date('2026-10-31T10:00:00.000Z').getTime();
    expect(lastDayRecord).toBeGreaterThanOrEqual(start!.getTime());
    expect(lastDayRecord).toBeLessThan(end!.getTime());
  });
});
