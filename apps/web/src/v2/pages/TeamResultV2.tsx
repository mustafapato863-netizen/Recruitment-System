import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import { Armchair, ChevronLeft, ChevronRight, Clock, Download, Info, Percent, Printer, RotateCw, TrendingDown, TrendingUp } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SelectV2, SkeletonV2, StatusChip, TabsV2 } from '../../components/v2';
import {
  cairoMonth,
  cairoWeek,
  fetchTargetsForPeriod,
  MIN_SAMPLE,
  monthLabel,
  tooFew,
  weekChoices,
  type EmployeeTargetItem,
  type ResultDetailItem,
  type ResultsResponse,
  type ResultTile,
  type TargetPeriodType,
  type TileKey,
} from '../api/myResult';
import { mergeTargets, TeamTargetsSection } from './ManageTargetsDrawer';
import { TeamActivityPanel } from './TeamActivityPanel';
import {
  fetchTeamResult,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
  percentDelta,
  percentOf,
  rowTooFew,
  sampleText,
  shiftMonth,
  TILE_KEYS,
  trailingMonths,
  type TeamResult,
  type TeamResultLoad,
  type TeamRow,
} from '../api/teamResult';
import { returnFromLocation } from '../returnTarget';
import './jobs.css';
import './team.css';
import './team-result.css';

const COLS: Array<{ key: TileKey; label: string }> = [
  { key: 'seats', label: 'Confirmed joinings' },
  { key: 'overdueFollowUps', label: 'Overdue follow-ups' },
  { key: 'screensReachedInterview', label: 'Screen → Interview' },
  { key: 'offersAccepted', label: 'Offers accepted' },
];

function measureLines(key: TileKey, tile: ResultTile): { primary: string; secondary: string; few: boolean } {
  const few = tooFew(key, tile);
  if (key === 'seats') {
    const rate = percentOf(tile.value, tile.of);
    return {
      primary: `${tile.value} of ${tile.of}`,
      secondary: rate === null ? 'Seats are not judged on sample size' : `${tile.value} joined (${formatPercent(rate)})`,
      few: false,
    };
  }
  if (key === 'overdueFollowUps') {
    return { primary: String(tile.value), secondary: tile.value === 0 ? 'No overdue follow-ups' : `${tile.value} overdue`, few };
  }
  const primary = `${tile.value} of ${tile.of}`;
  if (few || tile.of <= 0) return { primary, secondary: few ? 'Too few to judge' : '0', few };
  const rate = formatPercent(percentOf(tile.value, tile.of) ?? 0);
  return { primary, secondary: key === 'screensReachedInterview' ? `${rate} conversion` : `${rate} accepted`, few };
}

function judgedRate(key: 'screensReachedInterview' | 'offersAccepted', tile: ResultTile): number | null {
  if (tooFew(key, tile)) return null;
  return percentOf(tile.value, tile.of);
}

const csvCell = (value: string) => {
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) || text !== value ? `"${text.replace(/"/g, '""')}"` : text;
};

function teamResultCsv(data: TeamResult, periodLabel: string, siteLabel: string): string {
  const head = ['Recruiter', ...COLS.map((col) => col.label), 'Sample judgement'];
  const lines = data.rows.map((row) => {
    const names = data.people.map((person) => person.name).join(', ');
    const recruiter = row.person?.name ?? (names ? `Your team: ${names}` : 'Your team');
    const sample = `${rowTooFew(row.tiles) ? 'Too few to judge' : 'Enough to judge'} (${sampleText(row.tiles)})`;
    return [recruiter, ...COLS.map((col) => {
      const line = measureLines(col.key, row.tiles[col.key]);
      return `${line.primary} ${line.secondary}`;
    }), sample].map(csvCell).join(',');
  });
  const preface = [
    ['Period', periodLabel].map(csvCell).join(','),
    ['Site', siteLabel].map(csvCell).join(','),
    ['Team', 'Direct reports'].map(csvCell).join(','),
  ];
  return [...preface, '', head.map(csvCell).join(','), ...lines].join('\r\n');
}

function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const MEASURE_LABEL: Record<TileKey, string> = {
  seats: 'Confirmed joinings',
  overdueFollowUps: 'Overdue follow-ups',
  screensReachedInterview: 'Screen → Interview',
  offersAccepted: 'Offers accepted',
};
type DrillTab = 'events' | 'definitions' | 'workload';
type MeasureFilter = 'all' | TileKey;
interface EligibleEvent {
  id: string;
  date: string | null;
  job: string;
  candidate: string;
  measure: TileKey;
  dateLabel: string;
  outcome: string;
}

function formatEventDate(value: string | null): string {
  if (!value) return '—';
  const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(dt);
}

