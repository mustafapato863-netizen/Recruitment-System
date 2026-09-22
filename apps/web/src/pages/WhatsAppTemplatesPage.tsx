import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WhatsAppTemplateItem } from '@recruitflow/contracts';
import { deleteApi, getApi, postApi, patchApi } from '../api/client';
import { getErrorMessage } from '../api/errors';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Alert } from '../components/ui/Alert';
import { useFeedback } from '../hooks/useFeedback';
import { PageState } from '../components/ui/PageState';
import './WhatsAppTemplatesPage.css';

const CATEGORIES = [
  { value: 'ack', label: 'Acknowledgement' },
  { value: 'interview_invite', label: 'Interview invite' },
  { value: 'offer_next_step', label: 'Offer / next step' },
  { value: 'rejection', label: 'Rejection' },
  { value: 'misc', label: 'Misc' },
] as const;

const INTERVIEW_TYPES = ['Any', 'Screening', 'Technical', 'Behavioral', 'Managerial', 'Executive'] as const;

const PLACEHOLDERS = [
  { key: 'candidateName', label: 'Candidate name', sample: 'Sara Alharbi' },
  { key: 'positionTitle', label: 'Job title', sample: 'Staff Nurse' },
  { key: 'organizationName', label: 'Organization', sample: 'Saudi German Health' },
  { key: 'interviewType', label: 'Interview type', sample: 'Technical' },
  { key: 'interviewDate', label: 'Interview date', sample: 'Tue 24 Sep, 11:00 AM' },
  { key: 'recruiterName', label: 'Recruiter name', sample: 'Mustafa Zainhom' },
] as const;

const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  PLACEHOLDERS.map((item) => [item.key, item.sample]),
);

type EditorState = {
  id?: string;
  sourceId?: string;
  isDefaultSource?: boolean;
  saveMode: 'update' | 'create';
  name: string;
  category: string;
  interviewType: string;
  bodyTemplate: string;
};

const emptyEditor = (): EditorState => ({
  saveMode: 'create',
  name: '',
  category: 'misc',
  interviewType: 'Any',
  bodyTemplate: 'Hi {{candidateName}},\n\n',
});

function categoryChipClass(category: string) {
  switch (category) {
    case 'ack':
      return 'wa-chip-ack';
    case 'interview_invite':
      return 'wa-chip-invite';
    case 'offer_next_step':
      return 'wa-chip-offer';
    case 'rejection':
      return 'wa-chip-reject';
    default:
      return 'wa-chip-misc';
  }
}

function categoryLabel(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

function renderPreview(body: string) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE_VALUES[key] ?? `{{${key}}}`);
}

function tokenFor(key: string) {
  return `{{${key}}}`;
}

