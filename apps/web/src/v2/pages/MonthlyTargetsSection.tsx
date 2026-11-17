import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ClipboardCheck, FileSearch, MessageSquareText, Plus, Users } from 'lucide-react';
import { monthlyTargetWeeks } from '@recruitflow/contracts';
import { ButtonV2, initials, InputV2, SelectV2 } from '../../components/v2';
import { cairoMonth, fetchTargetsForPeriod, monthLabel, saveMonthlyTargetPlan, type EmployeeTargetItem, type TargetMetricKey, type TargetPeriodType } from '../api/myResult';
import { shiftMonth, type TeamRow } from '../api/teamResult';
import { withReturnTo } from '../returnTarget';
export const TARGET_METRICS: Array<{
  key: TargetMetricKey;
  columnLabel: string;
  label: string;
  tone: 'info' | 'success' | 'warning';
  icon: ReactNode;
}> = [
    { key: 'screenings_completed', columnLabel: 'Screening', label: 'Screenings completed', tone: 'info', icon: <FileSearch aria-hidden="true" /> },
    { key: 'interviews_conducted', columnLabel: 'Interviews', label: 'Interviews conducted', tone: 'info', icon: <Users aria-hidden="true" /> },
    { key: 'feedback_submitted', columnLabel: 'Feedback', label: 'Feedback submitted', tone: 'warning', icon: <MessageSquareText aria-hidden="true" /> },
    { key: 'seats_joined', columnLabel: 'Joinings', label: 'Confirmed joinings', tone: 'success', icon: <ClipboardCheck aria-hidden="true" /> },
  ];
