import { useEffect, useState, type FormEvent } from 'react';
import { CircleAlert, CircleCheck, Globe, Info, Mail, Plug, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, InputV2, SkeletonV2, StatusChip } from '../../components/v2';
import { fetchIntegrations, testIntegration, updateIntegration, type Integration, type IntegrationSettings } from './opsApi';
import '../pages/jobs.css';
import './admin.css';
import './integrations.css';

const when = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(iso)).replace(/^(\w{3}),/, '$1') : 'Never');
const META: Record<string, { title: string; icon: typeof Globe; use: string }> = {
  careers_site: { title: 'Careers site', icon: Globe, use: 'Publishes open jobs; applications land in Applied' },
  smtp: { title: 'Mail (SMTP)', icon: Mail, use: 'Sends interview, offer and stage emails from the outbox' },
};
const statusTone = (s: string) => (s === 'Connected' ? 'success' : s === 'Error' || s === 'Failed' ? 'danger' : 'warning') as 'success' | 'danger' | 'warning';
const SAVED = 'Settings saved. This does not send mail or mark the provider connected.';
const SMTP_NOT_VERIFIED = 'Mail delivery is not verified. A saved provider setting is not a connection, and this server does not send to candidates.';

/** A stored Connected label is not a verified mail send. */
const labelFor = (i: Integration) => (i.provider === 'smtp' && i.status === 'Connected' ? 'Not verified' : i.status);

function testOutcome(provider: string, r: { success?: boolean; ok?: boolean; message?: string; status?: string }): { ok: boolean; text: string } {
  if (provider === 'smtp') {
    const message = r.message && /not verified/i.test(r.message) && !/\bSent\b/.test(r.message) ? r.message : SMTP_NOT_VERIFIED;
    return { ok: false, text: message };
  }
  const ok = r.success ?? r.ok ?? (r.status ? r.status === 'Connected' : true);
  const text = r.message && !/\bSent\b/.test(r.message) ? r.message : (ok ? 'Connection works.' : 'The test failed.');
  return { ok, text };
}

function httpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

type FieldErrors = { careersUrl?: string; smtpHost?: string; fromAddress?: string; port?: string };

function withSaved(prev: Integration, saved: Integration): Integration {
  return {
    ...prev,
    name: saved.name || prev.name,
    provider: saved.provider || prev.provider,
    category: saved.category || prev.category,
    status: saved.status || prev.status,
    lastSyncAt: saved.lastSyncAt ?? prev.lastSyncAt,
    careersUrl: saved.careersUrl !== undefined ? saved.careersUrl : prev.careersUrl,
    smtpHost: saved.smtpHost !== undefined ? saved.smtpHost : prev.smtpHost,
    fromAddress: saved.fromAddress !== undefined ? saved.fromAddress : prev.fromAddress,
    port: saved.port !== undefined ? saved.port : prev.port,
  };
}

