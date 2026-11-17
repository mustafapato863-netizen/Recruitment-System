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

const FUNNEL_RANK: Record<string, number> = {
  Applied: 0,
  Screening: 1,
  Interview: 2,
  Offer: 3,
  'Pre-Hire': 4,
  Joined: 5,
};

export interface TeamFunnelInput {
  stage: string;
  history: string[];
  /** A screening log on this file has a non-empty note. */
  screenNote: boolean;
  /** An offer on this file was sent (sent time, or a non-draft offer). */
  offerSent: boolean;
  joined: boolean;
}

export interface TeamFunnelStep {
  label: 'Applications' | 'Screened' | 'Interviewed' | 'Offered' | 'Joined';
  count: number;
  /** Share of the previous step, rounded. Null on the first step and when the previous count is 0. */
  stepPercent: number | null;
}

function reached(app: TeamFunnelInput, stage: string): boolean {
  const need = FUNNEL_RANK[stage] ?? 99;
  if ((FUNNEL_RANK[app.stage] ?? -1) >= need) return true;
  return app.history.some((item) => (FUNNEL_RANK[item] ?? -1) >= need);
}

/**
 * Direct-report cohort funnel. Each step counts files in the list that reached
 * that stage. The list itself is the cohort (applications applied in the month
 * by the counted recruiters). Step percent is of the previous step.
 */
export function buildTeamFunnel(apps: TeamFunnelInput[]): TeamFunnelStep[] {
  const counts = [
    ['Applications', apps.length],
    ['Screened', apps.filter((app) => app.screenNote || reached(app, 'Screening')).length],
    ['Interviewed', apps.filter((app) => reached(app, 'Interview')).length],
    ['Offered', apps.filter((app) => app.offerSent || reached(app, 'Offer')).length],
    ['Joined', apps.filter((app) => app.joined || reached(app, 'Joined')).length],
  ] as const;
  return counts.map(([label, count], index) => {
    const earlier = counts[index - 1];
    const previous = index === 0 || !earlier ? null : earlier[1];
    const stepPercent = previous === null || previous <= 0 ? null : Math.round((count / previous) * 100);
    return { label, count, stepPercent };
  });
}

export interface JoinedSiteCount {
  siteId: string | null;
  site: string;
  joined: number;
}

/** Top sites by seats joined. Anything after `namedLimit` is summed as Other. */
export function bucketJoinedBySite(rows: JoinedSiteCount[], namedLimit = 3): JoinedSiteCount[] {
  const positive = rows.filter((row) => row.joined > 0 && row.site.trim());
  const sorted = [...positive].sort((a, b) => b.joined - a.joined || a.site.localeCompare(b.site));
  if (sorted.length <= namedLimit) return sorted;
  const rest = sorted.slice(namedLimit).reduce((sum, row) => sum + row.joined, 0);
  return rest > 0 ? [...sorted.slice(0, namedLimit), { siteId: null, site: 'Other', joined: rest }] : sorted.slice(0, namedLimit);
}

/**
 * R03: Parse a date-only (`YYYY-MM-DD`), month (`YYYY-MM`), or full ISO timestamp boundary in Africa/Cairo
 * for half-open `[from, to)` queries.
 * - `start` on `YYYY-MM-DD` -> 00:00 Africa/Cairo on that day.
 * - `end` on `YYYY-MM-DD` -> 00:00 Africa/Cairo on the next calendar day (exclusive upper bound).
 */
export function parseCairoDateBound(value: string, bound: 'start' | 'end'): Date {
  const trimmed = value.trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    const mr = monthRange(trimmed, new Date())!;
    return bound === 'start' ? mr.from : mr.to;
  }
  if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number) as [number, number, number];
    if (bound === 'start') return cairoMidnight(y, m, d);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return cairoMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  }
  return new Date(trimmed);
}

export const TARGET_METRICS = ['screenings_completed', 'interviews_conducted', 'feedback_submitted', 'seats_joined'] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];
export type TargetPeriodType = 'weekly' | 'monthly';

export const TARGET_METRIC_LABEL: Record<TargetMetric, string> = {
  screenings_completed: 'Screenings completed',
  interviews_conducted: 'Interviews conducted',
  feedback_submitted: 'Feedback submitted',
  seats_joined: 'Confirmed joinings',
};

export interface TargetPeriod {
  periodType: TargetPeriodType;
  periodKey: string;
  from: Date;
  to: Date;
  label: string;
}

export interface WeekRange {
  periodKey: string;
  firstDay: string;
  nextWeekFirstDay: string;
  from: Date;
  to: Date;
  label: string;
}

