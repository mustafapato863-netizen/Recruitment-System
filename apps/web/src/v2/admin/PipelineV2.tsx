import { toFormErrs } from './formErrors';
import { useEffect, useState } from 'react';
import { CircleCheck, Info, LogOut, PencilLine, Plus, RotateCw, ShieldCheck } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, InputV2, SelectV2, SkeletonV2 } from '../../components/v2';
import { createPipeline, fetchPipeline, fetchWorkflowRules, isExit, isSingleTemplate, previewWorkflowRule, renameStage, stageInfo, type PipelineStage, type PipelineTemplate, type WorkflowImpact, type WorkflowPosition } from './configApi';
import '../pages/jobs.css';
import './admin.css';

/** A05 Pipeline template (Admin seat): ONE template; stages renamed in place, never added as a second template or deleted. */
export function PipelineV2() {
  const [data, setData] = useState<{ template: PipelineTemplate; stages: PipelineStage[] } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<PipelineStage | null>(null);
  const [note, setNote] = useState<{ tone: 'success' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true; setError(null); setData(undefined);
    fetchPipeline().then((d) => live && setData(d)).catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt]);
  const create = async () => {
    setBusy(true);
    try { await createPipeline(); setNote({ tone: 'success', text: 'Default pipeline created.' }); }
    catch (e) { setNote({ tone: 'info', text: isSingleTemplate(e) ? 'There is already one pipeline template — showing it.' : (e as { message?: string })?.message || 'Could not create.' }); }
    finally { setBusy(false); setAttempt((n) => n + 1); }
  };
  const stages = data?.stages.filter((s) => !isExit(s)) ?? [];
  const exits = data?.stages.filter(isExit) ?? [];
  return (
    <div className="rf2-jobs rf2-admin">
      <div>
        <h1 className="rf2-jobs__title">Pipeline template</h1>
        <p className="rf2-jobs__sub">One template for every job. Stages in order, two exits. Gates are checks inside a stage, not extra stages.</p>
      </div>
      {note ? <p className="rf2-inline-note" data-tone={note.tone} role="status">{note.tone === 'success' ? <CircleCheck aria-hidden="true" /> : <Info aria-hidden="true" />} {note.text}</p> : null}
      {data === undefined && !error ? <SkeletonV2 lines={6} label="Loading pipeline…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load the pipeline" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data === null ? <EmptyStateV2 title="No pipeline template yet" body="Create the one default template every job uses." action={<ButtonV2 icon={<Plus />} loading={busy} onClick={() => void create()}>Create the template</ButtonV2>} /> : null}
      {data ? (
        <>
          <section className="rf2-panel rf2-admin__card" aria-labelledby="stages-h">
            <div className="rf2-row-between rf2-admin__head"><h2 id="stages-h" className="rf2-jtable__name">Stages</h2><span className="rf2-jtable__sub">{stages.length} stages · {data.template.name}</span></div>
            <ol className="rf2-admin__stages">
              {stages.map((s, i) => { const info = stageInfo(s); return (
                <li key={s.id} className="rf2-admin__stage">
                  <span className="rf2-admin__num" aria-hidden="true">{i + 1}</span>
                  <p className="rf2-jtable__name">{s.name}</p>
                  <div><p className="rf2-field__label">Drawer</p><p className="rf2-jtable__sub">{info?.drawer ?? '—'}</p></div>
                  <div><p className="rf2-field__label">Actions</p><p className="rf2-jtable__sub">{info?.actions || '—'}</p>
                    {info?.gate ? <p className="rf2-admin__gate"><ShieldCheck aria-hidden="true" /> {info.gate}</p> : null}</div>
                  <ButtonV2 kind="tertiary" size="sm" icon={<PencilLine />} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</ButtonV2>
                </li>
              ); })}
            </ol>
          </section>
          <section className="rf2-panel rf2-admin__card" aria-labelledby="exits-h">
            <div className="rf2-row-between rf2-admin__head"><h2 id="exits-h" className="rf2-jtable__name">Exits</h2><span className="rf2-jtable__sub">Reachable from any stage · listed under “Closed for this job”</span></div>
            {exits.length === 0 ? <p className="rf2-jtable__sub rf2-admin__pad">No exit stages on this template. Rejected and Withdrawn are still reachable from the file.</p> : (
              <ul className="rf2-admin__stages">
                {exits.map((s) => (
                  <li key={s.id} className="rf2-admin__stage rf2-admin__stage--exit">
                    <LogOut aria-hidden="true" className="rf2-admin__exit" />
                    <p className="rf2-jtable__name">{s.name}</p>
                    <p className="rf2-jtable__sub">{stageInfo(s)?.drawer ?? '—'}</p>
                    <ButtonV2 kind="tertiary" size="sm" icon={<PencilLine />} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</ButtonV2>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Stages and exits can be renamed, never deleted, and there is no second template. Hold lives on the job; Cancelled lives on the requisition — neither is a stage.</p>
      <WorkflowImpactCard />
      {editing && data ? <StageDrawer stage={editing} templateId={data.template.id} onClose={() => setEditing(null)} onDone={(m) => { setEditing(null); setNote({ tone: 'success', text: m }); setAttempt((n) => n + 1); }} /> : null}
    </div>
  );
}

const PROTECTED = ['VAC-2026-009', 'VAC-2026-010', 'VAC-2026-011'];

function WorkflowImpactCard() {
  const [positions, setPositions] = useState<WorkflowPosition[] | null>(null);
  const [positionId, setPositionId] = useState('');
  const [profile, setProfile] = useState<'technical' | 'clinical'>('clinical');
  const [impact, setImpact] = useState<WorkflowImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetchWorkflowRules()
      .then((doc) => {
        if (!live) return;
        const rows = doc.positions ?? [];
        setPositions(rows);
        const protectedRow = rows.find((row) => row.vacancies.some((vacancy) => PROTECTED.includes(vacancy.code)));
        const first = protectedRow ?? rows[0];
        if (first) {
          setPositionId(first.id);
          setProfile(first.profile === 'clinical' ? 'technical' : 'clinical');
        }
      })
      .catch(() => { if (live) setPositions([]); });
    return () => { live = false; };
  }, []);
  const preview = async () => {
    if (!positionId) return;
    setBusy(true); setError(null);
    try { setImpact(await previewWorkflowRule(positionId, profile)); }
    catch (e) { setImpact(null); setError((e as { message?: string })?.message || 'Could not preview this rule.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="rf2-panel rf2-admin__card" aria-labelledby="rule-h">
      <div className="rf2-row-between rf2-admin__head">
        <div>
          <h2 id="rule-h" className="rf2-jtable__name">Workflow rule impact</h2>
          <p className="rf2-jtable__sub">Technical and clinical joining profiles. A preview is the result when a protected job would change.</p>
        </div>
      </div>
      <div className="rf2-admin__pad">
        {positions === null ? <SkeletonV2 lines={2} label="Loading positions…" /> : null}
        {positions && positions.length === 0 ? <p className="rf2-jtable__sub">No positions are available for a rule preview.</p> : null}
        {positions && positions.length > 0 ? (
          <div className="rf2-req__row">
            <SelectV2 label="Position" value={positionId} onChange={(e) => { setPositionId(e.target.value); setImpact(null); }}>
              {positions.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
            </SelectV2>
            <SelectV2 label="Proposed profile" value={profile} onChange={(e) => { setProfile(e.target.value as 'technical' | 'clinical'); setImpact(null); }}>
              <option value="technical">Technical</option>
              <option value="clinical">Clinical</option>
            </SelectV2>
            <ButtonV2 kind="secondary" icon={<ShieldCheck />} loading={busy} onClick={() => void preview()}>Preview impact</ButtonV2>
          </div>
        ) : null}
        {error ? <p className="rf2-form-error" role="alert">{error}</p> : null}
        {impact ? (
          <div>
            <p className="rf2-inline-note" data-tone={impact.applyAllowed ? 'info' : 'warning'} role="status"><Info aria-hidden="true" /> {impact.message}</p>
            <p className="rf2-jtable__sub">{impact.preservedSnapshots} accepted {impact.preservedSnapshots === 1 ? 'case keeps' : 'cases keep'} the stored checklist. {impact.openCasesAdoptingProfile.length} open {impact.openCasesAdoptingProfile.length === 1 ? 'case' : 'cases'} would use the new profile later. Seat counts stay as shown.</p>
            {impact.vacancies.length ? (
              <table className="rf2-jtable" aria-label="Workflow rule impact">
                <thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Seats</th><th scope="col">Result</th></tr></thead>
                <tbody>
                  {impact.vacancies.map((vacancy) => (
                    <tr key={vacancy.code}>
                      <th scope="row">{vacancy.code}</th>
                      <td>{vacancy.status}</td>
                      <td>{vacancy.joinedHeadcount}/{vacancy.approvedHeadcount}</td>
                      <td>{vacancy.protected ? 'Preview only' : 'Unchanged'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="rf2-jtable__sub">This position has no jobs.</p>}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StageDrawer({ stage, templateId, onClose, onDone }: { stage: PipelineStage; templateId: string; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = useState(stage.name);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return setErr('Enter a name.');
    setBusy(true);
    try { await renameStage(templateId, stage.id, name.trim()); onDone(`Stage renamed to “${name.trim()}”.`); }
    catch (e) { const fe = toFormErrs(e, { name: 'name' }, 'Could not save.'); setErr(fe.name ?? fe.form ?? 'Could not save.'); } finally { setBusy(false); }
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Pipeline template" title={`Edit ${stage.name}`}
      primaryAction={<ButtonV2 icon={<CircleCheck />} loading={busy} disabled={name.trim() === stage.name} onClick={() => void save()}>Save stage</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <InputV2 label="Stage name" required value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} error={err ?? undefined} hint="The stage keeps its place, gates and history. It cannot be deleted." />
    </DrawerV2>
  );
}
