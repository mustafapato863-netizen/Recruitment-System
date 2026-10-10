import { useEffect, useState } from 'react';
import { CircleCheck, Info, PencilLine, ShieldCheck, TriangleAlert } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, initials, StatusChip, TextareaV2 } from '../../components/v2';
import {
  bandFor, bandPosition, currentVersion, decide, decisionError, loadDecision, money, payOf,
  type Decision, type DecisionError, type DecisionOffer, type GradeBand,
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
  const band = offer && state.kind === 'ready' ? bandFor(state.bands, offer, pay?.base?.currency ?? null) : null;
  const pos = bandPosition(band, pay?.base?.amount ?? null);
  const pending = v?.status === 'Pending Approval' || (!v?.status && offer?.status === 'Pending Approval');
  const owner = ownerName ?? 'the owner';
  const first = owner.split(' ')[0];

  const run = async (d: Decision) => {
    if (!offer || !v) return;
    if (d !== 'Approve' && reason.trim().length < 3) { setErr({ field: 'reason', text: d === 'Reject' ? 'Write a comment to reject (at least 3 characters).' : 'Write a comment to request changes (at least 3 characters).' }); return; }
    setBusy(d); setErr(null);
    try {
      await decide(offer.id, v.id, d, reason.trim() || undefined);
      const who = offer.candidateName ?? 'the candidate';
      onDone(d === 'Approve' ? `Offer for ${who} approved. ${first} can send it now.` : d === 'RequestChanges' ? `Changes requested on ${who}’s offer. It is back with ${first} as a draft.` : `Offer v${v.versionNumber} for ${who} rejected. The file stays in Offer; ${first} drafts a new version or closes the file.`);
    } catch (e) { setErr(decisionError(e)); } finally { setBusy(null); }
  };

  const errBand = err?.band;
  const shownBand = band ?? (errBand ? { id: String(errBand.id ?? ''), grade: errBand.grade ? { id: '', name: String(errBand.grade) } : null, site: errBand.site ? { id: '', name: String(errBand.site) } : null, currency: String(errBand.currency ?? ''), minMonthlyBase: typeof errBand.minMonthlyBase === 'number' ? errBand.minMonthlyBase : undefined, maxMonthlyBase: typeof errBand.maxMonthlyBase === 'number' ? errBand.maxMonthlyBase : undefined } : null);
  const amount = pay?.base?.amount ?? err?.offered ?? null;
  const shownPos = pos ?? bandPosition(shownBand, amount);

  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer decision${v ? ` · v${v.versionNumber}` : ''}`} title={offer?.candidateName ? `Offer for ${offer.candidateName}` : 'Offer decision'}
      status={state.kind === 'loading' ? 'loading' : state.kind === 'error' ? 'error' : 'ready'} errorMessage={state.kind === 'error' ? state.message : undefined} onRetry={() => setAttempt((n) => n + 1)}
      primaryAction={pending ? <ButtonV2 icon={<CircleCheck />} loading={busy === 'Approve'} disabled={!!busy || !v} onClick={() => void run('Approve')}>Approve offer</ButtonV2> : <ButtonV2 onClick={onClose}>Close</ButtonV2>}
      secondaryAction={pending ? <ButtonV2 kind="secondary" icon={<PencilLine />} loading={busy === 'RequestChanges'} disabled={!!busy} onClick={() => void run('RequestChanges')}>Request changes</ButtonV2> : null}
      confirmClose={() => !reason.trim() || window.confirm('Discard your comment?')}>
      {offer && v ? (
        <div className="rf2-drawer-form rf2-decide">
          {err && !err.field ? <p className="rf2-form-error" role="alert">{err.text}</p> : null}
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
              <div className="rf2-req__row">
                <div className="rf2-decide__pay"><p className="rf2-field__label">Monthly basic pay{pay?.base ? ` (${pay.base.currency})` : ''}</p><p className="rf2-decide__amount" data-testid="base-pay">{pay?.base ? money(pay.base.amount) : pay?.mixed ? 'Mixed currencies' : 'Not set'}</p></div>
                <div className="rf2-decide__pay"><p className="rf2-field__label">Allowances{pay?.allowances ? ` (${pay.allowances.currency})` : ''}</p><p className="rf2-decide__amount">{pay?.allowances ? money(pay.allowances.amount) : '—'}</p><p className="rf2-jtable__sub">Not counted in the band</p></div>
              </div>
              <BandPanel band={shownBand} grade={offer.grade?.name ?? null} amount={amount} pos={shownPos} code={err?.code} bandsListed={state.kind === 'ready' && state.bands !== null} />
            </>
          ) : <p className="rf2-inline-note"><ShieldCheck aria-hidden="true" /> Pay and the band are visible to the Manager only.</p>}
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