function eligibleEvents(details: ResultsResponse['details'] | undefined): EligibleEvent[] {
  if (!details) return [];
  const out: EligibleEvent[] = [];
  for (const key of TILE_KEYS) {
    const items = details[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item.id !== 'string') continue;
      const row = item as ResultDetailItem;
      out.push({
        id: `${key}-${row.id}`,
        date: row.date ?? null,
        job: row.jobTitle || 'Job',
        candidate: row.candidateName || 'Candidate',
        measure: key,
        dateLabel: row.dateLabel || MEASURE_LABEL[key],
        outcome: row.status || '—',
      });
    }
  }
  return out.sort((a, b) => {
    if (a.date === b.date) return a.candidate.localeCompare(b.candidate);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
}

function monthChoices(selected: string): string[] {
  const current = cairoMonth();
  const options: string[] = [];
  let cursor = current;
  for (let i = 0; i < 18; i += 1) {
    options.push(cursor);
    cursor = shiftMonth(cursor, -1);
  }
  if (!options.includes(selected)) options.unshift(selected);
  return options;
}

function MonthSwitcher({ month, isCurrent, onMonth }: { month: string; isCurrent: boolean; onMonth: (month: string) => void }) {
  return (
    <div className="rf2-segmented" role="group" aria-label="Month switcher">
      <ButtonV2 kind="secondary" size="sm" icon={<ChevronLeft />} onClick={() => onMonth(shiftMonth(month, -1))} aria-label="Previous month" />
      <SelectV2 label="Period" fieldClassName="rf2-sr-label rf2-tres__monthselect" value={month} onChange={(event) => onMonth(event.target.value)}>
        {monthChoices(month).map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}
      </SelectV2>
      <ButtonV2 kind="secondary" size="sm" icon={<ChevronRight />} onClick={() => onMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label="Next month" />
    </div>
  );
}

function judgeLine(key: TileKey, tile: ResultTile): string {
  return tooFew(key, tile) ? 'Too few to judge' : 'Measured';
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener?.('change', apply);
    return () => query.removeEventListener?.('change', apply);
  }, []);
  return reduced;
}

function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="rf2-tres__tip">
      <button type="button" className="rf2-tres__tip-btn" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen((value) => !value)}>
        <Info aria-hidden="true" />
      </button>
      <p id={id} className={open ? 'rf2-tres__tip-pop' : 'rf2-sr-only'}>{children}</p>
    </span>
  );
}

function DeltaChip({ text, amount, downIsGood = false }: { text: string; amount: number; downIsGood?: boolean }) {
  const tone = amount === 0 ? 'flat' : ((downIsGood ? amount < 0 : amount > 0) ? 'good' : 'bad');
  const Icon = amount < 0 ? TrendingDown : TrendingUp;
  return (
    <span className="rf2-tres__delta" data-tone={tone}>
      <Icon aria-hidden="true" />
      <span className="rf2-sr-only">versus previous month: </span>
      {text}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 88;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="rf2-tres__spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

type HistoryEntry = { month: string; load: TeamResultLoad | { kind: 'error'; message: string } };

function readyHistory(history: HistoryEntry[]): Array<{ month: string; data: TeamResult }> {
  return history.flatMap((entry) => (entry.load.kind === 'ready' ? [{ month: entry.month, data: entry.load.data }] : []));
}

function completeSeries(history: HistoryEntry[], pick: (data: TeamResult) => number | null): number[] | null {
  if (history.length < 2 || history.some((entry) => entry.load.kind !== 'ready')) return null;
  const points = [...history].sort((a, b) => a.month.localeCompare(b.month)).map((entry) => pick((entry.load as { kind: 'ready'; data: TeamResult }).data));
  if (points.some((value) => value === null)) return null;
  return points as number[];
}

function weeklyOverdue(rows: TeamRow[]): Array<{ label: string; value: number }> | null {
  if (!rows.every((row) => Array.isArray(row.details?.overdueFollowUps))) return null;
  const buckets = new Map<string, number>();
  for (const row of rows) {
    for (const item of row.details?.overdueFollowUps ?? []) {
      if (!item?.counted || typeof item.date !== 'string') continue;
      const day = item.date.slice(0, 10);
      const stamp = new Date(`${day}T12:00:00Z`);
      if (Number.isNaN(stamp.getTime())) continue;
      stamp.setUTCDate(stamp.getUTCDate() - ((stamp.getUTCDay() + 6) % 7));
      const key = stamp.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  if (buckets.size === 0) return null;
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)),
    value,
  }));
}

