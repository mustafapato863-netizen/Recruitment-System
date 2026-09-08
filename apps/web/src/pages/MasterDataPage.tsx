import { useEffect, useState, type FormEvent } from 'react';
import type { LegalEntityRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import {
  Alert,
  Badge,
  Button,
  DataToolbar,
  FormField,
  Input,
  Modal,
  PageFrame,
  PageState,
  ResponsiveDataView,
  SectionHeader,
  Select,
  StatusBadge,
  TableSkeleton,
  Tabs,
  Textarea,
  type ResponsiveDataColumn,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import './PageEnhancementsV2.css';
import { MasterDataGridPage } from './MasterDataGridPage';

type Category = 'legal-entities' | 'branches' | 'positions';
type RecordItem = Record<string, string | null | undefined>;
type FormState = { code: string; name: string; city: string; legalEntityId: string; description: string };
const emptyForm: FormState = { code: '', name: '', city: '', legalEntityId: '', description: '' };

const categoryTitles: Record<Category, string> = {
  'legal-entities': 'Legal Entity',
  'branches': 'Branch',
  'positions': 'Position',
};

async function loadRecords(category: Category): Promise<RecordItem[]> {
  const response = await fetchApi<RecordItem[] | { data?: RecordItem[] }>(`/${category}`);
  return Array.isArray(response) ? response : response.data || [];
}

export function MasterDataPage() {
  return <MasterDataGridPage />;
}

export function LegacyMasterDataPage() {
  const { user } = useAuth();
  const canManage = user?.permissions?.includes('MASTER_DATA_MANAGE');
  const [category, setCategory] = useState<Category>('legal-entities');
  const [data, setData] = useState<RecordItem[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');

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
    let cancelled = false;
    setCatalogError('');
    void loadRecords('legal-entities')
      .then((entities) => {
        if (cancelled) return;
        setLegalEntities(entities as unknown as LegalEntityRecord[]);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCatalogError(err instanceof Error ? err.message : 'Failed to load catalogue summary');
      });
    return () => { cancelled = true; };
  }, []);

  const columns: ResponsiveDataColumn<RecordItem>[] = [
    {
      key: 'code',
      header: 'Code',
      priority: 'secondary',
      render: (item) => <Badge variant="neutral" className="font-mono">{item.code || 'Not reported'}</Badge>,
    },
    {
      key: 'name',
      header: 'Name / title',
      priority: 'primary',
      render: (item) => (
        <div className="grid gap-0.5">
          <span className="font-bold text-rf-ink">{item.name || item.title || 'Not reported'}</span>
          {item.description && <span className="font-medium text-rf-ink-muted">{item.description}</span>}
        </div>
      ),
    },
    ...(category === 'branches' ? [{
      key: 'city',
      header: 'City',
      priority: 'tertiary' as const,
      render: (item: RecordItem) => <span className="font-medium text-rf-ink-muted">{item.city || 'Not reported'}</span>,
    }] : []),
    {
      key: 'status',
      header: 'Status',
      priority: 'secondary',
      render: (item) => <StatusBadge status={item.status || 'Active'} />,
    },
    ...(canManage ? [{
      key: 'actions',
      header: '',
      priority: 'primary' as const,
      render: (item: RecordItem) => (
        <div className="flex justify-end gap-2">
          {item.status !== 'Archived' ? (
            <Button variant="secondary" size="sm" onClick={() => toggleStatus(item, 'archive')} aria-label="Actions">
              Archive
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => toggleStatus(item, 'restore')} aria-label="Actions">
              Restore
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => confirmDelete(item)} aria-label="Delete">
            Delete
          </Button>
        </div>
      )
    }] : [])
  ];

  const toggleStatus = async (item: RecordItem, action: 'archive' | 'restore') => {
    try {
      await fetchApi(`/${category}/${item.id}/${action}`, { method: 'POST' });
      setData(await loadRecords(category));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const confirmDelete = async (item: RecordItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name || item.title || item.code}?`)) return;
    try {
      await fetchApi(`/${category}/${item.id}`, { method: 'DELETE' });
      setData(await loadRecords(category));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete record');
    }
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
    <PageFrame
      eyebrow="Administration"
      title="Master Data & Catalogs"
      description="Govern organizational structure, legal operating entities, branches, and standardized position catalogues."
      actions={
        canManage ? (
          <Button variant="primary" size="sm" onClick={() => { setFormError(''); setIsModalOpen(true); }}>
            <Icon name="plus" size={14} />
            Add {categoryTitles[category]}
          </Button>
        ) : undefined
      }
    >
      {error && (
        <Alert tone="danger" title="Unable to load master data">
          {error}
        </Alert>
      )}
      {catalogError && (
        <Alert
          tone="warning"
          title="Catalogue summary unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {catalogError}
        </Alert>
      )}

      <Tabs
        ariaLabel="Master data catalogues"
        activeKey={category}
        items={[
          { key: 'legal-entities', label: 'Legal Entities' },
          { key: 'branches', label: 'Branches' },
          { key: 'positions', label: 'Positions' },
        ]}
        onChange={(key) => setCategory(key as Category)}
      />

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
        <SectionHeader
          title={`${categoryTitles[category]} catalog (${data.length})`}
          description="Controlled organizational reference records."
          density="compact"
          className="border-b border-rf-border-subtle p-4 sm:p-5"
        />

        {isLoading ? (
          <TableSkeleton columns={category === 'branches' ? 4 : 3} rows={6} />
        ) : data.length === 0 ? (
          <PageState kind="empty" title="No records configured" description="Add an entry to establish master data." />
        ) : (
          <>
            <DataToolbar
              search={
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              }
            />
            <ResponsiveDataView
              rows={data.filter(item => !searchTerm || (item.name || item.title || item.code || "").toLowerCase().includes(searchTerm.toLowerCase()))}
              columns={columns}
              rowKey={(item) => String(item.id || item.code || item.name || item.title || 'master-record')}
              label={`${categoryTitles[category]} catalog`}
              className="px-4 pb-4 sm:px-5 sm:pb-5"
            />
          </>
        )}

      </section>

      {/* Add Record Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Create ${categoryTitles[category]}`}>
        <form onSubmit={(e) => void submit(e)}>
          {formError && (
            <div className="mb-4">
              <Alert tone="danger" title="Error">
                {formError}
              </Alert>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <FormField id="m-code" label="Code" hint="Optional. Leave blank to generate the next organization-safe code automatically.">
              <Input
                id="m-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </FormField>
            <FormField id="m-name" label={category === 'positions' ? 'Position Title' : 'Name'} required>
              <Input
                id="m-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            {category === 'branches' && (
              <>
                <FormField id="m-entity" label="Legal Entity" required>
                  <Select
                    id="m-entity"
                    required
                    value={form.legalEntityId}
                    onChange={(e) => setForm({ ...form, legalEntityId: e.target.value })}
                  >
                    <option value="">Select legal entity...</option>
                    {legalEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name} ({entity.code})
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="m-city" label="City">
                  <Input
                    id="m-city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </FormField>
              </>
            )}

            {category === 'positions' && (
              <FormField id="m-desc" label="Description">
                <Textarea
                  id="m-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>
            )}
          </div>
          <div className="flex gap-2 mt-6 justify-end">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} loadingLabel="Saving" type="submit">
              Save record
            </Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
