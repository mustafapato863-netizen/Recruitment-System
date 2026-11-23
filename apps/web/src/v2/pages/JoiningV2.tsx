import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Clock, AlertTriangle, Users, RotateCw, CheckCircle2, UserX } from 'lucide-react';
import { ButtonV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { InputV2 } from '../../components/v2/Field';
import { getApi, ApiError } from '../../api/client';
import { useCachedResource } from '../api/useCachedResource';
import {
  requirementCleared,
} from '../../components/candidate/JoiningChecklist';
import { OnboardingChecklistDrawer, type OnboardingCase } from '../drawers/OnboardingChecklistDrawer';
import { getInitials } from '../userIdentity';
import './jobs.css';
import './team.css';

export interface JoiningCase extends OnboardingCase {
  ownerUserId: string | null;
  checklistProgress?: number;
  completedItems?: number;
  totalItems?: number;
}

const statusTone = (status: string): 'info' | 'success' | 'warning' | 'danger' => {
  switch (status) {
    case 'Joined':
      return 'success';
    case 'Awaiting Joining':
      return 'info';
    case 'Postponed':
      return 'warning';
    case 'No-show':
      return 'danger';
    default:
      return 'info';
  }
};

export function JoiningV2() {
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);

  const statusFilter = params.get('status') || '';
  const searchFilter = params.get('search') || '';
  const activeCaseId = params.get('caseId');
  const drawerMode = params.get('drawer');

  const updateParams = (patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, val] of Object.entries(patch)) {
        if (val) next.set(key, val);
        else next.delete(key);
      }
      return next;
    });
  };

  const joiningRes = useCachedResource<JoiningCase[]>({
    key: 'joining',
    attempt,
    fetcher: () => getApi<JoiningCase[]>('/hiring').then((data) =>
      (Array.isArray(data) ? data : []).map((item) => {
        const reqs = item.complianceRequirements ?? [];
        const completed = reqs.filter((req) => req && requirementCleared(req)).length;
        const total = reqs.length;
        const checklistProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          ...item,
          checklistProgress,
          completedItems: completed,
          totalItems: total,
        };
      }),
    ),
  });

  const items = joiningRes.kind === 'ready' ? joiningRes.data : [];
  const loading = joiningRes.kind === 'loading';
  const error = joiningRes.kind === 'error'
    ? (joiningRes.error instanceof ApiError ? joiningRes.error.message : 'Could not load joining records.')
    : null;

  const awaitingCount = items.filter((i) => i.status === 'Awaiting Joining').length;
  const joinedCount = items.filter((i) => i.status === 'Joined').length;
  const postponedCount = items.filter((i) => i.status === 'Postponed').length;
  const noshowCount = items.filter((i) => i.status === 'No-show').length;
  const totalCount = items.length;

  const filtered = items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchName = item.candidateName?.toLowerCase().includes(q);
      const matchPos = item.positionTitle?.toLowerCase().includes(q);
      const matchBranch = item.branchName?.toLowerCase().includes(q);
      if (!matchName && !matchPos && !matchBranch) return false;
    }
    return true;
  });

  const activeCase = items.find((i) => i.id === activeCaseId);

  return (
    <div className="rf2-jobs rf2-team">
      <header className="rf2-team__bar">
        <div>
          <h1 className="rf2-team__title">Joining & Onboarding</h1>
          <p className="rf2-team__intro">
            Track accepted offers through pre-boarding compliance checklists, target start dates, and day-one show confirmations.
          </p>
        </div>
      </header>

      <ul className="rf2-team__summary-cards rf2-team__summary-cards--5" aria-label="Joining summary">
        <li>
          <span className="rf2-team__sum-icon" data-tone="info" aria-hidden="true"><Clock /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{awaitingCount}</span>
            <span className="rf2-team__sum-label">Awaiting Joining</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone="success" aria-hidden="true"><CheckCircle2 /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{joinedCount}</span>
            <span className="rf2-team__sum-label">Joined</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone="warning" aria-hidden="true"><AlertTriangle /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{postponedCount}</span>
            <span className="rf2-team__sum-label">Postponed</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone="danger" aria-hidden="true"><UserX /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{noshowCount}</span>
            <span className="rf2-team__sum-label">No-show</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone="info" aria-hidden="true"><Users /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{totalCount}</span>
            <span className="rf2-team__sum-label">Total in scope</span>
          </span>
        </li>
      </ul>

      <div className="rf2-team__toolbar">
        <div className="rf2-row-between" style={{ width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="rf2-tabs" role="tablist" aria-label="Status filters">
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={!statusFilter}
              onClick={() => updateParams({ status: null })}
            >
              All
              <span className="rf2-tab__count" aria-hidden="true">{totalCount}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={statusFilter === 'Awaiting Joining'}
              onClick={() => updateParams({ status: 'Awaiting Joining' })}
            >
              Awaiting
              <span className="rf2-tab__count" aria-hidden="true">{awaitingCount}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={statusFilter === 'Joined'}
              onClick={() => updateParams({ status: 'Joined' })}
            >
              Joined
              <span className="rf2-tab__count" aria-hidden="true">{joinedCount}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={statusFilter === 'Postponed'}
              onClick={() => updateParams({ status: 'Postponed' })}
            >
              Postponed
              <span className="rf2-tab__count" aria-hidden="true">{postponedCount}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={statusFilter === 'No-show'}
              onClick={() => updateParams({ status: 'No-show' })}
            >
              No-show
              <span className="rf2-tab__count" aria-hidden="true">{noshowCount}</span>
            </button>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 'min(100%, 300px)', maxWidth: 420 }}>
            <InputV2
              label="Search candidates"
              fieldClassName="rf2-jobs__search rf2-sr-label"
              placeholder="Search candidate, position or site…"
              value={searchFilter}
              onChange={(e) => updateParams({ search: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      <section className="rf2-panel">
        {loading ? <SkeletonV2 lines={6} label="Loading onboarding candidates…" /> : null}

        {error ? (
          <div role="alert">
            <EmptyStateV2
              title="Could not load joining records"
              body={error}
              action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>}
            />
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <EmptyStateV2
            title="No joining records found"
            body={items.length === 0 ? 'No accepted offers are currently awaiting or recording onboarding.' : 'No candidates match the selected filters.'}
          />
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="rf2-jscroll">
            <table className="rf2-jtable" aria-label="Joining candidates">
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">Position & Site</th>
                  <th scope="col">Target Start Date</th>
                  <th scope="col">Pre-boarding Checklist</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="rf2-intv-mgr__cand">
                        <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{getInitials(item.candidateName)}</span>
                        <span className="rf2-jtable__name">{item.candidateName}</span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong className="block font-medium">{item.positionTitle}</strong>
                        <span className="block text-sm rf2-ink-muted">{item.branchName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="rf2-intv-mgr__when">
                        <Calendar aria-hidden="true" />
                        {item.plannedJoiningDate ? new Date(item.plannedJoiningDate).toLocaleDateString('en-GB') : 'Not set'}
                      </span>
                    </td>
                    <td>
                      <div style={{ minWidth: 120 }}>
                        <span className="text-xs font-medium">
                          {item.completedItems ?? 0}/{item.totalItems ?? 0} items
                        </span>
                        <div
                          style={{
                            height: 6,
                            background: 'var(--rf2-border-subtle, #e2e8f0)',
                            borderRadius: 3,
                            marginTop: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${item.checklistProgress ?? 0}%`,
                              background: (item.checklistProgress ?? 0) === 100 ? 'var(--rf2-success, #16a34a)' : 'var(--rf2-action, #2563eb)',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusChip tone={statusTone(item.status)} label={item.status} />
                    </td>
                    <td>
                      <ButtonV2
                        kind="secondary"
                        size="sm"
                        onClick={() => updateParams({ caseId: item.id, drawer: 'checklist' })}
                      >
                        {item.status === 'Awaiting Joining' ? 'Confirm joining' : 'View checklist'}
                      </ButtonV2>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {drawerMode === 'checklist' && activeCase ? (
        <OnboardingChecklistDrawer
          hiringCase={activeCase}
          onClose={() => updateParams({ caseId: null, drawer: null })}
          onUpdated={() => setAttempt((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
