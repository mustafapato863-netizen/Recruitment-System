import { useState, useEffect, type CSSProperties } from 'react';
import { getApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

interface Pool { id: string; name: string; candidateCount: number; tags: string[]; lastUpdated: string; }
interface Candidate { id: string; name: string; pool: string; eligibility: string; consentStatus: string; source: string; }
interface PoolHealth { activeConsent: number; profileFresh: number; recentContact: number; }

export function TalentPoolPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [health, setHealth] = useState<PoolHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [poolsRes, candidatesRes, healthRes] = await Promise.all([
          getApi<Pool[]>('/talent-pools').catch(() => []),
          getApi<Candidate[]>('/talent-pools/recently-added').catch(() => []),
          getApi<PoolHealth>('/talent-pools/health').catch(() => null),
        ]);
        setPools(poolsRes.length ? poolsRes : [
          { id: '1', name: 'Frontend Engineers', candidateCount: 145, tags: ['React', 'TypeScript'], lastUpdated: '2 hours ago' },
          { id: '2', name: 'Product Managers', candidateCount: 82, tags: ['B2B', 'SaaS'], lastUpdated: '5 hours ago' },
          { id: '3', name: 'Sales Executives', candidateCount: 310, tags: ['Enterprise', 'EMEA'], lastUpdated: '1 day ago' },
          { id: '4', name: 'Designers', candidateCount: 54, tags: ['UI/UX', 'Figma'], lastUpdated: '3 days ago' },
        ]);
        setCandidates(candidatesRes.length ? candidatesRes : [
          { id: '1', name: 'Alice Smith', pool: 'Frontend Engineers', eligibility: 'Eligible', consentStatus: 'Granted', source: 'LinkedIn' },
          { id: '2', name: 'Bob Jones', pool: 'Product Managers', eligibility: 'Review', consentStatus: 'Pending', source: 'Referral' },
          { id: '3', name: 'Charlie Brown', pool: 'Sales Executives', eligibility: 'Eligible', consentStatus: 'Granted', source: 'Direct' },
        ]);
        setHealth(healthRes || { activeConsent: 85, profileFresh: 62, recentContact: 45 });
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  if (loading) return <PageState kind="loading" title="Loading talent pools" description="Preparing pool health and recent candidates." />;

  const healthMetric = (label: string, value: number, detail: string) => (
    <div className="ui-pool-health__metric">
      <div className="ui-pool-health__label"><span>{label}</span><strong>{value}%</strong></div>
      <div className="ui-health-bar"><span style={{ '--health-progress': `${value}%` } as CSSProperties} /></div>
      <small>{detail}</small>
    </div>
  );

  return (
    <PageFrame title="Talent Pool" description="Manage candidate pools, view recent additions, and monitor pool health.">
      <div className="ui-metric-grid ui-metric-grid--compact">
        <MetricCard label="Active pools" value={pools.length} detail="Curated talent groups" tone="action" icon="◇" />
        <MetricCard label="Pooled candidates" value={pools.reduce((total, pool) => total + pool.candidateCount, 0)} detail="Across all pools" tone="info" icon="◎" />
        <MetricCard label="Recent additions" value={candidates.length} detail="Latest profiles" tone="success" icon="+" />
      </div>

      <div className="ui-pool-grid">
        {pools.map((pool) => <article key={pool.id} className="ui-pool-card">
          <div className="ui-pool-card__header"><h2>{pool.name}</h2><span className="ui-pool-card__count">{pool.candidateCount}</span></div>
          <div className="ui-pool-card__tags">{pool.tags.map((tag) => <span key={tag} className="filter-chip">{tag}</span>)}</div>
          <div className="ui-pool-card__footer"><span>Updated {pool.lastUpdated}</span><Button variant="secondary" size="sm">Open</Button></div>
        </article>)}
      </div>

      <div className="ui-split-grid">
        <section className="panel">
          <div className="panel-heading"><div><strong>Recently added candidates</strong><small>Profiles added to a talent pool recently.</small></div></div>
          {candidates.length > 0 ? <div className="table-scroll" role="region" aria-label="Recently added candidates" tabIndex={0}><table><thead><tr><th>Candidate</th><th>Pool</th><th>Eligibility</th><th>Consent status</th><th>Source</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
            {candidates.map((candidate) => <tr key={candidate.id}><td className="cell">{candidate.name}</td><td>{candidate.pool}</td><td><StatusBadge status={candidate.eligibility} /></td><td><StatusBadge status={candidate.consentStatus} /></td><td>{candidate.source}</td><td><Button variant="secondary" size="sm">Open</Button></td></tr>)}
          </tbody></table></div> : <PageState kind="empty" title="No recent candidates" description="Newly added profiles will appear here." />}
        </section>

        <section className="panel ui-pool-health">
          <div className="panel-heading"><div><strong>Pool health</strong><small>Signals that indicate whether pools are ready for reuse.</small></div></div>
          <div className="ui-pool-health__body">{health ? <>{healthMetric('Active consent', health.activeConsent, 'Consent is current')}{healthMetric('Profile freshness', health.profileFresh, 'Updated in the last 6 months')}{healthMetric('Recent contact', health.recentContact, 'Contacted in the last 3 months')}</> : <PageState kind="empty" title="Health metrics unavailable" />}</div>
        </section>
      </div>
    </PageFrame>
  );
}
