import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ButtonV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { InputV2 } from '../../components/v2/Field';
import { getApi } from '../../api/client';
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

interface UserSeatWire {
  id: string;
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
  roles?: Array<string | { code?: string; name?: string }>;
  directReportCount?: number;
  hasDirectReports?: boolean;
  status?: string;
}

export function LicenseManagementV2() {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserSeatRow[]>([]);

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

    getApi<UserSeatWire[]>('/users')
      .then((rawUsers) => {
        if (!alive) return;
        if (!Array.isArray(rawUsers)) throw new Error('The user directory returned an invalid list.');
        const mappedUsers: UserSeatRow[] = rawUsers.map((u: UserSeatWire) => {
          const roles = Array.isArray(u.roles)
            ? u.roles.map((role) => typeof role === 'string' ? role : role.code ?? role.name ?? '').filter(Boolean)
            : [];
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
            status: u.status || 'Unknown',
            hasDirectReports: hasReports,
          };
        });

        setUsers(mappedUsers);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Could not load user seat assignments.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [attempt]);

  const filteredUsers = users.filter((u) => {
    if (seatFilter && u.seat !== seatFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.displayName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeCounts = {
    employee: users.filter((u) => u.seat === 'employee' && u.status === 'Active').length,
    manager: users.filter((u) => u.seat === 'manager' && u.status === 'Active').length,
    admin: users.filter((u) => u.seat === 'admin' && u.status === 'Active').length,
  };

  return (
    <div className="rf2-admin-workspace">
      <AdminWorkspaceHeader
        group="Users & Access"
        title="User seats & access"
        subtitle="Review actual user assignments. Licensed capacity is not reported by the user directory."
      />

      {error ? (
        <div className="rf2-admin-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
          <ButtonV2 kind="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>Retry</ButtonV2>
        </div>
      ) : null}

      <p className="rf2-jtable__sub" role="note">
        V2 is the signed-in interface. This page does not turn V1 back on.
        Counts reflect active user records, not purchased seats or a verified licensing limit.
      </p>
      <div className="rf2-admin-seat-grid" aria-label="Active users by workspace">
        {(['employee', 'manager', 'admin'] as const).map((seat) => (
          <div key={seat} className="rf2-admin-card rf2-admin-seat-card">
            <div className="rf2-row-between">
              <div>
                <h3 className="rf2-admin-seat-card__title">
                  {seat.charAt(0).toUpperCase() + seat.slice(1)} workspace
                </h3>
                <span className="rf2-admin-seat-card__quota">
                  {loading ? 'Loading users…' : error ? 'Unavailable' : `${activeCounts[seat]} active user${activeCounts[seat] === 1 ? '' : 's'}`}
                </span>
              </div>
              <StatusChip tone="neutral" label="V2 interface" />
            </div>
          </div>
        ))}
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
              <span className="rf2-tab__count">{activeCounts.employee}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={seatFilter === 'manager'}
              onClick={() => updateParams({ seat: 'manager' })}
            >
              Managers
              <span className="rf2-tab__count">{activeCounts.manager}</span>
            </button>
            <button
              type="button"
              className="rf2-tab"
              role="tab"
              aria-selected={seatFilter === 'admin'}
              onClick={() => updateParams({ seat: 'admin' })}
            >
              Admins
              <span className="rf2-tab__count">{activeCounts.admin}</span>
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

        {!loading && !error && filteredUsers.length === 0 ? (
          <EmptyStateV2
            title="No users found"
            body={users.length === 0 ? 'No active users in organization.' : 'No users match the search criteria.'}
          />
        ) : null}

        {!loading && !error && filteredUsers.length > 0 ? (
          <div className="rf2-jscroll">
            <table className="rf2-jtable" aria-label="User seat allocations">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Assigned Seat</th>
                  <th scope="col">Assigned Roles</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
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
