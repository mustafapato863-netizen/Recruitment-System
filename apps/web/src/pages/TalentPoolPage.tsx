import { useState, useEffect } from 'react';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';

interface Pool {
  id: string;
  name: string;
  candidateCount: number;
  tags: string[];
  lastUpdated: string;
}

interface Candidate {
  id: string;
  name: string;
  pool: string;
  eligibility: string;
  consentStatus: string;
  source: string;
}

interface PoolHealth {
  activeConsent: number;
  profileFresh: number;
  recentContact: number;
}

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
          getApi<PoolHealth>('/talent-pools/health').catch(() => null)
        ]);

        // Mock data fallback if API fails
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

        setHealth(healthRes || {
          activeConsent: 85,
          profileFresh: 62,
          recentContact: 45
        });
      } catch (error) {
        console.error('Failed to fetch talent pool data', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'eligible':
      case 'granted':
        return 'badge-success';
      case 'review':
      case 'pending':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading talent pools...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Talent Pool</h1>
          <p className="page-subtitle">Manage candidate pools, view recent additions, and monitor pool health.</p>
        </div>
        <div className="page-actions">
          <button className="button button-primary">
            <Icon name="plus" size={16} /> Create Pool
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {pools.map(pool => (
          <div key={pool.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{pool.name}</h3>
              <span className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>{pool.candidateCount}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {pool.tags.map(tag => (
                <span key={tag} className="badge badge-neutral" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Updated {pool.lastUpdated}</span>
              <button className="button button-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>Open</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Recently Added Candidates</h2>
          </div>
          {candidates.length > 0 ? (
            <div className="table-responsive">
              <table className="request-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Pool</th>
                    <th>Eligibility</th>
                    <th>Consent Status</th>
                    <th>Source</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(candidate => (
                    <tr key={candidate.id} className="request-row">
                      <td style={{ fontWeight: 500 }}>{candidate.name}</td>
                      <td>{candidate.pool}</td>
                      <td><span className={`badge ${getBadgeClass(candidate.eligibility)}`}>{candidate.eligibility}</span></td>
                      <td><span className={`badge ${getBadgeClass(candidate.consentStatus)}`}>{candidate.consentStatus}</span></td>
                      <td>{candidate.source}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="button button-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <p>No recently added candidates found.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Pool Health</h2>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {health ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <span>Active Consent</span>
                    <span>{health.activeConsent}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${health.activeConsent}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <span>Profile Fresh ({"<"} 6 months)</span>
                    <span>{health.profileFresh}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${health.profileFresh}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <span>Recent Contact ({"<"} 3 months)</span>
                    <span>{health.recentContact}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${health.recentContact}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Health metrics not available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
