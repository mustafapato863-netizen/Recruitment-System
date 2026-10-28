import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, RotateCw } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, SelectV2, SkeletonV2, StatusChip, initials } from '../../components/v2';
import { auditArea, downloadCsv, fetchAudit, humanize, namedAuditText, toCsv, type AuditEntry, type AuditPage, type AuditQuery } from './opsApi';
import { fetchUsers } from './usersApi';
import '../pages/jobs.css';
import '../pages/team.css';
import './admin.css';

const PERIODS: Array<[string, string, number]> = [['7', 'Last 7 days', 7], ['30', 'Last 30 days', 30], ['all', 'Everything', 0]];
const AUDIT_AREAS = ['Exit', 'File', 'Interview', 'Job', 'Offer', 'Other', 'Override', 'Requisition', 'Screening', 'Settings', 'Users'];
const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(iso));
const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(iso));

/** Page with the same period and actor until the collected rows cover the server total. */
async function collectAudit(q: Omit<AuditQuery, 'page'>): Promise<{ rows: AuditEntry[]; server: boolean }> {
  const rows: AuditEntry[] = [];
  const seen = new Set<string>();
  let total = Number.POSITIVE_INFINITY;
  let server = false;
  for (let page = 1; rows.length < total && page <= 100; page += 1) {
    const next = await fetchAudit({ ...q, page });
    server = next.server;
    total = next.total;
    const fresh = next.rows.filter((row) => !seen.has(row.id));
    if (fresh.length === 0) break;
    for (const row of fresh) seen.add(row.id);
    rows.push(...fresh);
  }
  return { rows, server };
}

function auditCsv(entries: AuditEntry[], names: ReadonlyMap<string, string>): string {
  return toCsv(['When (Cairo)', 'Who', 'Area', 'What', 'Reason', 'Result', 'Object', 'Object id'],
    entries.map((r) => [`${fmtDay(r.createdAt)} ${fmtTime(r.createdAt)}`, r.actorDisplayName ?? 'System', auditArea(r), humanize(r.action), namedAuditText(r.reason, names), r.result, r.entityType, r.entityId]));
}

