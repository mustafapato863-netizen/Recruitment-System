export interface MonthlyTargetWeek {
  weekStart: string;
  periodKey: string;
  days: number;
  quantity: number;
}
const day = 86400000;
const ymd = (date: Date) => date.toISOString().slice(0, 10);
function isoWeek(date: Date): string {
  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const number = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / day + 1) / 7);
  return `${year}-W${String(number).padStart(2, '0')}`;
}
/** Calendar-day allocation; cumulative rounding preserves the exact monthly integer total. */
export function monthlyTargetWeeks(month: string, quantity: number): MonthlyTargetWeek[] {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647)
    return [];
  const [year, number] = month.split('-').map(Number);
  const start = Date.UTC(year!, number! - 1, 1);
  const end = Date.UTC(year!, number!, 1);
  const days = Math.round((end - start) / day);
  const monday = new Date(start);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const out: MonthlyTargetWeek[] = [];
  for(let cursor = monday.getTime(); cursor < end; cursor += 7 * day) {
    const from = Math.max(0, Math.round((cursor - start) / day));
    const to = Math.min(days, Math.round((cursor + 7 * day - start) / day));
    out.push({ weekStart: ymd(new Date(cursor)), periodKey: isoWeek(new Date(cursor)), days: to - from, quantity: Math.floor(quantity * to / days) - Math.floor(quantity * from / days) });
  }
  return out;
}
