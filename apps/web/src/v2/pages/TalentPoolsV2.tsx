import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import type { TalentPoolItem } from '@recruitflow/contracts';
import { ApiError } from '../../api/client';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SkeletonV2, StatusChip, TextareaV2, type StatusTone } from '../../components/v2';
import { addPoolMember, createPool, fetchPool, fetchPools, removePoolMember, searchPoolPeople, type PoolDetail, type PoolPerson } from '../api/talentPools';
import './talent-pools.css';

type Failure = { kind: 'forbidden' } | { kind: 'error'; message: string };
type ListState = { kind: 'loading' } | { kind: 'ready'; rows: TalentPoolItem[]; total: number } | Failure;
type DetailState = { kind: 'loading' } | { kind: 'ready'; detail: PoolDetail } | Failure;
type PeopleState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; rows: PoolPerson[] } | Failure;

function failureOf(error: unknown): Failure {
  if (error instanceof ApiError && error.statusCode === 403) return { kind: 'forbidden' };
  const message = error instanceof Error && error.message ? error.message : 'Something went wrong.';
  return { kind: 'error', message };
}

function formatWhen(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(dt);
}

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(',')) {
    const tag = part.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function poolTone(status: string): StatusTone {
  return status === 'Active' ? 'success' : 'neutral';
}

function LoadStates({ state, onRetry, emptyTitle, emptyBody }: { state: Failure | { kind: 'loading' }; onRetry: () => void; emptyTitle?: string; emptyBody?: string }) {
  if (state.kind === 'loading') return <SkeletonV2 lines={5} label="Loading talent pools…" />;
  if (state.kind === 'forbidden') return <ForbiddenStateV2 body="Your role does not include talent pools." />;
  return (
    <div role="alert">
      <EmptyStateV2 title={emptyTitle ?? 'Could not load talent pools'} body={state.message || emptyBody} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={onRetry}>Try again</ButtonV2>} />
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="rf2-pools__tags" />;
  return (
    <ul className="rf2-pools__tags" aria-label="Tags">
      {tags.map((tag) => <li key={tag} className="rf2-pools__tag">{tag}</li>)}
    </ul>
  );
}

function PoolRow({ pool }: { pool: TalentPoolItem }) {
  return (
    <li className="rf2-pools__row">
      <p className="rf2-pools__name">{pool.name}</p>
      <p className="rf2-pools__description">{pool.description || ''}</p>
      <Tags tags={pool.tags} />
      <span className="rf2-pools__status"><StatusChip tone={poolTone(pool.status)} label={pool.status} /></span>
      <span className="rf2-pools__count" aria-label={`${pool.candidateCount} active members`}>{pool.candidateCount} active</span>
      <time className="rf2-pools__when" dateTime={pool.updatedAt}>Updated {formatWhen(pool.updatedAt)}</time>
      <span className="rf2-pools__action"><Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/talent-pools/${pool.id}`} aria-label={`Open ${pool.name}`}>Open</Link></span>
    </li>
  );
}

/** /talent-pools */
export function TalentPoolsListV2() {
  const [q, setQ] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      fetchPools(q)
        .then((page) => { if (live) setState({ kind: 'ready', rows: page.data ?? [], total: page.total ?? 0 }); })
        .catch((error: unknown) => { if (live) setState(failureOf(error)); });
    }, q.trim() ? 250 : 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [q, attempt]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const poolName = name.trim();
    if (!poolName) {
      setNameError('A pool name is required.');
      return;
    }
    setNameError(undefined);
    setFormError(null);
    setSaving(true);
    try {
      await createPool({
        name: poolName,
        description: description.trim() || null,
        tags: parseTags(tags),
      });
      setName('');
      setDescription('');
      setTags('');
      setNotice('Pool created.');
      setAttempt((n) => n + 1);
    } catch (error) {
      setFormError(error instanceof Error && error.message ? error.message : 'Could not create this pool.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rf2-pools">
      <header>
        <h1 className="rf2-pools__title">Talent pools</h1>
        <p className="rf2-pools__sub">Groups of people you may hire later. Adding or removing someone does not change an application.</p>
      </header>
      {notice ? <p className="rf2-pools__note" role="status">{notice}</p> : null}
      {state.kind === 'ready' ? (
        <form className="rf2-pools__form" onSubmit={(event) => { void onCreate(event); }}>
          <InputV2 label="Pool name" value={name} onChange={(event) => setName(event.target.value)} error={nameError} required autoComplete="off" />
          <TextareaV2 label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          <InputV2 label="Tags" value={tags} onChange={(event) => setTags(event.target.value)} hint="Comma-separated." autoComplete="off" />
          <ButtonV2 type="submit" loading={saving}>Create pool</ButtonV2>
        </form>
      ) : null}
      {formError ? <p role="alert">{formError}</p> : null}
      <InputV2 label="Search pools" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Pool name" autoComplete="off" />
      {state.kind !== 'ready' ? <LoadStates state={state} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {state.kind === 'ready' && state.rows.length === 0 ? <EmptyStateV2 title="No talent pools" body="Pools you create are listed here." /> : null}
      {state.kind === 'ready' && state.rows.length > 0 ? (
        <>
          {state.total > state.rows.length ? <p className="rf2-pools__bound">Showing {state.rows.length} of {state.total} pools.</p> : null}
          <ul className="rf2-pools__list" aria-label="Talent pools">
            {state.rows.map((pool) => <PoolRow key={pool.id} pool={pool} />)}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** /talent-pools/:id */
export function TalentPoolDetailV2() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  const [personQuery, setPersonQuery] = useState('');
  const [personError, setPersonError] = useState<string | undefined>();
  const [people, setPeople] = useState<PeopleState>({ kind: 'idle' });
  const [chosen, setChosen] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    fetchPool(id)
      .then((detail) => { if (live) setState({ kind: 'ready', detail }); })
      .catch((error: unknown) => { if (live) setState(failureOf(error)); });
    return () => { live = false; };
  }, [id, attempt]);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    const term = personQuery.trim();
    if (!term) {
      setPersonError('Enter a name.');
      return;
    }
    setPersonError(undefined);
    setPeople({ kind: 'loading' });
    setChosen('');
    try {
      setPeople({ kind: 'ready', rows: await searchPoolPeople(term) });
    } catch (error) {
      setPeople(failureOf(error));
    }
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !chosen) return;
    setAdding(true);
    setActionError(null);
    try {
      await addPoolMember(id, chosen);
      setChosen('');
      setNotice('Added to this pool.');
      setAttempt((n) => n + 1);
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : 'Could not add this person.');
    } finally {
      setAdding(false);
    }
  };

  const onRemove = async (candidateId: string) => {
    if (!id) return;
    setRemovingId(candidateId);
    setActionError(null);
    try {
      await removePoolMember(id, candidateId);
      setNotice('Removed from this pool.');
      setAttempt((n) => n + 1);
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : 'Could not remove this person.');
    } finally {
      setRemovingId(null);
    }
  };

  const detail = state.kind === 'ready' ? state.detail : null;
  const pool = detail?.pool;

  return (
    <div className="rf2-pools">
      <p className="rf2-pools__back"><Link to="/talent-pools">Talent pools</Link></p>
      {!id ? <LoadStates state={{ kind: 'error', message: 'This pool link is missing.' }} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {id && state.kind !== 'ready' ? <LoadStates state={state} onRetry={() => setAttempt((n) => n + 1)} emptyTitle="Could not load this pool" /> : null}
      {pool && detail ? (
        <>
          <header className="rf2-pools__head">
            <h1 className="rf2-pools__title rf2-pools__name">{pool.name}</h1>
            <p className="rf2-pools__description">{pool.description || ''}</p>
            <Tags tags={pool.tags} />
            <span className="rf2-pools__status"><StatusChip tone={poolTone(pool.status)} label={pool.status} /></span>
            <span className="rf2-pools__count" aria-label={`${detail.total} active members`}>{detail.total} active</span>
            <time className="rf2-pools__when" dateTime={pool.updatedAt}>Updated {formatWhen(pool.updatedAt)}</time>
          </header>
          {notice ? <p className="rf2-pools__note" role="status">{notice}</p> : null}
          {actionError ? <p role="alert">{actionError}</p> : null}
          <form className="rf2-pools__form" onSubmit={(event) => { void onSearch(event); }}>
            <InputV2 label="Person" value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} error={personError} placeholder="Name" autoComplete="off" />
            <ButtonV2 kind="secondary" type="submit">Search</ButtonV2>
          </form>
          {people.kind === 'loading' ? <SkeletonV2 lines={2} label="Searching people…" /> : null}
          {people.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include candidates." /> : null}
          {people.kind === 'error' ? <p role="alert">{people.message}</p> : null}
          {people.kind === 'ready' && people.rows.length === 0 ? <EmptyStateV2 headingLevel={3} title="No one found" body="Try another name." /> : null}
          {people.kind === 'ready' && people.rows.length > 0 ? (
            <form className="rf2-pools__form" onSubmit={(event) => { void onAdd(event); }}>
              <ul className="rf2-pools__people" aria-label="People to add">
                {people.rows.map((person) => (
                  <li key={person.id}>
                    <label>
                      <input type="radio" name="pool-person" value={person.id} checked={chosen === person.id} onChange={() => setChosen(person.id)} aria-label={`Choose ${person.name}`} />
                      <span>{person.name}</span>
                      {person.code ? <span className="rf2-pools__meta">{person.code}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <ButtonV2 type="submit" loading={adding} disabled={!chosen}>Add to this pool</ButtonV2>
            </form>
          ) : null}
          {detail.candidates.length === 0 ? <EmptyStateV2 headingLevel={3} title="No active members" body="Search for a person and add them to this pool." /> : (
            <>
              {detail.total > detail.candidates.length ? <p className="rf2-pools__bound">Showing {detail.candidates.length} of {detail.total} active members.</p> : null}
              <ul className="rf2-pools__members" aria-label="Active members">
                {detail.candidates.map((member) => (
                  <li key={member.id} className="rf2-pools__member">
                    <p className="rf2-pools__name">{member.candidateName}</p>
                    <span className="rf2-pools__source">{member.source || ''}</span>
                    <time className="rf2-pools__when" dateTime={member.addedAt}>Added {formatWhen(member.addedAt)}</time>
                    <span className="rf2-pools__action">
                      <ButtonV2 kind="danger-outline" size="sm" aria-label={`Remove ${member.candidateName}`} loading={removingId === member.candidateId} onClick={() => { void onRemove(member.candidateId); }}>Remove</ButtonV2>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