/** A09 Audit (Admin seat): every change, read-only. Nothing can be deleted. */
export function AuditV2({ now = () => Date.now() }: { now?: () => number } = {}) {
  const [data, setData] = useState<AuditPage | null>(null);
  const [page, setPage] = useState(1);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  // B2F-12: user ids inside audit text (FILE_REASSIGN "<from> -> <to>: reason") read as names.
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    fetchUsers().then((us) => live && setUserNames(new Map(us.map((u) => [u.id.toLowerCase(), u.displayName])))).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const [attempt, setAttempt] = useState(0);
  const [period, setPeriod] = useState('7');
  const [who, setWho] = useState('all');
  const [area, setArea] = useState('all');
  const [evidence, setEvidence] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const days = PERIODS.find(([k]) => k === period)![2];
  // CoS: period and who go to the server (GET /audit) with paging; the /audit-logs fallback filters on the client.
  const from = days ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(now() - days * 86400000)) : undefined;
  useEffect(() => {
    let live = true; setData(null); setError(null);
    fetchAudit({ page, from, actor: who === 'all' ? undefined : who })
      .then((d) => { if (!live) return; setData(d); setActorNames((m) => { const n = new Map(m); for (const r of d.rows) if (r.actorUserId) n.set(r.actorUserId, r.actorDisplayName ?? 'Unknown user'); return n; }); })
      .catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt, page, from, who]);
  const names = useMemo(() => { const n = new Map(userNames); for (const [id, nm] of actorNames) if (!n.has(id.toLowerCase())) n.set(id.toLowerCase(), nm); return n; }, [userNames, actorNames]);
  const actors = useMemo(() => [...actorNames.entries()].sort((a, b) => a[1].localeCompare(b[1])), [actorNames]);
  const server = !!data?.server;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const areas = useMemo(() => [...new Set([...AUDIT_AREAS, ...(data?.rows ?? []).map(auditArea)])].sort(), [data]);
  const rows = (data?.rows ?? []).filter((r) => (server || !days || now() - new Date(r.createdAt).getTime() <= days * 86400000) && (server || who === 'all' || r.actorUserId === who) && (area === 'all' || auditArea(r) === area))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exportCsv = async () => {
    if (!data || exporting || data.total === 0) return;
    setExporting(true); setExportError(null);
    try {
      const actor = who === 'all' ? undefined : who;
      const collected = await collectAudit({ from, actor });
      const filtered = collected.rows.filter((r) => (collected.server || !days || now() - new Date(r.createdAt).getTime() <= days * 86400000) && (collected.server || who === 'all' || r.actorUserId === who) && (area === 'all' || auditArea(r) === area))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (filtered.length === 0) { setExportError('No entries match this filter.'); return; }
      downloadCsv('recruitflow-audit.csv', auditCsv(filtered, names));
    } catch (e) { setExportError((e as { message?: string })?.message || 'Could not export.'); }
    finally { setExporting(false); }
  };
  return (
    <div className="rf2-jobs rf2-admin">
      <div className="rf2-row-between">
        <div><h1 className="rf2-jobs__title">Audit</h1></div>
        <ButtonV2 kind="secondary" icon={<Download />} onClick={() => void exportCsv()} disabled={!data || data.total === 0 || exporting}>Export</ButtonV2>
      </div>
      {exportError ? <p className="rf2-form-error" role="alert">{exportError}</p> : null}
      <div className="rf2-row-between">
        <div className="rf2-admin__filterset">
          <SelectV2 label="Period" fieldClassName="rf2-sr-label" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}>{PERIODS.map(([k, l]) => <option key={k} value={k}>Period: {l}</option>)}</SelectV2>
          <SelectV2 label="Who" fieldClassName="rf2-sr-label" value={who} onChange={(e) => { setWho(e.target.value); setPage(1); }}><option value="all">Who: Anyone</option>{actors.map(([id, n]) => <option key={id} value={id}>Who: {n}</option>)}</SelectV2>
          <SelectV2 label="Area" fieldClassName="rf2-sr-label" value={area} onChange={(e) => setArea(e.target.value)}><option value="all">Area: All</option>{areas.map((a) => <option key={a} value={a}>Area: {a}</option>)}</SelectV2>
        </div>
        {data ? <span className="rf2-jtable__sub" aria-live="polite">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}{server ? ` · page ${data.page} of ${pages} (${data.total} in total)` : data.total > data.rows.length ? ` · latest ${data.rows.length} of ${data.total} loaded` : ''}</span> : null}
      </div>
      {!data && !error ? <SkeletonV2 lines={8} label="Loading audit…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load the audit log" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <div className="rf2-panel rf2-admin__card">
          <table className="rf2-jtable" aria-label="Audit log">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Area</th><th scope="col">What</th><th scope="col">Object</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <button type="button" className="rf2-admin__person" aria-label={`Open evidence ${r.id}`} onClick={() => setEvidence(r)}>
                    <span><span className="rf2-jtable__name">{fmtDay(r.createdAt)}</span><span className="rf2-jtable__sub">{fmtTime(r.createdAt)}</span></span>
                  </button>
                </td>
                <td><span className="rf2-admin__who"><span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(r.actorDisplayName ?? 'System')}</span>{r.actorDisplayName ?? 'System'}</span></td>
                <td><StatusChip tone={auditArea(r) === 'Override' ? 'warning' : 'neutral'} label={auditArea(r)} /></td>
                <td>{humanize(r.action)}{r.reason ? ` — ${namedAuditText(r.reason, names)}` : ''}{r.result && r.result !== 'Success' && r.result !== 'SUCCESS' ? <span className="rf2-jtable__sub">Result: {r.result}</span> : null}</td>
                <td><span className="rf2-jtable__sub">{humanize(r.entityType)} · {r.entityId.slice(0, 8)}</span></td>
              </tr>
            ))}{rows.length === 0 ? <tr><td colSpan={5}>No entries match.</td></tr> : null}</tbody>
          </table>
          {pages > 1 ? (
            <nav className="rf2-row-between rf2-admin__pad" aria-label="Audit pages">
              <ButtonV2 kind="secondary" size="sm" icon={<ChevronLeft />} disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Newer</ButtonV2>
              <span className="rf2-jtable__sub">Page {page} of {pages}</span>
              <ButtonV2 kind="secondary" size="sm" icon={<ChevronRight />} disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>Older</ButtonV2>
            </nav>
          ) : null}
        </div>
      ) : null}
      {evidence ? <AuditEvidence entry={evidence} names={names} onClose={() => setEvidence(null)} /> : null}
    </div>
  );
}

function AuditEvidence({ entry, names, onClose }: { entry: AuditEntry; names: ReadonlyMap<string, string>; onClose: () => void }) {
  const facts: Array<[string, string]> = [
    ['When (Cairo)', `${fmtDay(entry.createdAt)} ${fmtTime(entry.createdAt)}`],
    ['Who', entry.actorDisplayName ?? 'System'],
    ['Area', auditArea(entry)],
    ['Action', humanize(entry.action)],
    ['Reason', namedAuditText(entry.reason, names) || '—'],
    ['Result', entry.result],
    ['Object type', humanize(entry.entityType)],
    ['Object id', entry.entityId],
  ];
  if (entry.correlationId) facts.push(['Correlation id', entry.correlationId]);
  return (
    <DrawerV2 open onClose={onClose} kicker="Audit" title="Audit entry">
      <dl className="rf2-decide__facts">
        {facts.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}
      </dl>
    </DrawerV2>
  );
}
