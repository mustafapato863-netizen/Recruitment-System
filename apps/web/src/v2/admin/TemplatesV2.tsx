import { toFormErrs } from './formErrors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, CircleCheck, Info, Mail, MessageCircle, Plus, RotateCw, Save } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, EmptyStateV2, InputV2, SelectV2, SkeletonV2, TextareaV2 } from '../../components/v2';
import { CATEGORIES, VARIABLES, archiveTemplate, fetchTemplates, render, saveTemplate, unknownVars, type Channel, type MessageTemplate } from './configApi';
import '../pages/jobs.css';
import './admin.css';

type Draft = { id: string | null; name: string; category: string; subject: string; bodyTemplate: string; isDefault?: boolean };
const blank = (ch: Channel): Draft => ({ id: null, name: '', category: ch === 'email' ? 'stage_auto' : 'interview_invite', subject: '', bodyTemplate: '' });
const toDraft = (t: MessageTemplate): Draft => ({ id: t.id, name: t.name, category: t.category, subject: t.subject ?? '', bodyTemplate: t.bodyTemplate, isDefault: t.isDefault });

/** A07 Templates (Admin seat only): email + WhatsApp messages the drawers use. Edit/new; no delete. */
export function TemplatesV2({ initial = 'email' }: { initial?: Channel } = {}) {
  const [params, setParams] = useSearchParams();
  const want = params.get('channel') ?? initial;
  const ch: Channel = want === 'whatsapp' ? 'whatsapp' : 'email';
  const [items, setItems] = useState<MessageTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let live = true; setItems(null); setError(null);
    fetchTemplates(ch).then((t) => { if (!live) return; setItems(t); setDraft((d) => (d && d.id && t.some((x) => x.id === d.id) ? toDraft(t.find((x) => x.id === d.id)!) : t[0] ? toDraft(t[0]) : blank(ch))); })
      .catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [ch, attempt]);
  const setCh = (c: Channel) => { setDraft(null); setNote(null); setErrs({}); setParams({ channel: c }); };
  const set = (k: keyof Draft) => (v: string) => { setDraft((d) => d && { ...d, [k]: v }); setErrs({}); };
  const insert = (key: string) => {
    if (!draft) return;
    const el = body.current; const tok = `{{${key}}}`;
    const at = el?.selectionStart ?? draft.bodyTemplate.length;
    set('bodyTemplate')(draft.bodyTemplate.slice(0, at) + tok + draft.bodyTemplate.slice(el?.selectionEnd ?? at));
  };
  const unknown = useMemo(() => (draft ? unknownVars(`${draft.subject} ${draft.bodyTemplate}`) : []), [draft]);
  const save = async () => {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Enter a name.';
    if (ch === 'email' && !draft.subject.trim()) e.subject = 'Enter a subject.';
    if (!draft.bodyTemplate.trim()) e.body = 'Write the message.';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const saved = await saveTemplate(ch, draft.id, { name: draft.name.trim(), category: draft.category, bodyTemplate: draft.bodyTemplate, ...(ch === 'email' ? { subject: draft.subject.trim() } : {}) });
      setNote(`“${draft.name.trim()}” saved.`); setDraft((d) => d && { ...d, id: saved?.id ?? d.id }); setAttempt((n) => n + 1);
    } catch (x) { setErrs(toFormErrs(x, { name: 'name', subject: 'subject', bodyTemplate: 'body', body: 'body', category: 'category' }, 'Could not save.')); } finally { setBusy(false); }
  };
  const archive = async () => {
    if (!draft?.id) return;
    const name = draft.name.trim() || 'Template';
    setBusy(true);
    try {
      await archiveTemplate(ch, draft.id);
      setNote(`“${name}” archived. It is no longer offered when sending; history keeps it.`);
      setDraft(null); setErrs({}); setAttempt((n) => n + 1);
    } catch (x) { setErrs(toFormErrs(x, {}, 'Could not archive.')); } finally { setBusy(false); }
  };
  const used = (c: string) => CATEGORIES[ch].find(([k]) => k === c)?.[1] ?? c;
  return (
    <div className="rf2-jobs rf2-admin">
      <div className="rf2-row-between">
        <div><h1 className="rf2-jobs__title">Templates</h1></div>
        <div className="rf2-segmented" role="group" aria-label="Channel">
          <ButtonV2 kind={ch === 'email' ? 'primary' : 'secondary'} size="sm" aria-pressed={ch === 'email'} onClick={() => setCh('email')}>Email</ButtonV2>
          <ButtonV2 kind={ch === 'whatsapp' ? 'primary' : 'secondary'} size="sm" aria-pressed={ch === 'whatsapp'} onClick={() => setCh('whatsapp')}>WhatsApp</ButtonV2>
        </div>
      </div>
      {note ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {note}</p> : null}
      {!items && !error ? <SkeletonV2 lines={6} label="Loading templates…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load templates" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {items && draft ? (
        <div className="rf2-admin__split">
          <nav className="rf2-panel rf2-admin__card" aria-label={`${ch === 'email' ? 'Email' : 'WhatsApp'} templates`}>
            <div className="rf2-row-between rf2-admin__head"><h2 className="rf2-jtable__name">{ch === 'email' ? 'Email' : 'WhatsApp'} templates</h2>
              <ButtonV2 kind="tertiary" size="sm" icon={<Plus />} onClick={() => { setDraft(blank(ch)); setNote(null); }}>New</ButtonV2></div>
            <ul className="rf2-admin__tpls">
              {items.map((t) => (
                <li key={t.id}><button type="button" className="rf2-admin__tpl" aria-current={draft.id === t.id || undefined} onClick={() => { setDraft(toDraft(t)); setErrs({}); setNote(null); }}>
                  {ch === 'email' ? <Mail aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}<span><span className="rf2-jtable__name">{t.name}</span><span className="rf2-jtable__sub">{used(t.category)}</span></span>
                </button></li>
              ))}
              {items.length === 0 ? <li className="rf2-jtable__sub rf2-admin__pad">No templates yet.</li> : null}
            </ul>
          </nav>
          <section className="rf2-panel rf2-admin__editor" aria-label="Template editor">
            <div className="rf2-req__row">
              <InputV2 label="Name" required value={draft.name} onChange={(e) => set('name')(e.target.value)} error={errs.name} />
              <SelectV2 label="Used by" value={draft.category} onChange={(e) => set('category')(e.target.value)} error={errs.category}>
                {CATEGORIES[ch].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </SelectV2>
            </div>
            {ch === 'email' ? <InputV2 label="Subject" required value={draft.subject} onChange={(e) => set('subject')(e.target.value)} error={errs.subject} /> : null}
            <TextareaV2 ref={body} label="Body" required rows={8} value={draft.bodyTemplate} onChange={(e) => set('bodyTemplate')(e.target.value)} error={errs.body} />
            <div><p className="rf2-field__label">Insert variable</p>
              <div className="rf2-admin__vars">{VARIABLES.map((v) => <button key={v} type="button" className="rf2-admin__var" onClick={() => insert(v)}>{`{{${v}}}`}</button>)}</div>
              {unknown.length ? <p className="rf2-inline-note" data-tone="warning"><Info aria-hidden="true" /> Not filled by the server, sent as typed: {unknown.map((u) => `{{${u}}}`).join(', ')}</p> : null}
            </div>
            <div className="rf2-admin__preview" aria-label="Preview">
              <p className="rf2-field__label">Preview — {render('{{candidateName}}')}</p>
              {ch === 'email' ? <p className="rf2-jtable__name">{render(draft.subject) || '—'}</p> : null}
              <p className="rf2-admin__pre">{render(draft.bodyTemplate) || '—'}</p>
            </div>
            {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
            <div className="rf2-admin__actions">
              <ButtonV2 icon={<Save />} loading={busy} onClick={() => void save()}>{draft.id ? 'Save template' : 'Create template'}</ButtonV2>
              {draft.id && draft.isDefault ? <p className="rf2-jtable__sub" data-testid="default-no-archive">Default templates can’t be archived.</p> : draft.id ? <DangerConfirmButton icon={<Archive />} confirmLabel="Confirm archive" disabled={busy} onConfirm={() => void archive()}>Archive</DangerConfirmButton> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
