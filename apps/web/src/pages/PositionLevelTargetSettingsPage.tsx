import { useState } from 'react';
import { PageFrame } from '../components/ui/PageFrame';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Alert } from '../components/ui/Alert';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export interface PositionLevelTarget {
  id: string;
  levelCode: string;
  levelName: string;
  category: string;
  dailyCalls: number;
  dailyScreenings: number;
  monthlyInterviews: number;
  monthlyOffers: number;
  targetAcceptanceRate: number;
  slaScorecardHours: number;
}

const DEFAULT_LEVEL_TARGETS: PositionLevelTarget[] = [
  {
    id: 'lvl-1',
    levelCode: 'L1-CONSULTANT',
    levelName: 'Senior Consultant & Medical Executive',
    category: 'Executive Clinical',
    dailyCalls: 8,
    dailyScreenings: 10,
    monthlyInterviews: 20,
    monthlyOffers: 2,
    targetAcceptanceRate: 90,
    slaScorecardHours: 12,
  },
  {
    id: 'lvl-2',
    levelCode: 'L2-SPECIALIST',
    levelName: 'Specialist & Clinical Doctors',
    category: 'Clinical Medical',
    dailyCalls: 12,
    dailyScreenings: 15,
    monthlyInterviews: 35,
    monthlyOffers: 4,
    targetAcceptanceRate: 85,
    slaScorecardHours: 8,
  },
  {
    id: 'lvl-3',
    levelCode: 'L3-NURSING',
    levelName: 'Nursing & Allied Healthcare',
    category: 'Clinical Support',
    dailyCalls: 20,
    dailyScreenings: 30,
    monthlyInterviews: 50,
    monthlyOffers: 8,
    targetAcceptanceRate: 80,
    slaScorecardHours: 4,
  },
  {
    id: 'lvl-4',
    levelCode: 'L4-TECH',
    levelName: 'Engineering & Technology',
    category: 'Digital & IT',
    dailyCalls: 15,
    dailyScreenings: 20,
    monthlyInterviews: 30,
    monthlyOffers: 3,
    targetAcceptanceRate: 85,
    slaScorecardHours: 6,
  },
  {
    id: 'lvl-5',
    levelCode: 'L5-ADMIN',
    levelName: 'Operations & Hospital Administration',
    category: 'Administration',
    dailyCalls: 18,
    dailyScreenings: 25,
    monthlyInterviews: 40,
    monthlyOffers: 5,
    targetAcceptanceRate: 80,
    slaScorecardHours: 6,
  },
];

const STORAGE_KEY = 'recruitflow_position_level_targets';