function snippet(body: string) {
  const text = renderPreview(body).replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function WhatsAppFullPreview({ body, title }: { body: string; title?: string }) {
  const rendered = renderPreview(body);
  return (
    <div className="wa-phone">
      <div className="wa-phone-bar">
        <span className="wa-phone-dot" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-white">{title || 'WhatsApp'}</div>
          <div className="text-[10px] text-white/70">Full message preview</div>
        </div>
      </div>
      <div className="wa-preview-shell wa-preview-shell-full">
        <div className="wa-bubble relative z-[1] ml-auto max-w-[94%] px-3 py-2.5 text-[13px] leading-relaxed">
          {rendered || 'Message preview will appear here.'}
        </div>
      </div>
    </div>
  );
}

export function WhatsAppTemplatesPage() {
  const { success: toastSuccess, error: toastError } = useFeedback();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<WhatsAppTemplateItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApi<WhatsAppTemplateItem[]>('/whatsapp-templates');
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load WhatsApp templates');
      setError(message);
      toastError(err, message);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.bodyTemplate.toLowerCase().includes(q) ||
        t.interviewType.toLowerCase().includes(q)
      );
    });
  }, [templates, query, categoryFilter]);

  const selected = templates.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  function insertPlaceholder(key: string) {
    const token = tokenFor(key);
    const el = bodyRef.current;
    const current = editor.bodyTemplate;
    if (!el) {
      setEditor((s) => ({ ...s, bodyTemplate: `${current}${token}` }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    setEditor((s) => ({ ...s, bodyTemplate: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function openCreate() {
    setEditor(emptyEditor());
    setEditorOpen(true);
  }

  function openEdit(t: WhatsAppTemplateItem, mode: 'update' | 'create' = 'update') {
    const baseName = mode === 'create' ? `${t.name} (custom)` : t.name;
    setEditor({
      id: mode === 'update' ? t.id : undefined,
      sourceId: t.id,
      isDefaultSource: t.isDefault,
      saveMode: mode,
      name: baseName,
      category: t.category,
      interviewType: t.interviewType,
      bodyTemplate: t.bodyTemplate,
    });
    setEditorOpen(true);
  }

  async function saveEditor() {
    if (!editor.name.trim() || !editor.bodyTemplate.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: editor.name.trim(),
        category: editor.category,
        interviewType: editor.interviewType,
        bodyTemplate: editor.bodyTemplate,
      };
      if (editor.saveMode === 'update' && editor.id) {
        await patchApi(`/whatsapp-templates/${editor.id}`, payload);
        toastSuccess('Template updated', editor.name);
      } else {
        const created = await postApi<WhatsAppTemplateItem>('/whatsapp-templates', payload);
        setSelectedId(created.id);
        toastSuccess('Template saved', created.name);
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      toastError(err, getErrorMessage(err, 'Unable to save template'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    try {
      await deleteApi(`/whatsapp-templates/${archiveTarget.id}`);
      toastSuccess('Template archived', archiveTarget.name);
      setArchiveTarget(null);
      if (selectedId === archiveTarget.id) setSelectedId(null);
      await load();
    } catch (err) {
      toastError(err, getErrorMessage(err, 'Unable to archive'));
    }
  }

  const editorTitle =
    editor.saveMode === 'create' && editor.sourceId
      ? 'Reuse default as a new template'
      : editor.id
        ? 'Edit template'
        : 'New template';

  return (
    <div className="wa-page rf-page space-y-5">
      <div className="wa-hero rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rf-ink-muted mb-1">
              Governance \u00b7 Messaging
            </p>
            <h1 className="rf-page-title m-0 text-rf-ink">WhatsApp Templates</h1>
            <p className="mt-2 max-w-2xl text-sm text-rf-ink-muted">
              Click a variable to insert it. Preview on the right shows the full message as it will appear. Default templates can be renamed, edited, or saved as a reusable copy.
            </p>
          </div>
          <Button type="button" variant="primary" onClick={openCreate} className="inline-flex items-center gap-2">
            <Icon name="plus" size={14} />
            New template
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="Load failed">{error}</Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates..."
          className="min-w-[200px] flex-1 rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <PageState kind="loading" title="Loading WhatsApp templates" />
      ) : filtered.length === 0 ? (
        <PageState kind="empty" title="No templates yet" description="Create your first WhatsApp template or wait for defaults to seed." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
          <div className="space-y-3">
            {filtered.map((t) => {
              const active = selected?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-2xl border border-rf-border-subtle bg-rf-surface p-4 text-left shadow-xs transition hover:bg-rf-surface-hover ${active ? 'wa-card-selected' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold text-rf-ink">{t.name}</span>
                        {t.isDefault && <span className="wa-default-pill">Default</span>}
                      </div>
                      <p className="mt-1 text-xs text-rf-ink-muted">{snippet(t.bodyTemplate)}</p>
                    </div>
                    <Icon name="chat" size={16} className="shrink-0 text-rf-ink-muted" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryChipClass(t.category)}`}>{categoryLabel(t.category)}</span>
                    <span className="rounded-full border border-rf-border-subtle bg-rf-surface-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink">{t.interviewType}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-rf-border-subtle bg-rf-surface p-4 shadow-xs xl:sticky xl:top-20 h-fit space-y-4">
            {selected ? (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="m-0 text-base font-bold text-rf-ink">{selected.name}</h2>
                    {selected.isDefault && <span className="wa-default-pill">Default</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryChipClass(selected.category)}`}>{categoryLabel(selected.category)}</span>
                    <span className="rounded-full border border-rf-border-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink">Interview: {selected.interviewType}</span>
                  </div>
                </div>
                <WhatsAppFullPreview body={selected.bodyTemplate} title={selected.name} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" size="sm" onClick={() => openEdit(selected, 'update')}>Rename & edit</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(selected, 'create')}>Save as new</Button>
                  {!selected.isDefault && (
                    <Button type="button" variant="danger" size="sm" onClick={() => setArchiveTarget(selected)}>Archive</Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-rf-ink-muted">Select a template to preview.</p>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorTitle}
        maxWidthClass="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="button" variant="primary" disabled={saving} onClick={() => void saveEditor()}>
              {saving ? 'Saving...' : editor.saveMode === 'create' ? 'Save as new template' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {editor.isDefaultSource && editor.saveMode === 'update' && (
            <Alert tone="info" title="Editing a default">
              You can rename this default and change the message. Use Save as new if you want to keep the original wording.
            </Alert>
          )}
          <FormField id="wa-name" label="Template name" required>
            <input
              className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm"
              value={editor.name}
              onChange={(e) => setEditor((s) => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Screening invite - Nursing"
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="wa-cat" label="Category">
              <select className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm" value={editor.category} onChange={(e) => setEditor((s) => ({ ...s, category: e.target.value }))}>
                {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </FormField>
            <FormField id="wa-itype" label="Interview type">
              <select className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm" value={editor.interviewType} onChange={(e) => setEditor((s) => ({ ...s, interviewType: e.target.value }))}>
                {INTERVIEW_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </FormField>
          </div>
          <FormField id="wa-body" label="Message" required hint="Click a field below to insert it at the cursor.">
            <div className="mb-2 flex flex-wrap gap-2">
              {PLACEHOLDERS.map((item) => (
                <button key={item.key} type="button" className="wa-var-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => insertPlaceholder(item.key)}>
                  <span className="wa-var-chip-label">{item.label}</span>
                  <span className="wa-var-chip-token">{tokenFor(item.key)}</span>
                </button>
              ))}
            </div>
            <Textarea ref={bodyRef} rows={10} value={editor.bodyTemplate} onChange={(e) => setEditor((s) => ({ ...s, bodyTemplate: e.target.value }))} />
          </FormField>
          <WhatsAppFullPreview body={editor.bodyTemplate} title={editor.name || 'Preview'} />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
        title="Archive WhatsApp template?"
        description={archiveTarget ? `Archive "${archiveTarget.name}"? Recruiters will no longer see it in send pickers.` : undefined}
        confirmLabel="Archive"
        tone="danger"
      />
    </div>
  );
}

export default WhatsAppTemplatesPage;
