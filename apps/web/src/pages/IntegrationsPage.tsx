import { useEffect, useState, useMemo } from 'react';
import { getApi, postApi, patchApi } from '../api/client';
import type { IntegrationItem } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Config modal state
  const [configuringItem, setConfiguringItem] = useState<IntegrationItem | null>(null);
  const [calendarId, setCalendarId] = useState('primary');
  const [syncMode, setSyncMode] = useState('push');
  const [autoGenerateMeeting, setAutoGenerateMeeting] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

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

  const categories = useMemo(() => {
    const cats = new Set<string>();
    integrations.forEach((i) => {
      if (i.category) cats.add(i.category);
    });
    return ['ALL', ...Array.from(cats).sort()];
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    if (selectedCategory === 'ALL') return integrations;
    return integrations.filter((i) => i.category === selectedCategory);
  }, [integrations, selectedCategory]);

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
        loadIntegrations();
      }
    } catch (err: unknown) {
      setTestError(`${integration.name}: ${err instanceof Error ? err.message : 'Connection test failed.'}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringItem) return;

    setIsSavingConfig(true);
    try {
      await patchApi(`/integrations/${configuringItem.id}`, {
        status: 'Connected',
        configJson: {
          calendarId,
          syncMode,
          autoGenerateMeeting,
        },
      });
      setTestMessage(`${configuringItem.name} synchronization configuration saved and connected.`);
      setConfiguringItem(null);
      loadIntegrations();
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Administration"
      title="Integrations & API Management"
      description="Connect third-party enterprise providers including HRIS, Single Sign-On, Google/Outlook Calendar, and background check providers."
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
        <Alert tone="info" title="Connection status">
          {testMessage}
        </Alert>
      )}

      {testError && (
        <Alert tone="danger" title="Connection error">
          {testError}
        </Alert>
      )}

      <section className="rf-panel rounded-2xl border border-rf-border bg-rf-surface p-5 shadow-xs flex flex-col gap-4">
        <div className="pb-3 border-b border-rf-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-rf-ink m-0">Connected Enterprise Ecosystem</h3>
            <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">
              Active connectors, calendar synchronizers, and third-party webhooks.
            </p>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Providers' : cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <PageState kind="loading" title="Loading integrations" description="Checking external connectors." />
        ) : filteredIntegrations.length === 0 ? (
          <PageState kind="empty" title="No integrations configured" description="Add a provider after its connection contract and secret boundary are approved." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.map((item) => (
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
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                    {item.category}
                  </span>
                  {item.lastSyncAt && (
                    <small className="text-[10.5px] text-rf-ink-muted font-medium block mt-2">
                      Last sync: {new Date(item.lastSyncAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </small>
                  )}
                </div>

                <div className="pt-3 border-t border-rf-border-subtle flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    loading={testingId === item.id}
                    loadingLabel="Testing"
                    onClick={() => void testIntegration(item)}
                  >
                    <Icon name="refresh-cw" size={12} />
                    Test Connection
                  </Button>

                  {item.category === 'Calendar & Scheduling' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfiguringItem(item)}
                      title="Configure Sync Settings"
                    >
                      <Icon name="settings" size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Calendar Sync Config Modal */}
      {configuringItem && (
        <Modal
          isOpen={Boolean(configuringItem)}
          onClose={() => setConfiguringItem(null)}
          title={`Configure ${configuringItem.name} Synchronization`}
          maxWidthClass="max-w-md"
        >
          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl text-blue-900 dark:text-blue-200 text-[11px] leading-relaxed">
              When enabled, scheduled panel interviews in RecruitFlow automatically push calendar invites to the
              interviewer and candidate calendars with direct video meeting links.
            </div>

            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Synchronization Direction
              </label>
              <select
                value={syncMode}
                onChange={(e) => setSyncMode(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="push">Push Events (RecruitFlow &rarr; Calendar)</option>
                <option value="twoway">Bi-directional (Push &amp; Ingest Free/Busy)</option>
              </select>
            </div>

            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Calendar Identifier
              </label>
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="primary"
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Use "primary" for default recruiter calendar</span>
            </div>

            <div>
              <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoGenerateMeeting}
                  onChange={(e) => setAutoGenerateMeeting(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Automatically attach virtual conference link (Teams / Google Meet)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfiguringItem(null)}
                className="px-3.5 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition cursor-pointer"
              >
                {isSavingConfig ? 'Connecting...' : 'Save & Connect'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageFrame>
  );
}
