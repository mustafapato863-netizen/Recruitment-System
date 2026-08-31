import { useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Icon } from '../Icon';

interface RecruiterTargetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function RecruiterTargetSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: RecruiterTargetSettingsModalProps) {
  const [period, setPeriod] = useState<'Daily' | 'Monthly'>('Daily');
  const [branch, setBranch] = useState('ALL');
  const [positionLevel, setPositionLevel] = useState('ALL');
  const [recruiter, setRecruiter] = useState('ALL');

  const [calls, setCalls] = useState(period === 'Daily' ? 12 : 200);
  const [screenings, setScreenings] = useState(period === 'Daily' ? 15 : 150);
  const [interviews, setInterviews] = useState(period === 'Daily' ? 3 : 40);
  const [offers, setOffers] = useState(period === 'Daily' ? 1 : 10);

  const handlePeriodChange = (newPeriod: 'Daily' | 'Monthly') => {
    setPeriod(newPeriod);
    if (newPeriod === 'Daily') {
      setCalls(12);
      setScreenings(15);
      setInterviews(3);
      setOffers(1);
    } else {
      setCalls(200);
      setScreenings(150);
      setInterviews(40);
      setOffers(10);
    }
  };

  const handleSave = () => {
    const data = {
      period,
      branchName: branch === 'ALL' ? 'All Branches' : branch,
      positionLevel: positionLevel === 'ALL' ? 'All Levels' : positionLevel,
      recruiter: recruiter === 'ALL' ? 'All Recruiters' : recruiter,
      calls: { actual: period === 'Daily' ? 8 : 165, target: calls },
      screenings: { actual: period === 'Daily' ? 14 : 120, target: screenings },
      interviews: { actual: period === 'Daily' ? 3 : 38, target: interviews },
      offers: { actual: period === 'Daily' ? 1 : 9, target: offers },
    };

    localStorage.setItem(`recruitflow_targets_${period}`, JSON.stringify(data));
    onSaved?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Recruiter Activity & KPI Targets"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-rf-ink-muted">
          Define productivity benchmarks for recruiters by branch, position seniority level, and time period.
        </p>

        {/* Filters & Dimensions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 rounded-xl border border-rf-border bg-rf-surface-subtle p-3">
          <div>
            <label className="text-xs font-semibold text-rf-ink-muted block mb-1">Target Period</label>
            <Select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as 'Daily' | 'Monthly')}
              aria-label="Target Period"
            >
              <option value="Daily">Daily Target</option>
              <option value="Monthly">Monthly Target</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-rf-ink-muted block mb-1">Branch / Hospital</label>
            <Select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              aria-label="Branch"
            >
              <option value="ALL">All Branches</option>
              <option value="HEAD-OFFICE">Head Office (Cairo)</option>
              <option value="ALEXANDRIA">Alexandria Hospital</option>
              <option value="NASR-CITY">Nasr City Hospital</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-rf-ink-muted block mb-1">Position Level</label>
            <Select
              value={positionLevel}
              onChange={(e) => setPositionLevel(e.target.value)}
              aria-label="Position Level"
            >
              <option value="ALL">All Levels & Types</option>
              <option value="SENIOR_CONSULTANT">Consultant / Senior Medical</option>
              <option value="SPECIALIST_NURSE">Nursing & Clinical Staff</option>
              <option value="TECH_ENGINEERING">Technology & Engineering</option>
              <option value="ADMIN_OPERATIONS">Administration & Ops</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-rf-ink-muted block mb-1">Recruiter</label>
            <Select
              value={recruiter}
              onChange={(e) => setRecruiter(e.target.value)}
              aria-label="Recruiter"
            >
              <option value="ALL">All Recruiters (Team Baseline)</option>
              <option value="sarah.ahmed@recruitflow.local">Sarah Ahmed (Recruiter)</option>
            </Select>
          </div>
        </div>

        {/* Target Counters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-3">
            <label className="text-xs font-semibold text-rf-ink flex items-center gap-1.5 mb-2">
              <Icon name="phone" size={13} className="text-emerald-600" />
              Target Calls ({period})
            </label>
            <Input
              type="number"
              min="0"
              value={calls}
              onChange={(e) => setCalls(Number(e.target.value))}
              aria-label="Target Calls"
            />
          </div>

          <div className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-3">
            <label className="text-xs font-semibold text-rf-ink flex items-center gap-1.5 mb-2">
              <Icon name="file-text" size={13} className="text-blue-600" />
              Target CVs ({period})
            </label>
            <Input
              type="number"
              min="0"
              value={screenings}
              onChange={(e) => setScreenings(Number(e.target.value))}
              aria-label="Target CVs"
            />
          </div>

          <div className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-3">
            <label className="text-xs font-semibold text-rf-ink flex items-center gap-1.5 mb-2">
              <Icon name="calendar-clock" size={13} className="text-purple-600" />
              Interviews ({period})
            </label>
            <Input
              type="number"
              min="0"
              value={interviews}
              onChange={(e) => setInterviews(Number(e.target.value))}
              aria-label="Target Interviews"
            />
          </div>

          <div className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-3">
            <label className="text-xs font-semibold text-rf-ink flex items-center gap-1.5 mb-2">
              <Icon name="offer" size={13} className="text-amber-600" />
              Offers ({period})
            </label>
            <Input
              type="number"
              min="0"
              value={offers}
              onChange={(e) => setOffers(Number(e.target.value))}
              aria-label="Target Offers"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-rf-border/60 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <Icon name="check" size={14} />
            Save Target Benchmark
          </Button>
        </div>
      </div>
    </Modal>
  );
}
