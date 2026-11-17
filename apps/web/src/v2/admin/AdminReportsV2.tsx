import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Download, Info, RotateCw, ShieldAlert } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip, TextareaV2, initials } from '../../components/v2';
import { OTHER_REASON, cairoToday, jobReasons } from '../api/jobs';
import { cairoMonth, monthLabel, tooFew, type ResultTile, type TileKey } from '../api/myResult';
import { rowTooFew, sampleText } from '../api/teamResult';
import { fetchUsers, seatOf } from './usersApi';
import {
  OVERRIDE_LABEL,
  OVERRIDE_MIN_REASON,
  downloadCsv,
  fetchOffersWaiting,
  fetchOrgJobs,
  fetchStageCounts,
  fetchTeamReport,
  overrideError,
  overridesFor,
  postOverride,
  toCsv,
  type OrgJob,
  type OverrideAction,
  type StageCount,
  type TeamReportList,
  type WaitingOfferRow,
} from './opsApi';
import '../pages/jobs.css';
import '../pages/team.css';
import './admin.css';
import { AdminWorkspaceHeader } from './AdminWorkspaceHeader';

const shift = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const day = (d: string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(
        new Date(d.length === 10 ? `${d}T12:00:00Z` : d),
      )
    : '—';
const ago = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
};
const tone = (s: string | null) =>
  (s === 'On Hold' ? 'warning' : s === 'Open' || s === 'Partially Filled' ? 'success' : 'neutral') as
    | 'warning'
    | 'success'
    | 'neutral';
const COLS: Array<{ key: TileKey; label: string }> = [
  { key: 'seats', label: 'Seats' },
  { key: 'overdueFollowUps', label: 'Overdue follow-ups' },
  { key: 'screensReachedInterview', label: 'Screen → interview' },
  { key: 'offersAccepted', label: 'Offers accepted' },
];
const tileText = (k: TileKey, t: ResultTile) => (k === 'overdueFollowUps' ? String(t.value) : `${t.value} of ${t.of}`);

type SectionState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string; forbidden?: boolean };

const settleMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

