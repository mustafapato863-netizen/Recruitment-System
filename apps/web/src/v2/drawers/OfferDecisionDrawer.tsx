import { useEffect, useState } from 'react';
import { CircleCheck, Info, PencilLine, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, initials, InputV2, SelectV2, StatusChip, TextareaV2 } from '../../components/v2';
import {
  bandFor, bandPosition, CURRENCIES, currentVersion, decide, decisionError, defaultCurrency, loadDecision, money, payOf,
  type Decision, type DecisionError, type DecisionPay, type DecisionOffer, type GradeBand,
} from '../api/offerDecision';

const fmtDay = (d?: string | null) => (d ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`)).replace(/^(\w{3}),/, '$1') : '—');
const fmtWhen = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(/^(\w{3}),/, '$1') : '');
const waitingFor = (iso?: string | null) => { if (!iso) return null; const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)); return d === 0 ? 'Waiting today' : `Waiting ${d} ${d === 1 ? 'day' : 'days'}`; };

/** M05 Offer decision (Manager, B7). Pay + band only when showPay (Manager seat with OFFER_PAY_VIEW). */
export function OfferDecisionDrawer({ offerId, ownerName, showPay, onClose, onDone }: {
  offerId: string; ownerName: string | null; showPay: boolean; onClose: () => void; onDone: (message: string) => void;
}) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; offer: DecisionOffer; bands: GradeBand[] | null } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [err, setErr] = useState<DecisionError | null>(null);

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    loadDecision(offerId, showPay).then((r) => live && setState({ kind: 'ready', ...r })).catch((e: { message?: string }) => live && setState({ kind: 'error', message: e?.message || 'Could not load the offer.' }));
    return () => { live = false; };
  }, [offerId, showPay, attempt]);

  const offer = state.kind === 'ready' ? state.offer : null;
  const v = offer ? currentVersion(offer) : null;
  const pay = showPay ? payOf(v) : null;
  // CoS: the Manager sets pay on Approve. Prefilled from the version; editable only with showPay (Manager seat + OFFER_PAY_VIEW).
  const [form, setForm] = useState<{ base: string; currency: string; allowances: Array<{ name: string; amount: string }> } | null>(null);
  useEffect(() => {
    if (!showPay || !v || form) return;
    const allow = (v.components ?? []).filter((c) => ['allowance', 'benefit'].includes(c.type.trim().toLowerCase()) && typeof c.amount === 'number');
    const fromBand = offer && state.kind === 'ready' ? defaultCurrency(state.bands, offer) : null;
    setForm({ base: pay?.base ? String(pay.base.amount) : '', currency: pay?.base?.currency ?? fromBand ?? allow[0]?.currency ?? CURRENCIES[0], allowances: allow.map((c) => ({ name: c.name, amount: String(c.amount) })) });
  }, [showPay, v, form, pay?.base, offer, state]);
  const baseNum = form && form.base.trim() !== '' && Number.isFinite(Number(form.base)) ? Number(form.base) : null;
  const band = offer && state.kind === 'ready' ? bandFor(state.bands, offer, form?.currency ?? pay?.base?.currency ?? null) : null;
  const pos = bandPosition(band, baseNum);
  const allowTotal = (form?.allowances ?? []).reduce((t, a) => t + (Number(a.amount) || 0), 0);
  const payBody = (): DecisionPay | null => {
    if (!form) return null;
    if (baseNum === null || baseNum <= 0) { setErr({ field: 'pay', text: 'Enter the monthly basic pay.' }); return null; }
    const bad = form.allowances.find((a) => !a.name.trim() || !(Number(a.amount) >= 0) || a.amount.trim() === '');
    if (bad) { setErr({ field: 'pay', text: 'Each allowance needs a name and an amount (0 or more).' }); return null; }
    return { basePay: baseNum, currency: form.currency, allowances: form.allowances.map((a) => ({ name: a.name.trim(), amount: Number(a.amount) })) };
  };
  const setAllow = (i: number, k: 'name' | 'amount', val: string) => { setForm((f) => f && { ...f, allowances: f.allowances.map((a, j) => (j === i ? { ...a, [k]: val } : a)) }); setErr(null); };
  const pending = v?.status === 'Pending Approval' || (!v?.status && offer?.status === 'Pending Approval');
  const owner = ownerName ?? 'the owner';
  const first = owner.split(' ')[0];

  const run = async (d: Decision) => {
    if (!offer || !v) return;
    if (d !== 'Approve' && reason.trim().length < 3) { setErr({ field: 'reason', text: d === 'Reject' ? 'Write a comment to reject (at least 3 characters).' : 'Write a comment to request changes (at least 3 characters).' }); return; }
    let body: DecisionPay | undefined;
    if (d === 'Approve' && showPay) { const b = payBody(); if (!b) return; body = b; }
    setBusy(d); setErr(null);
    try {
      await decide(offer.id, v.id, d, reason.trim() || undefined, body);
      const who = offer.candidateName ?? 'the candidate';
      onDone(d === 'Approve' ? `Offer for ${who} approved. ${first} can send it now.` : d === 'RequestChanges' ? `Changes requested on ${who}’s offer. It is back with ${first} as a draft.` : `Offer v${v.versionNumber} for ${who} rejected. The file stays in Offer; ${first} drafts a new version or closes the file.`);
    } catch (e) { setErr(decisionError(e)); } finally { setBusy(null); }
  };

  const errBand = err?.band;
  const shownBand = band ?? (errBand ? { id: String(errBand.id ?? ''), grade: errBand.grade ? { id: '', name: String(errBand.grade) } : null, site: errBand.site ? { id: '', name: String(errBand.site) } : null, currency: String(errBand.currency ?? ''), minMonthlyBase: typeof errBand.minMonthlyBase === 'number' ? errBand.minMonthlyBase : undefined, maxMonthlyBase: typeof errBand.maxMonthlyBase === 'number' ? errBand.maxMonthlyBase : undefined } : null);
  const amount = (showPay ? baseNum : null) ?? err?.offered ?? null;
  const shownPos = pos ?? bandPosition(shownBand, amount);

  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer decision${v ? ` · v${v.versionNumber}` : ''}`} title={offer?.candidateName ? `Offer for ${offer.candidateName}` : 'Offer decision'}
      status={state.kind === 'loading' ? 'loading' : state.kind === 'error' ? 'error' : 'ready'} errorMessage={state.kind === 'error' ? state.message : undefined} onRetry={() => setAttempt((n) => n + 1)}
      primaryAction={pending ? <ButtonV2 icon={<CircleCheck />} loading={busy === 'Approve'} disabled={!!busy || !v} onClick={() => void run('Approve')}>Approve offer</ButtonV2> : <ButtonV2 onClick={onClose}>Close</ButtonV2>}
      secondaryAction={pending ? <ButtonV2 kind="secondary" icon={<PencilLine />} loading={busy === 'RequestChanges'} disabled={!!busy} onClick={() => void run('RequestChanges')}>Request changes</ButtonV2> : null}
      confirmClose={() => !reason.trim() || window.confirm('Discard your comment?')}>
      {offer && v ? (
        <div className="rf2-drawer-form rf2-decide">
          <div className="rf2-decide__by">
            <span className="rf2-avatar" aria-hidden="true">{initials(owner)}</span>
            <div><p className="rf2-jtable__name">Submitted by {owner}</p><p className="rf2-jtable__sub">{fmtWhen(v.createdAt)}</p></div>
            {pending && waitingFor(v.createdAt) ? <StatusChip tone="neutral" label={waitingFor(v.createdAt)!} /> : <StatusChip tone="info" label={v.status ?? offer.status} />}
          </div>
          <dl className="rf2-decide__facts">
            <dt>Job</dt><dd>{[offer.positionTitle, offer.location].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Grade</dt><dd>{offer.grade?.name ?? 'No grade'}</dd>
            <dt>Start date</dt><dd>{fmtDay(v.proposedJoiningDate)}</dd>
            <dt>Contract</dt><dd>{v.contractType ?? '—'}</dd>
            <dt>Probation</dt><dd>{v.probationPeriod ?? '—'}</dd>
          </dl>
          {showPay ? (
            <>
              {form ? (
                <fieldset className="rf2-decide__payform" disabled={!pending}>
                  <legend className="rf2-field__label">Pay (set by you on Approve)</legend>
                  {err?.field === 'pay' ? <p className="rf2-form-error" role="alert" ref={(el) => el?.scrollIntoView?.({ block: 'nearest' })} data-testid="decision-error">{err.text}</p> : null}
                  {pay?.mixed ? <p className="rf2-jtable__sub">The version mixes currencies; pick one.</p> : null}
                  <div className="rf2-req__row">
                    <InputV2 label={`Monthly basic pay (${form.currency})`} required type="number" min={0} inputMode="numeric" value={form.base} onChange={(e) => { setForm({ ...form, base: e.target.value }); setErr(null); }} data-testid="base-pay" />
                    <SelectV2 label="Currency" value={form.currency} onChange={(e) => { setForm({ ...form, currency: e.target.value }); setErr(null); }}>
                      {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
                    </SelectV2>
                  </div>
                  {form.allowances.map((a, i) => (
                    <div className="rf2-decide__allow" key={i}>
                      <InputV2 label={`Allowance ${i + 1} name`} value={a.name} onChange={(e) => setAllow(i, 'name', e.target.value)} />
                      <InputV2 label={`Allowance ${i + 1} (${form.currency})`} type="number" min={0} value={a.amount} onChange={(e) => setAllow(i, 'amount', e.target.value)} />
                      <ButtonV2 kind="tertiary" size="sm" icon={<Trash2 />} aria-label={`Remove allowance ${i + 1}`} onClick={() => setForm({ ...form, allowances: form.allowances.filter((_, j) => j !== i) })} />
                    </div>
                  ))}
                  <div className="rf2-row-between">
                    <ButtonV2 kind="tertiary" size="sm" icon={<Plus />} onClick={() => setForm({ ...form, allowances: [...form.allowances, { name: '', amount: '' }] })}>Add allowance</ButtonV2>
                    <p className="rf2-jtable__sub">Allowances {money(allowTotal, form.currency)} / month · not counted in the band</p>
                  </div>
                </fieldset>
              ) : null}
              <BandPanel band={shownBand} grade={offer.grade?.name ?? null} amount={amount} pos={shownPos} code={err?.code} bandsListed={state.kind === 'ready' && state.bands !== null} />
            </>
          ) : <p className="rf2-inline-note"><ShieldCheck aria-hidden="true" /> Pay and the band are visible to the Manager only.</p>}
          {err && !err.field ? <p className="rf2-form-error" role="alert" ref={(el) => el?.scrollIntoView?.({ block: 'nearest' })} data-testid="decision-error">{err.text}</p> : null}
          <TextareaV2 label={`Comment to ${first} (required for Request changes or Reject)`} rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }} error={err?.field === 'reason' ? err.text : undefined} disabled={!pending} />
          {pending ? (
            <div className="rf2-decide__reject">
              <DangerConfirmButton size="sm" confirmLabel={`Confirm reject v${v.versionNumber}`} loading={busy === 'Reject'} disabled={!!busy} onConfirm={() => void run('Reject')}>Reject this version</DangerConfirmButton>
              <p className="rf2-jtable__sub">Withdraws v{v.versionNumber} only. The offer goes back to draft and the file stays in Offer.</p>
            </div>
          ) : <p className="rf2-inline-note"><Info aria-hidden="true" /> This version is {v.status ?? offer.status}; there is nothing to decide.</p>}
          <p className="rf2-inline-note"><ShieldCheck aria-hidden="true" /> Only the Manager sees pay. {first} sees “Pay set by the Manager”.</p>
        </div>
      ) : offer ? <p className="rf2-inline-note"><Info aria-hidden="true" /> This offer has no version to decide.</p> : null}
    </DrawerV2>
  );
}

