import { useEffect, useState } from 'react';
import { getApi, postApi } from '../api/client';
import type { IntegrationItem } from '@recruitflow/contracts';

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    getApi<IntegrationItem[]>('/integrations')
      .then(setIntegrations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load integrations.'))
      .finally(() => setLoading(false));
  }, []);

  const testIntegration = async (integration: IntegrationItem) => {
    setTestingId(integration.id);
    setTestMessage('');
    try {
      const result = await postApi<{ success: boolean; message: string }>(`/integrations/${integration.id}/test`);
      setTestMessage(`${integration.name}: ${result.message}`);
    } catch (err: unknown) {
      setTestMessage(err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Integrations & API</h1>
          <p className="page-subtitle">Review configured providers and their current connection state.</p>
        </div>
        <div className="page-actions">
          <button className="button button-outline" disabled title="API documentation is not published yet" type="button">View API Docs</button>
          <button className="button button-primary" disabled title="Add integration is not configured yet" type="button">Add Integration</button>
        </div>
      </header>

      {error && <div className="alert error-alert" role="alert">{error}</div>}
      {testMessage && <div className="alert loading-alert" role="status">{testMessage}</div>}
      {loading ? <div className="empty-state"><strong>Loading integrations…</strong><span>Reading provider status from the workspace.</span></div> : integrations.length === 0 ? (
        <div className="empty-state"><strong>No integrations configured</strong><span>Providers will appear here after they are enabled for this organization.</span></div>
      ) : (
        <div className="grid c4 integrations-grid">
          {integrations.map((integration) => (
            <div key={integration.id} className="card integration-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px', gap: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div aria-hidden="true" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-soft)', width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {integration.provider.slice(0, 2).toUpperCase()}
                </div>
                <span className={`badge badge-${integration.status === 'Connected' ? 'success' : integration.status === 'Available' ? 'info' : 'neutral'}`}>
                  {integration.status}
                </span>
              </div>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '16px' }}>{integration.name}</h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>{integration.category}</p>
                {integration.lastSyncAt && <small style={{ display: 'block', marginTop: '8px', color: 'var(--muted)' }}>Last sync: {new Date(integration.lastSyncAt).toLocaleString()}</small>}
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <button className="button button-sm button-outline" style={{ width: '100%' }} disabled={testingId === integration.id} type="button" onClick={() => void testIntegration(integration)}>
                  {testingId === integration.id ? 'Testing…' : 'Test connection'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