function monthlyOverdue(history: HistoryEntry[]): Array<{ label: string; value: number }> | null {
  const ready = readyHistory(history);
  if (ready.length < 2) return null;
  return ready.sort((a, b) => a.month.localeCompare(b.month)).map((entry) => ({
    label: new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${entry.month}-01T12:00:00Z`)),
    value: entry.data.tiles.overdueFollowUps.value,
  }));
}

/** M12 — one direct report’s monthly measures, the events behind them, and the path back to operational workload. */
function RecruiterDrill({ data, recruiterId, month, periodType, periodLabel, isCurrent, onMonth, onBack }: {
  data: TeamResult; recruiterId: string; month: string; periodType: TargetPeriodType; periodLabel: string; isCurrent: boolean; onMonth: (month: string) => void; onBack: () => void;
}) {
  const row: TeamRow | null = data.rows.find((item) => item.person?.id === recruiterId) ?? null;
  const person = row?.person ?? data.people.find((item) => item.id === recruiterId) ?? null;
  const [mtab, setMtab] = useState<DrillTab>('events');
  const [measure, setMeasure] = useState<MeasureFilter>('all');
  const [job, setJob] = useState('');
  useEffect(() => {
    setMtab('events');
    setMeasure('all');
    setJob('');
  }, [recruiterId, month]);

  if (!person) {
    return (
      <section className="rf2-panel rf2-tres__drill" role="alert">
        <h1 className="rf2-jobs__title">Team results</h1>
        <p>This person is not one of your direct reports in Team result.</p>
        <ButtonV2 kind="secondary" onClick={onBack}>Back to Team result</ButtonV2>
      </section>
    );
  }

  const tiles = row?.tiles ?? data.tiles;
  const events = eligibleEvents(row?.details ?? data.details);
  const jobs = [...new Set(events.map((event) => event.job))].sort((a, b) => a.localeCompare(b));
  const filtered = measure !== 'all' || job !== '';
  const visible = events.filter((event) => (measure === 'all' || event.measure === measure) && (!job || event.job === job));
  const few = rowTooFew(tiles);

  return (
    <section className="rf2-tres__drill" aria-label={`Recruiter performance: ${person.name}`}>
      <ButtonV2 kind="secondary" size="sm" icon={<ChevronLeft />} onClick={onBack}>Back to Team result</ButtonV2>
      <div className="rf2-row-between">
        <div className="rf2-tres__identity">
          <h1 className="rf2-jobs__title">{person.name} - {periodLabel}</h1>
          <StatusChip tone="info" label={person.role || 'Recruiter'} />
        </div>
        <div className="rf2-tres__toolbar">
          {periodType === 'monthly' ? <MonthSwitcher month={month} isCurrent={isCurrent} onMonth={onMonth} /> : null}
          <ButtonV2 kind="secondary" size="sm" icon={<Printer />} onClick={() => window.print()}>Print summary</ButtonV2>
        </div>
      </div>
      {!row ? <p className="rf2-inline-note"><Info aria-hidden="true" /> These figures are the team total for this period. A separate row for this recruiter was not returned.</p> : null}
      {few ? (
        <p className="rf2-inline-note" role="status">
          <Clock aria-hidden="true" /> Too few to judge: {sampleText(tiles)}. Fewer than {MIN_SAMPLE} eligible cases shows raw counts only.
        </p>
      ) : null}
      <ul className="rf2-team__kpis" aria-label="Recruiter delivery measures">
        <li>
          <span className="rf2-team__kpi-k">Confirmed joinings</span>
          <span className="rf2-team__kpi-v">{tiles.seats.value} of {tiles.seats.of}</span>
          <span className="rf2-team__kpi-n">{tiles.seats.detail || 'Seats are not judged on sample size'}</span>
        </li>
        <li>
          <span className="rf2-team__kpi-k">Overdue follow-ups</span>
          <span className="rf2-team__kpi-v">{tiles.overdueFollowUps.value} of {tiles.overdueFollowUps.of} due</span>
          <span className="rf2-team__kpi-n">{judgeLine('overdueFollowUps', tiles.overdueFollowUps)}</span>
        </li>
        <li>
          <span className="rf2-team__kpi-k">Screen → Interview</span>
          <span className="rf2-team__kpi-v">{tiles.screensReachedInterview.value} of {tiles.screensReachedInterview.of} eligible screens with a note</span>
          <span className="rf2-team__kpi-n">{judgeLine('screensReachedInterview', tiles.screensReachedInterview)}</span>
        </li>
        <li>
          <span className="rf2-team__kpi-k">Offers accepted</span>
          <span className="rf2-team__kpi-v">{tiles.offersAccepted.value} of {tiles.offersAccepted.of} sent</span>
          <span className="rf2-team__kpi-n">{judgeLine('offersAccepted', tiles.offersAccepted)}</span>
        </li>
      </ul>
      <TabsV2
        ariaLabel="Recruiter performance"
        activeKey={mtab}
        onChange={(key) => { if (key === 'events' || key === 'definitions' || key === 'workload') setMtab(key); }}
        items={[
          { key: 'events', label: 'Eligible events', controls: 'tres-drill-panel' },
          { key: 'definitions', label: 'Definitions', controls: 'tres-drill-panel' },
          { key: 'workload', label: 'Recruiter workload link', controls: 'tres-drill-panel' },
        ]}
      />
      <div role="tabpanel" id="tres-drill-panel" aria-labelledby={`rf2-tab-${mtab}`}>
        {mtab === 'events' ? (
          <div className="rf2-tres__events">
            <div className="rf2-tres__filters">
              <SelectV2 label="Eligible event" value={measure} onChange={(event) => setMeasure(event.target.value as MeasureFilter)}>
                <option value="all">All measures</option>
                {TILE_KEYS.map((key) => <option key={key} value={key}>{MEASURE_LABEL[key]}</option>)}
              </SelectV2>
              <SelectV2 label="Job" value={job} onChange={(event) => setJob(event.target.value)}>
                <option value="">All jobs</option>
                {jobs.map((title) => <option key={title} value={title}>{title}</option>)}
              </SelectV2>
              {filtered ? <StatusChip tone="neutral" label="Filtered view" /> : null}
            </div>
            {visible.length === 0 ? (
              <p className="rf2-jtable__sub">{events.length === 0 ? 'No eligible events in this period.' : 'No eligible events match this filter.'}</p>
            ) : (
              <div className="rf2-jscroll" tabIndex={0} role="region" aria-label="Eligible events">
                <table className="rf2-jtable" aria-label="Eligible events">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Job</th>
                      <th scope="col">Candidate</th>
                      <th scope="col">Eligible event</th>
                      <th scope="col">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((event) => (
                      <tr key={event.id}>
                        <td>{formatEventDate(event.date)}</td>
                        <td>{event.job}</td>
                        <td>{event.candidate}</td>
                        <td>
                          <p className="rf2-jtable__name">{MEASURE_LABEL[event.measure]}</p>
                          {event.dateLabel ? <p className="rf2-jtable__sub">{event.dateLabel}</p> : null}
                        </td>
                        <td>{event.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
        {mtab === 'definitions' ? (
          <div className="rf2-tres__events">
            <h2 className="rf2-team__h">Definitions</h2>
            <p>Counted inside the Cairo calendar month from {data.range.from} to {data.range.to}.</p>
            <dl className="rf2-tres__defs">
              <dt>Confirmed joinings</dt>
              <dd>People who joined in the month, over approved seats on the jobs in scope. A join counts when the actual joining date falls in the month.</dd>
              <dt>Overdue follow-ups</dt>
              <dd>Follow-ups due in the month that were not acted on by their date, over follow-ups due.</dd>
              <dt>Screen → Interview</dt>
              <dd>Screens with a note that reached Interview, over eligible screens with a note.</dd>
              <dt>Offers accepted</dt>
              <dd>Accepted offers, over offers sent in the selected period.</dd>
            </dl>
            <h3 className="rf2-field__label">Exclusions</h3>
            <ul>
              <li>Screens without a note are excluded.</li>
              <li>Offers are counted by sent date in the month.</li>
              <li>Joins are counted by actual joining date in the month.</li>
            </ul>
            <p>Measures with fewer than 5 eligible cases show Too few to judge and raw counts only. Calls, messages, and CV views are never scored.</p>
          </div>
        ) : null}
        {mtab === 'workload' ? (
          <div className="rf2-tres__events">
            <h2 className="rf2-team__h">Recruiter workload</h2>
            <p>Operational workload is separate from these monthly delivery measures. Open files, follow-ups on the desk, and reassignment stay in Team work and are not turned into a score.</p>
            <Link className="rf2-btn rf2-btn--secondary" to={`/my-work?recruiter=${encodeURIComponent(person.id)}`}>Open operational workload in Team work</Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FunnelPanel({ data, month }: { data: TeamResult; month: string }) {
  if (!data.funnel) {
    return (
      <section className="rf2-tres__card" aria-labelledby="tres-funnel">
        <h3 id="tres-funnel" className="rf2-tres__card-title">Hiring funnel</h3>
        <p className="rf2-tres__empty">Not available yet. The direct-report hiring funnel is not in this response.</p>
      </section>
    );
  }
  const steps = data.funnel;
  const applications = steps[0]?.count ?? 0;
  const joined = steps.find((step) => step.label === 'Joined')?.count ?? 0;
  const empty = steps.every((step) => step.count === 0);
  const max = Math.max(...steps.map((step) => step.count), 1);
  const conversion = applications > 0 ? (joined / applications) * 100 : null;
  return (
    <section className="rf2-tres__card" aria-labelledby="tres-funnel">
      <div className="rf2-tres__card-head">
        <h3 id="tres-funnel" className="rf2-tres__card-title">Hiring funnel</h3>
        <InfoTip label="About the hiring funnel">
          Applications whose applied date falls in the selected Cairo period and whose primary recruiter is one of your direct reports. The same site and job filters apply. Conversion is joined divided by applications.
        </InfoTip>
        {conversion !== null ? <span className="rf2-tres__chip">Conversion: {formatPercent(conversion)}</span> : null}
      </div>
      {empty ? <p className="rf2-tres__empty">No applications in {month}.</p> : (
        <ul className="rf2-tres__bars" aria-label="Hiring funnel counts">
          {steps.map((step) => (
            <li key={step.label} className="rf2-tres__bar">
              <span className="rf2-tres__bar-name">{step.label}</span>
              <span className="rf2-tres__bar-track" aria-hidden="true"><span className="rf2-tres__bar-fill" style={{ width: `${(step.count / max) * 100}%` }} /></span>
              <span className="rf2-tres__bar-value">{step.count}{step.stepPercent !== null ? ` (${step.stepPercent}%)` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OverdueHistorySection({
  data,
  history,
  month,
  periodLabel,
  previous,
}: {
  data: TeamResult;
  history: HistoryEntry[];
  month: string;
  periodLabel: string;
  previous: TeamResult | null;
}) {
  const reduced = useReducedMotion();
  const weekly = weeklyOverdue(data.rows);
  const monthly = weekly ? null : monthlyOverdue(history);
  const points = weekly ?? monthly;
  const hasMeaningfulTrend = points !== null && points.some((point) => point.value > 0);
  const current = data.tiles.overdueFollowUps.value;
  const previousVal = previous?.tiles.overdueFollowUps.value ?? 0;
  const compare = previous && previousVal > 0 ? percentDelta(current, previousVal) : null;

  return (
    <details className="rf2-tres__method rf2-tres__trend-details">
      <summary>Overdue follow-ups history</summary>
      {!hasMeaningfulTrend && current === 0 ? (
        <p className="rf2-tres__empty">No overdue follow-ups in {periodLabel}.</p>
      ) : (
        <div className="rf2-tres__trend-body">
          <div className="rf2-tres__card-head">
            <p className="rf2-tres__series">
              {weekly
                ? 'Overdue follow-ups grouped by week within the selected period.'
                : history.length > 0 ? 'Monthly overdue follow-up totals across loaded months.' : 'Overdue follow-ups in the selected period.'}
            </p>
            {compare !== null && previous ? (
              <span className="rf2-tres__chip">
                <span className="rf2-sr-only">versus previous month: </span>
                vs {monthLabel(shiftMonth(month, -1))} ({previous.tiles.overdueFollowUps.value} → {current})
              </span>
            ) : null}
          </div>
          {hasMeaningfulTrend && points ? (
            <>
              <div className="rf2-tres__plot" aria-hidden="true">
                <AreaChart width={520} height={160} data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--rf2-ink-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={28} tick={{ fill: 'var(--rf2-ink-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="value" stroke="var(--rf2-danger)" fill="var(--rf2-danger-tint)" isAnimationActive={!reduced} />
                </AreaChart>
              </div>
              <p className="rf2-tres__series">{points.map((point) => `${point.label} ${point.value}`).join(' · ')}</p>
              <table className="rf2-sr-only">
                <caption>Overdue follow-ups trend</caption>
                <thead><tr><th scope="col">Period</th><th scope="col">Overdue follow-ups</th></tr></thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.label}><th scope="row">{point.label}</th><td>{point.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="rf2-tres__series">{current} overdue follow-ups in {periodLabel}.</p>
          )}
        </div>
      )}
    </details>
  );
}

/** M4 Team results (Manager): in-page target management and team delivery results for direct reports. Alphabetical, not ranked. */
export function TeamResultV2() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const periodType: TargetPeriodType = params.get('period') === 'weekly' ? 'weekly' : 'monthly';
  const rawMonth = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : cairoMonth();
  const month = rawMonth > cairoMonth() ? cairoMonth() : rawMonth;
  const week = /^\d{4}-W\d{2}$/.test(params.get('week') ?? '') ? params.get('week')! : cairoWeek();
  const site = params.get('site') ?? '';
  const job = params.get('job') ?? '';
  const recruiterId = params.get('recruiter');

  const [state, setState] = useState<{ kind: 'loading' } | TeamResultLoad | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [localTargets, setLocalTargets] = useState<EmployeeTargetItem[]>([]);
  const [reloadedTargets, setReloadedTargets] = useState<EmployeeTargetItem[] | null>(null);
  const [monthlyTargetRetryError, setMonthlyTargetRetryError] = useState<string | null>(null);
  const [knownJobs, setKnownJobs] = useState<Array<{ id: string; title: string }>>([]);
  const targetRequestId = useRef(0);

  useEffect(() => {
    if (rawMonth <= cairoMonth()) return;
    const next = new URLSearchParams(params);
    next.set('month', cairoMonth());
    setParams(next, { replace: true });
  }, [rawMonth, params, setParams]);

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    setHistory([]);
    const months = periodType === 'monthly' ? trailingMonths(month, 6, cairoMonth()) : [month];
    Promise.all(months.map(async (item) => {
      try {
        return { month: item, load: await fetchTeamResult(item, job || null, site || null, item === month ? { type: periodType, key: periodType === 'weekly' ? week : month } : undefined) };
      } catch (error: unknown) {
        const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Something went wrong.';
        return { month: item, load: { kind: 'error' as const, message } };
      }
    })).then((entries) => {
      if (!live) return;
      setHistory(periodType === 'monthly' ? entries : []);
      const current = entries.find((entry) => entry.month === month)?.load;
      if (!current || current.kind === 'error') {
        setState({ kind: 'error', message: current && current.kind === 'error' ? current.message : 'Something went wrong.' });
      } else {
        setState(current);
        if (current.kind === 'ready' && current.data.jobOptions) {
          setKnownJobs((prev) => {
            const map = new Map(prev.map((j) => [j.id, j.title]));
            for (const j of current.data.jobOptions ?? []) map.set(j.id, j.title);
            return [...map.entries()].map(([id, title]) => ({ id, title }));
          });
        }
      }
    });
    return () => { live = false; };
  }, [month, week, periodType, site, job, attempt]);

  useEffect(() => {
    targetRequestId.current += 1;
    setReloadedTargets(null);
    setMonthlyTargetRetryError(null);
    return () => { targetRequestId.current += 1; };
  }, [month, week, periodType, site, job, attempt]);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };

  const setPeriodType = (nextType: TargetPeriodType) => {
    if (nextType === 'weekly') {
      updateParams({ period: 'weekly', week });
    } else {
      updateParams({ period: null, week: null });
    }
  };

  const setMonth = (value: string) => {
    const clamped = value > cairoMonth() ? cairoMonth() : value;
    updateParams({ month: clamped });
  };

  const setWeek = (value: string) => {
    updateParams({ week: value });
  };

  const setSite = (value: string) => {
    updateParams({ site: value || null });
  };

  const setJob = (value: string) => {
    updateParams({ job: value || null });
  };

  const setRecruiter = (id: string | null) => {
    updateParams({ recruiter: id });
  };

  const expectedPeriodKey = periodType === 'weekly' ? week : month;
  const data = state.kind === 'ready' && (state.data.periodType
    ? state.data.periodType === periodType && state.data.periodKey === expectedPeriodKey
    : periodType === 'monthly') ? state.data : null;
  const isCurrent = month >= cairoMonth();
  const canExport = !!data && data.rows.length > 0;
  const showDrill = Boolean(data && recruiterId);
  const previous = history.find((entry) => entry.month === shiftMonth(month, -1) && entry.load.kind === 'ready');
  const previousData = previous && previous.load.kind === 'ready' ? previous.load.data : null;

  const siteOptions = data?.sites ?? [];
  const siteKnown = !site || siteOptions.some((item) => item.id === site);
  const siteLabel = !site ? 'All sites' : (siteOptions.find((item) => item.id === site)?.name ?? 'Selected site');

  const rawServerTargets = useMemo(() => data && Array.isArray(data.targets) ? data.targets : [], [data]);
  const serverTargetsExplicitlyUnavailable = Boolean(data && 'targets' in data && (data as { targets?: unknown }).targets === null);

  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of knownJobs) map.set(item.id, item.title);
    for (const item of data?.jobOptions ?? []) map.set(item.id, item.title);
    for (const t of rawServerTargets) {
      if (t.vacancyId && t.jobTitle) map.set(t.vacancyId, t.jobTitle);
    }
    for (const t of localTargets) {
      if (t.vacancyId && t.jobTitle) map.set(t.vacancyId, t.jobTitle);
    }
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [knownJobs, data?.jobOptions, rawServerTargets, localTargets]);

  const jobKnown = !job || jobOptions.some((item) => item.id === job);
  const jobScopeLabel = !job ? 'All jobs' : (jobOptions.find((item) => item.id === job)?.title ?? 'Selected job');

  const weeklyChoices = useMemo(() => {
    const choices = weekChoices();
    if (week && !choices.some((item) => item.value === week)) {
      return [{ value: week, label: week }, ...choices];
    }
    return choices;
  }, [week]);

  const periodKey = periodType === 'weekly' ? week : month;
  const periodDisplayLabel = data?.periodLabel ?? (periodType === 'weekly'
    ? (weeklyChoices.find((item) => item.value === week)?.label ?? week)
    : monthLabel(month));

  const authorizedPeople = useMemo(() => [...(data?.people ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data?.people]);

  const targetsState = useMemo(() => {
    if (monthlyTargetRetryError) {
      return { kind: 'error' as const, message: monthlyTargetRetryError };
    }
    if (serverTargetsExplicitlyUnavailable && !reloadedTargets) {
      return { kind: 'error' as const, message: 'Actual target results could not be loaded for this period.' };
    }
    const base = reloadedTargets ?? rawServerTargets;
    return {
      kind: 'ready' as const,
      targets: mergeTargets(base, localTargets.filter((item) => (!item.periodType || item.periodType === periodType) && (!item.periodKey || item.periodKey === periodKey))),
    };
  }, [periodType, periodKey, reloadedTargets, localTargets, monthlyTargetRetryError, serverTargetsExplicitlyUnavailable, rawServerTargets]);

  const handleRetryTargets = () => {
    const requestId = ++targetRequestId.current;
    setMonthlyTargetRetryError(null);
    fetchTargetsForPeriod({
      scope: 'team',
      periodType,
      periodKey,
      ...(job ? { vacancyId: job } : {}),
      ...(site ? { branchId: site } : {}),
    })
      .then((result) => {
        if (requestId !== targetRequestId.current) return;
        setReloadedTargets(result.targets);
      })
      .catch((error: unknown) => {
        if (requestId !== targetRequestId.current) return;
        const message = error instanceof Error && error.message ? error.message : 'Could not reload targets.';
        setMonthlyTargetRetryError(message);
      });
  };

  const handleRefresh = () => {
    setAttempt((value) => value + 1);
  };

  const returnHref = useMemo(() => {
    return returnFromLocation(location.pathname, location.search) ?? '/reports';
  }, [location.pathname, location.search]);

  // Summary card calculations
  const prevSeats = previousData?.tiles.seats.value ?? 0;
  const seatsDelta = previousData && data && prevSeats > 0
    ? percentDelta(data.tiles.seats.value, prevSeats)
    : null;

  const prevOverdue = previousData?.tiles.overdueFollowUps.value ?? 0;
  const overdueDelta = previousData && data && prevOverdue > 0
    ? percentDelta(data.tiles.overdueFollowUps.value, prevOverdue)
    : null;

  const offerNow = data ? judgedRate('offersAccepted', data.tiles.offersAccepted) : null;
  const offerPrev = previousData ? judgedRate('offersAccepted', previousData.tiles.offersAccepted) : null;

  const conversionNow = data ? judgedRate('screensReachedInterview', data.tiles.screensReachedInterview) : null;
  const conversionPrev = previousData ? judgedRate('screensReachedInterview', previousData.tiles.screensReachedInterview) : null;

  const contextParts = [
    'Direct reports',
    ...(data ? [`${authorizedPeople.length} ${authorizedPeople.length === 1 ? 'employee' : 'employees'}`] : []),
    periodDisplayLabel,
    ...(site ? [siteLabel] : []),
    ...(job ? [jobScopeLabel] : []),
  ];

  return (
    <div className="rf2-jobs rf2-tres">
      {showDrill ? null : (
        <div className="rf2-tres__head">
          <div>
            <h1 className="rf2-jobs__title">Team results</h1>
            <p className="rf2-jobs__sub" data-testid="team-results-context">{contextParts.join(' · ')}</p>
          </div>
          <div className="rf2-tres__controls" role="toolbar" aria-label="Team results filters">
            <div className="rf2-segmented" role="group" aria-label="Period type">
              <ButtonV2
                kind="secondary"
                size="sm"
                selected={periodType === 'monthly'}
                onClick={() => setPeriodType('monthly')}
              >
                Monthly
              </ButtonV2>
              <ButtonV2
                kind="secondary"
                size="sm"
                selected={periodType === 'weekly'}
                onClick={() => setPeriodType('weekly')}
              >
                Weekly
              </ButtonV2>
            </div>
            {periodType === 'monthly' ? (
              <MonthSwitcher month={month} isCurrent={isCurrent} onMonth={setMonth} />
            ) : (
              <SelectV2
                label="Period"
                fieldClassName="rf2-sr-label rf2-tres__monthselect"
                value={week}
                onChange={(event) => setWeek(event.target.value)}
              >
                {weeklyChoices.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </SelectV2>
            )}
            <SelectV2 label="Site" fieldClassName="rf2-sr-label" value={site} onChange={(event) => setSite(event.target.value)}>
              <option value="">All sites</option>
              {siteOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              {site && !siteKnown ? <option value={site}>Selected site</option> : null}
            </SelectV2>
            <SelectV2 label="Job scope" fieldClassName="rf2-sr-label" value={job} onChange={(event) => setJob(event.target.value)}>
              <option value="">All jobs</option>
              {jobOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              {job && !jobKnown ? <option value={job}>Selected job</option> : null}
            </SelectV2>
            <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={handleRefresh} aria-label="Refresh">
              Refresh
            </ButtonV2>
            {canExport && data ? (
              <ButtonV2
                kind="secondary"
                size="sm"
                icon={<Download />}
                onClick={() => downloadCsv(`team-result-${periodKey}.csv`, teamResultCsv(data, periodDisplayLabel, siteLabel))}
              >
                Export
              </ButtonV2>
            ) : null}
          </div>
        </div>
      )}

      {state.kind === 'loading' ? (
        <>
          <div className="rf2-tres__skel" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="rf2-tres__skel-card" />)}
          </div>
          <SkeletonV2 lines={5} label="Loading team results…" />
        </>
      ) : null}

      {state.kind === 'no-reports' ? (
        <ForbiddenStateV2 body="Team result is for managers with direct reports. Nobody reports to you yet." />
      ) : null}

      {state.kind === 'unavailable' ? (
        <EmptyStateV2 title="Team result is not available yet" body="Period analytics are unavailable on this server. Refresh after the reporting service is updated." />
      ) : null}

      {state.kind === 'error' ? (
        <div role="alert">
          <EmptyStateV2
            title="Could not load team results"
            body={state.message}
            action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={handleRefresh}>Try again</ButtonV2>}
          />
        </div>
      ) : null}

      {showDrill && data && recruiterId ? (
        <RecruiterDrill
          data={data}
          recruiterId={recruiterId}
          month={month}
          periodType={periodType}
          periodLabel={periodDisplayLabel}
          isCurrent={isCurrent}
          onMonth={setMonth}
          onBack={() => setRecruiter(null)}
        />
      ) : null}

      {data && !recruiterId ? (
        <>
          <ul className="rf2-tres__kpis" aria-label={`Team summary for ${periodDisplayLabel}`}>
            <Kpi tone="success" icon={<Armchair aria-hidden="true" />} value={String(data.tiles.seats.value)} label="Confirmed joinings"
              sub={periodType === 'monthly' ? `${data.tiles.seats.value} of ${data.tiles.seats.of} approved seats` : `Actual joinings · ${periodDisplayLabel}`} spark={completeSeries(history, (item) => item.tiles.seats.value)}
              delta={seatsDelta === null ? null : { text: formatSignedPercent(seatsDelta), amount: seatsDelta }} />
            <Kpi tone="info" icon={<Percent aria-hidden="true" />} value={offerNow === null ? `${data.tiles.offersAccepted.value} of ${data.tiles.offersAccepted.of}` : formatPercent(offerNow)} label="Offer acceptance"
              sub={data.tiles.offersAccepted.of === 0 ? 'No offers sent in this period' : offerNow === null ? 'Too few to judge' : `${data.tiles.offersAccepted.value} of ${data.tiles.offersAccepted.of} sent`}
              spark={completeSeries(history, (item) => judgedRate('offersAccepted', item.tiles.offersAccepted))}
              delta={offerNow !== null && offerPrev !== null ? { text: formatSignedPoints(offerNow - offerPrev), amount: offerNow - offerPrev } : null} />
            <Kpi tone="info" icon={<TrendingUp aria-hidden="true" />} value={conversionNow === null ? `${data.tiles.screensReachedInterview.value} of ${data.tiles.screensReachedInterview.of}` : formatPercent(conversionNow)} label="Screen → Interview"
              sub={data.tiles.screensReachedInterview.of === 0 ? 'No eligible screenings in this period' : conversionNow === null ? 'Too few to judge' : `${data.tiles.screensReachedInterview.value} of ${data.tiles.screensReachedInterview.of} screenings`}
              spark={completeSeries(history, (item) => judgedRate('screensReachedInterview', item.tiles.screensReachedInterview))}
              delta={conversionNow !== null && conversionPrev !== null ? { text: formatSignedPoints(conversionNow - conversionPrev), amount: conversionNow - conversionPrev } : null} />
            <Kpi tone="danger" icon={<Clock aria-hidden="true" />} value={String(data.tiles.overdueFollowUps.value)} label="Overdue follow-ups"
              sub={data.tiles.overdueFollowUps.of <= 0 ? 'No follow-ups due in this period' : `${data.tiles.overdueFollowUps.value} of ${data.tiles.overdueFollowUps.of} due`}
              spark={completeSeries(history, (item) => item.tiles.overdueFollowUps.value)}
              delta={overdueDelta === null ? null : { text: formatSignedPercent(overdueDelta), amount: overdueDelta, downIsGood: true }} />
          </ul>

          <section className="rf2-tres__analysis" aria-labelledby="tres-analysis">
            <h2 id="tres-analysis" className="rf2-tres__section-title">Hiring analysis</h2>
            <div className="rf2-tres__row2">
              <FunnelPanel data={data} month={periodDisplayLabel} />
              <TeamActivityPanel data={data} periodType={periodType} periodKey={periodKey} periodLabel={periodDisplayLabel}
                targets={targetsState.kind === 'ready' ? targetsState.targets : []} vacancyId={job || null} targetsUnavailable={targetsState.kind !== 'ready'} />
            </div>
          </section>

          <TeamTargetsSection
            people={authorizedPeople}
            rows={data.rows}
            perPerson={data.perPerson}
            periodType={periodType}
            periodKey={periodKey}
            periodDisplayLabel={periodDisplayLabel}
            planningMonth={cairoMonth(new Date(data.range.from))}
            branchId={site || null}
            vacancyId={job || null}
            jobScopeLabel={jobScopeLabel}
            targetsState={targetsState}
            onRetryTargets={handleRetryTargets}
            onTargetSaved={(saved) => setLocalTargets((current) => mergeTargets(current, [saved]))}
            onTargetsReloaded={(targets) => setReloadedTargets(targets)}
            returnHref={returnHref}
            onOpenRecruiterDrill={(id) => setRecruiter(id)}
          />

            <OverdueHistorySection
              data={data}
              history={history}
              month={month}
              periodLabel={periodDisplayLabel}
              previous={previousData}
            />

          <details className="rf2-tres__method">
            <summary>How these measures are counted</summary>
            <div className="rf2-tres__notes">
              <p role="note" className="rf2-tres__note"><Info aria-hidden="true" /><span>Team results count direct reports only, while Team work lists the reporting line.</span></p>
              <p role="note" className="rf2-tres__note"><Info aria-hidden="true" /><span>Small sample sizes (fewer than 5 cases) show &quot;Too few to judge&quot; and raw counts only (e.g., Confirmed joinings are never judged on sample).</span></p>
              <p role="note" className="rf2-tres__note"><Info aria-hidden="true" /><span>Activity is not a score. It shows recruiting actions (e.g., screenings, interviews, feedback, joinings) to help you remove blockers and improve outcomes.</span></p>
            </div>
            <dl className="rf2-tres__defs">
              <dt>Screenings completed</dt>
              <dd>Recorded completed screening activity within the selected Cairo period.</dd>
              <dt>Interviews conducted</dt>
              <dd>Completed interviews within the period, excluding cancelled appointments and no-shows.</dd>
              <dt>Feedback submitted</dt>
              <dd>Submitted interview feedback within the period, without counting drafts or revisions twice.</dd>
              <dt>Confirmed joinings</dt>
              <dd>Actual joining records where the joining date falls in the period, rather than accepted offers or planned start dates.</dd>
              <dt>Offer acceptance</dt>
              <dd>Accepted offers, over offers sent in the month.</dd>
              <dt>Overdue follow-ups</dt>
              <dd>Follow-ups due in the selected period that were not acted on by their date.</dd>
              <dt>Hiring funnel</dt>
              <dd>Applications applied in the selected period by these direct reports, and how many reached each later stage.</dd>
            </dl>
            <p>Counted inside the Africa/Cairo timezone ({data.range.from} to {data.range.to}). Calls, messages, and CV views are never scored.</p>
            {authorizedPeople.length > 0 ? (
              <div className="rf2-tres__links">
                <p id="tres-direct" className="rf2-jtable__name">Direct reports</p>
                <ul className="rf2-tres__people" aria-labelledby="tres-direct">
                  {authorizedPeople.map((person) => (
                    <li key={person.id}><ButtonV2 kind="secondary" size="sm" onClick={() => setRecruiter(person.id)}>{person.name}</ButtonV2></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </details>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ tone, icon, value, label, sub, spark, delta }: {
  tone: 'info' | 'success' | 'danger' | 'neutral';
  icon: ReactNode;
  value: string;
  label: string;
  sub?: string;
  spark: number[] | null;
  delta: { text: string; amount: number; downIsGood?: boolean } | null;
}) {
  return (
    <li className="rf2-tres__kpi" data-tone={tone}>
      <span className="rf2-tres__kpi-icon">{icon}</span>
      <span className="rf2-tres__kpi-top">
        <span className="rf2-tres__kpi-value">{value}</span>
        {delta ? <DeltaChip text={delta.text} amount={delta.amount} downIsGood={delta.downIsGood} /> : null}
      </span>
      <span className="rf2-tres__kpi-label">{label}</span>
      {sub ? <span className="rf2-tres__kpi-sub">{sub}</span> : null}
      {spark ? <span className="rf2-sr-only">{label} across fetched months: {spark.join(', ')}</span> : null}
      {spark ? <Sparkline values={spark} /> : null}
    </li>
  );
}
