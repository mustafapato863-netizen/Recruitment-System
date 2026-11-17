import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ButtonV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { InputV2 } from '../../components/v2/Field';
import { getApi, patchApi, postApi, ApiError } from '../../api/client';
import { AdminWorkspaceHeader } from './AdminWorkspaceHeader';
import { type Seat } from '../seat';
import './admin.css';

interface UserSeatRow {
  id: string;
  displayName: string;
  email: string;
  seat: Seat;
  roles: string[];
  status: string;
  hasDirectReports: boolean;
}

interface RolloutState {
  v2Seats: Seat[];
  source: 'org' | 'env' | 'default';
  quota: {
    employee: { total: number; used: number };
    manager: { total: number; used: number };
    admin: { total: number; used: number };
  };
}

export function LicenseManagementV2() {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserSeatRow[]>([]);
  const [rollout, setRollout] = useState<RolloutState>({
    v2Seats: ['employee'],
    source: 'default',
    quota: {
      employee: { total: 50, used: 0 },
      manager: { total: 15, used: 0 },
      admin: { total: 5, used: 0 },
    },
  });
  // attempt unused

  const search = params.get('q') || '';
  const seatFilter = params.get('seat') || '';

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getApi<UserSeatRow[]>('/users').catch(() => []),
      getApi<{ v2Seats?: Seat[]; source?: 'org' | 'env' | 'default' }>('/auth/rollout').catch(() => ({
        v2Seats: ['employee'],
        source: 'default' as const,
      })),
    ])
      .then(([rawUsers, rolloutRes]) => {
        if (!alive) return;
        const userList = Array.isArray(rawUsers) ? rawUsers : [];
        const mappedUsers: UserSeatRow[] = userList.map((u: any) => {
          const roles = Array.isArray(u.roles) ? u.roles.map((r: any) => (typeof r === 'string' ? r : r.code || r.name)) : [];
          const hasReports = Boolean(u.directReportCount || u.hasDirectReports);
          let seat: Seat = 'employee';
          if (roles.includes('ADMINISTRATOR') || roles.includes('ADMIN')) seat = 'admin';
          else if (roles.includes('HIRING_MANAGER') || hasReports) seat = 'manager';

          return {
            id: u.id,
            displayName: u.displayName || u.name || 'User',
            email: u.email || '',
            seat,
            roles,
            status: u.status || 'Active',
            hasDirectReports: hasReports,
          };
        });

        const empUsed = mappedUsers.filter((u) => u.seat === 'employee' && u.status === 'Active').length;
        const mgrUsed = mappedUsers.filter((u) => u.seat === 'manager' && u.status === 'Active').length;
        const admUsed = mappedUsers.filter((u) => u.seat === 'admin' && u.status === 'Active').length;

        setUsers(mappedUsers);
        setRollout({
          v2Seats: (rolloutRes.v2Seats ?? ['employee']) as Seat[],
          source: rolloutRes.source || 'default',
          quota: {
            employee: { total: 50, used: empUsed },
            manager: { total: 15, used: mgrUsed },
            admin: { total: 5, used: admUsed },
          },
        });
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : 'Could not load license and seat configuration.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const toggleSeatV2 = async (seat: Seat) => {
    const nextSeats = rollout.v2Seats.includes(seat)
      ? rollout.v2Seats.filter((s) => s !== seat)
      : [...rollout.v2Seats, seat];

    setSaving(true);
    setError(null);
    try {
      await postApi('/integrations/config', {
        name: 'ROLLOUT_SEATS',
        configJson: { v2Seats: nextSeats },
      }).catch(async () => {
        // Fallback endpoint if direct org config endpoint is used
        await patchApi('/auth/rollout', { v2Seats: nextSeats });
      });
      setRollout((prev) => ({ ...prev, v2Seats: nextSeats, source: 'org' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save rollout configuration.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (seatFilter && u.seat !== seatFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.displayName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="rf2-admin-workspace">
      <AdminWorkspaceHeader
        group="Users & Access"
        title="License & Seat Administration"
        subtitle="Manage seat quotas, active software licenses, and V2 phased rollout controls."
      />

      {error ? (
        <div className="rf2-admin-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="rf2-admin-seat-grid">
        {(['employee', 'manager', 'admin'] as const).map((seat) => {
          const quota = rollout.quota[seat];
          const isV2 = rollout.v2Seats.includes(seat);
          const percent = Math.min(100, Math.round((quota.used / Math.max(1, quota.total)) * 100));

          return (
            <div key={seat} className="rf2-admin-card rf2-admin-seat-card">
              <div className="rf2-row-between">
                <div>
                  <h3 className="rf2-admin-seat-card__title">
                    {seat.charAt(0).toUpperCase() + seat.slice(1)} Workspace
                  </h3>
                  <span className="rf2-admin-seat-card__quota">
                    {quota.used} / {quota.total} Seats Occupied ({percent}%)
                  </span>
                </div>
                <StatusChip
                  tone={isV2 ? 'success' : 'neutral'}
                  label={isV2 ? 'V2 Enabled' : 'V1 Classic'}
                />
              </div>

              <div
                style={{
                  height: 6,
                  background: 'var(--rf2-border-subtle, #e2e8f0)',
                  borderRadius: 3,
                  margin: '12px 0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: percent > 90 ? 'var(--rf2-danger, #ef4444)' : 'var(--rf2-action, #2563eb)',
                    borderRadius: 3,
                  }}
                />
              </div>

              <div className="rf2-row-between" style={{ marginTop: 16 }}>
                <span className="text-sm font-medium">Default UI Version</span>
                <ButtonV2
                  kind={isV2 ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={saving}
                  onClick={() => toggleSeatV2(seat)}
                >
                  {isV2 ? 'Switch to V1' : 'Graduate to V2'}
                </ButtonV2>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rf2-team__toolbar" style={{ marginTop: 24 }}>
        <div className="rf2-row-between" style={{ width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="rf2-tabs" role="tablist" aria-label="Seat filters">
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={!seatFilter}
              onClick={() => updateParams({ seat: null })}
            >
              All Seats
              <span className="rf2-tab__count">{users.length}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={seatFilter === 'employee'}
              onClick={() => updateParams({ seat: 'employee' })}
            >
              Employees
              <span className="rf2-tab__count">{rollout.quota.employee.used}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={seatFilter === 'manager'}
              onClick={() => updateParams({ seat: 'manager' })}
            >
              Managers
              <span className="rf2-tab__count">{rollout.quota.manager.used}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={seatFilter === 'admin'}
              onClick={() => updateParams({ seat: 'admin' })}
            >
              Admins
              <span className="rf2-tab__count">{rollout.quota.admin.used}</span>
            </button>
          </div>

          <div style={{ maxWidth: 280, flex: 1 }}>
            <InputV2
              label="Search users"
              fieldClassName="rf2-jobs__search rf2-sr-label"
              placeholder="Search user name or email…"
              value={search}
              onChange={(e) => updateParams({ q: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      <section className="rf2-panel" style={{ marginTop: 16 }}>
        {loading ? <SkeletonV2 lines={6} label="Loading users and seat assignments…" /> : null}

        {!loading && filteredUsers.length === 0 ? (
          <EmptyStateV2
            title="No users found"
            body={users.length === 0 ? 'No active users in organization.' : 'No users match the search criteria.'}
          />
        ) : null}

        {!loading && filteredUsers.length > 0 ? (
          <div className="rf2-jscroll">
            <table className="rf2-jtable" aria-label="User seat allocations">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Assigned Seat</th>
                  <th scope="col">Assigned Roles</th>
                  <th scope="col">Status</th>
                  <th scope="col">Experience Mode</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const onV2 = rollout.v2Seats.includes(u.seat);
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong className="font-semibold">{u.displayName}</strong>
                      </td>
                      <td>
                        <span className="rf2-ink-muted">{u.email}</span>
                      </td>
                      <td>
                        <span className="rf2-chip rf2-chip--neutral">
                          {u.seat.charAt(0).toUpperCase() + u.seat.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs">{u.roles.join(', ') || 'Recruiter'}</span>
                      </td>
                      <td>
                        <StatusChip
                          tone={u.status === 'Active' ? 'success' : 'neutral'}
                          label={u.status}
                        />
                      </td>
                      <td>
                        <StatusChip
                          tone={onV2 ? 'success' : 'neutral'}
                          label={onV2 ? 'V2 Target' : 'V1 Classic'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
