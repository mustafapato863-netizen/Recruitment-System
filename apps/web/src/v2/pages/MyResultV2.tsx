import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Info, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SelectV2, SkeletonV2, StatusChip } from '../../components/v2';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import {
  cairoMonth,
  cairoWeek,
  fetchMyResult,
  fetchTargetsForPeriod,
  MIN_SAMPLE,
  monthLabel,
  tooFew,
  type EmployeeTargetItem,
  type MyResult,
  type ResultDetailItem,
  type ResultTile,
  type TileKey,
} from '../api/myResult';
import './jobs.css';

const VALID_MEASURES: readonly TileKey[] = ['seats', 'overdueFollowUps', 'screensReachedInterview', 'offersAccepted'];
const isTileKey = (v: string | null): v is TileKey => Boolean(v && (VALID_MEASURES as readonly string[]).includes(v));
const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const formatDay = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(d);
};
/** A label such as "Screened 2 Nov 2026" already includes the day. A bare label such as "Screened" still needs it. */
function recordDateText(dateLabel: string | null | undefined, date: string | null): string {
  if (dateLabel && /\d/.test(dateLabel)) return dateLabel;
  if (dateLabel) return `${dateLabel}: ${formatDay(date)}`;
  return formatDay(date);
}
const formatAsOf = (iso?: string) => {
  if (!iso) return 'today';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'today';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Africa/Cairo',
  }).format(d);
};

const MEASURE_META: Record<TileKey, { title: string; unit: string; unitPlural: string; description: string }> = {
  seats: {
    title: 'Seats',
    unit: 'job',
    unitPlural: 'jobs',
    description: 'Unique joined cases by actual joining date in Africa/Cairo during this month. Remaining seats today come from current job capacity.',
  },
  overdueFollowUps: {
    title: 'Overdue follow-ups',
    unit: 'follow-up file',
    unitPlural: 'follow-up files',
    description: 'Open files owned by you with a follow-up due date in this month that still need action.',
  },
  screensReachedInterview: {
    title: 'Screens with a note',
    unit: 'screening log',
    unitPlural: 'screening logs',
    description: 'Screening logs recorded with a note in this month and whether the file reached Interview.',
  },
  offersAccepted: {
    title: 'Offers accepted against sent',
    unit: 'sent offer version',
    unitPlural: 'sent offer versions',
    description: 'Offer versions sent in this month on your files and their current acceptance status.',
  },
};

function Tile({
  k,
  title,
  tile,
  headline,
  sub,
  foot,
  selected,
  onToggle,
}: {
  k: TileKey;
  title: string;
  tile: ResultTile;
  headline: string;
  sub?: string | null;
  foot?: string | null;
  selected: boolean;
  onToggle: () => void;
}) {
  const few = tooFew(k, tile);
  return (
    <section className="rf2-panel rf2-kpi" aria-label={title} data-selected={selected || undefined}>
      <h2 className="rf2-kpi__title">{title}</h2>
      <p className="rf2-kpi__value" data-few={few || undefined}>{few ? 'Too few to judge' : headline}</p>
      <p className="rf2-kpi__sub">{few ? `${headline} so far` : sub}</p>
      <p className="rf2-kpi__foot">
        {tile.detail ? <>{tile.detail}<br /></> : null}
        <span className="rf2-kpi__n">
          Based on {tile.sampleSize} {tile.sampleSize === 1 ? 'record' : 'records'}
          {few ? ` · needs ${MIN_SAMPLE}` : ''}
          {k === 'seats' ? ' · seats are always shown' : ''}
        </span>
        {foot ? <><br />{foot}</> : null}
      </p>
      <div style={{ marginTop: '0.5rem' }}>
        <ButtonV2
          kind="tertiary"
          size="sm"
          aria-expanded={selected}
          aria-label={`${selected ? 'Hide' : 'View'} ${title} records`}
          onClick={onToggle}
        >
          {selected ? 'Hide records' : 'View records'}
        </ButtonV2>
      </div>
    </section>
  );
}