/** A08 Reports (Admin seat): open jobs (+ admin override), stage counts, offers waiting, hiring report by team. Not a daily desk. */
export function AdminReportsV2() {
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : cairoMonth();
  const [jobsState, setJobsState] = useState<SectionState<OrgJob[]>>({ kind: 'loading' });
  const [stagesState, setStagesState] = useState<SectionState<StageCount[]>>({ kind: 'loading' });
  const [offersState, setOffersState] = useState<SectionState<WaitingOfferRow[]>>({ kind: 'loading' });
  const [teamState, setTeamState] = useState<SectionState<TeamReportList>>({ kind: 'loading' });
  const [jobsAttempt, setJobsAttempt] = useState(0);
  const [stagesAttempt, setStagesAttempt] = useState(0);
  const [offersAttempt, setOffersAttempt] = useState(0);
  const [teamAttempt, setTeamAttempt] = useState(0);
  const [site, setSite] = useState('all');
  const [note, setNote] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    let live = true;
    setJobsState({ kind: 'loading' });
    setAsOf(new Date().toISOString());
    fetchOrgJobs()
      .then(async (rows) => {
        await settleMicrotasks();
        if (live) setJobsState({ kind: 'ready', data: rows });
      })
      .catch((e: { statusCode?: number; message?: string }) => {
        if (!live) return;
        setJobsState({
          kind: 'error',
          message: e?.message || 'Could not load open jobs.',
          forbidden: e?.statusCode === 403,
        });
      });
    return () => {
      live = false;
    };
  }, [jobsAttempt]);

  useEffect(() => {
    let live = true;
    setStagesState({ kind: 'loading' });
    setAsOf(new Date().toISOString());
    fetchStageCounts(month)
      .then(async (rows) => {
        await settleMicrotasks();
        if (!live) return;
        if (rows === null) setStagesState({ kind: 'unavailable' });
        else setStagesState({ kind: 'ready', data: rows });
      })
      .catch((e: { statusCode?: number; message?: string }) => {
        if (!live) return;
        setStagesState({
          kind: 'error',
          message: e?.message || 'Could not load stage counts.',
          forbidden: e?.statusCode === 403,
        });
      });
    return () => {
      live = false;
    };
  }, [month, stagesAttempt]);

  useEffect(() => {
    let live = true;
    setOffersState({ kind: 'loading' });
    setAsOf(new Date().toISOString());
    fetchOffersWaiting()
      .then(async (rows) => {
        await settleMicrotasks();
        if (live) setOffersState({ kind: 'ready', data: rows });
      })
      .catch((e: { statusCode?: number; message?: string }) => {
        if (!live) return;
        if (e?.statusCode === 404 || e?.statusCode === 501) {
          setOffersState({ kind: 'unavailable' });
          return;
        }
        setOffersState({
          kind: 'error',
          message: e?.message || 'Could not load waiting offers.',
          forbidden: e?.statusCode === 403,
        });
      });
    return () => {
      live = false;
    };
  }, [offersAttempt]);

  useEffect(() => {
    let live = true;
    setTeamState({ kind: 'loading' });
    setAsOf(new Date().toISOString());
    (async () => {
      const users = await fetchUsers();
      const managers = users
        .filter((u) => seatOf(u) === 'manager' && u.status === 'Active' && users.some((r) => r.managerId === u.id))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((u) => ({ id: u.id, name: u.displayName, team: u.jobTitle ?? null }));
      const team = await fetchTeamReport(month, managers);
      if (!live) return;
      if (team === null) {
        setTeamState({ kind: 'unavailable' });
        return;
      }
      if (managers.length > 0 && team.length === 0 && team.omittedCount > 0) {
        const allForbidden = team.forbiddenCount === team.omittedCount;
        setTeamState({
          kind: 'error',
          message: allForbidden
            ? 'Your role does not have access to these team results.'
            : 'Could not load team results for the reporting lines.',
          forbidden: allForbidden,
        });
        return;
      }
      setTeamState({ kind: 'ready', data: team });
    })().catch((e: { statusCode?: number; message?: string }) => {
      if (!live) return;
      if (e?.statusCode === 404 || e?.statusCode === 501) {
        setTeamState({ kind: 'unavailable' });
        return;
      }
      setTeamState({
        kind: 'error',
        message: e?.message || 'Could not load reporting directory.',
        forbidden: e?.statusCode === 403,
      });
    });
    return () => {
      live = false;
    };
  }, [month, teamAttempt]);

  const go = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    setParams(n);
  };

  const allJobs = jobsState.kind === 'ready' ? jobsState.data : [];
  const sites = useMemo(() => [...new Set(allJobs.map((j) => j.site).filter(Boolean) as string[])].sort(), [allJobs]);
  const jobs = allJobs.filter((j) => site === 'all' || j.site === site).sort((a, b) => a.title.localeCompare(b.title));
  const overriding = allJobs.find((j) => j.id === params.get('override')) ?? null;
  const stages = stagesState.kind === 'ready' ? stagesState.data : null;
  const max = Math.max(1, ...(stages ?? []).map((s) => s.count));

  const anyReady =
    jobsState.kind === 'ready' ||
    stagesState.kind === 'ready' ||
    offersState.kind === 'ready' ||
    teamState.kind === 'ready';

  const exportCsv = () => {
    if (!anyReady) return;
    const siteScopeLabel = site === 'all' ? 'All sites' : site;
    const teamCompleteness =
      teamState.kind === 'ready'
        ? teamState.data.partial
          ? `Partial (${teamState.data.omittedCount} of ${teamState.data.requestedCount} teams omitted)`
          : 'Complete'
        : teamState.kind === 'unavailable'
          ? 'Unavailable'
          : teamState.kind === 'error'
            ? `Error: ${teamState.message}`
            : 'Loading';
    const overallCompleteness =
      jobsState.kind === 'ready' &&
      stagesState.kind === 'ready' &&
      offersState.kind === 'ready' &&
      teamState.kind === 'ready' &&
      !teamState.data.partial
        ? 'Complete'
        : 'Partial or degraded';

    const metaCsv = toCsv(
      ['Report month', 'Timezone', 'As of', 'Open jobs site filter', 'Other sections scope', 'Completeness'],
      [[month, 'Africa/Cairo', asOf, siteScopeLabel, 'All sites', overallCompleteness]],
    );

    const jobsCsv =
      jobsState.kind === 'ready'
        ? toCsv(
            ['Job', 'Site', 'Owner', 'Seats filled', 'Seats', 'Due', 'Active files', 'Status', 'Scope'],
            jobs.map((j) => [
              j.title,
              j.site,
              j.owner,
              j.seats.filled,
              j.seats.target,
              j.dueDate,
              j.active,
              j.status,
              `Live snapshot today · Site: ${siteScopeLabel}`,
            ]),
          )
        : toCsv(['Open jobs status'], [[jobsState.kind === 'error' ? `Error: ${jobsState.message}` : 'Unavailable']]);

    const stagesCsv =
      stagesState.kind === 'ready'
        ? toCsv(
            ['Stage', 'Count', 'Scope', 'Status'],
            stagesState.data.length > 0
              ? stagesState.data.map((s) => [
                  s.name === 'Pre-Hire' ? 'Pre-hire' : s.name,
                  s.count,
                  `${monthLabel(month)} · All sites (Africa/Cairo)`,
                  'Complete',
                ])
              : [['No stage counts for this month', 0, `${monthLabel(month)} · All sites (Africa/Cairo)`, 'Empty']],
          )
        : toCsv(
            ['Stage', 'Count', 'Scope', 'Status'],
            [
              [
                'Files by stage',
                null,
                `${monthLabel(month)} · All sites (Africa/Cairo)`,
                stagesState.kind === 'error' ? `Error: ${stagesState.message}` : 'Unavailable',
              ],
            ],
          );

    const offersCsv =
      offersState.kind === 'ready'
        ? toCsv(
            ['Candidate', 'Job', 'Offer version', 'Approver', 'Submitted at', 'Version created at', 'Scope', 'Status'],
            offersState.data.length > 0
              ? offersState.data.map((o) => [
                  o.candidate,
                  o.job,
                  `v${o.version}`,
                  o.approver ?? 'Manager',
                  o.submittedAt,
                  o.versionCreatedAt ?? null,
                  'Live snapshot today · All sites',
                  'Pending Approval',
                ])
              : [['Nothing waiting on a Manager', null, null, null, null, null, 'Live snapshot today · All sites', 'Empty']],
          )
        : toCsv(
            ['Offers waiting status', 'Scope'],
            [[offersState.kind === 'error' ? `Error: ${offersState.message}` : 'Unavailable', 'Live snapshot today · All sites']],
          );

    const teamRows: Array<Array<string | number | null | undefined>> =
      teamState.kind === 'ready'
        ? teamState.data.map((t) => [
            t.team,
            t.managerName,
            t.people,
            ...COLS.map((c) => tileText(c.key, t.tiles[c.key])),
            sampleText(t.tiles),
            rowTooFew(t.tiles) ? 'yes' : 'no',
            teamCompleteness,
          ])
        : [
            [
              null,
              null,
              null,
              ...COLS.map(() => null),
              null,
              null,
              teamCompleteness,
            ],
          ];
    const teamCsv = toCsv(
      ['Team', 'Manager', 'People', ...COLS.map((c) => c.label), 'Sample', 'Too few to judge', 'Completeness'],
      teamRows,
    );

    downloadCsv(`recruitflow-report-${month}.csv`, [metaCsv, jobsCsv, stagesCsv, offersCsv, teamCsv].join('\r\n\r\n'));
  };

  return (
    <div className="rf2-jobs rf2-admin">
      <AdminWorkspaceHeader
        group="Reports"
        title="Reports"
        subtitle="Review live open jobs, monthly stage counts, waiting offers and team hiring results."
        actions={
          <ButtonV2 icon={<Download />} onClick={exportCsv} disabled={!anyReady}>
            Export CSV
          </ButtonV2>
        }
      />
      <div className="rf2-admin__filterset">
        <div className="rf2-segmented" role="group" aria-label="Period">
          <ButtonV2
            kind="secondary"
            size="sm"
            icon={<ChevronLeft />}
            onClick={() => go({ month: shift(month, -1) })}
            aria-label="Previous month"
          />
          <span className="rf2-tres__month" aria-live="polite">
            {monthLabel(month)}
          </span>
          <ButtonV2
            kind="secondary"
            size="sm"
            icon={<ChevronRight />}
            onClick={() => go({ month: shift(month, 1) })}
            disabled={month >= cairoMonth()}
            aria-label="Next month"
          />
        </div>
        <SelectV2 label="Site filter" fieldClassName="rf2-sr-label" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="all">Open jobs site: All</option>
          {sites.map((s) => (
            <option key={s} value={s}>
              Open jobs site: {s}
            </option>
          ))}
        </SelectV2>
      </div>
      {note ? (
        <p className="rf2-inline-note" data-tone="success" role="status">
          {note}
        </p>
      ) : null}

      <section className="rf2-panel rf2-admin__card" aria-labelledby="oj-h">
        <div className="rf2-row-between rf2-admin__head">
          <h2 id="oj-h" className="rf2-jtable__name">
            Open jobs
          </h2>
          <span className="rf2-jtable__sub">
            {jobsState.kind === 'ready' ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} · ` : ''}
            Live snapshot today · Site: {site === 'all' ? 'All' : site}
          </span>
        </div>
        {jobsState.kind === 'loading' ? <SkeletonV2 lines={4} label="Loading open jobs…" /> : null}
        {jobsState.kind === 'error' ? (
          jobsState.forbidden ? (
            <div role="alert">
              <ForbiddenStateV2 body={jobsState.message} />
            </div>
          ) : (
            <div role="alert">
              <EmptyStateV2
                title="Could not load open jobs"
                body={jobsState.message}
                action={
                  <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setJobsAttempt((n) => n + 1)}>
                    Try again
                  </ButtonV2>
                }
              />
            </div>
          )
        ) : null}
        {jobsState.kind === 'ready' ? (
          <table className="rf2-jtable" aria-label="Open jobs">
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Owner</th>
                <th scope="col">Seats</th>
                <th scope="col">Due</th>
                <th scope="col" className="rf2-num">
                  Active files
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="rf2-sr-only">Override</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <th scope="row">
                    <span className="rf2-jtable__name">{j.title}</span>
                    <span className="rf2-jtable__sub">{j.site ?? '—'}</span>
                  </th>
                  <td>{j.owner ?? '—'}</td>
                  <td>
                    {j.seats.filled} of {j.seats.target}
                  </td>
                  <td>{day(j.dueDate)}</td>
                  <td className="rf2-num">{j.active ?? '—'}</td>
                  <td>{j.status ? <StatusChip tone={tone(j.status)} label={j.status} /> : '—'}</td>
                  <td>
                    {overridesFor(j.status).length ? (
                      <ButtonV2
                        kind="tertiary"
                        size="sm"
                        icon={<ShieldAlert />}
                        onClick={() => go({ override: j.id })}
                        aria-label={`Override ${j.title}`}
                      >
                        Override
                      </ButtonV2>
                    ) : null}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7}>No open jobs.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </section>

      <div className="rf2-admin__two">
        <section className="rf2-panel rf2-admin__card" aria-labelledby="st-h">
          <div className="rf2-row-between rf2-admin__head">
            <h2 id="st-h" className="rf2-jtable__name">
              Files by stage
            </h2>
            <span className="rf2-jtable__sub">{monthLabel(month)} · All sites (Africa/Cairo)</span>
          </div>
          {stagesState.kind === 'loading' ? <SkeletonV2 lines={3} label="Loading stage counts…" /> : null}
          {stagesState.kind === 'unavailable' ? (
            <p className="rf2-jtable__sub rf2-admin__pad">Stage counts (/reports/overview) are not available on this server.</p>
          ) : null}
          {stagesState.kind === 'error' ? (
            <div role="alert" className="rf2-admin__pad">
              <p className="rf2-form-error">{stagesState.message}</p>
              <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setStagesAttempt((n) => n + 1)}>
                Try again
              </ButtonV2>
            </div>
          ) : null}
          {stagesState.kind === 'ready' ? (
            stagesState.data.length ? (
              <ul className="rf2-admin__bars" aria-label="Files by stage">
                {stagesState.data.map((s) => (
                  <li key={s.name}>
                    <span>{s.name === 'Pre-Hire' ? 'Pre-hire' : s.name}</span>
                    <span className="rf2-admin__bar" aria-hidden="true">
                      <span style={{ width: `${(s.count / max) * 100}%` }} />
                    </span>
                    <span className="rf2-num">{s.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rf2-jtable__sub rf2-admin__pad">No stage counts for this month.</p>
            )
          ) : null}
          <p className="rf2-jtable__sub rf2-admin__pad">
            <Info aria-hidden="true" className="rf2-admin__i" /> Time in stage (median days) needs a backend field; counts shown until then.
          </p>
        </section>

        <section className="rf2-panel rf2-admin__card" aria-labelledby="ow-h">
          <div className="rf2-row-between rf2-admin__head">
            <h2 id="ow-h" className="rf2-jtable__name">
              Offers waiting
            </h2>
            <span className="rf2-jtable__sub">
              {offersState.kind === 'ready'
                ? `${offersState.data.length} ${offersState.data.length === 1 ? 'offer' : 'offers'} · Live snapshot today · All sites`
                : 'Live snapshot today · All sites'}
            </span>
          </div>
          {offersState.kind === 'loading' ? <SkeletonV2 lines={3} label="Loading offers waiting…" /> : null}
          {offersState.kind === 'unavailable' ? (
            <p className="rf2-jtable__sub rf2-admin__pad">Offers are not available on this server.</p>
          ) : null}
          {offersState.kind === 'error' ? (
            <div role="alert" className="rf2-admin__pad">
              <p className="rf2-form-error">{offersState.message}</p>
              <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setOffersAttempt((n) => n + 1)}>
                Try again
              </ButtonV2>
            </div>
          ) : null}
          {offersState.kind === 'ready' ? (
            offersState.data.length === 0 ? (
              <p className="rf2-jtable__sub rf2-admin__pad">Nothing waiting on a Manager.</p>
            ) : (
              <ul className="rf2-admin__offers">
                {offersState.data.map((o) => {
                  const waitAge = o.submittedAt ? ago(o.submittedAt) : null;
                  return (
                    <li key={o.id}>
                      <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">
                        {initials(o.candidate)}
                      </span>
                      <span>
                        <span className="rf2-jtable__name">
                          {o.candidate} · {o.job}
                        </span>
                        <span className="rf2-jtable__sub">
                          Offer v{o.version}
                          {o.submittedAt
                            ? ` · submitted ${day(o.submittedAt)}`
                            : o.versionCreatedAt
                              ? ` · version created ${day(o.versionCreatedAt)}`
                              : ''}
                        </span>
                      </span>
                      <StatusChip
                        tone="neutral"
                        icon={<Clock />}
                        label={`Waiting on ${o.approver ?? 'the Manager'}${waitAge ? ` · ${waitAge}` : ''}`}
                      />
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </section>
      </div>

      <section className="rf2-panel rf2-admin__card" aria-labelledby="tr-h">
        <div className="rf2-row-between rf2-admin__head">
          <h2 id="tr-h" className="rf2-jtable__name">
            Hiring report by team
          </h2>
          <span className="rf2-jtable__sub">{monthLabel(month)} · All sites (Africa/Cairo) · Same four measures as My result</span>
        </div>
        {teamState.kind === 'loading' ? <SkeletonV2 lines={4} label="Loading team report…" /> : null}
        {teamState.kind === 'unavailable' ? (
          <p className="rf2-jtable__sub rf2-admin__pad">Monthly results (/results/org) are not on this server yet.</p>
        ) : null}
        {teamState.kind === 'error' ? (
          <div role="alert" className="rf2-admin__pad">
            <p className="rf2-form-error">{teamState.message}</p>
            <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setTeamAttempt((n) => n + 1)}>
              Try again
            </ButtonV2>
          </div>
        ) : null}
        {teamState.kind === 'ready' ? (
          <>
            {teamState.data.partial ? (
              <div className="rf2-inline-note" data-tone="warning" role="alert">
                <Info aria-hidden="true" /> Partial team report: {teamState.data.omittedCount} of {teamState.data.requestedCount}{' '}
                {teamState.data.requestedCount === 1 ? 'team' : 'teams'} could not be loaded (
                {[
                  teamState.data.forbiddenCount ? `${teamState.data.forbiddenCount} restricted` : null,
                  teamState.data.failedCount ? `${teamState.data.failedCount} failed` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                ) and {teamState.data.omittedCount === 1 ? 'is' : 'are'} excluded from this table.{' '}
                <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setTeamAttempt((n) => n + 1)}>
                  Try again
                </ButtonV2>
              </div>
            ) : null}
            {teamState.data.length === 0 ? (
              <p className="rf2-jtable__sub rf2-admin__pad">
                No manager has direct reports yet. Set reporting lines in Users → Reporting tree.
              </p>
            ) : (
              <table className="rf2-jtable rf2-tres__table" aria-label="Hiring report by team">
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Sample</th>
                    {COLS.map((c) => (
                      <th key={c.key} scope="col">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamState.data.map((t) => (
                    <tr key={t.managerId}>
                      <th scope="row">
                        <span className="rf2-jtable__name">{t.team ?? t.managerName}</span>
                        <span className="rf2-jtable__sub">
                          {t.managerName}’s {t.people} direct {t.people === 1 ? 'report' : 'reports'}
                        </span>
                      </th>
                      <td>
                        <span className="rf2-jtable__sub">{sampleText(t.tiles)}</span>
                        {rowTooFew(t.tiles) ? (
                          <>
                            <br />
                            <StatusChip tone="neutral" icon={<Clock />} label="Too few to judge" />
                          </>
                        ) : null}
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} data-too-few={tooFew(c.key, t.tiles[c.key]) || undefined}>
                          {tileText(c.key, t.tiles[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : null}
        <p className="rf2-jtable__sub rf2-admin__pad">
          Live cohort: measures reflect current state of records dated in {monthLabel(month)} (Africa/Cairo). Sample shows follow-up files, screening logs, and sent offer versions. No previous period — no comparison is shown. No call, message or CV-view counts.
        </p>
      </section>

      {overriding ? (
        <OverrideDrawer
          job={overriding}
          onClose={() => go({ override: null })}
          onDone={(m) => {
            setNote(m);
            go({ override: null });
            setJobsAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A5 Admin override (#21 2ced190 POST /admin/overrides): hold / close take a list reason (hold-reasons / close-reasons,
 * "Other" + note; hold also holdUntil); reopen takes a free-text reason (>= 10). Audited as ADMIN_OVERRIDE.
 */
export function OverrideDrawer({ job, onClose, onDone }: { job: OrgJob; onClose: () => void; onDone: (m: string) => void }) {
  const actions = overridesFor(job.status);
  const [action, setAction] = useState<OverrideAction | ''>(actions.length === 1 ? actions[0] : '');
  const [reason, setReason] = useState('');
  const kind = action === 'job.hold' ? 'hold' : action === 'job.close' ? 'close' : null;
  const [lists, setLists] = useState<Partial<Record<'hold' | 'close', string[] | null>>>({});
  const [note, setNote] = useState('');
  const [holdUntil, setHoldUntil] = useState('');
  useEffect(() => {
    if (!kind || kind in lists) return;
    let live = true;
    jobReasons(kind)
      .then((r) => live && setLists((l) => ({ ...l, [kind]: r.length ? r : null })))
      .catch(() => live && setLists((l) => ({ ...l, [kind]: null })));
    return () => {
      live = false;
    };
  }, [kind, lists]);
  const list = kind ? lists[kind] ?? null : null;
  useEffect(() => {
    setReason('');
    setNote('');
  }, [kind]);
  const [err, setErr] = useState<{ field?: 'reason' | 'action' | 'holdUntil' | 'note'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const isOther = !!list && reason === OTHER_REASON;
  const submit = async () => {
    if (!action) return setErr({ field: 'action', text: 'Pick what to do.' });
    if (list) {
      if (!reason) return setErr({ field: 'reason', text: 'Pick a reason from the list.' });
      if (isOther && note.trim().length < 3) return setErr({ field: 'note', text: '"Other" needs a short note (at least 3 characters).' });
    } else if (reason.trim().length < OVERRIDE_MIN_REASON) {
      return setErr({ field: 'reason', text: `An override needs a reason (at least ${OVERRIDE_MIN_REASON} characters).` });
    }
    if (action === 'job.hold' && holdUntil && holdUntil <= cairoToday()) {
      return setErr({ field: 'holdUntil', text: 'Pick a day after today (Cairo).' });
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await postOverride(action, job.id, reason.trim(), { note: isOther ? note : undefined, holdUntil: holdUntil || undefined });
      onDone(`${job.title}: ${r?.from ?? job.status} → ${r?.to ?? OVERRIDE_LABEL[action]}. Logged in Audit as an admin override.`);
    } catch (e) {
      setErr(overrideError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <DrawerV2
      open
      onClose={onClose}
      kicker="Admin override"
      title={job.title}
      subtitle={`${job.site ?? ''}${job.owner ? ` · owner ${job.owner}` : ''} · ${job.status}`}
      confirmClose={() => !reason.trim() || window.confirm('Discard this override?')}
      primaryAction={
        <ButtonV2 icon={<ShieldAlert />} loading={busy} onClick={() => void submit()}>
          Apply override
        </ButtonV2>
      }
      secondaryAction={
        <ButtonV2 kind="secondary" onClick={onClose}>
          Cancel
        </ButtonV2>
      }
    >
      <fieldset className="rf2-choices">
        <legend className="rf2-field__label">What to do</legend>
        {actions.map((a) => (
          <label key={a} className="rf2-choice">
            <input
              type="radio"
              name="override"
              value={a}
              checked={action === a}
              onChange={() => {
                setAction(a);
                setErr(null);
              }}
            />{' '}
            {OVERRIDE_LABEL[a]}
          </label>
        ))}
        {err?.field === 'action' ? (
          <p className="rf2-form-error" role="alert">
            {err.text}
          </p>
        ) : null}
      </fieldset>
      {list ? (
        <SelectV2
          label={kind === 'hold' ? 'Hold reason' : 'Close reason'}
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setErr(null);
          }}
          error={err?.field === 'reason' ? err.text : undefined}
          hint="Kept on the audit log with who did it and the before/after status."
        >
          <option value="">Choose a reason</option>
          {list.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </SelectV2>
      ) : (
        <TextareaV2
          label="Why you are overriding"
          required
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setErr(null);
          }}
          error={err?.field === 'reason' ? err.text : undefined}
          hint={`At least ${OVERRIDE_MIN_REASON} characters. Kept on the audit log with who did it and the before/after status.`}
        />
      )}
      {isOther ? (
        <TextareaV2
          label="Other reason"
          required
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErr(null);
          }}
          error={err?.field === 'note' ? err.text : undefined}
        />
      ) : null}
      {kind === 'hold' ? (
        <InputV2
          label="Hold until (optional)"
          type="date"
          value={holdUntil}
          onChange={(e) => {
            setHoldUntil(e.target.value);
            setErr(null);
          }}
          error={err?.field === 'holdUntil' ? err.text : undefined}
          hint="A day after today (Cairo)."
        />
      ) : null}
      {err && !err.field ? (
        <p className="rf2-form-error" role="alert">
          {err.text}
        </p>
      ) : null}
      <p className="rf2-inline-note" data-tone="warning">
        <Info aria-hidden="true" /> Use this only when the owner can’t act. A leaver’s files move from Users → Deactivate (file.reassign override).
      </p>
    </DrawerV2>
  );
}
