import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import type { MasterDataCategory, LegalEntityRecord } from '@recruitflow/contracts';
import { ApiError, fetchApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Input, PageFrame, PageState, Select, Tabs } from '../components/ui';
import { Icon } from '../components/Icon';

type CatalogKey = 'branches' | 'job-titles' | MasterDataCategory;
type CatalogRow = {
  id: string;
  organizationId: string;
  category: CatalogKey;
  code: string | null;
  name: string;
  city?: string | null;
  legalEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  status: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  isNew?: boolean;
};

type MetadataField = {
  key: string;
  label: string;
  type?: 'text' | 'select';
};
type GridField = 'code' | 'name' | 'city' | 'legalEntityId' | 'status' | MetadataField['key'];

const METADATA_FIELDS: Record<CatalogKey, MetadataField[]> = {
  branches: [],
  departments: [{ key: 'branchId', label: 'Applicable branch', type: 'select' }],
  'job-titles': [
    { key: 'departmentId', label: 'Department', type: 'select' },
    { key: 'level', label: 'Level' },
    { key: 'suggestedSkills', label: 'Suggested skills' },
    { key: 'description', label: 'Description' },
  ],
  skills: [
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
  ],
  'candidate-sources': [{ key: 'type', label: 'Source type' }],
  'interview-types': [{ key: 'defaultDuration', label: 'Default duration (min)' }],
};

const TABS: Array<{ key: CatalogKey; label: string }> = [
  { key: 'branches', label: 'Branches' },
  { key: 'departments', label: 'Departments' },
  { key: 'job-titles', label: 'Job Titles' },
  { key: 'skills', label: 'Skills' },
  { key: 'candidate-sources', label: 'Candidate Sources' },
  { key: 'interview-types', label: 'Interview Types' },
];

function displayValue(row: CatalogRow, field: 'code' | 'name' | 'city') {
  return field === 'city' ? row.city || '' : row[field] || '';
}

