import { useEffect, useState } from 'react';
import { getApi, postApi } from '../api/client';
import type { IntegrationItem } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadIntegrations = () => {
    setLoading(true);
    setError('');
    getApi<IntegrationItem[]>('/integrations')
      .then((data) => {
        setIntegrations(data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load integrations.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const testIntegration = async (integration: IntegrationItem) => {
    setTestingId(integration.id);
    setTestMessage('');
    setTestError('');
    try {
      const result = await postApi<{ success: boolean; message: string }>(`/integrations/${integration.id}/test`);
      if (!result.success) {
        setTestError(`${integration.name}: ${result.message}`);
      } else {
        setTestMessage(`${integration.name}: ${result.message}`);
      }
    } catch (err: unknown) {
      setTestError(`${integration.name}: ${err instanceof Error ? err.message : 'Connection test failed.'}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <PageFrame
      eyebrow="Administration"
      title="Integrations & API Management"
      description="Connect third-party enterprise providers including HRIS, Single Sign-On, background check providers and licensing registries."
      actions={
        <Button variant="ghost" size="sm" onClick={loadIntegrations}>
          <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Integration error"
          action={
            <Button variant="secondary" size="sm" onClick={loadIntegrations}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {testMessage && (
        <Alert tone="info" title="Connection test result">
          {testMessage}
        </Alert>
      )}

      {testError && (
        <Alert tone="danger" title="Connection test failed">
          {testError}
        </Alert>
      )}

      <section className="rf-panel rounded-2xl border border-rf-border bg-rf-surface p-5 shadow-xs flex flex-col gap-4">
        <div className="pb-3 border-b border-rf-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-rf-ink m-0">Connected Enterprise Ecosystem</h3>
            <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Active connectors, webhooks, and third-party data synchronizers.</p>
          </div>
        </div>

        {loading ? (
          <PageState kind="loading" title="Loading integrations" description="Checking external connectors." />
        ) : integrations.length === 0 ? (
          <PageState kind="empty" title="No integrations configured" description="Add a provider after its connection contract and secret boundary are approved." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((item) => (
              <div
                key={item.id}
                className="rf-elevated-card p-5 rounded-2xl border border-rf-border bg-rf-surface shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rf-action-soft text-rf-action font-bold text-sm flex items-center justify-center border border-rf-action/20">
                    {item.provider.slice(0, 2).toUpperCase()}
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div>
                  <h4 className="text-xs font-bold text-rf-ink m-0 mb-1">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-rf-ink-muted font-medium m-0">{item.category}</p>
                  {item.lastSyncAt && (
                    <small className="text-[10.5px] text-rf-ink-muted font-medium block mt-2">
                      Last sync: {new Date(item.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  )}
                </div>

                <div className="pt-3 border-t border-rf-border-subtle">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    loading={testingId === item.id}
                    loadingLabel="Testing connection"
                    onClick={() => void testIntegration(item)}
                  >
                    <Icon name="refresh-cw" size={13} />
                    Test connection
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageFrame>
  );
}
