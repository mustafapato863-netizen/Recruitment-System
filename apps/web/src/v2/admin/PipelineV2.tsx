import { toFormErrs } from './formErrors';
import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Info, LogOut, PencilLine, Plus, RotateCw, ShieldCheck } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, InputV2, SelectV2, SkeletonV2 } from '../../components/v2';
import { useAuth } from '../../auth/AuthContext';
import { applyWorkflowRule, createPipeline, fetchPipeline, fetchWorkflowRules, isExit, isSingleTemplate, previewWorkflowRule, renameStage, stageInfo, WORKFLOW_RULE_REASON_MAX, type PipelineStage, type PipelineTemplate, type WorkflowImpact, type WorkflowPosition } from './configApi';
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
      <JoiningRules />
      {editing && data ? <StageDrawer stage={editing} templateId={data.template.id} onClose={() => setEditing(null)} onDone={(m) => { setEditing(null); setNote({ tone: 'success', text: m }); setAttempt((n) => n + 1); }} /> : null}
    </div>
  );
}

type RuleProfile = 'technical' | 'clinical';
/** Empty until the user picks a proposal. Null metadata keeps the historical checks, so it is not Standard. */
type ProposedProfile = RuleProfile | '';

function profileOf(row: WorkflowPosition | undefined): ProposedProfile {
  return row?.profile === 'clinical' || row?.profile === 'technical' ? row.profile : '';
}
function profileLabel(profile: RuleProfile): string {
  return profile === 'clinical' ? 'Licence-required' : 'Standard';
}
function checklistText(profile: RuleProfile): string {
  return profile === 'clinical' ? 'ID · Signed contract · SCFHS licence' : 'ID · Signed contract';
}
function storedChecklist(profile: WorkflowPosition['profile']): string {
  if (profile === 'clinical') return 'Stored checklist: Clinical — ID, signed contract and SCFHS licence.';
  if (profile === 'technical') return 'Stored checklist: Standard — ID and signed contract.';
  return 'Stored checklist: none yet. New cases keep the historical checks until a profile is saved.';
}