function metadataValue(row: CatalogRow, key: string): string {
  const value = row.metadata?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function normalizeLegacyCatalogRow(category: CatalogKey, value: Record<string, unknown>): CatalogRow {
  const metadata = value.metadata && typeof value.metadata === 'object'
    ? value.metadata as Record<string, unknown>
    : {};
  const title = typeof value.title === 'string' ? value.title : undefined;
  return {
    id: String(value.id ?? ''),
    organizationId: String(value.organizationId ?? ''),
    category,
    code: typeof value.code === 'string' ? value.code : null,
    name: typeof value.name === 'string' ? value.name : title ?? '',
    city: typeof value.city === 'string' ? value.city : null,
    legalEntityId: typeof value.legalEntityId === 'string' ? value.legalEntityId : null,
    metadata: category === 'job-titles'
      ? { ...metadata, legalEntityId: value.legalEntityId ?? metadata.legalEntityId, description: value.description ?? metadata.description }
      : metadata,
    status: typeof value.status === 'string' ? value.status : 'Active',
    version: typeof value.version === 'number' ? value.version : 1,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

export function MasterDataGridPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions.includes('MASTER_DATA_MANAGE'));
  const [category, setCategory] = useState<CatalogKey>('branches');
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntityRecord[]>([]);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'load' | 'save'>('load');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'warning'>('success');
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [activeCell, setActiveCell] = useState<{ row: number; field: GridField } | null>(null);
  const pasteRef = useRef<HTMLTableElement>(null);

  const loadCatalog = useCallback(async (selectedCategory: CatalogKey): Promise<CatalogRow[]> => {
    try {
      return await fetchApi<CatalogRow[]>(`/master-data/catalog/${selectedCategory}`);
    } catch (err) {
      // Older local API processes may still be serving the legacy entity routes. Keep
      // the read path useful while the API is restarted; writes still use the
      // versioned catalog endpoint so they cannot silently lose fields.
      if (!(err instanceof ApiError) || err.statusCode !== 404 || !['branches', 'job-titles'].includes(selectedCategory)) {
        throw err;
      }
      const legacyPath = selectedCategory === 'branches' ? '/branches' : '/positions';
      const legacy = await fetchApi<Array<Record<string, unknown>>>(legacyPath);
      return legacy.map((value) => normalizeLegacyCatalogRow(selectedCategory, value));
    }
  }, []);

  const load = useCallback(async (selectedCategory: CatalogKey = category) => {
    setIsLoading(true);
    setError('');
    setErrorKind('load');
    setNotice('');
    setNoticeKind('success');
    try {
      const requests: [Promise<CatalogRow[]>, Promise<LegalEntityRecord[] | unknown[]>, Promise<Array<{ id: string; name: string; code?: string }> | unknown[]>, Promise<Array<{ id: string; name: string; code?: string }> | unknown[]>] = [
        loadCatalog(selectedCategory),
        selectedCategory === 'branches' || selectedCategory === 'job-titles' ? fetchApi<LegalEntityRecord[]>('/legal-entities') : Promise.resolve([]),
        selectedCategory === 'departments' ? fetchApi<Array<{ id: string; name: string; code?: string }>>('/branches') : Promise.resolve([]),
        selectedCategory === 'job-titles' ? fetchApi<Array<{ id: string; name: string; code?: string }>>('/master-data/catalog/departments') : Promise.resolve([]),
      ];
      const [catalogResult, entitiesResult, branchesResult, departmentsResult] = await Promise.allSettled(requests);
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      const catalog = catalogResult.value;
      setRows(Array.isArray(catalog) ? catalog : []);
      setDirtyIds(new Set());
      if (selectedCategory === 'branches' || selectedCategory === 'job-titles') {
        if (entitiesResult.status === 'fulfilled' && Array.isArray(entitiesResult.value)) setLegalEntities(entitiesResult.value as LegalEntityRecord[]);
        else { setNoticeKind('warning'); setNotice('Reference options could not be loaded. Retry before adding a linked record.'); }
      }
      if (selectedCategory === 'departments') {
        if (branchesResult.status === 'fulfilled' && Array.isArray(branchesResult.value)) setBranchOptions(branchesResult.value as Array<{ id: string; name: string; code?: string }>);
        else { setNoticeKind('warning'); setNotice('Branch options could not be loaded. Retry before adding a linked record.'); }
      }
      if (selectedCategory === 'job-titles') {
        if (departmentsResult.status === 'fulfilled' && Array.isArray(departmentsResult.value)) setDepartmentOptions(departmentsResult.value as Array<{ id: string; name: string; code?: string }>);
        else { setNoticeKind('warning'); setNotice('Department options could not be loaded. Retry before adding a linked record.'); }
      }
    } catch (err) {
      setErrorKind('load');
      setError(err instanceof Error ? err.message : 'Unable to load Master Data.');
    } finally {
      setIsLoading(false);
    }
  }, [category, loadCatalog]);

  useEffect(() => { void load(category); }, [category, load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.code, row.name, row.city, row.status].some((value) => value?.toLowerCase().includes(term)));
  }, [rows, search]);
  const pendingRows = rows.filter((row) => row.isNew || dirtyIds.has(row.id));

  const updateRow = (id: string, patch: Partial<CatalogRow>) => {
    setNotice('');
    setDirtyIds((current) => new Set(current).add(id));
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const updateMetadata = (id: string, key: string, value: string) => {
    setNotice('');
    setDirtyIds((current) => new Set(current).add(id));
    setRows((current) => current.map((row) => row.id === id
      ? { ...row, metadata: { ...(row.metadata ?? {}), [key]: value } }
      : row));
  };

  const addRow = () => {
    if (rows.filter((row) => row.isNew).length >= 250) {
      setErrorKind('save');
      setError('A maximum of 250 pending rows can be saved at once.');
      return;
    }
    const entity = legalEntities.find((item) => item.status === 'Active');
    setRows((current) => [...current, {
      id: `new-${Date.now()}-${current.length}`,
      organizationId: user?.organizationId || '',
      category,
      code: null,
      name: '',
      city: category === 'branches' ? '' : undefined,
      legalEntityId: category === 'branches' ? entity?.id || null : null,
      metadata: null,
      status: 'Active',
      version: 1,
      isNew: true,
    }]);
  };

  const discard = () => {
    void load(category).then(() => {
      setNoticeKind('success');
      setNotice('Unsaved edits discarded.');
    });
  };

  const save = async () => {
    const pending = rows.filter((row) => row.isNew || dirtyIds.has(row.id));
    const invalid = pending.find((row) => !row.name.trim() || (category === 'branches' && !row.legalEntityId));
    if (invalid) {
      setErrorKind('save');
      setError(category === 'branches' ? 'Every branch needs a name and legal entity.' : 'Every pending row needs a name.');
      return;
    }
    setIsSaving(true);
    setErrorKind('save');
    setError('');
    try {
      await fetchApi(`/master-data/catalog/${category}/batch`, {
        method: 'POST',
        body: JSON.stringify({ rows: pending.map((row) => ({
          ...(row.isNew ? {} : { id: row.id, expectedVersion: row.version }),
          code: row.code?.trim() || null,
          name: row.name.trim(),
          ...(category === 'branches' ? { city: row.city?.trim() || null, legalEntityId: row.legalEntityId } : {}),
          ...(category === 'job-titles' ? { legalEntityId: row.legalEntityId || null } : {}),
          ...(row.metadata ? { metadata: row.metadata } : {}),
          status: row.status,
        })) }),
      });
      await load(category);
      setNotice(`${pending.length} row${pending.length === 1 ? '' : 's'} saved.`);
    } catch (err) {
      setErrorKind('save');
      setError(err instanceof Error ? err.message : 'Unable to save Master Data. Your edits are still here.');
    } finally {
      setIsSaving(false);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTableElement>) => {
    if (!canManage || !activeCell) return;
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    const values = text.split(/\r?\n/).filter((line) => line.length > 0).map((line) => line.split('\t'));
    const fields: GridField[] = category === 'branches'
      ? ['code', 'name', 'legalEntityId', 'city', 'status']
      : ['code', 'name', ...(category === 'job-titles' ? ['legalEntityId' as const] : []), ...METADATA_FIELDS[category].map((field) => field.key as GridField), 'status'];
    const changedIds = new Set<string>();
    const next = [...rows];
    let stagedCount = 0;
    values.forEach((cells, rowOffset) => {
      const targetIndex = activeCell.row + rowOffset;
      if (targetIndex > next.length || rowOffset >= 250) return;
      if (!next[targetIndex]) {
        next.push({
          id: `new-${Date.now()}-${next.length}`,
          organizationId: user?.organizationId || '',
          category,
          code: null,
          name: '',
          city: category === 'branches' ? '' : undefined,
          legalEntityId: category === 'branches' || category === 'job-titles' ? legalEntities.find((item) => item.status === 'Active')?.id || null : null,
          metadata: null,
          status: 'Active',
          version: 1,
          isNew: true,
        });
      }
      changedIds.add(next[targetIndex].id);
      stagedCount += 1;
      cells.forEach((value, colOffset) => {
        const field = fields[fields.indexOf(activeCell.field) + colOffset];
        if (!field) return;
        if (field === 'code' || field === 'name' || field === 'city' || field === 'legalEntityId' || field === 'status') {
          next[targetIndex] = { ...next[targetIndex], [field]: value.trim() };
        } else {
          next[targetIndex] = {
            ...next[targetIndex],
            metadata: { ...(next[targetIndex].metadata ?? {}), [field]: value.trim() },
          };
        }
      });
    });
    setRows(next);
    setDirtyIds((current) => new Set([...current, ...changedIds]));
    setNoticeKind('success');
    setNotice(`${stagedCount} pasted row${stagedCount === 1 ? '' : 's'} staged. Review validation before saving.`);
  };

  const metadataFields = METADATA_FIELDS[category];

  return (
    <PageFrame
      eyebrow="Administration"
      title="Master Data"
      description="Edit controlled recruiting values in a focused grid. Paste rows from Excel, validate them here, then save one bounded batch."
      actions={canManage ? <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={discard} disabled={isSaving}>Discard</Button><Button variant="primary" size="sm" onClick={() => void save()} loading={isSaving} disabled={pendingRows.length === 0}>Save Changes</Button></div> : undefined}
    >
      {error && <Alert tone="danger" title={errorKind === 'load' ? 'Unable to load Master Data' : 'Master Data could not be saved'}>{error}</Alert>}
      {notice && <Alert tone={noticeKind} title={noticeKind === 'warning' ? 'Some options are unavailable' : 'Changes staged'}>{notice}</Alert>}
      <Tabs ariaLabel="Master Data categories" activeKey={category} items={TABS} onChange={(key) => setCategory(key as CatalogKey)} />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input aria-label="Search Master Data" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this category" />
        {canManage && <Button variant="secondary" size="sm" onClick={addRow}><Icon name="plus" size={14} />Add row</Button>}
      </div>
      {isLoading ? <div className="py-12 text-center text-sm text-rf-ink-muted">Loading Master Data…</div> : visibleRows.length === 0 ? <PageState kind="empty" title="No values configured" description="Add a row to start this category." /> : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-rf-border-subtle bg-rf-surface">
          <table ref={pasteRef} onPaste={onPaste} className="min-w-[720px] w-full text-left text-xs">
            <thead className="border-b border-rf-border-subtle bg-rf-surface-subtle text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted"><tr><th className="px-3 py-3">Code</th><th className="px-3 py-3">{category === 'job-titles' ? 'Title' : 'Name'}</th>{(category === 'branches' || category === 'job-titles') && <th className="px-3 py-3">Legal Entity</th>}{category === 'branches' && <th className="px-3 py-3">City</th>}{metadataFields.map((field) => <th key={field.key} className="px-3 py-3">{field.label}</th>)}<th className="px-3 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-rf-border-subtle">
              {visibleRows.map((row) => { const actualIndex = rows.findIndex((item) => item.id === row.id); return <tr key={row.id} className={row.isNew ? 'bg-amber-50/40 dark:bg-amber-950/10' : undefined}>
                {(['code', 'name'] as const).map((field) => <td key={field} className="px-3 py-2"><Input aria-label={`${field} for ${row.name || 'new row'}`} value={displayValue(row, field)} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field })} onChange={(event) => updateRow(row.id, { [field]: event.target.value })} placeholder={field === 'code' ? 'Auto' : 'Required'} /></td>)}
                {(category === 'branches' || category === 'job-titles') && <td className="px-3 py-2"><Select aria-label={`legal entity for ${row.name || 'new row'}`} value={row.legalEntityId || ''} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field: 'legalEntityId' })} onChange={(event) => updateRow(row.id, { legalEntityId: event.target.value || null })}><option value="">{category === 'branches' ? 'Select legal entity' : 'Any legal entity'}</option>{legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} ({entity.code})</option>)}</Select></td>}
                {category === 'branches' && <td className="px-3 py-2"><Input aria-label={`city for ${row.name || 'new row'}`} value={displayValue(row, 'city')} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field: 'city' })} onChange={(event) => updateRow(row.id, { city: event.target.value })} /></td>}
                {metadataFields.map((field) => <td key={field.key} className="px-3 py-2">{field.type === 'select' && field.key === 'branchId' ? <Select aria-label={`${field.label} for ${row.name || 'new row'}`} value={metadataValue(row, field.key)} disabled={!canManage} onChange={(event) => updateMetadata(row.id, field.key, event.target.value)}><option value="">Any branch</option>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? ` (${branch.code})` : ''}</option>)}</Select> : field.type === 'select' && field.key === 'departmentId' ? <Select aria-label={`${field.label} for ${row.name || 'new row'}`} value={metadataValue(row, field.key)} disabled={!canManage} onChange={(event) => updateMetadata(row.id, field.key, event.target.value)}><option value="">Any department</option>{departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}{department.code ? ` (${department.code})` : ''}</option>)}</Select> : <Input aria-label={`${field.label} for ${row.name || 'new row'}`} value={metadataValue(row, field.key)} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field: field.key })} onChange={(event) => updateMetadata(row.id, field.key, event.target.value)} placeholder={field.key === 'defaultDuration' ? 'Minutes' : ''} />}</td>)}
                <td className="px-3 py-2"><Select aria-label={`status for ${row.name || 'new row'}`} value={row.status} disabled={!canManage} onChange={(event) => updateRow(row.id, { status: event.target.value })}><option>Active</option><option>Inactive</option><option>Archived</option></Select></td>
              </tr>; })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-rf-ink-muted">Changes remain unsaved until Save Changes. Paste is limited to the visible columns and saves up to 250 rows per transaction. Inactive values stay available on historical records.</p>
    </PageFrame>
  );
}

export default MasterDataGridPage;
