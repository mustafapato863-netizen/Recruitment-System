import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { EmailTemplateItem } from '@recruitflow/contracts';
import { deleteApi, getApi, patchApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Select } from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

const TEMPLATE_VARIABLES = [
  { key: '{{candidateName}}', label: 'Candidate Name' },
  { key: '{{positionTitle}}', label: 'Position Title' },
  { key: '{{stageName}}', label: 'Stage Name' },
  { key: '{{organizationName}}', label: 'Organization Name' },
];

const CATEGORY_OPTIONS = [
  { value: 'stage_auto', label: 'Stage Automation' },
  { value: 'notification', label: 'Notification' },
  { value: 'misc', label: 'Miscellaneous' },
];

type TemplateForm = {
  name: string;
  category: string;
  subject: string;
  bodyTemplate: string;
};

const emptyForm: TemplateForm = {
  name: '',
  category: 'stage_auto',
  subject: '',
  bodyTemplate: '',
};

function categoryLabel(cat: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat;
}

export function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getApi<EmailTemplateItem[]>('/email-templates');
      setTemplates(data);
    } catch {
      setError('Failed to load email templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setIsModalOpen(true);
  }

  function openEdit(t: EmailTemplateItem) {
    setForm({ name: t.name, category: t.category, subject: t.subject, bodyTemplate: t.bodyTemplate });
    setEditingId(t.id);
    setError('');
    setIsModalOpen(true);
  }

  async function handleDuplicate(t: EmailTemplateItem) {
    setBusy(true);
    try {
      await postApi(`/email-templates/${t.id}/duplicate`, {});
      await loadTemplates();
    } catch {
      setError('Failed to duplicate template.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await patchApi(`/email-templates/${editingId}`, form);
      } else {
        await postApi('/email-templates', form);
      }
      setIsModalOpen(false);
      await loadTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save template.';
      setError(msg);
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
      await loadTemplates();
    } catch {
      setError('Failed to delete template.');
    } finally {
      setBusy(false);
    }
  }

  function insertVariable(varKey: string) {
    setForm((f) => ({ ...f, bodyTemplate: f.bodyTemplate + varKey }));
  }

  return (
    <PageFrame
      title="Email Templates"
      description="Manage reusable email templates for stage automation and notifications. Default templates are read-only — duplicate to customise."
      actions={
        <Button id="btn-create-email-template" variant="primary" onClick={openCreate}>
          <Icon name="plus" size={16} />
          New Template
        </Button>
      }
    >
      {error && !isModalOpen && (
        <Alert tone="danger" className="mb-4">{error}</Alert>
      )}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : templates.length === 0 ? (
        <PageState
          kind="empty"
          title="No email templates yet"
          description="Create your first email template to enable stage automation."
          actionLabel="New Template"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="glass-card p-4 flex items-start justify-between gap-4 group hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-rf-ink">{t.name}</span>
                  {t.isDefault && (
                    <Badge variant="info" className="text-xs">Default</Badge>
                  )}
                  <Badge variant="purple" className="text-xs">{categoryLabel(t.category)}</Badge>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm text-rf-ink-muted truncate">
                  <span className="font-medium">Subject:</span> {t.subject}
                </p>
                <p className="text-xs text-rf-ink-subtle mt-1 line-clamp-2">{t.bodyTemplate}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  id={`btn-duplicate-${t.id}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDuplicate(t)}
                  disabled={busy}
                  title="Duplicate this template"
                >
                  <Icon name="copy" size={14} />
                </Button>
                {!t.isDefault && (
                  <>
                    <Button
                      id={`btn-edit-${t.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(t)}
                      title="Edit template"
                    >
                      <Icon name="edit" size={14} />
                    </Button>
                    <Button
                      id={`btn-delete-${t.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(t.id)}
                      title="Delete template"
                      className="text-rf-danger hover:bg-rf-danger/10"
                    >
                      <Icon name="trash-2" size={14} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Email Template' : 'New Email Template'}
        maxWidthClass="max-w-2xl"
      >
        <form id="email-template-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <FormField id="et-name" label="Template name" required>
            <Input
              id="et-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Screening Invitation"
              required
            />
          </FormField>

          <FormField id="et-category" label="Category">
            <Select
              id="et-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField id="et-subject" label="Subject" required>
            <Input
              id="et-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. We received your application for {{positionTitle}}"
              required
            />
          </FormField>

          <FormField id="et-body" label="Body">
            <div className="space-y-2">
              {/* Variable hint badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-rf-ink-muted">Insert variable:</span>
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    id={`btn-var-${v.key}`}
                    onClick={() => insertVariable(v.key)}
                    className="text-xs px-2 py-0.5 rounded-full bg-rf-accent/10 text-rf-accent hover:bg-rf-accent/20 transition-colors font-mono"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
              <textarea
                id="et-body"
                value={form.bodyTemplate}
                onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 rounded-lg border border-rf-border bg-rf-surface text-rf-ink text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-rf-accent/30"
                placeholder="Dear {{candidateName}},&#10;&#10;Thank you for applying for {{positionTitle}} at {{organizationName}}..."
                required
              />
            </div>
          </FormField>

          {/* Preview hint */}
          <div className="text-xs text-rf-ink-muted bg-rf-surface-alt rounded-lg p-3">
            <span className="font-semibold text-rf-ink">Supported variables:</span>{' '}
            {TEMPLATE_VARIABLES.map((v) => (
              <code key={v.key} className="mx-1 px-1 rounded bg-rf-border/30">{v.key}</code>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button id="btn-cancel-et" type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button id="btn-save-et" type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete email template"
        description="This template will be archived and can no longer be used for stage automation. This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
      />
    </PageFrame>
  );
}
