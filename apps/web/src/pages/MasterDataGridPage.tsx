import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BulkImportDataset, BulkImportInspectResult, MasterDataCategory } from '@recruitflow/contracts';
import { ApiError, downloadApi, fetchApi, postFormDataApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Input, PageFrame, PageState, Select, Tabs } from '../components/ui';
import { Icon } from '../components/Icon';
import { saveBlob } from '../utils/download';

type CatalogKey = 'branches' | 'job-titles' | MasterDataCategory;
type CatalogRow = {
  id: string;
  organizationId: string;
  category: CatalogKey;
  code: string | null;
  name: string;
  country?: string | null;
  city?: string | null;
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
type GridField = 'code' | 'name' | 'country' | 'city' | 'status' | MetadataField['key'];

const COUNTRY_OPTIONS = [
  { code: 'EGY', label: 'EGY · Egypt' },
  { code: 'UAE', label: 'UAE · United Arab Emirates' },
] as const;
const CITY_OPTIONS = ['Offshore', 'Dubai', 'Ajman', 'Sharjah', 'Clinics'] as const;

function cityOptions(currentCity: string): string[] {
  const options = new Set<string>(CITY_OPTIONS);
  if (currentCity.trim()) options.add(currentCity);
  return Array.from(options);
}

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

const IMPORT_DATASET_BY_CATEGORY: Record<CatalogKey, BulkImportDataset> = {
  branches: 'branches',
  departments: 'departments',
  'job-titles': 'positions',
  skills: 'skills',
  'candidate-sources': 'candidate-sources',
  'interview-types': 'interview-types',
};

const CATEGORY_LABELS: Record<CatalogKey, string> = Object.fromEntries(TABS.map((tab) => [tab.key, tab.label])) as Record<CatalogKey, string>;

function displayValue(row: CatalogRow, field: 'code' | 'name' | 'country' | 'city') {
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
    country: typeof value.country === 'string' ? value.country : 'EGY',
    city: typeof value.city === 'string' ? value.city : null,
    metadata: category === 'job-titles'
      ? { ...metadata, description: value.description ?? metadata.description }
      : metadata,
    status: typeof value.status === 'string' ? value.status : 'Active',
    version: typeof value.version === 'number' ? value.version : 1,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

export function MasterDataGridPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions.includes('MASTER_DATA_MANAGE'));
  const [category, setCategory] = useState<CatalogKey>('branches');
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isInspectingWorkbook, setIsInspectingWorkbook] = useState(false);
  const [isStagingWorkbook, setIsStagingWorkbook] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadInspect, setUploadInspect] = useState<BulkImportInspectResult | null>(null);
  const [uploadSheetName, setUploadSheetName] = useState('');
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'load' | 'save'>('load');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'warning'>('success');
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [activeCell, setActiveCell] = useState<{ row: number; field: GridField } | null>(null);
  const pasteRef = useRef<HTMLTableElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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
      const requests: [Promise<CatalogRow[]>, Promise<Array<{ id: string; name: string; code?: string }> | unknown[]>, Promise<Array<{ id: string; name: string; code?: string }> | unknown[]>] = [
        loadCatalog(selectedCategory),
        selectedCategory === 'departments' ? fetchApi<Array<{ id: string; name: string; code?: string }>>('/branches') : Promise.resolve([]),
        selectedCategory === 'job-titles' ? fetchApi<Array<{ id: string; name: string; code?: string }>>('/master-data/catalog/departments') : Promise.resolve([]),
      ];
      const [catalogResult, branchesResult, departmentsResult] = await Promise.allSettled(requests);
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      const catalog = catalogResult.value;
      setRows(Array.isArray(catalog) ? catalog : []);
      setDirtyIds(new Set());
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

  useEffect(() => {
    setUploadFile(null);
    setUploadInspect(null);
    setUploadSheetName('');
  }, [category]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.code, row.name, row.country, row.city, row.status].some((value) => value?.toLowerCase().includes(term)));
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
    setRows((current) => [...current, {
      id: `new-${Date.now()}-${current.length}`,
      organizationId: user?.organizationId || '',
      category,
      code: null,
      name: '',
      country: category === 'branches' ? 'EGY' : undefined,
      city: category === 'branches' ? '' : undefined,
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

  const downloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    setError('');
    try {
      const dataset = IMPORT_DATASET_BY_CATEGORY[category];
      const workbook = await downloadApi(`/imports/master-data/${dataset}/template`);
      saveBlob(workbook, `recruitflow-${category}-template.xlsx`);
    } catch (err) {
      setErrorKind('load');
      setError(err instanceof Error ? err.message : 'Unable to download the Master Data template.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const inspectWorkbook = async (file: File) => {
    setIsInspectingWorkbook(true);
    setError('');
    setNotice('');
    setUploadFile(file);
    setUploadInspect(null);
    setUploadSheetName('');
    try {
      const body = new FormData();
      body.append('file', file);
      const dataset = IMPORT_DATASET_BY_CATEGORY[category];
      const inspected = await postFormDataApi<BulkImportInspectResult>(`/imports/master-data/${dataset}/inspect`, body);
      setUploadInspect(inspected);
      setUploadSheetName(inspected.sheets[0]?.name ?? '');
      if (inspected.warnings.length > 0) {
        setNoticeKind('warning');
        setNotice(inspected.warnings.join(' '));
      } else {
        setNoticeKind('success');
        setNotice(`${file.name} is ready to stage for review.`);
      }
    } catch (err) {
      setUploadFile(null);
      setErrorKind('save');
      setError(err instanceof Error ? err.message : 'Unable to inspect the selected workbook.');
    } finally {
      setIsInspectingWorkbook(false);
    }
  };

  const stageWorkbook = async () => {
    if (!uploadFile || !uploadInspect) return;
    setIsStagingWorkbook(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', uploadFile);
      const dataset = IMPORT_DATASET_BY_CATEGORY[category];
      const query = uploadSheetName ? `?sheetName=${encodeURIComponent(uploadSheetName)}` : '';
      const result = await postFormDataApi<{ jobId: string }>(`/imports/master-data/${dataset}/upload${query}`, body);
      navigate(`/import/${dataset}/${result.jobId}`);
    } catch (err) {
      setErrorKind('save');
      setError(err instanceof Error ? err.message : 'Unable to stage the workbook for review.');
    } finally {
      setIsStagingWorkbook(false);
    }
  };

  const cancelWorkbook = () => {
    setUploadFile(null);
    setUploadInspect(null);
    setUploadSheetName('');
    setNotice('');
  };

  const save = async () => {
    const pending = rows.filter((row) => row.isNew || dirtyIds.has(row.id));
    const invalid = pending.find((row) => !row.name.trim() || (category === 'branches' && !row.country));
    if (invalid) {
      setErrorKind('save');
      setError(category === 'branches' ? 'Every branch needs a name and country.' : 'Every pending row needs a name.');
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
          ...(category === 'branches' ? { country: row.country?.trim().toUpperCase() || 'EGY', city: row.city?.trim() || null } : {}),
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
      ? ['code', 'name', 'country', 'city', 'status']
      : ['code', 'name', ...METADATA_FIELDS[category].map((field) => field.key as GridField), 'status'];
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
          country: category === 'branches' ? 'EGY' : undefined,
          city: category === 'branches' ? '' : undefined,
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
        if (field === 'code' || field === 'name' || field === 'country' || field === 'city' || field === 'status') {
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
      {notice && <Alert tone={noticeKind} title={noticeKind === 'warning' ? (uploadInspect ? 'Workbook needs attention' : 'Some options are unavailable') : uploadInspect ? 'Workbook ready' : 'Changes staged'}>{notice}</Alert>}
      <Tabs ariaLabel="Master Data categories" activeKey={category} items={TABS} onChange={(key) => setCategory(key as CatalogKey)} />
      <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-rf-border-subtle bg-rf-surface p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-sm font-extrabold text-rf-ink">Excel template · {CATEGORY_LABELS[category]}</h2>
          <p className="mt-1 text-xs font-medium text-rf-ink-muted">Download the controlled columns, fill one record per row, then upload the workbook here. Existing names and codes are flagged before saving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={isDownloadingTemplate} loadingLabel="Downloading" onClick={() => void downloadTemplate()}>
            <Icon name="download" size={14} />Download template
          </Button>
          {canManage && <>
            <input
              ref={uploadInputRef}
              className="sr-only"
              type="file"
              aria-label={`Upload ${CATEGORY_LABELS[category]} workbook`}
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) void inspectWorkbook(file);
              }}
            />
            <Button variant="primary" size="sm" loading={isInspectingWorkbook} loadingLabel="Checking file" onClick={() => uploadInputRef.current?.click()}>
              <Icon name="upload" size={14} />Upload filled template
            </Button>
          </>}
        </div>
      </section>
      {uploadFile && uploadInspect && (
        <section className="mt-3 grid gap-3 rounded-2xl border border-rf-action/25 bg-rf-action-soft/20 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,280px)_auto] sm:items-end">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted">Selected workbook</span>
            <p className="mt-1 truncate text-sm font-bold text-rf-ink">{uploadFile.name}</p>
            <p className="mt-0.5 text-xs text-rf-ink-muted">{uploadInspect.sheets.reduce((total, sheet) => total + sheet.rowCount, 0)} data rows detected</p>
          </div>
          <label className="grid gap-1 text-[11px] font-bold text-rf-ink">
            Worksheet
            <Select value={uploadSheetName} onChange={(event) => setUploadSheetName(event.target.value)}>
              {uploadInspect.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.rowCount} rows</option>)}
            </Select>
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelWorkbook} disabled={isStagingWorkbook}>Cancel</Button>
            <Button variant="primary" size="sm" loading={isStagingWorkbook} loadingLabel="Staging" onClick={() => void stageWorkbook()}>
              <Icon name="check-circle" size={14} />Review import
            </Button>
          </div>
        </section>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input aria-label="Search Master Data" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this category" />
        {canManage && <Button variant="secondary" size="sm" onClick={addRow}><Icon name="plus" size={14} />Add row</Button>}
      </div>
      {isLoading ? <div className="py-12 text-center text-sm text-rf-ink-muted">Loading Master Data…</div> : visibleRows.length === 0 ? <PageState kind="empty" title="No values configured" description="Add a row to start this category." /> : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-rf-border-subtle bg-rf-surface">
          <table ref={pasteRef} onPaste={onPaste} className="min-w-[720px] w-full text-left text-xs">
            <thead className="border-b border-rf-border-subtle bg-rf-surface-subtle text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted"><tr><th className="px-3 py-3">Code</th><th className="px-3 py-3">{category === 'job-titles' ? 'Title' : 'Name'}</th>{category === 'branches' && <><th className="px-3 py-3">Country</th><th className="px-3 py-3">City</th></>}{metadataFields.map((field) => <th key={field.key} className="px-3 py-3">{field.label}</th>)}<th className="px-3 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-rf-border-subtle">
              {visibleRows.map((row) => { const actualIndex = rows.findIndex((item) => item.id === row.id); return <tr key={row.id} className={row.isNew ? 'bg-amber-50/40 dark:bg-amber-950/10' : undefined}>
                {(['code'] as const).map((field) => <td key={field} className="px-3 py-2"><Input aria-label={`${field} for ${row.name || 'new row'}`} value={displayValue(row, field)} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field })} onChange={(event) => updateRow(row.id, { [field]: event.target.value })} placeholder="Auto" /></td>)}
                <td className="px-3 py-2"><Input aria-label={`name for ${row.name || 'new row'}`} value={displayValue(row, 'name')} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field: 'name' })} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder="Required" /></td>
                {category === 'branches' && <td className="px-3 py-2"><Select aria-label={`country for ${row.name || 'new row'}`} value={row.country || 'EGY'} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field: 'country' })} onChange={(event) => updateRow(row.id, { country: event.target.value })}>{COUNTRY_OPTIONS.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}</Select></td>}
                {category === 'branches' && <td className="px-3 py-2"><Select aria-label={`city for ${row.name || 'new row'}`} value={row.city || ''} disabled={!canManage} onFocus={() => setActiveCell({ row: actualIndex, field: 'city' })} onChange={(event) => updateRow(row.id, { city: event.target.value || null })}><option value="">Select city</option>{cityOptions(row.city || '').map((city) => <option key={city} value={city}>{city}</option>)}</Select></td>}
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
