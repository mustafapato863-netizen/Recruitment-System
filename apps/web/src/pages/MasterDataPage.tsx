import { useEffect, useState, type FormEvent } from 'react';
import type { LegalEntityRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import '../styles/admin.css';

type Category = 'legal-entities' | 'branches' | 'positions';
type RecordItem = Record<string, string | null | undefined>;
type FormState = { code: string; name: string; city: string; legalEntityId: string; description: string };
const emptyForm: FormState = { code: '', name: '', city: '', legalEntityId: '', description: '' };

async function loadRecords(category: Category): Promise<RecordItem[]> {
  const response = await fetchApi<RecordItem[] | { data?: RecordItem[] }>(`/${category}`);
  return Array.isArray(response) ? response : response.data || [];
}

export function MasterDataPage() {
  const [category, setCategory] = useState<Category>('legal-entities');
  const [data, setData] = useState<RecordItem[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    void loadRecords(category)
      .then((records) => { if (!cancelled) setData(records); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load master data'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [category]);

  useEffect(() => {
    void fetchApi<LegalEntityRecord[] | { data?: LegalEntityRecord[] }>('/legal-entities')
      .then((response) => setLegalEntities(Array.isArray(response) ? response : response.data || []))
      .catch(() => setLegalEntities([]));
  }, []);

  const categoryTitles: Record<Category, string> = {
    'legal-entities': 'Legal Entity',
    branches: 'Branch',
    positions: 'Position',
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (category === 'branches' && !form.legalEntityId) {
      setFormError('Select a legal entity before creating a branch.');
      return;
    }
    setIsSubmitting(true);
    const payload = category === 'branches'
      ? { code: form.code, name: form.name, legalEntityId: form.legalEntityId, city: form.city || undefined }
      : category === 'positions'
        ? { code: form.code, title: form.name, description: form.description || undefined }
        : { code: form.code, name: form.name };
    try {
      await fetchApi(`/${category}`, { method: 'POST', body: JSON.stringify(payload) });
      setForm(emptyForm);
      setIsModalOpen(false);
      setData(await loadRecords(category));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div><span className="eyebrow">Administration</span><h1>Master Data</h1><p>Govern organization structure, positions, and reusable controlled values.</p></div>
        <button className="primary-button" type="button" onClick={() => { setFormError(''); setIsModalOpen(true); }}>Add Record</button>
      </div>

      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => { setIsLoading(true); setError(''); void loadRecords(category).then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load master data')).finally(() => setIsLoading(false)); }}>Retry</button></div>}

      <div className="master-grid">
        <aside className="master-sidebar" aria-label="Master data categories">
          <div className="sidebar-group">ORGANIZATION</div>
          {(['legal-entities', 'branches', 'positions'] as Category[]).map((item) => (
            <button className={category === item ? 'sidebar-item active' : 'sidebar-item'} key={item} type="button" aria-current={category === item ? 'page' : undefined} onClick={() => setCategory(item)}>
              {item === 'legal-entities' ? 'Legal Entities' : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </aside>

        <div className="master-content">
          {isLoading ? <div className="alert loading-alert" role="status">Loading master data...</div> : (
            <div className="table-scroll" role="region" aria-label={`${categoryTitles[category]} table`} tabIndex={0}>
              <table className="admin-table">
                <thead><tr><th>Code</th><th>Name / Title</th>{category === 'branches' && <th>City</th>}<th>Status</th></tr></thead>
                <tbody>
                  {data.map((item) => <tr key={item.id || item.code}><td>{item.code}</td><td><strong>{item.name || item.title}</strong></td>{category === 'branches' && <td>{item.city || '—'}</td>}<td><StatusBadge status={item.status || 'Active'} /></td></tr>)}
                  {data.length === 0 && <tr><td className="table-empty" colSpan={category === 'branches' ? 4 : 3}>No records found. Add the first record to this category.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Create ${categoryTitles[category]}`}>
        <form onSubmit={submit}>
          {formError && <div className="alert error-alert" role="alert">{formError}</div>}
          <div className="form-grid">
            <label className="full-field">Code <input required type="text" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
            <label className="full-field">{category === 'positions' ? 'Title' : 'Name'} <input required type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            {category === 'branches' && <>
              <label className="full-field">Legal entity <select required value={form.legalEntityId} onChange={(event) => setForm({ ...form, legalEntityId: event.target.value })}><option value="">Select legal entity</option>{legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
              <label className="full-field">City <input type="text" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            </>}
            {category === 'positions' && <label className="full-field">Description <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>}
          </div>
          <div className="form-actions"><button className="quiet-button" type="button" onClick={() => setIsModalOpen(false)}>Cancel</button><button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'Creating...' : 'Create Record'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
