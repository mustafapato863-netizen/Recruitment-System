/**
 * B8 (v2 §7 "My result", §9 Evaluation): four monthly numbers, nothing else.
 * No activity counters (calls, messages, CVs opened) and no prior-period comparison.
 */
export const MIN_SAMPLE = 5;
export const RESULTS_TIMEZONE = 'Africa/Cairo';

export interface ResultTile {
  value: number;
  of: number;
  sampleSize: number;
  detail: string;
  /** sampleSize < 5: the number is shown but must not be judged. Seats are exempt. */
  tooFewToJudge: boolean;
}

export function tile(value: number, of: number, sampleSize: number, detail: string, exempt = false): ResultTile {
  return { value, of, sampleSize, detail, tooFewToJudge: exempt ? false : sampleSize < MIN_SAMPLE };
}

/** UTC offset (minutes) of Africa/Cairo at a given instant. */
function cairoOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: RESULTS_TIMEZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute')) - Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes())) / 60_000;
}

/** Instant of 00:00 Cairo on the given calendar day. */
export function cairoMidnight(year: number, month1: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month1 - 1, day));
  const off = cairoOffsetMinutes(new Date(guess.getTime() - 3 * 3_600_000));
  return new Date(guess.getTime() - off * 60_000);
}

export function cairoToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: RESULTS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** month = YYYY-MM (Cairo). Default: the current Cairo month. Returns [from, to) instants and day strings. */
export function monthRange(month: string | undefined, now: Date) {
  const m = month ?? cairoToday(now).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return null;
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const ny = mo === 12 ? y + 1 : y; const nm = mo === 12 ? 1 : mo + 1;
  return {
    month: m,
    from: cairoMidnight(y, mo, 1),
    to: cairoMidnight(ny, nm, 1),
    firstDay: `${m}-01`,
    nextMonthFirstDay: `${ny}-${String(nm).padStart(2, '0')}-01`,
  };
}