/** Configure a position checklist here, review the impact, then save. Protected jobs stay preview-only. */
function JoiningRules() {
  const { user } = useAuth();
  const canSave = (user?.permissions ?? []).includes('MASTER_DATA_MANAGE');
  const [positions, setPositions] = useState<WorkflowPosition[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [positionId, setPositionId] = useState('');
  const [profile, setProfile] = useState<ProposedProfile>('');
  const [impact, setImpact] = useState<WorkflowImpact | null>(null);
  const [reviewed, setReviewed] = useState<{ positionId: string; profile: RuleProfile } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<{ positionId: string; profile: RuleProfile } | null>(null);
  const [checking, setChecking] = useState(false);
  const selectionRef = useRef<{ positionId: string; profile: ProposedProfile }>({ positionId: '', profile: '' });
  const requestId = useRef(0);
  const previewingRef = useRef(false);
  const savingRef = useRef(false);
  const checkingRef = useRef(false);
  const unconfirmedRef = useRef<{ positionId: string; profile: RuleProfile } | null>(null);
  const loadGen = useRef(0);
  selectionRef.current = { positionId, profile };
  unconfirmedRef.current = unconfirmed;

  useEffect(() => {
    const gen = ++loadGen.current;
    let live = true;
    setLoadError(null);
    setPositions(null);
    fetchWorkflowRules()
      .then((doc) => {
        if (!live || gen !== loadGen.current) return;
        const rows = doc.positions ?? [];
        setPositions(rows);
        setLoadError(null);
        const selectedId = selectionRef.current.positionId;
        if (!rows.some((row) => row.id === selectedId)) {
          const first = rows[0];
          const nextProfile = profileOf(first);
          selectionRef.current = { positionId: first?.id ?? '', profile: nextProfile };
          setPositionId(first?.id ?? '');
          setProfile(nextProfile);
        }
      })
      .catch((e: { message?: string }) => {
        if (!live || gen !== loadGen.current) return;
        setPositions(null);
        setLoadError(e?.message || 'Could not load joining rules.');
      });
    return () => { live = false; };
  }, [loadAttempt]);

  const dropInFlight = () => {
    requestId.current += 1;
    previewingRef.current = false;
    setPreviewing(false);
    setImpact(null);
    setReviewed(null);
    setReviewOpen(false);
    setReason('');
    setReasonError(null);
    setApplyError(null);
    setSaved(null);
  };
  const closeReview = () => {
    setImpact(null);
    setReviewed(null);
    setReviewOpen(false);
    setReason('');
    setReasonError(null);
    if (!unconfirmedRef.current) setApplyError(null);
  };
  const chooseJob = (id: string) => {
    if (savingRef.current || unconfirmedRef.current) return;
    const nextProfile = profileOf((positions ?? []).find((row) => row.id === id));
    selectionRef.current = { positionId: id, profile: nextProfile };
    dropInFlight();
    setPositionId(id);
    setProfile(nextProfile);
    setError(null);
  };
  const chooseProfile = (next: RuleProfile) => {
    if (savingRef.current || unconfirmedRef.current) return;
    selectionRef.current = { positionId, profile: next };
    dropInFlight();
    setProfile(next);
    setError(null);
  };
  const review = async () => {
    if (!positionId || previewingRef.current || savingRef.current || checkingRef.current || unconfirmedRef.current) return;
    if (profile !== 'technical' && profile !== 'clinical') {
      setError('Choose a checklist profile before reviewing the impact.');
      return;
    }
    const request = ++requestId.current;
    const requested = { positionId, profile };
    previewingRef.current = true;
    setPreviewing(true);
    setError(null);
    setApplyError(null);
    try {
      const next = await previewWorkflowRule(requested.positionId, requested.profile);
      if (request !== requestId.current) return;
      if (selectionRef.current.positionId !== requested.positionId || selectionRef.current.profile !== requested.profile) return;
      setImpact(next);
      setReviewed(requested);
      setReviewOpen(true);
      setReason('');
      setReasonError(null);
      setSaved(null);
    } catch (e) {
      if (request !== requestId.current) return;
      setImpact(null);
      setReviewed(null);
      setReviewOpen(false);
      setError((e as { message?: string })?.message || 'Could not preview this rule.');
    } finally {
      if (request === requestId.current) {
        previewingRef.current = false;
        setPreviewing(false);
      }
    }
  };
  const noteUnconfirmed = (requested: { positionId: string; profile: RuleProfile }) => {
    unconfirmedRef.current = requested;
    setUnconfirmed(requested);
    setApplyError('The joining rule could not be confirmed from the saved positions. It is not shown as saved.');
  };
  const checkSaved = async () => {
    const requested = unconfirmedRef.current;
    if (!requested || checkingRef.current || savingRef.current) return;
    const gen = ++loadGen.current;
    checkingRef.current = true;
    setChecking(true);
    setApplyError(null);
    try {
      const fresh = await fetchWorkflowRules();
      if (gen !== loadGen.current) return;
      const rows = fresh.positions ?? [];
      setPositions(rows);
      setLoadError(null);
      const persisted = rows.find((row) => row.id === requested.positionId);
      if (persisted?.profile === requested.profile) {
        unconfirmedRef.current = null;
        setUnconfirmed(null);
        selectionRef.current = { positionId: requested.positionId, profile: requested.profile };
        setPositionId(requested.positionId);
        setProfile(requested.profile);
        setSaved(`Joining rule saved for ${persisted.title}. Stored checklist is ${profileLabel(requested.profile)}.`);
        closeReview();
        return;
      }
      unconfirmedRef.current = null;
      setUnconfirmed(null);
      setApplyError('The joining rule was not saved. The position still shows its previous checklist.');
    } catch {
      if (gen !== loadGen.current) return;
      noteUnconfirmed(requested);
    } finally {
      if (gen === loadGen.current) {
        checkingRef.current = false;
        setChecking(false);
      }
    }
  };
  const confirm = async () => {
    if (savingRef.current || checkingRef.current || unconfirmedRef.current || !impact || !reviewed) return;
    if (!canSave || !impact.applyAllowed) return;
    if (reviewed.positionId !== positionId || reviewed.profile !== profile) {
      setApplyError('Review the impact again before saving.');
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Enter a reason.');
      return;
    }
    if (trimmed.length > WORKFLOW_RULE_REASON_MAX) {
      setReasonError('Use 500 characters or fewer.');
      return;
    }
    const requested = reviewed;
    const gen = ++loadGen.current;
    savingRef.current = true;
    setSaving(true);
    setApplyError(null);
    setReasonError(null);
    setSaved(null);
    let applied = false;
    try {
      await applyWorkflowRule(requested.positionId, requested.profile, trimmed);
      applied = true;
      const fresh = await fetchWorkflowRules();
      if (gen !== loadGen.current) return;
      const rows = fresh.positions ?? [];
      setPositions(rows);
      const persisted = rows.find((row) => row.id === requested.positionId);
      if (persisted?.profile === requested.profile) {
        setProfile(requested.profile);
        setSaved(`Joining rule saved for ${persisted.title}. Stored checklist is ${profileLabel(requested.profile)}.`);
        closeReview();
        return;
      }
      setApplyError('The joining rule was not saved. The position still shows its previous checklist.');
    } catch (e) {
      if (gen !== loadGen.current) return;
      if (applied) {
        noteUnconfirmed(requested);
        return;
      }
      const fe = toFormErrs(e, { reason: 'reason' }, 'Could not save this joining rule.');
      setReasonError(fe.reason ?? null);
      setApplyError(fe.form ?? null);
    } finally {
      if (gen === loadGen.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };
  const selected = positions?.find((row) => row.id === positionId) ?? null;
  const awaitingResult = Boolean(unconfirmed);
  const canConfirm = Boolean(canSave && impact?.applyAllowed && reviewed && !awaitingResult);
  return (
    <section className="rf2-panel rf2-admin__card" aria-labelledby="rule-h">
      <div className="rf2-row-between rf2-admin__head">
        <div>
          <h2 id="rule-h" className="rf2-jtable__name">Joining checks by job</h2>
          <p className="rf2-jtable__sub">The required checklist follows the job configuration.</p>
        </div>
      </div>
      <div className="rf2-admin__pad rf2-admin__rules">
        <p className="rf2-jtable__name">Standard profile · Technical / administration</p>
        <p className="rf2-jtable__sub">ID and a signed contract. A professional licence is not required.</p>
        <p className="rf2-jtable__name">Clinical profile · Licence-required</p>
        <p className="rf2-jtable__sub">ID, a signed contract, and an SCFHS licence. Licence review stays limited to the assigned specialist.</p>
        <p className="rf2-jtable__sub">Final hiring approval stays required for every hire. Accepted cases keep their recorded checklist and history. Changing a profile shows affected jobs before saving.</p>
        <div className="rf2-admin__rule-lock">
          <p className="rf2-field__label">Licence reviewer permission</p>
          <p>Assigned licence checks only</p>
        </div>
        {positions === null && !loadError ? <SkeletonV2 lines={2} label="Loading positions…" /> : null}
        {loadError ? (
          <div role="alert">
            <p className="rf2-form-error">{loadError}</p>
            <div className="rf2-admin__rule-actions">
              <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setLoadAttempt((n) => n + 1)}>Try again</ButtonV2>
            </div>
          </div>
        ) : null}
        {positions && positions.length === 0 ? <p className="rf2-jtable__sub">No positions are available for a joining rule.</p> : null}
        {selected ? (
          <>
            <p className="rf2-jtable__sub">{storedChecklist(selected.profile)}</p>
            <div className="rf2-admin__rule-fields">
              <SelectV2 label="Job" value={positionId} disabled={saving || awaitingResult} onChange={(e) => chooseJob(e.target.value)}>
                {positions?.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
              </SelectV2>
              <SelectV2 label="Checklist profile" value={profile} disabled={saving || awaitingResult} placeholder={profile === '' ? 'Choose profile' : undefined} onChange={(e) => { const value = e.target.value; if (value === 'clinical' || value === 'technical') chooseProfile(value); }}>
                <option value="technical">Standard</option>
                <option value="clinical">Licence-required</option>
              </SelectV2>
            </div>
            <div className="rf2-admin__rule-actions">
              <ButtonV2 kind="secondary" icon={<ShieldCheck />} loading={previewing} disabled={saving || awaitingResult} onClick={() => { void review(); }}>Review impact</ButtonV2>
            </div>
          </>
        ) : null}
        {unconfirmed && !reviewOpen ? (
          <div role="alert">
            <p className="rf2-form-error">The joining rule could not be confirmed from the saved positions. It is not shown as saved.</p>
            <div className="rf2-admin__rule-actions">
              <ButtonV2 kind="secondary" icon={<RotateCw />} loading={checking} onClick={() => { void checkSaved(); }}>Check saved result</ButtonV2>
            </div>
          </div>
        ) : null}
        {applyError && !reviewOpen && !unconfirmed ? <p className="rf2-form-error" role="alert">{applyError}</p> : null}
        {error ? <p className="rf2-form-error" role="alert">{error}</p> : null}
        {saved ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {saved}</p> : null}
      </div>
      {reviewOpen && impact && reviewed ? (
        <DrawerV2 open onClose={closeReview} confirmClose={() => !savingRef.current && !checkingRef.current} kicker="Joining rules" title="Review joining-rule changes" subtitle="Check affected jobs before confirming a new checklist profile."
          primaryAction={awaitingResult
            ? <ButtonV2 icon={<RotateCw />} loading={checking} onClick={() => { void checkSaved(); }}>Check saved result</ButtonV2>
            : canConfirm ? <ButtonV2 icon={<CircleCheck />} loading={saving} onClick={() => { void confirm(); }}>Confirm rule change</ButtonV2> : undefined}
          secondaryAction={<ButtonV2 kind="secondary" disabled={saving || checking} onClick={closeReview}>Cancel</ButtonV2>}>
          <div className="rf2-admin__rules">
            <dl className="rf2-admin__rule-facts">
              <dt>Selected job</dt>
              <dd>{impact.positionTitle}</dd>
              <dt>Required profile</dt>
              <dd>{checklistText(reviewed.profile)}</dd>
              <dt>New cases</dt>
              <dd>Use the new profile after save. {impact.openCasesAdoptingProfile.length} open {impact.openCasesAdoptingProfile.length === 1 ? 'case' : 'cases'}.</dd>
              <dt>Accepted / existing cases</dt>
              <dd>Keep their recorded checklist and verification history. {impact.preservedSnapshots} accepted {impact.preservedSnapshots === 1 ? 'case' : 'cases'}.</dd>
              <dt>Final hiring approval</dt>
              <dd>Required for every hire · unchanged</dd>
            </dl>
            <p className="rf2-inline-note" data-tone={impact.applyAllowed ? 'info' : 'warning'}><Info aria-hidden="true" /> {impact.message}</p>
            {impact.vacancies.length ? (
              <table className="rf2-jtable" aria-label="Jobs on this position">
                <thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Seats</th><th scope="col">Result</th></tr></thead>
                <tbody>
                  {impact.vacancies.map((vacancy) => (
                    <tr key={vacancy.code}>
                      <th scope="row">{vacancy.code}</th>
                      <td>{vacancy.status}</td>
                      <td>{vacancy.joinedHeadcount}/{vacancy.approvedHeadcount}</td>
                      <td>{vacancy.protected ? 'Preview only' : 'Status and seats unchanged'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="rf2-jtable__sub">This position has no jobs.</p>}
            {canConfirm ? (
              <InputV2 label="Reason" required maxLength={WORKFLOW_RULE_REASON_MAX} value={reason} disabled={saving} error={reasonError ?? undefined} hint="Required before this checklist is saved." onChange={(e) => { setReason(e.target.value); setReasonError(null); }} />
            ) : null}
            {!canSave ? <p className="rf2-jtable__sub">You can review this impact. Saving needs the master-data manage permission.</p> : null}
            {applyError ? <p className="rf2-form-error" role="alert">{applyError}</p> : null}
          </div>
        </DrawerV2>
      ) : null}
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