interface Ymd { y: number; m: number; d: number }

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdString(part: Ymd): string {
  return `${part.y}-${pad2(part.m)}-${pad2(part.d)}`;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addCalendarDays(y: number, m: number, d: number, days: number): Ymd {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Monday = 1 … Sunday = 7, on the calendar date (not the instant). */
function weekdayMon1(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

function mondayOnOrBefore(y: number, m: number, d: number): Ymd {
  return addCalendarDays(y, m, d, 1 - weekdayMon1(y, m, d));
}

export function cairoYmd(now: Date): Ymd {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: RESULTS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: n('year'), m: n('month'), d: n('day') };
}

/** ISO week-numbering year and week for a calendar date. */
export function isoWeekOf(y: number, m: number, d: number): { isoYear: number; week: number } {
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { isoYear, week };
}

/** Monday of an ISO week, or null when that week does not exist. */
export function mondayOfIsoWeek(isoYear: number, week: number): Ymd | null {
  if (!Number.isInteger(isoYear) || !Number.isInteger(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7);
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  const check = isoWeekOf(y, m, d);
  if (check.isoYear !== isoYear || check.week !== week) return null;
  return { y, m, d };
}

export function cairoCurrentWeek(now = new Date()): string {
  const part = cairoYmd(now);
  const iso = isoWeekOf(part.y, part.m, part.d);
  return `${iso.isoYear}-W${pad2(iso.week)}`;
}

function weekLabel(firstDay: string): string {
  const [y, m, d] = firstDay.split('-').map(Number) as [number, number, number];
  const formatted = new Intl.DateTimeFormat('en-GB', { timeZone: RESULTS_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(cairoMidnight(y, m, d));
  return `Week of ${formatted}`;
}

function monthLabel(periodKey: string): string {
  return new Date(`${periodKey}-15T12:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function rangeFromMonday(periodKey: string, monday: Ymd): WeekRange {
  const next = addCalendarDays(monday.y, monday.m, monday.d, 7);
  const firstDay = ymdString(monday);
  const nextWeekFirstDay = ymdString(next);
  return {
    periodKey,
    firstDay,
    nextWeekFirstDay,
    from: cairoMidnight(monday.y, monday.m, monday.d),
    to: cairoMidnight(next.y, next.m, next.d),
    label: weekLabel(firstDay),
  };
}

/**
 * Africa/Cairo week. ISO keys (`YYYY-Www`) stay ISO keys. A `YYYY-MM-DD` key is
 * normalized to that week's Monday date. Omitted key = the current Cairo week (`YYYY-Www`).
 * Bounds are Monday 00:00 Cairo inclusive to the next Monday 00:00 exclusive.
 */
export function cairoWeekRange(periodKey?: string, now = new Date()): WeekRange | null {
  const key = periodKey?.trim() || cairoCurrentWeek(now);
  const iso = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(key);
  if (iso) {
    const monday = mondayOfIsoWeek(Number(iso[1]), Number(iso[2]));
    if (!monday) return null;
    return rangeFromMonday(`${iso[1]}-W${iso[2]}`, monday);
  }
  const day = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(key);
  if (!day) return null;
  const y = Number(day[1]);
  const m = Number(day[2]);
  const d = Number(day[3]);
  if (!isValidYmd(y, m, d)) return null;
  const monday = mondayOnOrBefore(y, m, d);
  return rangeFromMonday(ymdString(monday), monday);
}

export function resolveTargetPeriod(periodType: TargetPeriodType, periodKey?: string, now = new Date()): TargetPeriod | null {
  if (periodType === 'monthly') {
    const range = monthRange(periodKey, now);
    if (!range) return null;
    return { periodType, periodKey: range.month, from: range.from, to: range.to, label: monthLabel(range.month) };
  }
  if (periodType === 'weekly') {
    const range = cairoWeekRange(periodKey, now);
    if (!range) return null;
    return { periodType, periodKey: range.periodKey, from: range.from, to: range.to, label: range.label };
  }
  return null;
}

export function cairoDateLabel(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: RESULTS_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(at);
}

export function inHalfOpen(at: Date | null | undefined, from: Date, to: Date): boolean {
  if (!at || Number.isNaN(at.getTime())) return false;
  const time = at.getTime();
  return time >= from.getTime() && time < to.getTime();
}

export function targetProgress(targetQuantity: number, achieved: number): { target: number; achieved: number; remaining: number; progressPercent: number } {
  return {
    target: targetQuantity,
    achieved,
    remaining: Math.max(0, targetQuantity - achieved),
    progressPercent: targetQuantity > 0 ? Math.round((achieved / targetQuantity) * 100) : 0,
  };
}

export interface CountedWork {
  id: string;
  applicationId: string;
  candidateName: string;
  vacancyId: string | null;
  jobTitle: string;
  at: Date;
  status: string;
}

interface PersonName { firstName?: string | null; lastName?: string | null }
interface JobTitle { vacancyCode?: string | null; position?: { title?: string | null } | null }
interface ScreeningCountRow {
  id: string;
  applicationId: string;
  screenerId?: string | null;
  outcome?: string | null;
  screenedAt?: Date | null;
  application?: {
    id?: string;
    vacancyId?: string | null;
    candidate?: PersonName | null;
    vacancy?: (JobTitle & { id?: string; branchId?: string | null }) | null;
  } | null;
}

function personName(candidate?: PersonName | null): string {
  return `${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim() || 'Candidate';
}

function jobTitleOf(vacancy?: JobTitle | null): string {
  return vacancy?.position?.title?.trim() || vacancy?.vacancyCode?.trim() || 'Job';
}

function sameJob(vacancyId: string | null | undefined, applicationVacancyId: string | null | undefined, vacancy?: { id?: string | null } | null): boolean {
  if (!vacancyId) return true;
  return applicationVacancyId === vacancyId || vacancy?.id === vacancyId;
}

function sameBranch(branchId: string | null | undefined, vacancy?: { branchId?: string | null } | null): boolean {
  if (!branchId) return true;
  return vacancy?.branchId === branchId;
}

/** Earliest finalized screening per application. Retries by the same screener do not add another record. */
export function countScreenings(
  rows: ScreeningCountRow[],
  employeeId: string,
  from: Date,
  to: Date,
  vacancyId?: string | null,
  branchId?: string | null,
): CountedWork[] {
  const sorted = rows
    .filter((row) => row.screenerId === employeeId)
    .filter((row) => row.outcome !== '__discarded__')
    .filter((row) => inHalfOpen(row.screenedAt, from, to))
    .filter((row) => sameJob(vacancyId, row.application?.vacancyId, row.application?.vacancy))
    .filter((row) => sameBranch(branchId, row.application?.vacancy))
    .sort((a, b) => (a.screenedAt?.getTime() ?? 0) - (b.screenedAt?.getTime() ?? 0));
  const seen = new Set<string>();
  const kept: CountedWork[] = [];
  for (const row of sorted) {
    if (!row.applicationId || seen.has(row.applicationId)) continue;
    seen.add(row.applicationId);
    kept.push({
      id: row.id,
      applicationId: row.applicationId,
      candidateName: personName(row.application?.candidate),
      vacancyId: row.application?.vacancy?.id ?? row.application?.vacancyId ?? null,
      jobTitle: jobTitleOf(row.application?.vacancy),
      at: row.screenedAt!,
      status: row.outcome?.trim() || 'Passed',
    });
  }
  return kept;
}

interface ScorecardStamp { interviewerId?: string | null; status?: string | null; submittedAt?: Date | null; revision?: number | null }
interface InterviewCountRow {
  id: string;
  status?: string | null;
  interviewType?: string | null;
  applicationId?: string | null;
  completedAt?: Date | null;
  scheduledEnd?: Date | null;
  attendees?: Array<{ userId?: string | null; response?: string | null }>;
  scorecards?: ScorecardStamp[];
  application?: ScreeningCountRow['application'];
}

/** completedAt, else the earliest submitted scorecard, else the scheduled end. */
export function interviewCountedAt(interview: { completedAt?: Date | null; scheduledEnd?: Date | null; scorecards?: ScorecardStamp[] }): Date | null {
  if (interview.completedAt) return interview.completedAt;
  const submitted = (interview.scorecards ?? [])
    .filter((card) => card.status === 'Submitted' && card.submittedAt)
    .sort((a, b) => (a.revision ?? 1) - (b.revision ?? 1) || a.submittedAt!.getTime() - b.submittedAt!.getTime());
  return submitted[0]?.submittedAt ?? interview.scheduledEnd ?? null;
}

function participated(interview: InterviewCountRow, employeeId: string): boolean {
  if (interview.status !== 'Completed') return false;
  const attendee = (interview.attendees ?? []).find((row) => row.userId === employeeId);
  if (!attendee || attendee.response === 'Declined') return false;
  const submitted = (interview.scorecards ?? []).some((card) => card.interviewerId === employeeId && card.status === 'Submitted');
  const confirmed = attendee.response !== 'Declined' && attendee.response !== 'Pending';
  return submitted || confirmed || interview.status === 'Completed';
}

/** One conducted interview per application and interview type. Reschedules and non-completed statuses do not count. */
export function countInterviews(
  rows: InterviewCountRow[],
  employeeId: string,
  from: Date,
  to: Date,
  vacancyId?: string | null,
  branchId?: string | null,
): CountedWork[] {
  const prepared = rows
    .filter((row) => participated(row, employeeId))
    .filter((row) => sameJob(vacancyId, row.application?.vacancyId, row.application?.vacancy))
    .map((row) => ({ row, at: interviewCountedAt(row) }))
    .filter((item) => inHalfOpen(item.at, from, to))
    .filter((item) => sameBranch(branchId, item.row.application?.vacancy))
    .sort((a, b) => a.at!.getTime() - b.at!.getTime());
  const seen = new Set<string>();
  const kept: CountedWork[] = [];
  for (const item of prepared) {
    const applicationId = item.row.application?.id ?? item.row.applicationId ?? '';
    if (!applicationId) continue;
    const key = `${applicationId}:${item.row.interviewType ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({
      id: item.row.id,
      applicationId,
      candidateName: personName(item.row.application?.candidate),
      vacancyId: item.row.application?.vacancy?.id ?? item.row.application?.vacancyId ?? null,
      jobTitle: jobTitleOf(item.row.application?.vacancy),
      at: item.at!,
      status: 'Completed',
    });
  }
  return kept;
}

interface FeedbackCountRow {
  id: string;
  interviewId: string;
  interviewerId?: string | null;
  status?: string | null;
  revision?: number | null;
  submittedAt?: Date | null;
  interview?: {
    id?: string;
    status?: string | null;
    application?: ScreeningCountRow['application'];
  } | null;
}

/** One submitted feedback per interview. The first submitted revision owns the period; later revisions do not count. */
export function countFeedback(
  rows: FeedbackCountRow[],
  employeeId: string,
  from: Date,
  to: Date,
  vacancyId?: string | null,
  branchId?: string | null,
): CountedWork[] {
  const eligible = rows.filter((row) => row.interviewerId === employeeId && row.status === 'Submitted' && row.submittedAt);
  const byInterview = new Map<string, FeedbackCountRow>();
  const ordered = [...eligible].sort((a, b) => (a.revision ?? 1) - (b.revision ?? 1) || a.submittedAt!.getTime() - b.submittedAt!.getTime());
  for (const row of ordered) {
    if (!byInterview.has(row.interviewId)) byInterview.set(row.interviewId, row);
  }
  const kept: CountedWork[] = [];
  for (const row of byInterview.values()) {
    const interviewStatus = row.interview?.status;
    if (interviewStatus === 'Cancelled' || interviewStatus === 'No-show') continue;
    if (!sameJob(vacancyId, row.interview?.application?.vacancyId, row.interview?.application?.vacancy)) continue;
    if (!sameBranch(branchId, row.interview?.application?.vacancy)) continue;
    if (!inHalfOpen(row.submittedAt, from, to)) continue;
    const applicationId = row.interview?.application?.id ?? '';
    kept.push({
      id: row.id,
      applicationId,
      candidateName: personName(row.interview?.application?.candidate),
      vacancyId: row.interview?.application?.vacancy?.id ?? row.interview?.application?.vacancyId ?? null,
      jobTitle: jobTitleOf(row.interview?.application?.vacancy),
      at: row.submittedAt!,
      status: 'Submitted',
    });
  }
  kept.sort((a, b) => a.at.getTime() - b.at.getTime());
  return kept;
}

interface JoiningCountRow {
  id: string;
  applicationId: string;
  status?: string | null;
  actualJoiningDate?: Date | null;
  application?: {
    id?: string;
    vacancyId?: string | null;
    primaryRecruiterId?: string | null;
    candidate?: PersonName | null;
    vacancy?: (JobTitle & { id?: string; branchId?: string | null; primaryRecruiterId?: string | null }) | null;
  } | null;
}

/** Confirmed joinings in the period, on files the employee owns or jobs they own. One row per application. */
export function countJoinings(
  rows: JoiningCountRow[],
  employeeId: string,
  from: Date,
  to: Date,
  vacancyId?: string | null,
  branchId?: string | null,
): CountedWork[] {
  const sorted = rows
    .filter((row) => row.status === 'Joined')
    .filter((row) => inHalfOpen(row.actualJoiningDate, from, to))
    .filter((row) => row.application?.primaryRecruiterId === employeeId || row.application?.vacancy?.primaryRecruiterId === employeeId)
    .filter((row) => sameJob(vacancyId, row.application?.vacancyId, row.application?.vacancy))
    .filter((row) => sameBranch(branchId, row.application?.vacancy))
    .sort((a, b) => (a.actualJoiningDate?.getTime() ?? 0) - (b.actualJoiningDate?.getTime() ?? 0));
  const seen = new Set<string>();
  const kept: CountedWork[] = [];
  for (const row of sorted) {
    if (seen.has(row.applicationId)) continue;
    seen.add(row.applicationId);
    kept.push({
      id: row.id,
      applicationId: row.applicationId,
      candidateName: personName(row.application?.candidate),
      vacancyId: row.application?.vacancy?.id ?? row.application?.vacancyId ?? null,
      jobTitle: jobTitleOf(row.application?.vacancy),
      at: row.actualJoiningDate!,
      status: 'Joined',
    });
  }
  return kept;
}
