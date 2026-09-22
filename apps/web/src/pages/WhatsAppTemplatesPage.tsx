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
  { key: 'candidateName', label: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u0634\u062d', sample: 'Sara Alharbi' },
  { key: 'positionTitle', label: '\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064a\u0641\u064a', sample: 'Staff Nurse' },
  { key: 'organizationName', label: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629', sample: 'Saudi German Health' },
  { key: 'interviewType', label: '\u0646\u0648\u0639 \u0627\u0644\u0645\u0642\u0627\u0628\u0644\u0629', sample: 'Technical' },
  { key: 'interviewDate', label: '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u0642\u0627\u0628\u0644\u0629', sample: 'Tue 24 Sep, 11:00 AM' },
  { key: 'recruiterName', label: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644', sample: 'Mustafa Zainhom' },
] as const;

const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  PLACEHOLDERS.map((item) => [item.key, item.sample]),
);

type EditorState = {
  id?: string;
  name: string;
  category: string;
  interviewType: string;
  bodyTemplate: string;
};

const emptyEditor = (): EditorState => ({
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

function WhatsAppFullPreview({ body, title }: { body: string; title?: string }) {
  const rendered = renderPreview(body);
  return (
    <div className="wa-phone">
      <div className="wa-phone-bar">
        <span className="wa-phone-dot" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-white">{title || 'WhatsApp'}</div>
          <div className="text-[10px] text-white/70">\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0643\u0645\u0627 \u0633\u062a\u0638\u0647\u0631 \u0644\u0644\u0645\u0631\u0634\u062d</div>
        </div>
      </div>
      <div className="wa-preview-shell wa-preview-shell-full">
        <div className="wa-bubble relative z-[1] ml-auto max-w-[94%] px-3 py-2.5 text-[13px] leading-relaxed">
          {rendered || '\u2014'}
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
  }, []);

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

  function openEdit(t: WhatsAppTemplateItem) {
    if (t.isDefault) {
      toastError(new Error('Default templates are read-only'), 'Duplicate to customise');
      return;
    }
    setEditor({
      id: t.id,
      name: t.name,
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
      if (editor.id) {
        await patchApi(`/whatsapp-templates/${editor.id}`, {
          name: editor.name,
          category: editor.category,
          interviewType: editor.interviewType,
          bodyTemplate: editor.bodyTemplate,
        });
        toastSuccess('Template updated', editor.name);
      } else {
        const created = await postApi<WhatsAppTemplateItem>('/whatsapp-templates', {
          name: editor.name,
          category: editor.category,
          interviewType: editor.interviewType,
          bodyTemplate: editor.bodyTemplate,
        });
        setSelectedId(created.id);
        toastSuccess('Template created', created.name);
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      toastError(err, getErrorMessage(err, 'Unable to save template'));
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(t: WhatsAppTemplateItem) {
    try {
      const copy = await postApi<WhatsAppTemplateItem>(`/whatsapp-templates/${t.id}/duplicate`, {});
      toastSuccess('Template duplicated', copy.name);
      setSelectedId(copy.id);
      await load();
    } catch (err) {
      toastError(err, getErrorMessage(err, 'Unable to duplicate'));
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
              \u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u062a\u063a\u064a\u0631 \u0628\u0627\u0644\u0636\u063a\u0637 \u0639\u0644\u064a\u0647 \u0644\u064a\u064f\u062f\u0631\u062c \u0641\u064a \u0627\u0644\u0646\u0635\u060c \u0648\u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0639\u0644\u0649 \u0627\u0644\u064a\u0645\u064a\u0646 \u062a\u0639\u0631\u0636 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0643\u0627\u0645\u0644\u0629 \u0643\u0645\u0627 \u0633\u062a\u0638\u0647\u0631 \u0639\u0644\u0649 \u0648\u0627\u062a\u0633\u0627\u0628.
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
          placeholder="Search templates\u2026"
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
                        {t.isDefault && (
                          <span className="rounded-full bg-rf-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rf-ink-muted">Default</span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-rf-ink-muted whitespace-pre-wrap">{t.bodyTemplate}</p>
                    </div>
                    <Icon name="chat" size={16} className="shrink-0 text-rf-ink-muted" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryChipClass(t.category)}`}>{categoryLabel(t.category)}</span>
                    <span className="rounded-full border border-rf-border-subtle bg-rf-surface-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink">{t.interviewType}</span>
                    <span className="rounded-full border border-rf-border-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink-muted">{t.status}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-rf-border-subtle bg-rf-surface p-4 shadow-xs xl:sticky xl:top-20 h-fit space-y-4">
            {selected ? (
              <>
                <div>
                  <h2 className="m-0 text-base font-bold text-rf-ink">{selected.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryChipClass(selected.category)}`}>{categoryLabel(selected.category)}</span>
                    <span className="rounded-full border border-rf-border-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink">Interview: {selected.interviewType}</span>
                  </div>
                </div>
                <WhatsAppFullPreview body={selected.bodyTemplate} title={selected.name} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void duplicate(selected)}>Duplicate</Button>
                  {!selected.isDefault && (
                    <>
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(selected)}>Edit</Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => setArchiveTarget(selected)}>Archive</Button>
                    </>
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
        title={editor.id ? 'Edit WhatsApp template' : 'New WhatsApp template'}
        maxWidthClass="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="button" variant="primary" disabled={saving} onClick={() => void saveEditor()}>{saving ? 'Saving\u2026' : 'Save template'}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField id="wa-name" label="Name" required>
            <input className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm" value={editor.name} onChange={(e) => setEditor((s) => ({ ...s, name: e.target.value }))} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="wa-cat" label="Category">
              <select className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm" value={editor.category} onChange={(e) => setEditor((s) => ({ ...s, category: e.target.value }))}>
                {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </FormField>
            <FormField id="wa-itype" label="Interview type tag">
              <select className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm" value={editor.interviewType} onChange={(e) => setEditor((s) => ({ ...s, interviewType: e.target.value }))}>
                {INTERVIEW_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </FormField>
          </div>
          <FormField id="wa-body" label="Body" required hint="\u0627\u0636\u063a\u0637 \u0627\u0644\u0645\u062a\u063a\u064a\u0631 \u0644\u0625\u062f\u0631\u0627\u062c\u0647 \u0641\u064a \u0645\u0643\u0627\u0646 \u0627\u0644\u0645\u0624\u0634\u0631 \u2014 \u0628\u062f\u0648\u0646 \u0643\u062a\u0627\u0628\u0629 \u064a\u062f\u0648\u064a\u0629">
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
        description={archiveTarget ? `Archive \u201c${archiveTarget.name}\u201d? Recruiters will no longer see it in send pickers.` : undefined}
        confirmLabel="Archive"
        tone="danger"
      />
    </div>
  );
}

export default WhatsAppTemplatesPage;