export function PositionLevelTargetSettingsPage() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<PositionLevelTarget[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_LEVEL_TARGETS;
    } catch {
      return DEFAULT_LEVEL_TARGETS;
    }
  });

  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const canEdit = user?.permissions.includes('VACANCY_REQUEST_APPROVE') || user?.permissions.includes('USERS_MANAGE') || user?.permissions.includes('VACANCY_MANAGE');

  const handleUpdate = (id: string, field: keyof PositionLevelTarget, value: number) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    setTargets(DEFAULT_LEVEL_TARGETS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LEVEL_TARGETS));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const filteredTargets = targets.filter(
    (t) =>
      t.levelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.levelCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageFrame
      eyebrow="Settings & Governance"
      title="Position Level Target Settings"
      description="Define standard recruitment activity quotas, screening benchmarks, and SLA targets by position grade."
      actions={
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="secondary" size="sm" onClick={handleResetDefaults}>
                <Icon name="refresh-cw" size={14} />
                Reset Defaults
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                <Icon name="check" size={14} />
                Save Target Matrix
              </Button>
            </>
          )}
        </div>
      }
    >
      {savedSuccess && (
        <Alert tone="success" title="Target Matrix Updated" className="mb-6">
          Position level targets have been successfully saved and applied to live recruiter progress trackers.
        </Alert>
      )}

      {/* Scope Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 rounded-2xl border border-rf-border bg-white dark:bg-rf-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Input
              placeholder="Search level or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-rf-ink-muted">Branch Scope:</span>
            <Select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="text-xs w-48"
            >
              <option value="ALL">All Hospital Branches (Global)</option>
              <option value="HEAD-OFFICE">Head Office Cairo</option>
              <option value="ALEXANDRIA">Alexandria Hospital</option>
              <option value="NASR-CITY">Nasr City Medical Center</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-rf-ink-muted">
          <Icon name="info" size={14} className="text-rf-primary" />
          <span>Configured by Talent Manager for SLA benchmarking</span>
        </div>
      </div>

      {/* Target Matrix Cards */}
      <div className="grid gap-5">
        {filteredTargets.map((lvl) => (
          <Card key={lvl.id} className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rf-border/70 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rf-primary/10 text-rf-primary font-bold shadow-2xs">
                  {lvl.levelCode.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-rf-ink dark:text-white">{lvl.levelName}</h3>
                    <Badge variant="purple">{lvl.category}</Badge>
                  </div>
                  <p className="text-xs text-rf-ink-muted font-mono">{lvl.levelCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Icon name="check-circle" size={13} />
                  {lvl.targetAcceptanceRate}% Min. Acceptance
                </span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Icon name="clock" size={13} />
                  {lvl.slaScorecardHours}h Scorecard SLA
                </span>
              </div>
            </div>

            {/* Quota Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="rounded-xl border border-rf-border/80 bg-rf-surface-subtle/50 p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                  <Icon name="phone" size={12} className="text-emerald-600" />
                  Daily Calls
                </label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={lvl.dailyCalls}
                  onChange={(e) => handleUpdate(lvl.id, 'dailyCalls', Number(e.target.value))}
                  className="font-mono text-sm font-bold text-rf-ink dark:text-white"
                />
                <span className="text-[10px] text-rf-ink-muted block">calls / recruiter / day</span>
              </div>

              <div className="rounded-xl border border-rf-border/80 bg-rf-surface-subtle/50 p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                  <Icon name="file-text" size={12} className="text-blue-600" />
                  Daily CV Screen
                </label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={lvl.dailyScreenings}
                  onChange={(e) => handleUpdate(lvl.id, 'dailyScreenings', Number(e.target.value))}
                  className="font-mono text-sm font-bold text-rf-ink dark:text-white"
                />
                <span className="text-[10px] text-rf-ink-muted block">CVs screened / day</span>
              </div>

              <div className="rounded-xl border border-rf-border/80 bg-rf-surface-subtle/50 p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                  <Icon name="calendar-clock" size={12} className="text-purple-600" />
                  Monthly Interviews
                </label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={lvl.monthlyInterviews}
                  onChange={(e) => handleUpdate(lvl.id, 'monthlyInterviews', Number(e.target.value))}
                  className="font-mono text-sm font-bold text-rf-ink dark:text-white"
                />
                <span className="text-[10px] text-rf-ink-muted block">interviews / month</span>
              </div>

              <div className="rounded-xl border border-rf-border/80 bg-rf-surface-subtle/50 p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                  <Icon name="offer" size={12} className="text-amber-600" />
                  Monthly Offers
                </label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={lvl.monthlyOffers}
                  onChange={(e) => handleUpdate(lvl.id, 'monthlyOffers', Number(e.target.value))}
                  className="font-mono text-sm font-bold text-rf-ink dark:text-white"
                />
                <span className="text-[10px] text-rf-ink-muted block">offers extended</span>
              </div>

              <div className="rounded-xl border border-rf-border/80 bg-rf-surface-subtle/50 p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                  <Icon name="check-circle" size={12} className="text-emerald-600" />
                  Acceptance %
                </label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={lvl.targetAcceptanceRate}
                  onChange={(e) => handleUpdate(lvl.id, 'targetAcceptanceRate', Number(e.target.value))}
                  className="font-mono text-sm font-bold text-rf-ink dark:text-white"
                />
                <span className="text-[10px] text-rf-ink-muted block">min. offer accept %</span>
              </div>

              <div className="rounded-xl border border-rf-border/80 bg-rf-surface-subtle/50 p-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                  <Icon name="clock" size={12} className="text-blue-600" />
                  Turnaround SLA
                </label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={lvl.slaScorecardHours}
                  onChange={(e) => handleUpdate(lvl.id, 'slaScorecardHours', Number(e.target.value))}
                  className="font-mono text-sm font-bold text-rf-ink dark:text-white"
                />
                <span className="text-[10px] text-rf-ink-muted block">max hours scorecard</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageFrame>
  );
}