function SettingsForm({ item, blocked, onBusy, onSaved }: { item: Integration; blocked: boolean; onBusy: (id: string | null) => void; onSaved: (item: Integration) => void }) {
  const [careersUrl, setCareersUrl] = useState(item.careersUrl ?? '');
  const [smtpHost, setSmtpHost] = useState(item.smtpHost ?? '');
  const [fromAddress, setFromAddress] = useState(item.fromAddress ?? '');
  const [port, setPort] = useState(item.port != null ? String(item.port) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [note, setNote] = useState<string | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const title = META[item.provider]?.title ?? item.name;

  const persist = async (configJson: IntegrationSettings) => {
    setSaving(true);
    onBusy(item.id);
    setFail(null);
    try {
      const saved = await updateIntegration(item.id, configJson);
      onSaved(withSaved(item, saved));
      setNote(SAVED);
    } catch (e) {
      setNote(null);
      setFail((e as { message?: string })?.message || 'Could not save these settings.');
    } finally {
      setSaving(false);
      onBusy(null);
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || blocked) return;
    if (item.provider === 'careers_site') {
      const next = careersUrl.trim();
      if (!next) { setErrors({ careersUrl: 'Enter the careers URL.' }); return; }
      if (!httpUrl(next)) { setErrors({ careersUrl: 'Enter a careers URL that starts with http:// or https://.' }); return; }
      setErrors({});
      void persist({ careersUrl: next });
      return;
    }
    if (item.provider !== 'smtp') return;
    const nextHost = smtpHost.trim();
    const nextFrom = fromAddress.trim();
    const nextErrors: FieldErrors = {};
    if (!nextHost) nextErrors.smtpHost = 'Enter the SMTP host.';
    else if (/[\s/]/.test(nextHost)) nextErrors.smtpHost = 'Enter the SMTP host name, not a URL.';
    if (!nextFrom) nextErrors.fromAddress = 'Enter the from address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextFrom)) nextErrors.fromAddress = 'Enter an email address.';
    let nextPort: number | undefined;
    if (port.trim()) {
      if (!/^\d+$/.test(port.trim())) nextErrors.port = 'Enter a port from 1 to 65535.';
      else {
        nextPort = Number(port.trim());
        if (nextPort < 1 || nextPort > 65535) nextErrors.port = 'Enter a port from 1 to 65535.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    void persist({ smtpHost: nextHost, fromAddress: nextFrom, ...(nextPort !== undefined ? { port: nextPort } : {}) });
  };

  return (
    <form className="rf2-int__form" noValidate onSubmit={save} aria-label={`Settings: ${title}`}>
      {item.provider === 'careers_site' ? (
        <InputV2 label="Careers URL" type="url" required autoComplete="off" value={careersUrl} error={errors.careersUrl} onChange={(e) => { setCareersUrl(e.target.value); setErrors({}); }} />
      ) : null}
      {item.provider === 'smtp' ? (
        <>
          <InputV2 label="SMTP host" required autoComplete="off" value={smtpHost} error={errors.smtpHost} onChange={(e) => { setSmtpHost(e.target.value); setErrors({}); }} />
          <InputV2 label="From address" type="email" required autoComplete="off" value={fromAddress} error={errors.fromAddress} onChange={(e) => { setFromAddress(e.target.value); setErrors({}); }} />
          <InputV2 label="Port" type="number" inputMode="numeric" min={1} max={65535} value={port} error={errors.port} hint="Optional." onChange={(e) => { setPort(e.target.value); setErrors({}); }} />
        </>
      ) : null}
      <ButtonV2 type="submit" kind="secondary" size="sm" loading={saving} disabled={blocked}>Save settings</ButtonV2>
      {note ? <p className="rf2-inline-note" role="status">{note}</p> : null}
      {fail ? <p className="rf2-form-error" role="alert">{fail}</p> : null}
    </form>
  );
}

/** A10 Integrations (Admin seat): careers publishing and mail only (B9). Status as text + icon. */
export function IntegrationsV2() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
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
      setResult((m) => ({ ...m, [i.id]: testOutcome(i.provider, r ?? {}) }));
      setAttempt((n) => n + 1);
    } catch (e) {
      const message = (e as { message?: string })?.message || 'The test failed.';
      const text = i.provider === 'smtp' || /\bSent\b/.test(message) ? (i.provider === 'smtp' ? SMTP_NOT_VERIFIED : 'The test failed.') : message;
      setResult((m) => ({ ...m, [i.id]: { ok: false, text } }));
    } finally { setBusy(null); }
  };
  return (
    <div className="rf2-jobs rf2-admin rf2-int">
      <div><h1 className="rf2-jobs__title">Integrations</h1><p className="rf2-jobs__sub">Connections that feed and send for RecruitFlow: the careers site and mail. Status is shown with text and an icon.</p></div>
      {!items && !error ? <SkeletonV2 lines={6} label="Loading integrations…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load integrations" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {items ? (
        <div className="rf2-admin__two">
          {items.map((i) => { const m = META[i.provider]; const I = m?.icon ?? Plug; const r = result[i.id]; const label = labelFor(i); return (
            <section key={i.id} className="rf2-panel rf2-admin__card" aria-labelledby={`int-${i.id}`}>
              <div className="rf2-row-between rf2-admin__head">
                <h2 id={`int-${i.id}`} className="rf2-jtable__name rf2-admin__inttitle"><span className="rf2-admin__inticon" aria-hidden="true"><I /></span>{m?.title ?? i.name}</h2>
                <StatusChip tone={statusTone(label)} icon={label === 'Connected' ? <CircleCheck /> : <CircleAlert />} label={label} />
              </div>
              <dl className="rf2-decide__facts rf2-admin__intfacts">
                <dt>Name</dt><dd>{i.name}</dd>
                <dt>Use</dt><dd>{m?.use ?? i.category}</dd>
                <dt>Last sync</dt><dd>{when(i.lastSyncAt)}</dd>
              </dl>
              {i.provider === 'careers_site' || i.provider === 'smtp' ? (
                <SettingsForm item={i} blocked={busy !== null || (saving !== null && saving !== i.id)} onBusy={setSaving} onSaved={(next) => setItems((rows) => rows?.map((row) => row.id === next.id ? next : row) ?? rows)} />
              ) : null}
              {r ? <p className={r.ok ? 'rf2-inline-note rf2-admin__pad' : 'rf2-form-error rf2-admin__pad'} role={r.ok ? 'status' : 'alert'} data-tone={r.ok ? 'success' : undefined}>{r.text}</p> : null}
              <div className="rf2-admin__pad"><ButtonV2 kind="secondary" size="sm" icon={<Plug />} loading={busy === i.id} disabled={busy !== null || saving !== null} onClick={() => void test(i)} aria-label={`Test connection: ${m?.title ?? i.name}`}>Test connection</ButtonV2></div>
            </section>
          ); })}
          {items.length === 0 ? <EmptyStateV2 title="No integrations set up" body="Careers publishing and mail appear here once the server has them." /> : null}
        </div>
      ) : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> A saved status is not a verified connection. Use Test connection. WhatsApp messages are sent by hand from the drawers (wa.me link); calendar and Meet are not used.</p>
    </div>
  );
}