const identity = (item: EmployeeTargetItem) => `${item.employeeId}:${item.metric}:${item.periodType}:${item.periodKey}:${item.vacancyId ?? 'ALL'}`;
export function mergeTargets(base: EmployeeTargetItem[], overrides: EmployeeTargetItem[]): EmployeeTargetItem[] {
  const result = new Map(base.map(item => [identity(item), item]));
  for(const item of overrides)
    result.set(identity(item), item);
  return [...result.values()];
}
export function findCellTarget(targets: EmployeeTargetItem[], employeeId: string, metric: TargetMetricKey, periodType: TargetPeriodType, periodKey: string, vacancyId: string | null): EmployeeTargetItem | null {
  return targets.find(item => item.employeeId === employeeId && item.metric === metric && (!item.periodType || item.periodType === periodType) && (!item.periodKey || item.periodKey === periodKey) && (item.vacancyId ?? null) === (vacancyId || null)) ?? null;
}
export interface TeamTargetsSectionProps {
  people: Array<{
    id: string;
    name: string;
    role?: string | null;
  }>;
  rows: TeamRow[];
  perPerson: boolean;
  periodType: TargetPeriodType;
  periodKey: string;
  periodDisplayLabel: string;
  branchId: string | null;
  vacancyId: string | null;
  jobScopeLabel: string;
  targetsState: {
    kind: 'loading';
  } | {
    kind: 'error';
    message: string;
  } | {
    kind: 'ready';
    targets: EmployeeTargetItem[];
  };
  onRetryTargets: () => void;
  onTargetSaved: (item: EmployeeTargetItem) => void;
  onTargetsReloaded: (targets: EmployeeTargetItem[]) => void;
  returnHref: string;
  onOpenRecruiterDrill?: (id: string) => void;
  planningMonth?: string;
}
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'The monthly plan could not be saved. Please try again.';
const isConflict = (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409);
const emptyValues = () => Object.fromEntries(TARGET_METRICS.map(item => [item.key, ''])) as Record<TargetMetricKey, string>;
function stamp(date: string): string { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(date)); }
function MonthlyPlanEditor({ people, initialEmployee, initialMonth, vacancyId, jobScopeLabel, onSaved, onClose }: {
  people: TeamTargetsSectionProps['people'];
  initialEmployee: string;
  initialMonth: string;
  vacancyId: string | null;
  jobScopeLabel: string;
  onSaved: (items: EmployeeTargetItem[]) => void;
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(initialEmployee);
  const [month, setMonth] = useState(initialMonth);
  const [loaded, setLoaded] = useState<EmployeeTargetItem[] | null>(null);
  const [values, setValues] = useState(emptyValues);
  const [initial, setInitial] = useState(emptyValues);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<{
    employeeId: string;
    month: string;
  } | 'close' | null>(null);
  const employeeSelect = useRef<HTMLSelectElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { employeeSelect.current?.focus(); }, []);
  useEffect(() => {
    if(!employeeId) {
      setLoaded([]);
      setValues(emptyValues());
      setInitial(emptyValues());
      return;
    }
    let live = true;
    setLoaded(null);
    setError('');
    setConflict(false);
    setReason('');
    fetchTargetsForPeriod({ scope: 'team', periodType: 'monthly', periodKey: month, employeeId, ...(vacancyId ? { vacancyId } : {}) }).then(result => {
      if(!live)
        return;
      const targets = result.targets.filter(item => item.employeeId === employeeId && item.periodType === 'monthly' && item.periodKey === month && (item.vacancyId ?? null) === (vacancyId ?? null));
      const next = emptyValues();
      for(const target of targets)
        next[target.metric] = String(target.target);
      setLoaded(targets);
      setValues(next);
      setInitial(next);
    }).catch(cause => {
      if(live) {
        setLoaded(null);
        setError(messageOf(cause));
      }
    });
    return () => { live = false; };
  }, [employeeId, month, vacancyId, attempt]);
  const dirty = TARGET_METRICS.some(item => values[item.key] !== initial[item.key]) || reason.trim() !== '';
  const choose = (next: {
    employeeId: string;
    month: string;
  } | 'close') => {
    if(dirty) {
      setPending(next);
      return;
    }
    if(next === 'close')
      onClose();
    else {
      setEmployeeId(next.employeeId);
      setMonth(next.month);
    }
  };
  const existingChanged = loaded?.some(item => values[item.metric] !== String(item.target)) ?? false;
  const monthOptions = [...new Set([month, ...Array.from({ length: 18 }, (_, i) => shiftMonth(cairoMonth(), 6 - i))])].sort().reverse();
  const weeks = monthlyTargetWeeks(month, 0);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setConflict(false);
    if(!employeeId) {
      setError('Choose an employee.');
      return;
    }
    if(!loaded) {
      setError('Load the current monthly plan before saving.');
      return;
    }
    const targets: Array<{
      metric: TargetMetricKey;
      targetQuantity: number;
      version: number | null;
    }> = [];
    for(const metric of TARGET_METRICS) {
      const raw = values[metric.key].trim();
      const current = loaded.find(item => item.metric === metric.key);
      if(!raw && !current)
        continue;
      const quantity = Number(raw);
      if(!/^\d+$/.test(raw) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) {
        setError(`${metric.label}: enter a positive whole number. Existing targets cannot be cleared.`);
        return;
      }
      if(current && typeof current.version !== 'number') {
        setError('The current version is unavailable. Reload the plan before saving.');
        return;
      }
      targets.push({ metric: metric.key, targetQuantity: quantity, version: current?.version ?? null });
    }
    if(!targets.length) {
      setError('Set at least one monthly target.');
      return;
    }
    if(existingChanged && reason.trim().length < 3) {
      setError('Add a short reason for the monthly plan change.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMonthlyTargetPlan({ employeeId, month, vacancyId, reason: reason.trim(), targets });
      if(mounted.current)
        onSaved(saved);
    }
    catch(cause) {
      setError(messageOf(cause));
      setConflict(isConflict(cause));
    }
    finally {
      setSaving(false);
    }
  };
  return <form className="rf2-monthly-plan" aria-label="Monthly target plan" aria-busy={saving || undefined} onSubmit={event => void submit(event)} noValidate>
    <div className="rf2-monthly-plan__intro">
      <span className="rf2-tres__metric-icon" data-tone="info">
        <CalendarDays aria-hidden="true" />
      </span>
      <div>
        <h3>Set monthly targets once</h3>
        <p>Weekly targets update automatically. {jobScopeLabel}.</p>
      </div>
    </div>
    <div className="rf2-monthly-plan__context">
      <SelectV2 ref={employeeSelect} label="Employee" value={employeeId} disabled={saving} onChange={event => choose({ employeeId: event.target.value, month })}>
        <option value="">Select an employee</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</SelectV2>
      <SelectV2 label="Plan month" value={month} disabled={saving} onChange={event => choose({ employeeId, month: event.target.value })}>{monthOptions.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}</SelectV2>
    </div>
    {employeeId && !loaded && !error ? <p role="status">Loading monthly plan…</p> : null}
    <div className="rf2-monthly-plan__metrics">{TARGET_METRICS.map(metric => <div key={metric.key} className="rf2-monthly-plan__metric">
      <span className="rf2-tres__metric-icon" data-tone={metric.tone}>{metric.icon}</span>
      <InputV2 label={metric.label} type="number" inputMode="numeric" min={1} step={1} value={values[metric.key]} placeholder="Not set" disabled={saving || !employeeId || !loaded} onChange={event => setValues(current => ({ ...current, [metric.key]: event.target.value }))} />
    </div>)}</div>
    {existingChanged ? <InputV2 label="Reason for change" value={reason} disabled={saving} onChange={event => setReason(event.target.value)} required /> : null}
    <details className="rf2-monthly-plan__preview">
      <summary>Weekly distribution · automatic</summary>
      <p>Split by calendar days in each Monday–Sunday week. Rounded shares add up to the monthly total; weeks crossing months combine both plans.</p>
      <div className="rf2-jscroll" tabIndex={0} role="region" aria-label="Weekly distribution preview">
        <table className="rf2-jtable">
          <thead>
            <tr>
              <th scope="col">Week of</th>{TARGET_METRICS.map(item => <th scope="col" key={item.key}>{item.columnLabel}</th>)}</tr>
          </thead>
          <tbody>{weeks.map(week => <tr key={week.periodKey}>
            <th scope="row">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(week.weekStart + 'T12:00:00Z'))}</th>{TARGET_METRICS.map(item => <td key={item.key}>{values[item.key].trim() ? monthlyTargetWeeks(month, Number(values[item.key])).find(value => value.periodKey === week.periodKey)?.quantity ?? '—' : '—'}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
    {error ? <div role="alert" className="rf2-tres__error-banner">
      <p>{error}</p>{employeeId && (conflict || !loaded) ? <ButtonV2 size="sm" kind="secondary" disabled={saving} onClick={() => setAttempt(value => value + 1)}>{conflict ? 'Reload latest plan' : 'Retry loading plan'}</ButtonV2> : null}</div> : null}
    {pending ? <div role="alert" aria-label="Unsaved monthly plan" className="rf2-tres__unsaved">
      <p>You have unsaved changes.</p>
      <ButtonV2 kind="secondary" size="sm" onClick={() => {
        const next = pending; setPending(null); if(next === 'close')
          onClose();
        else {
          setEmployeeId(next.employeeId);
          setMonth(next.month);
        }
      }}>Discard changes</ButtonV2>
      <ButtonV2 kind="secondary" size="sm" onClick={() => setPending(null)}>Keep editing</ButtonV2>
    </div> : null}
    <div className="rf2-tres__manage-actions">
      <ButtonV2 type="submit" loading={saving} disabled={saving || !employeeId || !loaded}>Save monthly plan</ButtonV2>
      <ButtonV2 kind="secondary" disabled={saving} onClick={() => choose('close')}>Cancel</ButtonV2>
    </div>
  </form>;
}
export function TeamTargetsSection(props: TeamTargetsSectionProps) {
  const { people, rows, periodType, periodKey, periodDisplayLabel, branchId, vacancyId, jobScopeLabel, targetsState, onRetryTargets, onTargetSaved, onTargetsReloaded, returnHref, onOpenRecruiterDrill } = props;
  const [editor, setEditor] = useState<{
    employeeId: string;
    month: string;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const generation = useRef(0);
  const targets = targetsState.kind === 'ready' ? targetsState.targets : [];
  const targetActive = targets.find(item => item.id === selected);
  const fallbackPerson = selected?.startsWith('actual:') ? people.find(person => selected === `actual:${person.id}`) : undefined;
  const fallbackRow = fallbackPerson ? rows.find(row => row.person?.id === fallbackPerson.id) : undefined;
  const active: Pick<EmployeeTargetItem, 'employeeName' | 'metricLabel' | 'achieved' | 'periodLabel' | 'monthlySources' | 'records' | 'revisions'> | undefined = targetActive ?? (fallbackPerson && fallbackRow ? { employeeName: fallbackPerson.name, metricLabel: 'Confirmed joinings', achieved: fallbackRow.tiles.seats.value, periodLabel: periodDisplayLabel, records: fallbackRow.details?.seats, revisions: [] } : undefined);
  const scope = `${periodType}:${periodKey}:${branchId}:${vacancyId}`;
  useEffect(() => { generation.current += 1; setEditor(null); setSelected(null); setMessage(''); setRefreshError(''); return () => { generation.current += 1; }; }, [scope]);
  useEffect(() => {
    if(!editor)
      editTrigger.current?.focus();
  }, [editor]);
  const currentMonth = periodType === 'monthly' ? periodKey : targets.find(item => item.monthlySources?.length)?.monthlySources?.[0]?.month ?? props.planningMonth ?? cairoMonth();
  const close = () => { setEditor(null); };
  const saved = (items: EmployeeTargetItem[]) => {
    const requestGeneration = generation.current;
    // Saved quantities are global to the job scope; filtered actuals must be reloaded.
    if (periodType === 'monthly' && !branchId) items.forEach(onTargetSaved);
    close();
    setMessage(`Monthly plan saved for ${monthLabel(items[0]?.periodKey ?? currentMonth)}. Weekly targets update automatically.`);
    fetchTargetsForPeriod({ scope: 'team', periodType, periodKey, ...(vacancyId ? { vacancyId } : {}), ...(branchId ? { branchId } : {}) }).then(result => {
        if(requestGeneration === generation.current)
          onTargetsReloaded(result.targets);
      }).catch(() => {
        if(requestGeneration === generation.current)
          setRefreshError('Monthly plan saved. Refresh targets to see the updated progress.');
      });
  };
  const open = (employeeId: string, trigger: HTMLButtonElement) => { editTrigger.current = trigger; setEditor({ employeeId, month: currentMonth }); setSelected(null); setMessage(''); };
  return <section className="rf2-tres__card rf2-tres__targets-section" aria-labelledby="tres-targets">
    <div className="rf2-tres__card-head rf2-tres__targets-head">
      <div>
        <h2 id="tres-targets" className="rf2-tres__card-title">Team targets &amp; progress</h2>
        <p className="rf2-tres__series">{periodDisplayLabel} · {jobScopeLabel}</p>
        <p className="rf2-tres__series">{periodType === 'weekly' ? 'Weekly shares are calculated from monthly plans.' : 'Set monthly plans once. Weekly targets are automatic.'}</p>
      </div>
      <ButtonV2 size="sm" kind="secondary" icon={<Plus />} disabled={Boolean(editor)} onClick={event => open('', event.currentTarget)}>Set monthly targets</ButtonV2>
    </div>
    {message ? <p role="status" className="rf2-tres__status-banner">
      <CheckCircle2 aria-hidden="true" />{message}</p> : null}
    {targetsState.kind === 'loading' ? <p role="status">Loading targets…</p> : null}
    {targetsState.kind === 'error' || refreshError ? <div role="alert" className="rf2-tres__error-banner">
      <p>{refreshError || (targetsState.kind === 'error' ? targetsState.message : '')}</p>
      <ButtonV2 kind="secondary" size="sm" onClick={() => { setRefreshError(''); onRetryTargets(); }}>Retry</ButtonV2>
    </div> : null}
    {editor ? <MonthlyPlanEditor people={people} initialEmployee={editor.employeeId} initialMonth={editor.month} vacancyId={vacancyId} jobScopeLabel={jobScopeLabel} onSaved={saved} onClose={close} /> : null}
    <div className="rf2-jscroll rf2-tres__matrix-wrap" tabIndex={0} role="region" aria-label="Team targets & progress table">
      <table className="rf2-jtable rf2-tres__table rf2-tres__matrix" aria-label="Team targets & progress">
        <thead>
          <tr>
            <th scope="col">Employee</th>{TARGET_METRICS.map(item => <th key={item.key} scope="col">
              <span className="rf2-tres__col-head">
                <span className="rf2-tres__metric-icon" data-tone={item.tone}>{item.icon}</span>{item.columnLabel}</span>
            </th>)}</tr>
        </thead>
        <tbody>
          {people.length === 0 ? <tr>
            <td colSpan={5}>No direct reports in this scope.</td>
          </tr> : null}
          {[...people].sort((a, b) => a.name.localeCompare(b.name)).map(person => <Fragment key={person.id}>
            <tr className="rf2-tres__matrix-row">
              <th scope="row" className="rf2-tres__matrix-emp">
                <div className="rf2-tres__who">
                  <span className="rf2-avatar">{initials(person.name)}</span>
                  <div className="rf2-tres__who-text">
                    <strong>{person.name}</strong>
                    <span className="rf2-jtable__sub">{person.role || 'Recruiter'}</span>
                    <div className="rf2-monthly-plan__row-actions">
                      <ButtonV2 kind="tertiary" size="sm" disabled={Boolean(editor)} aria-label={`Edit monthly plan for ${person.name}`} onClick={event => open(person.id, event.currentTarget)}>Edit plan</ButtonV2>{onOpenRecruiterDrill ? <ButtonV2 kind="tertiary" size="sm" aria-label={`Open performance details for ${person.name}`} onClick={() => onOpenRecruiterDrill(person.id)}>Details</ButtonV2> : null}</div>
                  </div>
                </div>
              </th>{TARGET_METRICS.map(metric => {
                const target = findCellTarget(targets, person.id, metric.key, periodType, periodKey, vacancyId);
                const row = rows.find(item => item.person?.id === person.id);
                const actual = target?.achieved ?? row?.workCounts?.[metric.key] ?? (metric.key === 'seats_joined' ? row?.tiles.seats.value : undefined);
                return <td key={metric.key} className="rf2-tres__matrix-cell">
                  <span className="rf2-tres__cell-mobile-label">
                    <span className="rf2-tres__metric-icon" data-tone={metric.tone}>{metric.icon}</span>{metric.columnLabel}</span>{targetsState.kind === 'error' ? <span>Unavailable</span> : target ? <>
                      <ButtonV2 kind="tertiary" size="sm" aria-label={`View supporting records for ${person.name} ${metric.label}`} onClick={() => setSelected(selected === target.id ? null : target.id)}>{target.achieved} / {target.target}</ButtonV2>
                      <div className="rf2-tres__cell-progress" role="progressbar" aria-label={`${metric.columnLabel} progress for ${person.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, target.progressPercent))} aria-valuetext={`${target.achieved} of ${target.target}`}>
                        <span style={{ width: `${Math.min(100, Math.max(0, target.progressPercent))}%` }} />
                      </div>
                      <p className="rf2-tres__series">{target.achieved > target.target ? 'Target exceeded' : `${target.remaining} remaining`} · {target.progressPercent}%</p>{target.source ? <span className="rf2-monthly-plan__auto">{target.source === 'monthly' ? 'Auto from monthly' : 'Existing weekly target'}</span> : null}</> : <>
                      <span className="rf2-tres__series">Not set</span>{actual !== undefined ? (metric.key === 'seats_joined' && row?.details?.seats ? <ButtonV2 kind="tertiary" size="sm" aria-label={`View supporting records for ${person.name} ${metric.label}`} onClick={() => setSelected(`actual:${person.id}`)}>{actual} achieved</ButtonV2> : <p className="rf2-tres__series">{actual} achieved</p>) : null}</>}</td>;
              })}</tr>
          </Fragment>)}
        </tbody>
      </table>
    </div>
    {active ? <section className="rf2-monthly-plan__records" aria-label={`Supporting records for ${active.employeeName} ${active.metricLabel}`}>
      <div className="rf2-row-between">
        <h3>{active.employeeName} · {active.metricLabel}</h3>
        <ButtonV2 size="sm" kind="secondary" onClick={() => setSelected(null)}>Close records</ButtonV2>
      </div>
      <p>{active.achieved} achieved · {active.periodLabel}</p>{active.monthlySources?.length ? <p className="rf2-tres__series">From {active.monthlySources.map(source => `${monthLabel(source.month)}: ${source.weeklyQuantity} of ${source.monthlyQuantity}`).join(' · ')}</p> : null}
      {active.records === undefined ? <p>Supporting records are unavailable.</p> : active.records.length === 0 ? <p>No completed records for this target.</p> : <div className="rf2-jscroll" tabIndex={0} role="region" aria-label="Supporting records table">
        <table className="rf2-jtable" aria-label={`Supporting records for ${active.metricLabel}`}>
          <thead>
            <tr>
              <th scope="col">Candidate</th>
              <th scope="col">Job</th>
              <th scope="col">Completion date</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>{active.records.map(item => <tr key={item.id}>
            <th scope="row">{item.candidateName}</th>
            <td>{item.jobTitle}</td>
            <td>{item.date ? item.dateLabel && /\d/.test(item.dateLabel) ? item.dateLabel : `${item.dateLabel || 'Completed'}: ${stamp(item.date)}` : '—'}</td>
            <td>{item.status}</td>
            <td>{item.applicationId ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={withReturnTo(`/applications/${encodeURIComponent(item.applicationId)}`, returnHref)}>Open file</Link> : null}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <details>
        <summary>Change history</summary>{active.revisions?.length ? <ul>{active.revisions.map(item => <li key={item.id}>{item.priorTarget ?? 'Not set'} → {item.newTarget} · {item.reason} · {item.actorName} · {stamp(item.createdAt)}</li>)}</ul> : <p>No changes recorded yet.</p>}</details>
    </section> : null}
  </section>;
}
