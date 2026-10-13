import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Globe, Info, Mail, Plug, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { fetchIntegrations, testIntegration, type Integration } from './opsApi';
import '../pages/jobs.css';
import './admin.css';

const when = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(iso)).replace(/^(\w{3}),/, '$1') : 'Never');
const META: Record<string, { title: string; icon: typeof Globe; use: string }> = {
  careers_site: { title: 'Careers site', icon: Globe, use: 'Publishes open jobs; applications land in Applied' },
  smtp: { title: 'Mail (SMTP)', icon: Mail, use: 'Sends interview, offer and stage emails from the outbox' },
};
const statusTone = (s: string) => (s === 'Connected' ? 'success' : s === 'Error' || s === 'Failed' ? 'danger' : 'warning') as 'success' | 'danger' | 'warning';

/** A10 Integrations (Admin seat): careers publishing and mail only (B9). Status as text + icon. */
export function IntegrationsV2() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  useEffect(() => {
    let live = true; setError(null);
    fetchIntegrations().then((i) => live && setItems(i)).catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt]);
  const test = async (i: Integration) => {
    setBusy(i.id);
    try {
      const r = await testIntegration(i.id);
      const ok = r?.success ?? r?.ok ?? (r?.status ? r.status === 'Connected' : true);
      setResult((m) => ({ ...m, [i.id]: { ok, text: r?.message || (ok ? 'Connection works.' : 'The test failed.') } })); setAttempt((n) => n + 1);
    } catch (e) { setResult((m) => ({ ...m, [i.id]: { ok: false, text: (e as { message?: string })?.message || 'The test failed.' } })); } finally { setBusy(null); }
  };
  return (
    <div className="rf2-jobs rf2-admin">
      <div><h1 className="rf2-jobs__title">Integrations</h1><p className="rf2-jobs__sub">Connections that feed and send for RecruitFlow: the careers site and mail. Status is shown with text and an icon.</p></div>
      {!items && !error ? <SkeletonV2 lines={6} label="Loading integrations…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load integrations" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {items ? (
        <div className="rf2-admin__two">
          {items.map((i) => { const m = META[i.provider]; const I = m?.icon ?? Plug; const r = result[i.id]; return (
            <section key={i.id} className="rf2-panel rf2-admin__card" aria-labelledby={`int-${i.id}`}>
              <div className="rf2-row-between rf2-admin__head">
                <h2 id={`int-${i.id}`} className="rf2-jtable__name rf2-admin__inttitle"><span className="rf2-admin__inticon" aria-hidden="true"><I /></span>{m?.title ?? i.name}</h2>
                <StatusChip tone={statusTone(i.status)} icon={i.status === 'Connected' ? <CircleCheck /> : <CircleAlert />} label={i.status} />
              </div>
              <dl className="rf2-decide__facts rf2-admin__intfacts">
                <dt>Name</dt><dd>{i.name}</dd>
                <dt>Use</dt><dd>{m?.use ?? i.category}</dd>
                <dt>Last sync</dt><dd>{when(i.lastSyncAt)}</dd>
              </dl>
              {r ? <p className={r.ok ? 'rf2-inline-note rf2-admin__pad' : 'rf2-form-error rf2-admin__pad'} role={r.ok ? 'status' : 'alert'} data-tone={r.ok ? 'success' : undefined}>{r.text}</p> : null}
              <div className="rf2-admin__pad"><ButtonV2 kind="secondary" size="sm" icon={<Plug />} loading={busy === i.id} disabled={busy !== null} onClick={() => void test(i)} aria-label={`Test connection: ${m?.title ?? i.name}`}>Test connection</ButtonV2></div>
            </section>
          ); })}
          {items.length === 0 ? <EmptyStateV2 title="No integrations set up" body="Careers publishing and mail appear here once the server has them." /> : null}
        </div>
      ) : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> A saved status is not a verified connection. Use Test connection. WhatsApp messages are sent by hand from the drawers (wa.me link); calendar and Meet are not used.</p>
    </div>
  );
}
