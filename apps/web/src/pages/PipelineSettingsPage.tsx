import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getApi, postApi } from '../api/client';
import { Modal } from '../components/Modal';
import type { PipelineStageItem, PipelineTemplateItem } from '@recruitflow/contracts';

type PipelineTemplateDetail = PipelineTemplateItem & { stages: PipelineStageItem[] };

type TemplateForm = { name: string; isDefault: boolean };
type StageForm = { name: string; stageType: string; slaDays: string };

const emptyTemplateForm: TemplateForm = { name: '', isDefault: false };
const emptyStageForm: StageForm = { name: '', stageType: 'Screening', slaDays: '' };

export function PipelineSettingsPage() {
  const [templates, setTemplates] = useState<PipelineTemplateItem[]>([]);
  const [selected, setSelected] = useState<PipelineTemplateDetail | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [stageForm, setStageForm] = useState(emptyStageForm);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  const handleAddStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !stageForm.name.trim()) return;
    setBusy(true);
    try {
      await postApi(`/pipeline-templates/${selected.id}/stages`, {
        name: stageForm.name.trim(),
        stageType: stageForm.stageType,
        slaDays: stageForm.slaDays ? Number(stageForm.slaDays) : undefined,
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

  if (loading && templates.length === 0) {
    return <div className="empty-state"><strong>Loading pipeline templates…</strong><span>Reading the configured hiring stages.</span></div>;
  }

  return (
    <div className="page-container master-data-page" style={{ display: 'flex', gap: '24px', height: '100%' }}>
      <aside className="sidebar-panel" style={{ width: '250px', borderRight: '1px solid var(--border)', paddingRight: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Templates</h3>
          <button className="button button-sm button-primary" type="button" onClick={() => setIsTemplateModalOpen(true)}>New</button>
        </div>
        {templates.length === 0 ? <div className="empty-state"><span>No pipeline templates configured.</span></div> : (
          <ul className="nav-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => void loadTemplate(template.id)}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: selected?.id === template.id ? 'var(--surface-soft)' : 'transparent', color: 'var(--text)', border: 0, borderRadius: 'var(--radius)', fontWeight: selected?.id === template.id ? 'bold' : 'normal', marginBottom: '4px', cursor: 'pointer' }}
                >
                  {template.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="main-panel" style={{ flex: 1, minWidth: 0 }}>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {!selected ? <>
          <header className="page-header">
            <div><h1 className="page-title">Pipeline Settings</h1><p className="page-subtitle">Create and manage reusable hiring-stage templates.</p></div>
          </header>
          <div className="empty-state"><strong>Select a pipeline template</strong><span>Create or select a template to manage its stages.</span></div>
        </> : (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">{selected.name}</h1>
                <p className="page-subtitle">Live stages from the selected pipeline template.</p>
              </div>
              <div className="page-actions">
                <button className="button button-outline" disabled={busy} type="button" onClick={() => void handleDuplicate()}>Duplicate Template</button>
                <button className="button button-primary" disabled={busy} type="button" onClick={() => setIsStageModalOpen(true)}>Add Stage</button>
              </div>
            </header>

            <div className="callout callout-info" style={{ padding: '16px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', borderRadius: 'var(--radius)', marginBottom: '24px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <strong>Template status:</strong> {selected.status}{selected.isDefault ? ' · Default template' : ''}
            </div>

            {selected.stages.length === 0 ? <div className="empty-state"><strong>No stages configured</strong><span>Add the first stage to this template.</span></div> : (
              <div className="card table-container">
                <table className="request-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th>Order</th><th>Stage Name</th><th>Stage Type</th><th>SLA (Days)</th><th>Default Owner</th><th>Gates</th></tr></thead>
                  <tbody>{selected.stages.map((stage) => (
                    <tr key={stage.id}>
                      <td>{stage.sortOrder + 1}</td>
                      <td><strong>{stage.name}</strong></td>
                      <td><span className="badge badge-neutral">{stage.stageType}</span></td>
                      <td>{stage.slaDays ?? '—'}</td>
                      <td>{stage.defaultOwner || 'Not set'}</td>
                      <td>{stage.entryGate || stage.exitGate || 'Not set'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="Create pipeline template">
        <form className="form-grid" onSubmit={(event) => void handleCreateTemplate(event)}>
          <label className="full-field">Template name<input className="input" required value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} /></label>
          <label className="checkbox-field"><input type="checkbox" checked={templateForm.isDefault} onChange={(event) => setTemplateForm({ ...templateForm, isDefault: event.target.checked })} /> Set as default template</label>
          <div className="form-actions full-field"><button className="quiet-button" type="button" onClick={() => setIsTemplateModalOpen(false)}>Cancel</button><button className="primary-button" disabled={busy} type="submit">Create template</button></div>
        </form>
      </Modal>

      <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title="Add pipeline stage">
        <form className="form-grid" onSubmit={(event) => void handleAddStage(event)}>
          <label>Stage name<input className="input" required value={stageForm.name} onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })} /></label>
          <label>Stage type<input className="input" required value={stageForm.stageType} onChange={(event) => setStageForm({ ...stageForm, stageType: event.target.value })} /></label>
          <label>SLA days<input className="input" min="0" type="number" value={stageForm.slaDays} onChange={(event) => setStageForm({ ...stageForm, slaDays: event.target.value })} /></label>
          <div className="form-actions full-field"><button className="quiet-button" type="button" onClick={() => setIsStageModalOpen(false)}>Cancel</button><button className="primary-button" disabled={busy} type="submit">Add stage</button></div>
        </form>
      </Modal>
    </div>
  );
}
