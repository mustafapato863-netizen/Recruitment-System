import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, CircleMinus, FileText, Info, Scale, UserPlus } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { addToJob, fetchSuggestions, matchErrorFromError, sourceLabel, type Suggestion, type SuggestionsResponse } from '../api/matching';
import { jobTitle, type JobDetail } from '../api/jobs';
import { formatDay } from '../pages/OpenJobsV2';

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** E10 Suggest from bank (B6 #13): evidence lines, never a score. Add to this job; select 2–4 to compare (E24). */
export function SuggestDrawer({ job, accepting, onClose, onAdded }: { job: JobDetail; accepting: boolean; onClose: () => void; onAdded: () => void }) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: SuggestionsResponse } | { kind: 'error'; message: string; forbidden?: boolean }>({ kind: 'loading' });
  const [added, setAdded] = useState<Record<string, 'busy' | 'done' | string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    fetchSuggestions(job.id).then((data) => setState({ kind: 'ready', data }))
      .catch((e: { statusCode?: number; message?: string }) => setState({ kind: 'error', forbidden: e?.statusCode === 403, message: matchErrorFromError(e)?.message || e?.message || 'Could not load suggestions.' }));
  }, [job.id]);
  const add = async (s: Suggestion) => {
    setAdded((a) => ({ ...a, [s.candidate.id]: 'busy' }));
    try { await addToJob(job.id, s.candidate.id); setAdded((a) => ({ ...a, [s.candidate.id]: 'done' })); onAdded(); }
    catch (e) { setAdded((a) => ({ ...a, [s.candidate.id]: matchErrorFromError(e)?.message || (e as Error)?.message || 'Could not add.' })); }
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  const compareHref = `/candidates/compare?job=${encodeURIComponent(job.id)}&ids=${picked.map(encodeURIComponent).join(',')}`;

  return (
    <DrawerV2 open onClose={onClose} kicker={`Suggest from bank · ${jobTitle(job)}`} title="People in the bank who match this job"
      primaryAction={picked.length >= 2
        ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={compareHref}><Scale aria-hidden="true" /> Compare {picked.length} on skills</Link>
        : <ButtonV2 icon={<Scale />} disabled aria-describedby="cmp-why">Compare on skills</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2>}>
      <span id="cmp-why" className="rf2-sr-only">Select 2 to 4 people to compare.</span>
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Finding people in the bank…" /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 headingLevel={3} title={state.forbidden ? 'Only the job owner can see suggestions' : 'Could not load suggestions'} body={state.message} /></div> : null}
      {state.kind === 'ready' ? (
        <div className="rf2-drawer-form">
          <section aria-labelledby="req-h">
            <h3 id="req-h" className="rf2-field__label">Required skills</h3>
            <ul className="rf2-chips">{state.data.requiredSkills.map((s) => <li key={s.id ?? s.name} className="rf2-chip">{s.name}</li>)}</ul>
            {state.data.unmappedRequiredSkills.length ? <p className="rf2-jtable__sub">Not in the skill library, so not matched: {state.data.unmappedRequiredSkills.join(', ')}.</p> : null}
          </section>
          <p className="rf2-inline-note"><Info aria-hidden="true" /> <span>Ordered by: {state.data.orderedBy.join('; ')}. Each match is backed by a written evidence line — never a score. People already on this job and inactive people are not listed.</span></p>
          {!accepting ? <p className="rf2-inline-note" data-tone="warning"><Info aria-hidden="true" /> This job takes no new applications, so “Add to this job” is off.</p> : null}
          {state.data.suggestions.length === 0 ? <EmptyStateV2 headingLevel={3} title="No one in the bank matches yet" body={state.data.requiredSkills.length ? 'Nobody active has these skills linked.' : 'This job has no required skills from the library.'} /> : (
            <ul className="rf2-sugg" aria-label="Suggestions">
              {state.data.suggestions.map((s) => {
                const st = added[s.candidate.id];
                return (
                  <li key={s.candidate.id} className="rf2-sugg__card">
                    <div className="rf2-sugg__top">
                      <input type="checkbox" aria-label={`Select ${s.candidate.name} to compare`} checked={picked.includes(s.candidate.id)} disabled={!picked.includes(s.candidate.id) && picked.length >= 4} onChange={() => toggle(s.candidate.id)} />
                      <span className="rf2-kcard__avatar" aria-hidden="true">{initials(s.candidate.name)}</span>
                      <div className="rf2-sugg__who"><p className="rf2-jtable__name">{s.candidate.name}</p><p className="rf2-jtable__sub">{[s.candidate.code, s.candidate.currentTitle, s.candidate.location].filter(Boolean).join(' · ')}</p></div>
                      {st === 'done' ? <StatusChip tone="success" label="Added to Applied" />
                        : <ButtonV2 kind="secondary" size="sm" icon={<UserPlus />} loading={st === 'busy'} disabled={!accepting} onClick={() => void add(s)} aria-label={`Add ${s.candidate.name} to this job`}>Add to this job</ButtonV2>}
                    </div>
                    <ul className="rf2-chips">
                      {s.matchedSkills.map((m) => <li key={m.skill.name} className="rf2-chip" data-tone={m.hasEvidence ? 'success' : 'neutral'}>{m.hasEvidence ? <CircleCheck aria-hidden="true" /> : <CircleMinus aria-hidden="true" />}{m.skill.name}{m.hasEvidence ? '' : ' — no evidence'}</li>)}
                      {s.missingSkills.map((m) => <li key={m.name} className="rf2-chip" data-tone="muted"><CircleMinus aria-hidden="true" />{m.name} — missing</li>)}
                    </ul>
                    <ul className="rf2-evid">
                      {s.matchedSkills.flatMap((m) => m.evidence.slice(0, 2).map((e) => (
                        <li key={e.id}><FileText aria-hidden="true" /> <span>{e.snippet ? `“${e.snippet}”` : `${m.skill.name} evidence`} — {sourceLabel(e.sourceType)}{e.sourceRef ? ` (${e.sourceRef})` : ''}, {formatDay(e.addedAt)}</span></li>
                      )))}
                    </ul>
                    {st && st !== 'busy' && st !== 'done' ? <p className="rf2-form-error" role="alert">{st}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </DrawerV2>
  );
}
