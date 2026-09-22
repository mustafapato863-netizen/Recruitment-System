import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { EmailTemplateItem } from '@recruitflow/contracts';
import { deleteApi, getApi, patchApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Select } from '../components/ui/Select';
import './EmailTemplatesPage.css';

const PLACEHOLDERS = [
  { key: '{{candidateName}}', label: 'Candidate name', sample: 'Ahmed Youssef' },
  { key: '{{positionTitle}}', label: 'Job title', sample: 'Web Developer' },
  { key: '{{stageName}}', label: 'Stage', sample: 'Screening' },
  { key: '{{organizationName}}', label: 'Organization', sample: 'Saudi German Health' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'stage_auto', label: 'Stage automation' },
  { value: 'notification', label: 'Notification' },
  { value: 'misc', label: 'Misc' },
];

type FormState = {
  id?: string;
  saveMode: 'update' | 'create';
  name: string;
  category: string;
  subject: string;
  bodyTemplate: string;
};

const emptyForm = (): FormState => ({
  saveMode: 'create',
  name: '',
  category: 'stage_auto',
  subject: '',
  bodyTemplate: 'Dear {{candidateName}},\n\n',
});

function categoryLabel(cat: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat;
}

function renderPreview(text: string): string {
  return PLACEHOLDERS.reduce(
    (out, item) => out.replaceAll(item.key, item.sample),
    text || '',
  );
}

export function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const insertTarget = useRef<'subject' | 'body'>('body');

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getApi<EmailTemplateItem[]>('/email-templates');
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch {
      setError('Failed to load email templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.bodyTemplate.toLowerCase().includes(q)
      );
    });
  }, [templates, query, categoryFilter]);

  const selected = templates.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setForm({
      id: selected.id,
      saveMode: 'update',
      name: selected.name,
      category: selected.category,
      subject: selected.subject,
      bodyTemplate: selected.bodyTemplate,
    });
  }, [selected?.id]);

  function insertVariable(token: string) {
    const target = insertTarget.current;
    if (target === 'subject') {
      const el = subjectRef.current;
      const current = form.subject;
      if (!el) {
        setForm((f) => ({ ...f, subject: `${current}${token}` }));
        return;
      }
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
      setForm((f) => ({ ...f, subject: next }));
      requestAnimationFrame(() => {
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
      return;
    }
    const el = bodyRef.current;
    const current = form.bodyTemplate;
    if (!el) {
      setForm((f) => ({ ...f, bodyTemplate: `${current}${token}` }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    setForm((f) => ({ ...f, bodyTemplate: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function openCreate() {
    setSelectedId(null);
    setForm(emptyForm());
    setError('');
  }

  function reuseSelected() {
    if (!selected) return;
    setForm({
      saveMode: 'create',
      name: `${selected.name} (custom)`,
      category: selected.category,
      subject: selected.subject,
      bodyTemplate: selected.bodyTemplate,
    });
    setSelectedId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim() || !form.bodyTemplate.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (form.saveMode === 'update' && form.id) {
        await patchApi(`/email-templates/${form.id}`, {
          name: form.name,
          category: form.category,
          subject: form.subject,
          bodyTemplate: form.bodyTemplate,
        });
      } else {
        await postApi('/email-templates', {
          name: form.name,
          category: form.category,
          subject: form.subject,
          bodyTemplate: form.bodyTemplate,
        });
      }
      await loadTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteApi(`/email-templates/${pendingDelete}`);
      setPendingDelete(null);
      setSelectedId(null);
      await loadTemplates();
    } catch {
      setError('Failed to delete template.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame
      title="Email Templates"
      description="Click a variable to insert it. Preview shows the full email as the candidate will read it. Defaults can be renamed, edited, or reused."
      actions={
        <Button id="btn-create-email-template" variant="primary" onClick={openCreate}>
          <Icon name="plus" size={16} />
          New template
        </Button>
      }
    >
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {loading ? (
        <PageState kind="loading" title="Loading email templates..." />
      ) : templates.length === 0 && !form.name ? (
        <PageState
          kind="empty"
          title="No email templates yet"
          description="Create the first template for stage emails."
          actionLabel="New template"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              className="mb-2"
            />
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <div className="mt-3 space-y-1 max-h-[62vh] overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left ${selectedId === t.id ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.name}</span>
                    {t.isDefault && <Badge variant="info" className="text-[10px]">Default</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.subject}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{categoryLabel(t.category)}</p>
                </button>
              ))}
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {form.saveMode === 'create' ? 'New template' : 'Edit template'}
              </h2>
              {selected && (
                <Button type="button" variant="secondary" size="sm" onClick={reuseSelected}>
                  Reuse as custom
                </Button>
              )}
            </div>

            <FormField id="et-name" label="Name" required>
              <Input id="et-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </FormField>
            <FormField id="et-category" label="Category">
              <Select id="et-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField id="et-subject" label="Subject" required>
              <Input
                id="et-subject"
                ref={subjectRef}
                value={form.subject}
                onFocus={() => { insertTarget.current = 'subject'; }}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </FormField>

            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => insertVariable(item.key)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                  title={`Insert ${item.key}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <FormField id="et-body" label="Body" required>
              <textarea
                id="et-body"
                ref={bodyRef}
                value={form.bodyTemplate}
                onFocus={() => { insertTarget.current = 'body'; }}
                onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                rows={12}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </FormField>

            <div className="flex items-center justify-between gap-2 pt-1">
              {form.id && !selected?.isDefault && (
                <Button type="button" variant="ghost" className="text-rose-600" onClick={() => setPendingDelete(form.id!)}>
                  Delete
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? 'Saving…' : form.saveMode === 'create' ? 'Create template' : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>

          <aside className="email-preview">
            <div className="email-preview-bar">Inbox preview</div>
            <div className="email-preview-subject">{renderPreview(form.subject) || 'Subject'}</div>
            <div className="email-preview-meta">To: Ahmed Youssef · From: Recruiting</div>
            <div className="email-preview-body">{renderPreview(form.bodyTemplate) || 'Message body will appear here.'}</div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete email template"
        description="This template will be archived and can no longer be used for stage automation."
        confirmLabel="Delete"
        tone="danger"
      />
    </PageFrame>
  );
}
