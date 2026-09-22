import { useCallback, useEffect, useMemo, useState } from 'react';
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
  'candidateName',
  'positionTitle',
  'organizationName',
  'interviewType',
  'interviewDate',
  'recruiterName',
] as const;

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
  const sample: Record<string, string> = {
    candidateName: 'Sara Alharbi',
    positionTitle: 'Staff Nurse',
    organizationName: 'Saudi German Health',
    interviewType: 'Technical',
    interviewDate: 'Tue 24 Sep, 11:00 AM',
    recruiterName: 'Mustafa Zainhom',
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => sample[key] ?? `{{${key}}}`);
}

export function WhatsAppTemplatesPage() {
  const { success: toastSuccess, error: toastError } = useFeedback();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              Governance · Messaging
            </p>
            <h1 className="rf-page-title m-0 text-rf-ink">WhatsApp Templates</h1>
            <p className="mt-2 max-w-2xl text-sm text-rf-ink-muted">
              Craft recruiter-ready WhatsApp messages with live bubble preview. Send opens{' '}
              <span className="font-semibold text-rf-ink">wa.me</span> on your device — no Meta Cloud API.
            </p>
          </div>
          <Button type="button" variant="primary" onClick={openCreate} className="inline-flex items-center gap-2">
            <Icon name="plus" size={14} />
            New template
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {PLACEHOLDERS.map((p) => (
            <span
              key={p}
              className="rounded-full border border-rf-border-subtle bg-rf-surface px-2.5 py-1 font-mono text-[10px] font-bold text-rf-ink-muted"
            >
              {`{{${p}}}`}
            </span>
          ))}
        </div>
      </div>

      {error && <Alert tone="danger" title="Load failed">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className="min-w-[200px] flex-1 rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <PageState kind="loading" title="Loading WhatsApp templates" />
      ) : filtered.length === 0 ? (
        <PageState
          kind="empty"
          title="No templates yet"
          description="Create your first WhatsApp template or wait for defaults to seed."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="space-y-3">
            {filtered.map((t) => {
              const active = selected?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-2xl border border-rf-border-subtle bg-rf-surface p-4 text-left shadow-xs transition hover:bg-rf-surface-hover ${
                    active ? 'wa-card-selected' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold text-rf-ink">{t.name}</span>
                        {t.isDefault && (
                          <span className="rounded-full bg-rf-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rf-ink-muted">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-rf-ink-muted whitespace-pre-wrap">
                        {t.bodyTemplate}
                      </p>
                    </div>
                    <Icon name="chat" size={16} className="shrink-0 text-rf-ink-muted" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryChipClass(t.category)}`}>
                      {categoryLabel(t.category)}
                    </span>
                    <span className="rounded-full border border-rf-border-subtle bg-rf-surface-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink">
                      {t.interviewType}
                    </span>
                    <span className="rounded-full border border-rf-border-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink-muted">
                      {t.status}
                    </span>
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
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryChipClass(selected.category)}`}>
                      {categoryLabel(selected.category)}
                    </span>
                    <span className="rounded-full border border-rf-border-subtle px-2 py-0.5 text-[10px] font-bold text-rf-ink">
                      Interview: {selected.interviewType}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
                    WhatsApp preview
                  </div>
                  <div className="wa-preview-shell p-4">
                    <div className="wa-bubble relative z-[1] ml-auto max-w-[92%] px-3 py-2 text-[13px] leading-relaxed">
                      {renderPreview(selected.bodyTemplate)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void duplicate(selected)}>
                    Duplicate
                  </Button>
                  {!selected.isDefault && (
                    <>
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(selected)}>
                        Edit
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => setArchiveTarget(selected)}>
                        Archive
                      </Button>
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
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={saving} onClick={() => void saveEditor()}>
              {saving ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField id="wa-name" label="Name" required>
            <input
              className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm"
              value={editor.name}
              onChange={(e) => setEditor((s) => ({ ...s, name: e.target.value }))}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="wa-cat" label="Category">
              <select
                className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm"
                value={editor.category}
                onChange={(e) => setEditor((s) => ({ ...s, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="wa-itype" label="Interview type tag">
              <select
                className="w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm"
                value={editor.interviewType}
                onChange={(e) => setEditor((s) => ({ ...s, interviewType: e.target.value }))}
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField id="wa-body" label="Body" required hint={`Use ${PLACEHOLDERS.map((p) => '{{' + p + '}}').join(' ')}`}>
            <Textarea
              rows={10}
              value={editor.bodyTemplate}
              onChange={(e) => setEditor((s) => ({ ...s, bodyTemplate: e.target.value }))}
            />
          </FormField>
          <div className="wa-preview-shell p-4">
            <div className="wa-bubble relative z-[1] ml-auto max-w-[92%] px-3 py-2 text-[13px] leading-relaxed">
              {renderPreview(editor.bodyTemplate)}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
        title="Archive WhatsApp template?"
        description={archiveTarget ? `Archive “${archiveTarget.name}”? Recruiters will no longer see it in send pickers.` : undefined}
        confirmLabel="Archive"
        tone="danger"
      />
    </div>
  );
}

export default WhatsAppTemplatesPage;
