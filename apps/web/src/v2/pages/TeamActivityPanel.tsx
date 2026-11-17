import { useState } from 'react';
import { SelectV2 } from '../../components/v2';
import type { EmployeeTargetItem, TargetMetricKey, TargetPeriodType } from '../api/myResult';
import type { TeamResult } from '../api/teamResult';
import { findCellTarget, TARGET_METRICS } from './ManageTargetsDrawer';

export function TeamActivityPanel({ data, periodType, periodKey, periodLabel, targets, vacancyId, targetsUnavailable }: {
  data: TeamResult;
  periodType: TargetPeriodType;
  periodKey: string;
  periodLabel: string;
  targets: EmployeeTargetItem[];
  vacancyId: string | null;
  targetsUnavailable: boolean;
}) {
  const [metric, setMetric] = useState<TargetMetricKey>('screenings_completed');
  const selected = TARGET_METRICS.find((item) => item.key === metric)!;
  const entries = data.people.map((person) => {
    const row = data.rows.find((item) => item.person?.id === person.id);
    const target = findCellTarget(targets, person.id, metric, periodType, periodKey, vacancyId);
    return { person, actual: row?.workCounts?.[metric] ?? target?.achieved ?? null, target: target?.target ?? null };
  });
  const max = Math.max(1, ...entries.flatMap((item) => [item.actual ?? 0, item.target ?? 0]));
  return (
    <section className="rf2-tres__card rf2-tres__activity" aria-labelledby="tres-activity">
      <div className="rf2-tres__card-head">
        <h3 id="tres-activity" className="rf2-tres__card-title">Actual vs target</h3>
        <SelectV2 label="Activity metric" fieldClassName="rf2-sr-label" value={metric} onChange={(event) => setMetric(event.target.value as TargetMetricKey)}>
          {TARGET_METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </SelectV2>
      </div>
      <p className="rf2-tres__series">{selected.label} · {periodLabel}</p>
      <div className="rf2-tres__legend"><span data-series="actual">Actual</span><span data-series="target">Target</span></div>
      {targetsUnavailable ? <p className="rf2-tres__series" role="status">Targets unavailable. Actual completed work is still shown.</p> : null}
      {entries.length === 0 ? <p className="rf2-tres__empty">No employees in this scope.</p> : (
        <ul className="rf2-tres__comparison" tabIndex={0} aria-label={`${selected.label}: actual vs target`}>
          {entries.map(({ person, actual, target }) => (
            <li key={person.id}>
              <strong>{person.name}</strong>
              <div className="rf2-tres__comparison-series">
                <span className="rf2-tres__comparison-track" aria-hidden="true"><span data-series="actual" style={{ width: `${((actual ?? 0) / max) * 100}%` }} /></span>
                <span className="rf2-num">{actual === null ? 'Unavailable' : `${actual} actual`}</span>
                <span className="rf2-tres__comparison-track" aria-hidden="true"><span data-series="target" style={{ width: `${((target ?? 0) / max) * 100}%` }} /></span>
                <span className="rf2-num">{targetsUnavailable ? 'Unavailable' : target === null ? 'Not set' : `${target} target`}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
