import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageFrame } from '../components/ui/PageFrame';
import { Icon, type IconName } from '../components/Icon';
import { MasterDataPage } from './MasterDataPage';
import { UsersRolesPage } from './UsersRolesPage';
import { PipelineSettingsPage } from './PipelineSettingsPage';
import { IntegrationsPage } from './IntegrationsPage';
import { AuditLogPage } from './AuditLogPage';
import { PositionLevelTargetSettingsPage } from './PositionLevelTargetSettingsPage';

type SettingsTab = 'positions' | 'pipeline' | 'templates' | 'users' | 'integrations' | 'audit' | 'master-data';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: IconName;
  description: string;
}

const SETTINGS_TABS: TabConfig[] = [
  { id: 'positions', label: 'Job Positions & Targets', icon: 'settings', description: 'Position catalog, salary bands, and time-to-fill targets' },
  { id: 'pipeline', label: 'Pipeline Stages', icon: 'pipeline', description: 'Configure recruitment stages, candidate workflows, and SLAs' },
  { id: 'templates', label: 'Email Templates & Publishing', icon: 'mail', description: 'Message templates, candidate notifications, and career site channels' },
  { id: 'users', label: 'User Roles & Access', icon: 'users', description: 'Team members, recruiter assignments, and RBAC permissions' },
  { id: 'master-data', label: 'Master Data & Entities', icon: 'database', description: 'Legal entities, hospital branches, and clinical departments' },
  { id: 'integrations', label: 'Integrations & API', icon: 'folder-kanban', description: 'Job boards, video conferencing, and healthcare HRIS integrations' },
  { id: 'audit', label: 'Audit & Governance Logs', icon: 'audit', description: 'Immutable activity trails, compliance logs, and security events' },
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'positions';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const handleTabChange = (tabId: SettingsTab) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <PageFrame
      eyebrow="System Configuration"
      title="Recruitment Settings & Governance"
      description="Manage Saudi German Health recruitment pipelines, master clinical data, team roles, and system integrations."
    >
      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-rf-border pb-3 mb-6">
        {SETTINGS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-rf-primary text-white shadow-sm font-semibold'
                  : 'text-rf-muted hover:text-rf-ink hover:bg-rf-surface-subtle'
              }`}
            >
              <Icon name={tab.icon} size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panes */}
      <div className="settings-content-pane">
        {activeTab === 'positions' && (
          <div className="space-y-6">
            <PositionLevelTargetSettingsPage />
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <PipelineSettingsPage />
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="card p-6 border border-rf-border rounded-xl bg-rf-surface space-y-6">
              <div>
                <h3 className="text-base font-semibold text-rf-ink">Candidate Communication & Email Templates</h3>
                <p className="text-sm text-rf-muted mt-1">Configure automated notifications sent to candidates at each recruitment workflow milestone.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-rf-border rounded-lg bg-rf-surface-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-rf-ink">Interview Invitation (Clinical)</span>
                    <span className="badge badge-success text-xs">Active</span>
                  </div>
                  <p className="text-xs text-rf-muted">Includes Zoom link, panelist names, and required clinical credentials reminder.</p>
                </div>

                <div className="p-4 border border-rf-border rounded-lg bg-rf-surface-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-rf-ink">Official Job Offer Letter</span>
                    <span className="badge badge-success text-xs">Active</span>
                  </div>
                  <p className="text-xs text-rf-muted">Includes compensation breakdown, allowances, and 7-day acceptance deadline.</p>
                </div>

                <div className="p-4 border border-rf-border rounded-lg bg-rf-surface-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-rf-ink">Application Acknowledgment</span>
                    <span className="badge badge-success text-xs">Active</span>
                  </div>
                  <p className="text-xs text-rf-muted">Sent immediately upon submission through Saudi German Health Careers site.</p>
                </div>

                <div className="p-4 border border-rf-border rounded-lg bg-rf-surface-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-rf-ink">Regret Notice (Polite)</span>
                    <span className="badge badge-success text-xs">Active</span>
                  </div>
                  <p className="text-xs text-rf-muted">Sent when candidate profile is archived or not selected for current opening.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <UsersRolesPage />
          </div>
        )}

        {activeTab === 'master-data' && (
          <div className="space-y-6">
            <MasterDataPage />
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <IntegrationsPage />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <AuditLogPage />
          </div>
        )}
      </div>
    </PageFrame>
  );
}