function ActivityTargets({ monthly, jobId, returnHref }: { monthly: EmployeeTargetItem[]; jobId: string | null; returnHref: string }) {
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [weeklyAttempt, setWeeklyAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; targets: EmployeeTargetItem[] }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    if (period !== 'weekly') return undefined;
    let live = true;
    setWeekly({ kind: 'loading' });
    setOpenId(null);
    fetchTargetsForPeriod({ scope: 'me', periodType: 'weekly', periodKey: cairoWeek(), ...(jobId ? { vacancyId: jobId } : {}) })
      .then((result) => {
        if (live) setWeekly({ kind: 'ready', targets: result.targets });
      })
      .catch((error: { message?: string }) => {
        if (live) setWeekly({ kind: 'error', message: error?.message || 'Could not load weekly targets.' });
      });
    return () => {
      live = false;
    };
  }, [period, weeklyAttempt, jobId]);

  const weeklyFailed = period === 'weekly' && weekly.kind === 'error';
  const weeklyLoading = period === 'weekly' && (weekly.kind === 'loading' || weekly.kind === 'idle');
  const monthlyTargets = monthly.filter((target) => !target.periodType || target.periodType === 'monthly');
  const visible = period === 'weekly' ? (weekly.kind === 'ready' ? weekly.targets : []) : monthlyTargets;

  return (
    <section className="rf2-panel rf2-my-targets" aria-label="My activity targets" data-testid="my-activity-targets">
      <div className="rf2-my-targets__head">
        <h2 className="rf2-jtable__name">My activity targets</h2>
        <div className="rf2-my-targets__switch" role="group" aria-label="Target period">
          <ButtonV2 kind="secondary" size="sm" selected={period === 'monthly'} onClick={() => setPeriod('monthly')}>Monthly</ButtonV2>
          <ButtonV2 kind="secondary" size="sm" selected={period === 'weekly'} onClick={() => setPeriod('weekly')}>Weekly</ButtonV2>
        </div>
      </div>
      {weeklyLoading ? <SkeletonV2 lines={3} label="Loading weekly targets" /> : null}
      {weeklyFailed ? (
        <div role="alert">
          <p>{weekly.kind === 'error' ? weekly.message : 'Could not load weekly targets.'}</p>
          <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setWeeklyAttempt((value) => value + 1)}>Try again</ButtonV2>
        </div>
      ) : null}
      {weeklyLoading || weeklyFailed ? null : visible.length === 0 ? (
        <p>No targets assigned for this period.</p>
      ) : (
        <ul className="rf2-my-targets__list">
          {visible.map((target) => {
            const open = openId === target.id;
            const title = target.jobTitle ? `${target.metricLabel} · ${target.jobTitle}` : target.metricLabel;
            return (
              <li key={target.id} className="rf2-my-targets__item">
                <h3 className="rf2-jtable__name">{title}</h3>
                <p className="rf2-my-targets__stat">{target.achieved}/{target.target}</p>
                <p className="rf2-my-targets__stat">{target.remaining} remaining</p>
                <p className="rf2-my-targets__stat">{target.progressPercent}%</p>
                <ButtonV2
                  kind="tertiary"
                  size="sm"
                  aria-expanded={open}
                  aria-label={`${open ? 'Hide' : 'View'} records for ${target.metricLabel}`}
                  onClick={() => setOpenId(open ? null : target.id)}
                >
                  {open ? 'Hide records' : 'View records'}
                </ButtonV2>
                {open ? <TargetRecords target={target} returnHref={returnHref} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TargetRecords({ target, returnHref }: { target: EmployeeTargetItem; returnHref: string }) {
  const records = target.records ?? [];
  if (records.length === 0) return <p>No supporting records for this target.</p>;
  return (
    <div className="rf2-jscroll" tabIndex={0} role="region" aria-label={`Supporting records for ${target.metricLabel}`}>
      <table className="rf2-jtable" aria-label={`Supporting records for ${target.metricLabel}`}>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col">Job</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item) => (
            <tr key={item.id}>
              <th scope="row">{item.candidateName}</th>
              <td>{item.jobTitle}</td>
              <td>{recordDateText(item.dateLabel, item.date)}</td>
              <td><StatusChip tone={item.counted ? 'success' : 'neutral'} label={item.status} /></td>
              <td>
                {item.applicationId ? (
                  <Link
                    className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                    to={`/applications/${encodeURIComponent(item.applicationId)}?returnTo=${encodeURIComponent(returnHref)}`}
                    aria-label={`Open file for ${item.candidateName}`}
                  >
                    <span>Open file</span>
                  </Link>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** E04 My result (Employee, v2 only). Four numbers, sample counts, "Too few to judge" under 5. Not a score. */
export function MyResultV2() {
  const shell = useV2Shell();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const job = params.get('job');
  const currentMonth = cairoMonth();
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : currentMonth;
  const rawMeasure = params.get('measure');
  const selectedMeasure: TileKey | null = isTileKey(rawMeasure) ? rawMeasure : null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; data: MyResult }
    | { kind: 'unavailable' }
    | { kind: 'forbidden' }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' });

  useEffect(() => {
    if (shell?.seat !== 'employee') return;
    let live = true;
    setState({ kind: 'loading' });
    fetchMyResult(month, job)
      .then((r) => live && setState(r))
      .catch((e: { statusCode?: number; message?: string }) =>
        live &&
        setState(
          e?.statusCode === 403
            ? { kind: 'forbidden' }
            : { kind: 'error', message: e?.message || 'Something went wrong.' },
        ),
      );
    return () => {
      live = false;
    };
  }, [shell?.seat, month, job, attempt]);

  const updateFilter = (patch: { month?: string | null; job?: string | null; measure?: TileKey | null }) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    if (state.kind === 'ready') {
      for (const v of state.data.vacancies ?? []) {
        map.set(v.id, v.title);
      }
      if (state.data.vacancy) {
        map.set(state.data.vacancy.id, state.data.vacancy.title);
      }
    }
    if (job && !map.has(job)) {
      map.set(job, 'Selected job');
    }
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [state, job]);

  if (shell?.seat !== 'employee') return <Navigate to="/my-work" replace />;

  const back = <Link className="rf2-file__back" to="/my-work"><ArrowLeft aria-hidden="true" /> Back to My Work</Link>;
  const scope = state.kind === 'ready' && state.data.vacancy ? `${state.data.vacancy.title} only` : 'All my jobs';
  const hasActiveFilters = Boolean(job) || month !== currentMonth;
  const returnHref = `${location.pathname}${location.search}`;
  const reportsParams = new URLSearchParams();
  if (month) reportsParams.set('month', month);
  if (job) reportsParams.set('job', job);
  if (selectedMeasure === 'overdueFollowUps') {
    reportsParams.set('tab', 'followups');
  } else if (selectedMeasure === 'screensReachedInterview') {
    reportsParams.set('tab', 'funnel');
    reportsParams.set('stage', 'Interview');
  } else if (selectedMeasure === 'seats') {
    reportsParams.set('tab', 'funnel');
    reportsParams.set('stage', 'Joined');
  } else if (selectedMeasure === 'offersAccepted') {
    reportsParams.set('tab', 'funnel');
    reportsParams.set('stage', 'Offer');
  }
  if (selectedMeasure) reportsParams.set('measure', selectedMeasure);
  const reportsHref = `/reports${reportsParams.toString() ? `?${reportsParams.toString()}` : ''}`;

  return (
    <div className="rf2-jobs">
      {back}
      <div className="rf2-row-between">
        <div>
          <h1 className="rf2-jobs__title">My result</h1>
          <p className="rf2-jobs__sub">{monthLabel(month)} · monthly · {scope}.</p>
          {state.kind === 'ready' ? (
            <p className="rf2-jtable__sub" data-testid="my-result-freshness">
              <Clock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: 'text-bottom', marginRight: 4 }} />
              Live cohort as of {formatAsOf(state.data.asOf)} · Africa/Cairo
            </p>
          ) : null}
        </div>
        <div className="rf2-row-between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="rf2-segmented" role="group" aria-label="Month">
            <ButtonV2
              kind="secondary"
              size="sm"
              icon={<ChevronLeft />}
              onClick={() => updateFilter({ month: shiftMonth(month, -1) })}
              aria-label="Previous month"
            />
            <span className="rf2-tres__month" aria-live="polite">{monthLabel(month)}</span>
            <ButtonV2
              kind="secondary"
              size="sm"
              icon={<ChevronRight />}
              onClick={() => updateFilter({ month: shiftMonth(month, 1) })}
              disabled={month >= currentMonth}
              aria-label="Next month"
            />
          </div>
          <SelectV2
            label="Job scope"
            fieldClassName="rf2-sr-label"
            value={job ?? 'all'}
            onChange={(e) => updateFilter({ job: e.target.value === 'all' ? null : e.target.value })}
          >
            <option value="all">Job scope: All my jobs</option>
            {jobOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>Job scope: {opt.title}</option>
            ))}
          </SelectV2>
          {hasActiveFilters ? (
            <ButtonV2
              kind="secondary"
              size="sm"
              onClick={() => updateFilter({ month: null, job: null })}
            >
              Reset filters
            </ButtonV2>
          ) : null}
          <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={reportsHref}>
            Open full reports
          </Link>
        </div>
      </div>

      {state.kind === 'loading' ? <SkeletonV2 lines={4} label="Loading my result…" /> : null}
      {state.kind === 'unavailable' ? <EmptyStateV2 title="My result is not available yet" body="The result numbers are still being built. Your work is all on My Work in the meantime." /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include results." /> : null}
      {state.kind === 'error' ? (
        <div role="alert">
          <EmptyStateV2
            title="Could not load my result"
            body={state.message}
            action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>}
          />
        </div>
      ) : null}
      {state.kind === 'ready' ? (() => {
        const t = state.data.tiles;
        const cap = state.data.effectiveCapacity;
        const seatsHeadline = `Joined this month: ${t.seats.value}`;
        const seatsSub = cap
          ? `Remaining seats today: ${cap.remaining} · ${cap.joined} of ${cap.approved} filled`
          : `Remaining seats today: — · ${t.seats.of} target seats`;
        const toggleMeasure = (k: TileKey) => updateFilter({ measure: selectedMeasure === k ? null : k });
        const detailItems: ResultDetailItem[] | undefined = selectedMeasure ? state.data.details?.[selectedMeasure] : undefined;

        return (
          <>
            <div className="rf2-kpis">
              <Tile
                k="seats"
                title="Seats"
                tile={t.seats}
                headline={seatsHeadline}
                sub={seatsSub}
                selected={selectedMeasure === 'seats'}
                onToggle={() => toggleMeasure('seats')}
              />
              <Tile
                k="overdueFollowUps"
                title="Overdue follow-ups"
                tile={t.overdueFollowUps}
                headline={`${t.overdueFollowUps.value} of ${t.overdueFollowUps.of}`}
                sub={t.overdueFollowUps.value ? 'past their follow-up date' : 'none overdue'}
                foot="Follow-up dates are set on each file"
                selected={selectedMeasure === 'overdueFollowUps'}
                onToggle={() => toggleMeasure('overdueFollowUps')}
              />
              <Tile
                k="screensReachedInterview"
                title="Screens with a note"
                tile={t.screensReachedInterview}
                headline={`${t.screensReachedInterview.value} of ${t.screensReachedInterview.of}`}
                sub="reached interview"
                selected={selectedMeasure === 'screensReachedInterview'}
                onToggle={() => toggleMeasure('screensReachedInterview')}
              />
              <Tile
                k="offersAccepted"
                title="Offers accepted against sent"
                tile={t.offersAccepted}
                headline={`${t.offersAccepted.value} of ${t.offersAccepted.of}`}
                sub={t.offersAccepted.of ? 'accepted of sent' : 'none sent yet'}
                selected={selectedMeasure === 'offersAccepted'}
                onToggle={() => toggleMeasure('offersAccepted')}
              />
            </div>

            {Array.isArray(state.data.targets) ? (
              <ActivityTargets monthly={state.data.targets} jobId={job} returnHref={returnHref} />
            ) : null}

            {selectedMeasure ? (
              <section
                className="rf2-panel"
                aria-label={`${MEASURE_META[selectedMeasure].title} records`}
                data-testid="my-result-details"
              >
                <div className="rf2-row-between" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <h2 className="rf2-jtable__name">{MEASURE_META[selectedMeasure].title} — underlying records</h2>
                    <p className="rf2-jtable__sub">
                      {MEASURE_META[selectedMeasure].description} · Sample: {t[selectedMeasure].sampleSize}{' '}
                      {t[selectedMeasure].sampleSize === 1
                        ? MEASURE_META[selectedMeasure].unit
                        : MEASURE_META[selectedMeasure].unitPlural}
                    </p>
                  </div>
                  <ButtonV2 kind="secondary" size="sm" onClick={() => updateFilter({ measure: null })}>
                    Close details
                  </ButtonV2>
                </div>

                {detailItems && detailItems.length > 0 ? (
                  <table className="rf2-jtable" aria-label={`${MEASURE_META[selectedMeasure].title} detail list`}>
                    <thead>
                      <tr>
                        <th scope="col">Candidate</th>
                        <th scope="col">Job</th>
                        <th scope="col">Date</th>
                        <th scope="col">Status</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">
                            <span className="rf2-jtable__name">{item.candidateName}</span>
                          </th>
                          <td>{item.jobTitle}</td>
                          <td>
                            <span className="rf2-jtable__sub">{item.dateLabel}: {formatDay(item.date)}</span>
                          </td>
                          <td>
                            <StatusChip
                              tone={item.counted ? (selectedMeasure === 'overdueFollowUps' ? 'warning' : 'success') : 'neutral'}
                              label={item.status}
                            />
                          </td>
                          <td>
                            {item.applicationId ? (
                              <Link
                                className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                                to={`/applications/${encodeURIComponent(item.applicationId)}?returnTo=${encodeURIComponent(returnHref)}`}
                                aria-label={`Open file for ${item.candidateName}`}
                              >
                                <span>Open file</span>
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="rf2-jtable__sub">
                    {t[selectedMeasure].sampleSize === 0 && t[selectedMeasure].value === 0
                      ? 'No records in this cohort for the selected month and job scope.'
                      : 'No individual record rows were returned for this measure.'}
                  </p>
                )}
              </section>
            ) : null}
          </>
        );
      })() : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Activity is not a score. These numbers show where work stands, not how well you are doing. Nothing here is ranked or compared with colleagues.</p>
    </div>
  );
}
