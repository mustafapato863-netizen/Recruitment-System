import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PipelineStageItem, PipelineTemplateItem, EmailTemplateItem } from '@recruitflow/contracts';
import { deleteApi, getApi, patchApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CheckboxField } from '../components/ui/CheckboxField';
import { FormField } from '../components/ui/FormField';
import { FormSection } from '../components/ui/FormSection';
import { Input } from '../components/ui/Input';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Select } from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

type PipelineTemplateDetail = PipelineTemplateItem & { stages: PipelineStageItem[] };
type TemplateForm = { name: string; isDefault: boolean };
type StageForm = {
  name: string;
  stageType: string;
  slaDays: string;
  // Phase C — Stage Automation fields
  emailTemplateId: string;
  folded: boolean;
  isHiredStage: boolean;
  tooltip: string;
};

const emptyTemplateForm: TemplateForm = { name: '', isDefault: false };
const emptyStageForm: StageForm = {
  name: '',
  stageType: 'Screening',
  slaDays: '',
  emailTemplateId: '',
  folded: false,
  isHiredStage: false,
  tooltip: '',
};

const stageColumns: ResponsiveDataColumn<PipelineStageItem>[] = [
  {
    key: 'order',
    header: 'Order',
    priority: 'secondary',
    render: (stage) => <Badge variant="neutral">#{stage.sortOrder}</Badge>,
  },
  {
    key: 'name',
    header: 'Stage name',
    priority: 'primary',
    render: (stage) => <span className="font-bold text-rf-ink">{stage.name}</span>,
  },
  {
    key: 'type',
    header: 'Stage type',
    priority: 'secondary',
    render: (stage) => <Badge variant="purple">{stage.stageType}</Badge>,
  },
  {
    key: 'sla',
    header: 'SLA target',
    priority: 'secondary',
    render: (stage) => <span className="font-medium text-rf-ink-muted">{stage.slaDays ? `${stage.slaDays} days` : 'No SLA'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (stage) => <StatusBadge status={stage.status || 'Active'} />,
  },
];

export function PipelineSettingsPage() {
  const [templates, setTemplates] = useState<PipelineTemplateItem[]>([]);
  const [selected, setSelected] = useState<PipelineTemplateDetail | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [stageForm, setStageForm] = useState<StageForm>(emptyStageForm);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStageItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'template' | 'stage'; id: string } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>([]);

  const loadTemplate = useCallback(async (id: string) => {
    const detail = await getApi<PipelineTemplateDetail>(`/pipeline-templates/${id}`);
    setSelected(detail);
  }, []);

  const loadTemplates = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const nextTemplates = await getApi<PipelineTemplateItem[]>('/pipeline-templates');
      setTemplates(nextTemplates);
      const nextId = preferredId ?? selected?.id ?? nextTemplates[0]?.id;
      if (nextId) {
        await loadTemplate(nextId);
      } else {
        setSelected(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load pipeline templates.');
    } finally {
      setLoading(false);
    }
  }, [loadTemplate, selected?.id]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  // Load email templates for the stage automation dropdown
  useEffect(() => {
    getApi<EmailTemplateItem[]>('/email-templates')
      .then(setEmailTemplates)
      .catch(() => {/* non-blocking */});
  }, []);

  const handleCreateTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!templateForm.name.trim()) return;
    setBusy(true);
    try {
      const created = await postApi<PipelineTemplateItem>('/pipeline-templates', {
        name: templateForm.name.trim(),
        isDefault: templateForm.isDefault,
      });
      setTemplateForm(emptyTemplateForm);
      setIsTemplateModalOpen(false);
      await loadTemplates(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create the template.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !templateForm.name.trim()) return;
    setBusy(true);
    try {
      await patchApi(`/pipeline-templates/${selected.id}`, { name: templateForm.name.trim(), isDefault: templateForm.isDefault });
      setEditingTemplate(false);
      await loadTemplates(selected.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update the template.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !stageForm.name.trim()) return;
    setBusy(true);
    try {
      await postApi(`/pipeline-templates/${selected.id}/stages`, {
        name: stageForm.name.trim(),
        stageType: stageForm.stageType,
        slaDays: stageForm.slaDays ? Number(stageForm.slaDays) : undefined,
        emailTemplateId: stageForm.emailTemplateId || undefined,
        folded: stageForm.folded,
        isHiredStage: stageForm.isHiredStage,
        tooltip: stageForm.tooltip.trim() || undefined,
      });
      setStageForm(emptyStageForm);
      setIsStageModalOpen(false);
      await loadTemplates(selected.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to add the stage.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !editingStage || !stageForm.name.trim()) return;
    setBusy(true);
    try {
      await patchApi(`/pipeline-templates/${selected.id}/stages/${editingStage.id}`, {
        name: stageForm.name.trim(),
        stageType: stageForm.stageType,
        slaDays: stageForm.slaDays ? Number(stageForm.slaDays) : null,
        emailTemplateId: stageForm.emailTemplateId || null,
        folded: stageForm.folded,
        isHiredStage: stageForm.isHiredStage,
        tooltip: stageForm.tooltip.trim() || null,
      });
      setEditingStage(null);
      await loadTemplates(selected.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update the stage.');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const copy = await postApi<PipelineTemplateItem>(`/pipeline-templates/${selected.id}/duplicate`);
      await loadTemplates(copy.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to duplicate the template.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      if (pendingDelete.kind === 'template') {
        await deleteApi(`/pipeline-templates/${pendingDelete.id}`);
        setPendingDelete(null);
        await loadTemplates();
      } else if (selected) {
        await deleteApi(`/pipeline-templates/${selected.id}/stages/${pendingDelete.id}`);
        setPendingDelete(null);
        await loadTemplates(selected.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to archive this workflow item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Administration"
      title="Workflow & Pipeline Settings"
      description="Configure customizable stage funnels, SLA targets, scorecard requirements and transition rules."
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={() => void loadTemplates()}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
            <Icon name="plus" size={14} />
            New template
          </Button>
        </>
      )}
    >
      {error && (
        <Alert
          tone="danger"
          title="Workflow configuration notice"
          action={(
            <Button variant="secondary" size="sm" onClick={() => void loadTemplates()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          )}
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <aside>
          <FormSection
            title="Hiring tracks"
            description="Select a template to configure."
            contentClassName="grid gap-2 p-3"
            actions={<Badge variant="neutral">{templates.length}</Badge>}
          >
            {loading ? (
              <TableSkeleton columns={1} rows={4} />
            ) : templates.length === 0 ? (
              <PageState kind="empty" title="No templates yet" description="Create a pipeline template to start configuring stages." />
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`rf-pipeline-template${selected?.id === template.id ? ' is-active' : ''}`}
                  aria-pressed={selected?.id === template.id}
                  onClick={() => void loadTemplate(template.id)}
                >
                  <span className="min-w-0 truncate">{template.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {template.isDefault && <Badge variant="info">Default</Badge>}
                    <Badge variant="neutral">{template.stageCount}</Badge>
                  </span>
                </button>
              ))
            )}
          </FormSection>
        </aside>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <SectionHeader
              title={`${selected?.name || 'Pipeline stages'} (${selected?.stages?.length || 0})`}
              description="Ordered evaluation gates with SLA targets."
              density="compact"
              className="border-b border-rf-border-subtle p-4 sm:p-5"
              actions={(
                <>
                  <Button variant="ghost" size="sm" disabled={busy || !selected} onClick={() => {
                    if (!selected) return;
                    setTemplateForm({ name: selected.name, isDefault: selected.isDefault });
                    setEditingTemplate(true);
                  }}>
                    <Icon name="edit" size={13} />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy || !selected || selected.isDefault} onClick={() => selected && setPendingDelete({ kind: 'template', id: selected.id })}>
                    <Icon name="trash-2" size={13} />
                    Archive
                  </Button>
                  <Button variant="secondary" size="sm" disabled={busy || !selected} onClick={() => void handleDuplicate()}>
                    <Icon name="copy" size={13} />
                    Duplicate
                  </Button>
                  <Button variant="primary" size="sm" disabled={busy || !selected} onClick={() => setIsStageModalOpen(true)}>
                    <Icon name="plus" size={13} />
                    Add stage
                  </Button>
                </>
              )}
            />

            {loading ? (
              <TableSkeleton columns={5} rows={5} />
            ) : !selected ? (
              <PageState kind="empty" title="No template selected" description="Select or create a template." />
            ) : selected.stages.length === 0 ? (
              <PageState kind="empty" title="No stages configured" description="Add an evaluation stage to this template." />
            ) : (
              <ResponsiveDataView
                rows={selected.stages}
                 columns={stageColumns}
                 rowKey={(stage) => stage.id}
                 label="Pipeline stages"
                 className="px-4 pb-4 sm:px-5 sm:pb-5"
                 renderActions={(stage) => (
                   <>
                     <Button variant="ghost" size="sm" onClick={() => {
                       setEditingStage(stage);
                       setStageForm({
                         name: stage.name,
                         stageType: stage.stageType,
                         slaDays: stage.slaDays ? String(stage.slaDays) : '',
                         emailTemplateId: stage.emailTemplateId ?? '',
                         folded: stage.folded ?? false,
                         isHiredStage: stage.isHiredStage ?? false,
                         tooltip: stage.tooltip ?? '',
                       });
                     }}>
                       <Icon name="edit" size={13} /> Edit
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => setPendingDelete({ kind: 'stage', id: stage.id })}>
                       <Icon name="trash-2" size={13} /> Archive
                     </Button>
                   </>
                 )}
               />
            )}
          </section>
        </div>
      </div>

      <Modal isOpen={isTemplateModalOpen || editingTemplate} onClose={() => { setIsTemplateModalOpen(false); setEditingTemplate(false); }} title={editingTemplate ? 'Edit Pipeline Track Template' : 'Create Pipeline Track Template'}>
        <form onSubmit={(event) => void (editingTemplate ? handleSaveTemplate(event) : handleCreateTemplate(event))}>
          <div className="flex flex-col gap-4">
            <FormField id="t-name" label="Template Name" required>
              <Input
                id="t-name"
                required
                placeholder="e.g. Healthcare Clinical Track"
                value={templateForm.name}
                onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })}
              />
            </FormField>
            <CheckboxField
              checked={templateForm.isDefault}
              label="Set as default template for new openings"
              onChange={(event) => setTemplateForm({ ...templateForm, isDefault: event.target.checked })}
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} loadingLabel={editingTemplate ? 'Saving' : 'Creating'} type="submit">Save template</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isStageModalOpen || Boolean(editingStage)} onClose={() => { setIsStageModalOpen(false); setEditingStage(null); }} title={editingStage ? 'Edit Workflow Stage' : 'Add Workflow Stage'}>
        <form onSubmit={(event) => void (editingStage ? handleSaveStage(event) : handleAddStage(event))}>
          <div className="flex flex-col gap-4">
            <FormField id="s-name" label="Stage Name" required>
              <Input
                id="s-name"
                required
                placeholder="e.g. Technical Assessment"
                value={stageForm.name}
                onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })}
              />
            </FormField>
            <FormField id="s-type" label="Stage Type" required>
              <Select id="s-type" value={stageForm.stageType} onChange={(event) => setStageForm({ ...stageForm, stageType: event.target.value })}>
                <option value="Screening">Screening</option>
                <option value="Interview">Interview</option>
                <option value="Assessment">Assessment</option>
                <option value="Offer">Offer</option>
                <option value="PreHire">PreHire</option>
              </Select>
            </FormField>
            <FormField id="s-sla" label="SLA Target (Days)">
              <Input
                id="s-sla"
                type="number"
                placeholder="e.g. 3"
                value={stageForm.slaDays}
                onChange={(event) => setStageForm({ ...stageForm, slaDays: event.target.value })}
              />
            </FormField>

            {/* Phase C — Stage Automation fields */}
            <FormField id="s-email-template" label="Auto-email on stage entry">
              <Select
                id="s-email-template"
                value={stageForm.emailTemplateId}
                onChange={(event) => setStageForm({ ...stageForm, emailTemplateId: event.target.value })}
              >
                <option value="">— None (no auto-email) —</option>
                {emailTemplates.map((et) => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField id="s-tooltip" label="Tooltip (shown on Kanban column header)">
              <Input
                id="s-tooltip"
                placeholder="e.g. SLA Target: 48h to review new applications"
                value={stageForm.tooltip}
                onChange={(event) => setStageForm({ ...stageForm, tooltip: event.target.value })}
                maxLength={500}
              />
            </FormField>

            <div className="flex flex-col gap-2">
              <CheckboxField
                checked={stageForm.folded}
                label="Fold this column by default in the Kanban view"
                onChange={(event) => setStageForm({ ...stageForm, folded: event.target.checked })}
              />
              <CheckboxField
                checked={stageForm.isHiredStage}
                label="This is the hired / terminal success stage"
                onChange={(event) => setStageForm({ ...stageForm, isHiredStage: event.target.checked })}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsStageModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} loadingLabel={editingStage ? 'Saving' : 'Adding'} type="submit">{editingStage ? 'Save stage' : 'Add stage'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={pendingDelete?.kind === 'template' ? 'Archive this pipeline template?' : 'Archive this pipeline stage?'}
        description="The item will be removed from active configuration while historical records remain preserved."
        confirmLabel="Archive"
        tone="danger"
        isLoading={busy}
      />
    </PageFrame>
  );
}
