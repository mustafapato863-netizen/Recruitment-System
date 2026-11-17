import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardCheck, RotateCw, Target, Users } from 'lucide-react';
import { ButtonV2 } from '../../components/v2/Button';
import { DrawerV2 } from '../../components/v2/Drawer';
import { SkeletonV2 } from '../../components/v2/PageStates';
import { cairoMonth, cairoWeek, fetchTargetsForPeriod, monthLabel, weekChoices, type EmployeeTargetItem, type TargetPeriodType } from '../api/myResult';
import { withReturnTo } from '../returnTarget';

type TargetRead = { key: string } & (
  | { status: 'loading' }
  | { status: 'ready'; items: EmployeeTargetItem[] }
  | { status: 'error'; message: string }
);
const icons = { screenings_completed: ClipboardCheck, interviews_conducted: CalendarCheck, feedback_submitted: ClipboardCheck, seats_joined: Users };

/** Personal targets are independent of the daily task queue and never substitute hiring headcount. */
export function MyWorkTargets({ today, employeeId, period, onPeriod, returnTo, canOpenFile, refreshKey }: {
  today: string; employeeId?: string; period: TargetPeriodType; onPeriod: (period: TargetPeriodType) => void;
  returnTo: string | null; canOpenFile: boolean; refreshKey: number;
}) {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(today) ? new Date(`${today}T12:00:00Z`) : new Date();
  const periodKey = period === 'weekly' ? cairoWeek(anchor) : cairoMonth(anchor);
  const key = `${employeeId ?? ''}:${period}:${periodKey}`;
  const label = period === 'monthly' ? monthLabel(periodKey) : weekChoices(1, anchor)[0]?.label ?? periodKey;
  const [attempt, setAttempt] = useState(0);
  const [opened, setOpened] = useState<string | null>(null);
  const [read, setRead] = useState<TargetRead>({ key: '', status: 'loading' });
  useEffect(() => {
    // The targets endpoint requires the same application-view permission as its record links.
    if (!canOpenFile) return undefined;
    let live = true;
    setRead({ key, status: 'loading' });
    fetchTargetsForPeriod({ scope: 'me', periodType: period, periodKey })
      .then((result) => { if (live) setRead({ key, status: 'ready', items: result.targets }); })
      .catch((error: unknown) => { if (live) setRead({ key, status: 'error', message: error instanceof Error ? error.message : 'Could not load your targets.' }); });
    return () => { live = false; };
  }, [canOpenFile, key, period, periodKey, attempt, refreshKey]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt((value) => value + 1); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  const current = read.key === key ? read : { key, status: 'loading' as const };
  const items = current.status === 'ready' ? current.items : [];
  const selected = items.find((item) => item.id === opened);
  if (!canOpenFile) return null;
  return (
    <section className="rf2-work-targets" aria-labelledby="work-targets-title">
      <div className="rf2-work-targets__head">
        <div><h2 id="work-targets-title">My targets</h2><p>{label}</p></div>
        <div className="rf2-work-targets__switch" role="group" aria-label="Target period">
          {(['monthly', 'weekly'] as const).map((value) => <ButtonV2 key={value} kind="secondary" size="sm" selected={period === value} onClick={() => { setOpened(null); onPeriod(value); }}>{value === 'monthly' ? 'Monthly' : 'Weekly'}</ButtonV2>)}
        </div>
      </div>
      {current.status === 'loading' ? <SkeletonV2 lines={3} label={`Loading ${period} targets`} /> : null}
      {current.status === 'error' ? <div className="rf2-work-targets__message" role="alert"><p>{current.message}</p><ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setAttempt((value) => value + 1)}>Retry targets</ButtonV2></div> : null}
      {current.status === 'ready' && !items.length ? <p className="rf2-work-targets__message">No targets assigned for this {period === 'monthly' ? 'month' : 'week'}.</p> : null}
      {items.length ? <ul className="rf2-work-targets__grid" aria-label={`${period === 'monthly' ? 'Monthly' : 'Weekly'} targets`}>
        {items.map((item) => {
          const Icon = icons[item.metric] ?? Target;
          const progress = Math.max(0, Math.min(100, item.progressPercent));
          return <li key={item.id} className="rf2-work-targets__card">
            <div className="rf2-work-targets__metric"><span aria-hidden="true"><Icon /></span><h3>{item.metricLabel}</h3></div>
            <p className="rf2-work-targets__value"><strong>{item.achieved}</strong><span> / {item.target}</span></p>
            <div className="rf2-work-targets__progress" role="progressbar" aria-label={`${item.metricLabel} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${item.achieved} of ${item.target}, ${item.progressPercent}% complete`}><span style={{ width: `${progress}%` }} /></div>
            <p className="rf2-work-targets__remaining">{item.remaining} remaining <span>{item.progressPercent}%</span></p>
            {item.source?<p className="rf2-work-targets__message">{item.source==='monthly'?'Auto from monthly plan':'Existing weekly target'}</p>:null}
            <div className="rf2-work-targets__foot"><span>{item.jobTitle || 'All my jobs'}</span><ButtonV2 kind="tertiary" size="sm" aria-label={`View records for ${item.metricLabel}${item.jobTitle ? `: ${item.jobTitle}` : ''}`} onClick={() => setOpened(item.id)}>View records</ButtonV2></div>
          </li>;
        })}
      </ul> : null}
      {selected ? <DrawerV2 open title={selected.metricLabel} kicker={`${selected.periodLabel} · Target records`} subtitle={`${selected.achieved} achieved of ${selected.target}`} onClose={() => setOpened(null)}>
        {selected.records === undefined ? <p>Supporting records are unavailable.</p> : !selected.records.length ? <p>No completed records for this target.</p> : <ul className="rf2-work-targets__records">
          {selected.records.map((record) => <li key={record.id}><div><strong>{record.candidateName}</strong><p>{record.jobTitle} · {record.status}</p>{record.date ? <time dateTime={record.date}>{record.date.slice(0, 10)}</time> : null}</div>{canOpenFile && record.applicationId ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={withReturnTo(`/applications/${encodeURIComponent(record.applicationId)}`, returnTo)} aria-label={`Open file for ${record.candidateName}`}>Open file</Link> : null}</li>)}
        </ul>}
      </DrawerV2> : null}
    </section>
  );
}
