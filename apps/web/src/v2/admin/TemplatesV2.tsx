import { toFormErrs } from './formErrors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CircleCheck, Info, MessageCircle, Plus, RotateCw, Save, Search } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, EmptyStateV2, InputV2, SelectV2, SkeletonV2, TextareaV2 } from '../../components/v2';
import { CATEGORIES, VARIABLES, archiveTemplate, fetchTemplates, render, saveTemplate, unknownVars, type MessageTemplate } from './configApi';
import { AdminWorkspaceHeader } from './AdminWorkspaceHeader';
import '../pages/jobs.css';
import './admin.css';

type Draft = { id: string | null; name: string; category: string; bodyTemplate: string; isDefault?: boolean };
const blank = (): Draft => ({ id: null, name: '', category: 'interview_invite', bodyTemplate: '' });
const toDraft = (t: MessageTemplate): Draft => ({ id: t.id, name: t.name, category: t.category, bodyTemplate: t.bodyTemplate, isDefault: t.isDefault });

/** WhatsApp templates used when writing to a candidate. Email templates remain stored for v3 and are not edited here. */
export function TemplatesV2() {
  const [items, setItems] = useState<MessageTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const body = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let live = true; setItems(null); setError(null);
    fetchTemplates('whatsapp').then((t) => { if (!live) return; setItems(t); setDraft((d) => (d && d.id && t.some((x) => x.id === d.id) ? toDraft(t.find((x) => x.id === d.id)!) : t[0] ? toDraft(t[0]) : blank())); })
      .catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt]);
  const set = (k: keyof Draft) => (v: string) => { setDraft((d) => d && { ...d, [k]: v }); setErrs({}); };
  const insert = (key: string) => {
    if (!draft) return;
    const el = body.current; const tok = `{{${key}}}`;
    const at = el?.selectionStart ?? draft.bodyTemplate.length;
    set('bodyTemplate')(draft.bodyTemplate.slice(0, at) + tok + draft.bodyTemplate.slice(el?.selectionEnd ?? at));
  };
  const unknown = useMemo(() => (draft ? unknownVars(draft.bodyTemplate) : []), [draft]);
  const save = async () => {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Enter a name.';
    if (!draft.bodyTemplate.trim()) e.body = 'Write the message.';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const saved = await saveTemplate('whatsapp', draft.id, { name: draft.name.trim(), category: draft.category, bodyTemplate: draft.bodyTemplate });
      setNote(`“${draft.name.trim()}” saved.`); setDraft((d) => d && { ...d, id: saved?.id ?? d.id }); setAttempt((n) => n + 1);
    } catch (x) { setErrs(toFormErrs(x, { name: 'name', bodyTemplate: 'body', body: 'body', category: 'category' }, 'Could not save.')); } finally { setBusy(false); }
  };
  const archive = async () => {
    if (!draft?.id) return;
    const name = draft.name.trim() || 'Template';
    setBusy(true);
    try {
      await archiveTemplate('whatsapp', draft.id);
      setNote(`“${name}” archived. It is no longer offered when sending; history keeps it.`);
      setDraft(null); setErrs({}); setAttempt((n) => n + 1);
    } catch (x) { setErrs(toFormErrs(x, {}, 'Could not archive.')); } finally { setBusy(false); }
  };
  const used = (c: string) => CATEGORIES.whatsapp.find(([k]) => k === c)?.[1] ?? c;
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter((t) => `${t.name} ${used(t.category)} ${t.bodyTemplate}`.toLowerCase().includes(q));
  }, [items, search]);
  return (
    <div className="rf2-jobs rf2-admin">
      <AdminWorkspaceHeader
        group="Recruitment Setup"
        title="WhatsApp templates"
        subtitle="Configure message templates and approved placeholders for candidate outreach."
      />
      {note ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {note}</p> : null}
      {!items && !error ? <SkeletonV2 lines={6} label="Loading templates…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load templates" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {items && draft ? (
        <div className="rf2-admin__split">
          <nav className="rf2-panel rf2-admin__card" aria-label="WhatsApp templates">
            <div className="rf2-row-between rf2-admin__head"><h2 className="rf2-jtable__name">WhatsApp templates</h2>
              <ButtonV2 kind="secondary" size="sm" icon={<Plus />} onClick={() => { setDraft(blank()); setNote(null); }}>New</ButtonV2></div>
            <div className="rf2-admin__tpl-search">
              <InputV2 label="Search templates" fieldClassName="rf2-sr-label" placeholder="Search templates…" leadingIcon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ul className="rf2-admin__tpls">
              {visibleItems.map((t) => (
                <li key={t.id}><button type="button" className="rf2-admin__tpl" aria-current={draft.id === t.id || undefined} onClick={() => { setDraft(toDraft(t)); setErrs({}); setNote(null); }}>
                  <MessageCircle aria-hidden="true" /><span><span className="rf2-jtable__name">{t.name}</span><span className="rf2-jtable__sub">{used(t.category)}</span></span>
                </button></li>
              ))}
              {visibleItems.length === 0 ? <li className="rf2-jtable__sub rf2-admin__pad">{items.length === 0 ? 'No templates yet.' : 'No templates match your search.'}</li> : null}
            </ul>
          </nav>
          <section className="rf2-panel rf2-admin__card rf2-admin__editor" aria-label="Template editor">
            <div className="rf2-admin__editor-layout">
              <div className="rf2-admin__editor-main">
                <div className="rf2-req__row">
                  <InputV2 label="Name" required value={draft.name} onChange={(e) => set('name')(e.target.value)} error={errs.name} />
                  <SelectV2 label="Used by" value={draft.category} onChange={(e) => set('category')(e.target.value)} error={errs.category}>
                    {CATEGORIES.whatsapp.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </SelectV2>
                </div>
                <TextareaV2 ref={body} label="Body" required rows={8} value={draft.bodyTemplate} onChange={(e) => set('bodyTemplate')(e.target.value)} error={errs.body} />
                <div><p className="rf2-field__label">Insert variable</p>
                  <div className="rf2-admin__vars">{VARIABLES.map((v) => <button key={v} type="button" className="rf2-admin__var" onClick={() => insert(v)}>{`{{${v}}}`}</button>)}</div>
                  {unknown.length ? <p className="rf2-inline-note" data-tone="warning"><Info aria-hidden="true" /> Not filled by the server, sent as typed: {unknown.map((u) => `{{${u}}}`).join(', ')}</p> : null}
                </div>
                {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
                <div className="rf2-admin__actions">
                  <ButtonV2 icon={<Save />} loading={busy} onClick={() => void save()}>{draft.id ? 'Save template' : 'Create template'}</ButtonV2>
                  {draft.id && draft.isDefault ? <p className="rf2-jtable__sub" data-testid="default-no-archive">Default templates can’t be archived.</p> : draft.id ? <DangerConfirmButton icon={<Archive />} confirmLabel="Confirm archive" disabled={busy} onConfirm={() => void archive()}>Archive</DangerConfirmButton> : null}
                </div>
              </div>
              <div className="rf2-admin__editor-side">
                <div className="rf2-admin__preview" aria-label="Preview">
                  <div className="wa-phone">
                    <div className="wa-phone-bar">
                      <span className="wa-phone-avatar" aria-hidden="true" />
                      <span className="wa-phone-id">
                        <span className="wa-phone-name">{render('{{candidateName}}')}</span>
                        <span className="wa-phone-sub">WhatsApp live preview</span>
                      </span>
                    </div>
                    <div className="wa-preview-shell">
                      <div className="wa-bubble">
                        <p className="rf2-field__label">Preview — {render('{{candidateName}}')}</p>
                        <p className="rf2-admin__pre">{render(draft.bodyTemplate) || '—'}</p>
                        <time>Now</time>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