function BandPanel({ band, grade, amount, pos, code, bandsListed }: { band: GradeBand | null; grade: string | null; amount: number | null; pos: 'inside' | 'below' | 'above' | null; code?: string; bandsListed: boolean }) {
  const has = band && typeof band.minMonthlyBase === 'number' && typeof band.maxMonthlyBase === 'number';
  if (!has) {
    return (
      <section className="rf2-decide__band" aria-label="Pay band" data-state="missing">
        <p className="rf2-jtable__name"><TriangleAlert aria-hidden="true" /> {grade ? `${grade} band` : 'Pay band'}</p>
        <p className="rf2-jtable__sub">{code === 'GRADE_BAND_MISSING' || (bandsListed && !band) ? `No active band for ${grade ?? 'this job (no grade)'}${band?.site ? ` at ${band.site.name}` : ''}${band?.currency ? ` in ${band.currency}` : ''}. Approve is refused until an admin adds it (GRADE_BAND_MISSING).` : 'The band list is not available to you; Approve still checks the band.'}</p>
      </section>
    );
  }
  const min = band!.minMonthlyBase!; const max = band!.maxMonthlyBase!; const mid = Math.round((min + max) / 2);
  const span = Math.max(1, max - min); const lo = min - span * 0.1; const hi = max + span * 0.1;
  const at = (n: number) => `${Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100))}%`;
  return (
    <section className="rf2-decide__band" aria-label="Pay band" data-state={pos ?? 'unknown'}>
      <div className="rf2-row-between">
        <p className="rf2-jtable__name">{band!.grade?.name ?? grade} band · monthly basic, {band!.currency}</p>
        {pos === 'inside' ? <StatusChip tone="success" label="Inside band" /> : pos ? <StatusChip tone="danger" label={pos === 'below' ? 'Below band' : 'Above band'} /> : null}
      </div>
      <div className="rf2-decide__bar" aria-hidden="true">
        <span className="rf2-decide__range" style={{ left: at(min), right: `calc(100% - ${at(max)})` }} />
        <span className="rf2-decide__mid" style={{ left: at(mid) }} />
        {amount !== null ? <span className="rf2-decide__offer" style={{ left: at(amount) }}><span>Offer {money(amount)}</span></span> : null}
      </div>
      <div className="rf2-row-between rf2-jtable__sub"><span>Min {money(min)}</span><span>Mid {money(mid)}</span><span>Max {money(max)}</span></div>
      <p className="rf2-jtable__sub" data-testid="band-text">{amount === null ? 'No base pay on this version yet.' : pos === 'inside' ? `Offer ${money(amount)} sits inside the band, ${money(Math.abs(amount - mid))} ${amount >= mid ? 'above' : 'below'} the midpoint.` : `Offer ${money(amount)} is ${pos === 'below' ? `${money(min - amount)} below the minimum` : `${money(amount - max)} above the maximum`}. Approve is refused (OFFER_PAY_OUTSIDE_BAND).`}</p>
    </section>
  );
}
