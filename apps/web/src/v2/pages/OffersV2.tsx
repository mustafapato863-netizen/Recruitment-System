import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, RotateCw, Search } from 'lucide-react';
import type { Offer } from '@recruitflow/contracts';
import { getApi } from '../../api/client';
import { ButtonV2, EmptyStateV2, InputV2, SkeletonV2, StatusChip, type StatusTone } from '../../components/v2';
import './jobs.css';
import './team.css';

type OfferResponse = Offer[] | { data: Offer[] };
type OfferState =
  | { kind: 'loading' }
  | { kind: 'ready'; offers: Offer[] }
  | { kind: 'error'; message: string };

const STATUS: Record<string, StatusTone> = {
  Draft: 'neutral',
  'Pending Approval': 'warning',
  Approval: 'warning',
  Approved: 'info',
  Sent: 'info',
  Accepted: 'success',
  Declined: 'danger',
  Expired: 'danger',
  Cancelled: 'neutral',
};

const statuses = [
  ['all', 'All offers'],
  ['pending', 'Pending approval'],
  ['Draft', 'Draft'],
  ['Approved', 'Approved'],
  ['Sent', 'Sent'],
  ['Accepted', 'Accepted'],
  ['Declined', 'Declined'],
  ['Expired', 'Expired'],
] as const;

function belongsToStatus(offer: Offer, status: string): boolean {
  if (status === 'all') return true;
  if (status === 'pending') return offer.status === 'Pending Approval';
  return offer.status === status;
}

function displayDate(raw: string | null | undefined): string {
  if (!raw) return 'Not recorded';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
}

/**
 * V2 offers index.
 *
 * A listing, not a second offer workflow: versioning, approval and candidate
 * response remain in the canonical application file and offer APIs. This index
 * intentionally never fetches or renders salary/package data.
 */
export function OffersV2() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<OfferState>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);

  const filter = params.get('status') || 'all';
  const search = params.get('q') || '';
  const vacancyId = params.get('vacancyId') || '';

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    getApi<OfferResponse>('/offers')
      .then((response) => {
        if (!active) return;
        const offers = Array.isArray(response) ? response : response.data;
        if (!Array.isArray(offers)) throw new Error('The offers response was not a list.');
        setState({ kind: 'ready', offers });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load offers.' });
      });
    return () => { active = false; };
  }, [refresh]);

  const available = useMemo(() => (state.kind === 'ready' ? state.offers : []), [state]);
  const scoped = useMemo(
    () => available.filter((offer) => !vacancyId || offer.vacancyId === vacancyId),
    [available, vacancyId],
  );
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return scoped
      .filter((offer) => belongsToStatus(offer, filter))
      .filter((offer) => !query || [offer.offerCode, offer.candidateName ?? '', offer.positionTitle ?? '', offer.applicationCode ?? '']
        .some((field) => field.toLocaleLowerCase().includes(query)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [scoped, filter, search]);

  const updateQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <main className="rf2-jobs rf2-team">
      <header className="rf2-team__bar">
        <div>
          <h1 className="rf2-team__title">Offers</h1>
          <p className="rf2-team__intro">Track every offer and return to its application file for approvals, revisions and candidate decisions.</p>
        </div>
        <div className="rf2-row-between" style={{ gap: '0.5rem' }}>
          <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setRefresh((n) => n + 1)}>Refresh</ButtonV2>
          <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to="/vacancies"><FileText aria-hidden="true" /> Open jobs</Link>
        </div>
      </header>

      <div className="rf2-team__toolbar">
        <div className="rf2-row-between" style={{ width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="rf2-tabs" role="group" aria-label="Offer status filters">
            {statuses.map(([key, label]) => (
              <button key={key} type="button" className="rf2-tab" aria-pressed={filter === key}
                onClick={() => updateQuery({ status: key })}>
                {label}
                {state.kind === 'ready' ? <span className="rf2-tab__count" aria-hidden="true">{scoped.filter((offer) => belongsToStatus(offer, key)).length}</span> : null}
              </button>
            ))}
          </div>
          <div style={{ width: 290, maxWidth: '100%' }}>
            <InputV2 label="Search offers" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Candidate, position or offer code" leadingIcon={<Search />} value={search} onChange={(event) => updateQuery({ q: event.target.value || null })} />
          </div>
        </div>
      </div>

      <section className="rf2-panel" aria-live="polite">
        {state.kind === 'loading' ? <SkeletonV2 lines={5} label="Loading offers…" /> : null}
        {state.kind === 'error' ? (
          <div role="alert"><EmptyStateV2 title="Could not load offers" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setRefresh((n) => n + 1)}>Try again</ButtonV2>} /></div>
        ) : null}
        {state.kind === 'ready' && shown.length === 0 ? (
          <EmptyStateV2 title="No offers found" body={scoped.length ? 'No offers match these filters.' : 'Create an offer from the relevant application file after screening and interview gates are met.'} />
        ) : null}
        {state.kind === 'ready' && shown.length > 0 ? (
          <div className="rf2-jscroll">
            <table className="rf2-jtable" aria-label="Offers">
              <thead><tr><th scope="col">Offer</th><th scope="col">Candidate</th><th scope="col">Position</th><th scope="col">Updated</th><th scope="col">Status</th><th scope="col">Application</th></tr></thead>
              <tbody>
                {shown.map((offer) => (
                  <tr key={offer.id}>
                    <td><Link className="rf2-jtable__name" to={`/offers/${encodeURIComponent(offer.id)}`}>{offer.offerCode}</Link></td>
                    <td>{offer.candidateName || 'Candidate unavailable'}</td>
                    <td>{offer.positionTitle || 'Position unavailable'}</td>
                    <td>{displayDate(offer.updatedAt)}</td>
                    <td><StatusChip tone={STATUS[offer.status] ?? 'neutral'} label={offer.status} /></td>
                    <td><Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/offers/${encodeURIComponent(offer.id)}`}>Open file</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <p className="rf2-jtable__sub">Compensation is available only within authorized offer and application-file views. No salary details are shown in this index.</p>
    </main>
  );
}
