import { useEffect, useMemo, useState } from 'react';
import { Download, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, SelectV2, SkeletonV2, StatusChip, initials } from '../../components/v2';
import { auditArea, downloadCsv, fetchAudit, humanize, toCsv, type AuditEntry } from './opsApi';
import '../pages/jobs.css';
import '../pages/team.css';
import './admin.css';

const PERIODS: Array<[string, string, number]> = [['7', 'Last 7 days', 7], ['30', 'Last 30 days', 30], ['all', 'Everything loaded', 0]];
const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(iso));
const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(iso));

/** A09 Audit (Admin seat): every change, read-only. Nothing can be deleted. */
export function AuditV2({ now = () => Date.now() }: { now?: () => number } = {}) {
  const [data, setData] = useState<{ rows: AuditEntry[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [period, setPeriod] = useState('7');
  const [who, setWho] = useState('all');
  const [area, setArea] = useState('all');
  useEffect(() => {
    let live = true; setData(null); setError(null);
    fetchAudit().then((d) => live && setData(d)).catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt]);
  const actors = useMemo(() => [...new Map((data?.rows ?? []).filter((r) => r.actorUserId).map((r) => [r.actorUserId!, r.actorDisplayName ?? 'Unknown user'])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [data]);
  const areas = useMemo(() => [...new Set((data?.rows ?? []).map(auditArea))].sort(), [data]);
  const days = PERIODS.find(([k]) => k === period)![2];
  const rows = (data?.rows ?? []).filter((r) => (!days || now() - new Date(r.createdAt).getTime() <= days * 86400000) && (who === 'all' || r.actorUserId === who) && (area === 'all' || auditArea(r) === area))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exportCsv = () => downloadCsv('recruitflow-audit.csv', toCsv(['When (Cairo)', 'Who', 'Area', 'What', 'Reason', 'Result', 'Object', 'Object id'],
    rows.map((r) => [`${fmtDay(r.createdAt)} ${fmtTime(r.createdAt)}`, r.actorDisplayName ?? 'System', auditArea(r), humanize(r.action), r.reason, r.result, r.entityType, r.entityId])));
  return (
    <div className="rf2-jobs rf2-admin">
      <div className="rf2-row-between">
        <div><h1 className="rf2-jobs__title">Audit</h1><p className="rf2-jobs__sub">Every change on files, jobs, requisitions and settings. Read-only; nothing can be deleted.</p></div>
        <ButtonV2 kind="secondary" icon={<Download />} onClick={exportCsv} disabled={!data || rows.length === 0}>Export</ButtonV2>
      </div>
      <div className="rf2-row-between">
        <div className="rf2-admin__filterset">
          <SelectV2 label="Period" fieldClassName="rf2-sr-label" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>Period: {l}</option>)}</SelectV2>
          <SelectV2 label="Who" fieldClassName="rf2-sr-label" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Who: Anyone</option>{actors.map(([id, n]) => <option key={id} value={id}>Who: {n}</option>)}</SelectV2>
          <SelectV2 label="Area" fieldClassName="rf2-sr-label" value={area} onChange={(e) => setArea(e.target.value)}><option value="all">Area: All</option>{areas.map((a) => <option key={a} value={a}>Area: {a}</option>)}</SelectV2>
        </div>
        {data ? <span className="rf2-jtable__sub" aria-live="polite">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}{data.total > data.rows.length ? ` · latest ${data.rows.length} of ${data.total} loaded` : ''}</span> : null}
      </div>
      {!data && !error ? <SkeletonV2 lines={8} label="Loading audit…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load the audit log" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <div className="rf2-panel rf2-admin__card">
          <table className="rf2-jtable" aria-label="Audit log">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Area</th><th scope="col">What</th><th scope="col">Object</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><span className="rf2-jtable__name">{fmtDay(r.createdAt)}</span><span className="rf2-jtable__sub">{fmtTime(r.createdAt)}</span></td>
                <td><span className="rf2-admin__who"><span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(r.actorDisplayName ?? 'System')}</span>{r.actorDisplayName ?? 'System'}</span></td>
                <td><StatusChip tone={auditArea(r) === 'Override' ? 'warning' : 'neutral'} label={auditArea(r)} /></td>
                <td>{humanize(r.action)}{r.reason ? ` — ${r.reason}` : ''}{r.result && r.result !== 'Success' && r.result !== 'SUCCESS' ? <span className="rf2-jtable__sub">Result: {r.result}</span> : null}</td>
                <td><span className="rf2-jtable__sub">{humanize(r.entityType)} · {r.entityId.slice(0, 8)}</span></td>
              </tr>
            ))}{rows.length === 0 ? <tr><td colSpan={5}>No entries match.</td></tr> : null}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
