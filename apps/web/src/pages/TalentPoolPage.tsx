import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { DataTable, dataTableClasses } from '../components/ui/DataTable';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { useToast } from '../components/ui/ToastContext';
import { Pagination } from '../components/ui/Pagination';
import type { PaginatedResult, TalentPoolCandidateItem, TalentPoolHealthMetrics, TalentPoolItem } from '@recruitflow/contracts';
import './PageEnhancementsV2.css';

export function TalentPoolPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [pools, setPools] = useState<TalentPoolItem[]>([]);
  const [totalPools, setTotalPools] = useState(0);
  const [poolsPage, setPoolsPage] = useState(1);
  const [poolsSearch, setPoolsSearch] = useState('');
  
  const [candidates, setCandidates] = useState<TalentPoolCandidateItem[]>([]);
  const [health, setHealth] = useState<TalentPoolHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ name: '', description: '', tags: '' });
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async (page = poolsPage, search = poolsSearch) => {
    setLoading(true);
    setError(null);
    
    let poolsUrl = `/talent-pools?page=${page}&pageSize=12`;
    if (search.trim()) poolsUrl += `&search=${encodeURIComponent(search.trim())}`;
    
    const [poolsRes, candidatesRes, healthRes] = await Promise.allSettled([
      getApi<PaginatedResult<TalentPoolItem>>(poolsUrl),
      getApi<TalentPoolCandidateItem[]>('/talent-pools/recently-added'),
      getApi<TalentPoolHealthMetrics>('/talent-pools/health'),
    ]);

    const failedResources: string[] = [];
    if (poolsRes.status === 'fulfilled') {
      setPools(poolsRes.value.data);
      setTotalPools(poolsRes.value.total);
    } else {
      setPools([]);
      failedResources.push('pools');
    }
    
    if (candidatesRes.status === 'fulfilled') {
      setCandidates(candidatesRes.value);
    } else {
      setCandidates([]);
      failedResources.push('recent candidates');
    }
    
    if (healthRes.status === 'fulfilled') {
      setHealth(healthRes.value);
    } else {
      setHealth(null);
      failedResources.push('health metrics');
    }
    
    if (failedResources.length > 0 && failedResources.includes('pools')) {
      setError(`Unable to load talent pool data. Retry to connect to the talent pool service.`);
    }
    setLoading(false);
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createData.name.trim()) return;
    try {
      setIsCreating(true);
      const tagsArray = createData.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await postApi('/talent-pools', { name: createData.name, description: createData.description, tags: tagsArray });
      show({ title: 'Talent pool created', tone: 'success' });
      setIsCreateOpen(false);
      setCreateData({ name: '', description: '', tags: '' });
      void loadData(1, poolsSearch);
      setPoolsPage(1);
    } catch {
      show({ title: 'Failed to create talent pool', tone: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => { 
    const timer = setTimeout(() => void loadData(poolsPage, poolsSearch), 300);
    return () => clearTimeout(timer);
  }, [poolsPage, poolsSearch]);

  if (loading && (!pools || pools.length === 0)) {
    return <PageState kind="loading" title="Loading talent pools" description="Preparing pool health and recent candidates." />;
  }

  if (error && (!pools || pools.length === 0) && (!candidates || candidates.length === 0) && !health) {
    return (
      <PageFrame eyebrow="Talent & Intake" title="Talent Pools & Bench" description="Manage candidate pools, view recent additions, and monitor pool health.">
        <PageState kind="error" title="Talent pool data unavailable" description={error} actionLabel="Retry" onAction={() => void loadData(poolsPage, poolsSearch)} />
      </PageFrame>
    );
  }

  const healthMetric = (label: string, value: number | string, detail: string) => (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
      <div className="flex items-center justify-between text-xs font-bold text-rf-ink">
        <span>{label}</span>
        <strong className="text-rf-action font-black">{typeof value === 'number' ? `${value}%` : value}</strong>
      </div>
      <div className="h-2 w-full bg-rf-border-subtle rounded-full overflow-hidden">
        <div className="h-full bg-rf-action rounded-full transition-all duration-300" style={{ width: typeof value === 'number' ? `${value}%` : '0%' }} />
      </div>
      <small className="text-[10.5px] text-rf-ink-muted font-medium">{detail}</small>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(totalPools / 12));

  return (
    <PageFrame
      eyebrow="Talent & Intake"
      title="Talent Pools & Bench"
      description="Manage candidate pools, view recent additions, and monitor pool readiness for future openings."
      actions={
        <div className="flex gap-2 items-center">
          <div className="relative w-64 max-md:hidden">
            <Input 
              type="text" 
              placeholder="Search pools..." 
              value={poolsSearch} 
              onChange={(e) => {
                setPoolsSearch(e.target.value);
                setPoolsPage(1);
              }}
              className="pl-8 h-8 text-xs" 
            />
            <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadData(poolsPage, poolsSearch)}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Icon name="plus" size={13} />
            Create Pool
          </Button>
        </div>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Some talent pool data is unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadData(poolsPage, poolsSearch)}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <MetricCard label="Active pools" value={totalPools} detail="Curated talent groups" tone="action" icon={<Icon name="briefcase" size={14} />} />
        <MetricCard label="Pooled candidates" value={(pools || []).reduce((total, pool) => total + (pool.candidateCount || 0), 0)} detail="Across current page" tone="info" icon={<Icon name="users" size={14} />} />
        <MetricCard label="Recent additions" value={(candidates || []).length} detail="Profiles ready for matching" tone="success" icon={<Icon name="check-circle" size={14} />} />
      </div>
      
      {/* Mobile search bar */}
      <div className="md:hidden relative w-full mb-2">
        <Input 
          type="text" 
          placeholder="Search pools..." 
          value={poolsSearch} 
          onChange={(e) => {
            setPoolsSearch(e.target.value);
            setPoolsPage(1);
          }}
          className="pl-8 h-9 text-sm" 
        />
        <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" />
      </div>

      {pools && pools.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <article 
                key={pool.id} 
                onClick={() => navigate(`/talent-pool/${pool.id}`)}
                className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs hover:shadow-md hover:border-rf-action/40 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-rf-border-subtle mb-3">
                    <h2 className="text-xs font-bold text-rf-ink group-hover:text-rf-action transition-colors m-0">{pool.name}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-rf-action-soft text-rf-action text-[11px] font-black border border-rf-action/15">
                      {pool.candidateCount || 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(pool.tags || []).map((tag) => (
                      <span key={tag} className="font-mono text-[10.5px] font-semibold text-rf-ink-muted bg-rf-surface-subtle px-2 py-0.5 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-rf-border-subtle text-xs">
                  <span className="text-[11px] text-rf-ink-muted font-medium">Updated {pool.updatedAt ? new Date(pool.updatedAt).toLocaleDateString() : 'N/A'}</span>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/talent-pool/${pool.id}`);
                    }}
                  >
                    Open Pool
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={poolsPage}
                totalPages={totalPages}
                onPageChange={setPoolsPage}
                disabled={loading}
              />
            </div>
          )}
        </div>
      ) : (
        <PageState
          kind="empty"
          title={poolsSearch ? "No talent pools match your search" : "No talent pools found"}
          description={poolsSearch ? "Try adjusting your search terms." : "Create your first curated talent pool to segment candidates for fast-track requisition matching."}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
          <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle">
            <h2 className="text-xs font-bold text-rf-ink m-0">Recently Added Candidates</h2>
            <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Profiles linked to a pool for fast-track matching.</p>
          </div>
          {candidates.length > 0 ? (
            <DataTable role="region" aria-label="Recently added candidates" tabIndex={0} className="rounded-none border-0 shadow-none">
              <thead className={dataTableClasses.head}>
                <tr>
                  <th className={dataTableClasses.th}>Candidate</th>
                  <th className={dataTableClasses.th}>Pool</th>
                  <th className={dataTableClasses.th}>Eligibility</th>
                  <th className={dataTableClasses.th}>Consent</th>
                  <th className={dataTableClasses.th}>Source</th>
                  <th className={dataTableClasses.th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr className={dataTableClasses.row} key={candidate.id}>
                    <td className={dataTableClasses.td}>
                      <span className={dataTableClasses.primary}>{candidate.candidateName}</span>
                    </td>
                    <td className={dataTableClasses.td}>
                      <span className="text-rf-ink-muted font-medium text-xs">{candidate.poolName}</span>
                    </td>
                    <td className={dataTableClasses.td}><StatusBadge status={candidate.eligibility} /></td>
                    <td className={dataTableClasses.td}><StatusBadge status={candidate.consentStatus} /></td>
                    <td className={dataTableClasses.td}><span className="text-rf-ink-muted font-medium text-xs">{candidate.source || 'N/A'}</span></td>
                    <td className={dataTableClasses.td}>
                      <Button variant="secondary" size="sm" asChild><Link to={`/candidates/${candidate.candidateId}`}>Open</Link></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <div className="p-8 text-center">
              <PageState kind="empty" title="No recent candidates" description="Newly added profiles will appear here." />
            </div>
          )}
        </section>

        <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h2 className="text-xs font-bold text-rf-ink m-0">Pool Health & Freshness</h2>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Readiness and compliance signals.</p>
            </div>
            <div className="flex flex-col gap-3">
              {healthMetric('Active consent', health?.activeConsentPercent ?? '—', 'Consent is current')}
              {healthMetric('Profile freshness', health?.profileFreshPercent ?? '—', 'Updated in last 6 months')}
              {healthMetric('Recent contact', health?.recentContactPercent ?? '—', 'Contacted in last 3 months')}
            </div>
          </div>
        </section>
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Talent Pool">
        <form onSubmit={handleCreatePool} className="flex flex-col gap-4">
          <FormField id="talent-pool-name" label="Pool Name" required>
            <Input
              id="talent-pool-name"
              value={createData.name}
              onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
              placeholder="e.g. Senior Frontend Engineers"
              autoFocus
            />
          </FormField>
          <FormField id="talent-pool-description" label="Description">
            <Textarea
              id="talent-pool-description"
              value={createData.description}
              onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
              placeholder="Describe the purpose of this talent pool..."
              rows={3}
            />
          </FormField>
          <FormField id="talent-pool-tags" label="Tags (comma separated)">
            <Input
              id="talent-pool-tags"
              value={createData.tags}
              onChange={(e) => setCreateData({ ...createData, tags: e.target.value })}
              placeholder="e.g. React, Remote, Urgent"
            />
          </FormField>
          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-rf-border-subtle">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={isCreating}>Create Pool</Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
