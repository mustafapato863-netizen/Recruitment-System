import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApi, postApi, deleteApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import { DataTable, dataTableClasses } from '../components/ui/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/ToastContext';
import { CandidateCombobox } from '../components/CandidateCombobox';
import { useSetBreadcrumbTitle } from '../context/BreadcrumbContext';
import type { TalentPoolCandidateItem, TalentPoolItem } from '@recruitflow/contracts';

interface PoolDetail {
  pool: TalentPoolItem;
  candidates: TalentPoolCandidateItem[];
  total: number;
}

interface PoolDetailResponse extends PoolDetail {
  page: number;
  pageSize: number;
}

export function TalentPoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [data, setData] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSetBreadcrumbTitle(data?.pool?.name || 'Talent Pool Details');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addCandidateId, setAddCandidateId] = useState('');
  const [addSource, setAddSource] = useState('');
  const [addConsentExpiry, setAddConsentExpiry] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<TalentPoolCandidateItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getApi<PoolDetailResponse>(`/talent-pools/${id}`);
      if (!res.pool) throw new Error('Talent pool data is unavailable.');
      setData({
        pool: res.pool,
        candidates: res.candidates ?? [],
        total: res.total,
      });
      setError(null);
    } catch (err: unknown) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load talent pool details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !addCandidateId.trim()) return;
    try {
      setIsAdding(true);
      await postApi(`/talent-pools/${id}/candidates`, {
        candidateId: addCandidateId.trim(),
        source: addSource.trim() || undefined,
        consentExpiry: addConsentExpiry || undefined,
      });
      show({ title: 'Candidate added to pool', tone: 'success' });
      setIsAddOpen(false);
      setAddCandidateId('');
      setAddSource('');
      setAddConsentExpiry('');
      void loadData();
    } catch {
      show({ title: 'Failed to add candidate', tone: 'error' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCandidate = (candidate: TalentPoolCandidateItem) => {
    setPendingRemoval(candidate);
  };

  const confirmRemoveCandidate = async () => {
    if (!id || !pendingRemoval) return;
    try {
      setIsRemoving(true);
      await deleteApi(`/talent-pools/${id}/candidates/${pendingRemoval.candidateId}`);
      show({ title: 'Candidate removed', tone: 'success' });
      setPendingRemoval(null);
      void loadData();
    } catch {
      show({ title: 'Failed to remove candidate', tone: 'error' });
    } finally {
      setIsRemoving(false);
    }
  };

  if (loading) {
    return <PageState kind="loading" title="Loading Pool Details" />;
  }

  if (error || !data || !data.pool) {
    return (
      <PageFrame eyebrow="Talent & Intake" title="Pool Details" showBack backTo="/talent-pool">
        <PageState 
          kind="error" 
          title="Could not load pool" 
          description={error || 'The requested talent pool could not be found or loaded.'} 
          actionLabel="Retry"
          onAction={() => void loadData()}
        />
      </PageFrame>
    );
  }

  const pool = data.pool;
  const candidates = data.candidates || [];

  return (
    <PageFrame
      eyebrow="Talent Pool"
      title={pool.name}
      description={pool.description || 'Curated group of candidates'}
      showBack
      backTo="/talent-pool"
      actions={
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
            <Icon name="plus" size={14} /> Add Candidate
          </Button>
        </div>
      }
    >
      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs mt-6">
        <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold text-rf-ink m-0">Candidates ({data.total})</h2>
          </div>
        </div>
        {candidates.length > 0 ? (
          <DataTable role="region" aria-label="Candidates in pool" tabIndex={0} className="rounded-none border-0 shadow-none">
            <thead className={dataTableClasses.head}>
              <tr>
                <th className={dataTableClasses.th}>Candidate</th>
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
                  <td className={dataTableClasses.td}><StatusBadge status={candidate.eligibility} /></td>
                  <td className={dataTableClasses.td}><StatusBadge status={candidate.consentStatus} /></td>
                  <td className={dataTableClasses.td}><span className="text-rf-ink-muted font-medium text-xs">{candidate.source || 'N/A'}</span></td>
                  <td className={dataTableClasses.td}>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" asChild><Link to={`/candidates/${candidate.candidateId}`}>Open</Link></Button>
                      <Button variant="danger" size="sm" aria-label={`Remove ${candidate.candidateName} from pool`} onClick={() => handleRemoveCandidate(candidate)}>
                        <Icon name="trash-2" size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <div className="p-8 text-center">
            <PageState kind="empty" title="No candidates in this pool" description="Add candidates to start building this talent pool." />
          </div>
        )}
      </section>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Candidate to Pool">
        <form onSubmit={handleAddCandidate} className="flex flex-col gap-4">
          <FormField id="talent-pool-candidate" label="Search Candidate" required>
            <CandidateCombobox
              id="talent-pool-candidate"
              value={addCandidateId}
              onChange={setAddCandidateId}
            />
          </FormField>
          <FormField id="talent-pool-source" label="Source">
            <Input
              id="talent-pool-source"
              value={addSource}
              onChange={(e) => setAddSource(e.target.value)}
              placeholder="e.g. LinkedIn, Internal, Referral"
            />
          </FormField>
          <FormField id="talent-pool-consent-expiry" label="Consent Expiry (Optional)">
            <Input
              id="talent-pool-consent-expiry"
              type="date"
              value={addConsentExpiry}
              onChange={(e) => setAddConsentExpiry(e.target.value)}
            />
          </FormField>
          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-rf-border-subtle">
            <Button variant="secondary" onClick={() => setIsAddOpen(false)} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={isAdding}>Add Candidate</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(pendingRemoval)} onClose={() => setPendingRemoval(null)} title="Remove candidate from pool">
        <div className="grid gap-4">
          <p className="m-0 text-sm leading-6 text-rf-ink-muted">
            Remove <strong className="text-rf-ink">{pendingRemoval?.candidateName}</strong> from this talent pool? The candidate record and other pool memberships will remain unchanged.
          </p>
          <div className="flex justify-end gap-3 border-t border-rf-border-subtle pt-4">
            <Button variant="secondary" type="button" onClick={() => setPendingRemoval(null)} disabled={isRemoving}>Cancel</Button>
            <Button variant="danger" type="button" onClick={() => void confirmRemoveCandidate()} loading={isRemoving} loadingLabel="Removing">Remove candidate</Button>
          </div>
        </div>
      </Modal>
    </PageFrame>
  );
}
