import { useEffect, useState } from 'react';
import { CircleCheck, CircleMinus, Info, RotateCw, ShieldCheck } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { SEAT_LABEL } from '../seat';
import { CAPABILITIES, POLICY, fetchPermissions, fetchRoles, grant, revoke, roleSeat, type AdminRole, type Permission } from './rolesApi';
import { fetchUsers } from './usersApi';
import '../pages/jobs.css';
import './admin.css';

const ICON = { yes: CircleCheck, info: Info, no: CircleMinus } as const;
const COLS = ['employee', 'manager', 'admin', 'interviewer'] as const;
function capabilityChange(count: number, roleName: string): string {
  return `${count} ${count === 1 ? 'user has' : 'users have'} the ${roleName} role. Change this capability?`;
}

/** A04 Roles (Admin seat): the three-seat policy plus Interviewer / Licence check granted as permissions on roles. */
export function RolesV2() {
  const [data, setData] = useState<{ roles: AdminRole[]; perms: Permission[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<{ role: AdminRole; perm: Permission; on: boolean; label: string; count: number } | null>(null);
  useEffect(() => {
    let live = true; setError(null);
    Promise.all([fetchRoles(), fetchPermissions().catch(() => [] as Permission[])]).then(([roles, perms]) => live && setData({ roles, perms }))
      .catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt]);
  const roles = (data?.roles ?? []).filter((r) => r.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const ask = async (role: AdminRole, perm: Permission, on: boolean, label: string) => {
    if (busy || pending) return;
    setBusy(`${role.id}:${perm.id}`); setMsg(null);
    try {
      const users = await fetchUsers();
      const count = users.filter((u) => u.roles.some((rr) => rr.id === role.id)).length;
      setPending({ role, perm, on, label, count });
    } catch (e) {
      setMsg({ tone: 'error', text: (e as { message?: string })?.message || 'Could not load users.' });
    } finally { setBusy(null); }
  };
  const commit = async () => {
    if (!pending) return;
    const { role, perm, on, label } = pending;
    setPending(null); setBusy(`${role.id}:${perm.id}`); setMsg(null);
    try {
      await (on ? grant(role.id, perm.id) : revoke(role.id, perm.id));
      setMsg({ tone: 'success', text: `${label} ${on ? 'granted to' : 'removed from'} ${role.name}.` });
      setAttempt((n) => n + 1);
    } catch (e) { setMsg({ tone: 'error', text: (e as { message?: string })?.message || 'Could not save.' }); }
    finally { setBusy(null); }
  };

  return (
    <div className="rf2-jobs rf2-admin">
      <div>
        <h1 className="rf2-jobs__title">Roles</h1>
      </div>
      <div className="rf2-panel rf2-admin__card">
        <table className="rf2-jtable rf2-admin__matrix" aria-label="What each role can do">
          <thead><tr><th scope="col">Capability</th><th scope="col">Employee</th><th scope="col">Manager</th><th scope="col">Admin</th><th scope="col" className="rf2-admin__cap">Interviewer (capability)</th></tr></thead>
          {POLICY.map((g) => (
            <tbody key={g.group}>
              <tr className="rf2-admin__group"><th scope="rowgroup" colSpan={5}>{g.group}</th></tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {COLS.map((c) => { const [tone, text] = r[c]; const I = ICON[tone]; return <td key={c} data-tone={tone}><I aria-hidden="true" /> {text}</td>; })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <section className="rf2-panel rf2-admin__card" aria-labelledby="caps-h">
        <div className="rf2-row-between rf2-admin__head"><h2 id="caps-h" className="rf2-jtable__name">Capabilities granted on roles</h2><span className="rf2-jtable__sub">Permissions, not seats</span></div>
        {!data && !error ? <SkeletonV2 lines={3} label="Loading roles…" /> : null}
        {error ? <div role="alert"><EmptyStateV2 headingLevel={3} title="Could not load roles" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
        {msg ? <p className={msg.tone === 'error' ? 'rf2-form-error' : 'rf2-inline-note'} role={msg.tone === 'error' ? 'alert' : 'status'} data-tone={msg.tone}>{msg.text}</p> : null}
        {data ? CAPABILITIES.map((cap) => {
          const perm = data.perms.find((p) => p.code === cap.code);
          const legacy = data.roles.find((r) => r.code === cap.legacyRole && r.status === 'Active');
          return (
            <div key={cap.key} className="rf2-admin__capblock">
              <p className="rf2-jtable__name">{cap.label} <code className="rf2-admin__code">{cap.code}</code></p>
              <p className="rf2-jtable__sub">{cap.what}</p>
              {perm ? (
                <ul className="rf2-admin__grants" aria-label={`${cap.label} by role`}>
                  {roles.filter((r) => r.code !== cap.legacyRole).map((r) => {
                    const on = r.permissions.some((p) => p.id === perm.id || p.code === perm.code);
                    return (
                      <li key={r.id}>
                        <label className="rf2-check">
                          <input type="checkbox" checked={on} disabled={busy !== null || pending !== null} onChange={() => void ask(r, perm, !on, cap.label)} />
                          <span>{r.name}</span>
                        </label>
                        <span className="rf2-jtable__sub">{roleSeat(r) ? SEAT_LABEL[roleSeat(r)!] : 'Seat not mapped'}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rf2-inline-note" data-tone="warning"><Info aria-hidden="true" /> {cap.code} is not on this server yet.{legacy ? ` Today this is the “${legacy.name}” role; it moves to a permission when Backend lands R1.` : ''}</p>
              )}
            </div>
          );
        }) : null}
      </section>

      {data ? (
        <section className="rf2-panel rf2-admin__card" aria-labelledby="map-h">
          <div className="rf2-row-between rf2-admin__head"><h2 id="map-h" className="rf2-jtable__name">Production roles → seat</h2><span className="rf2-jtable__sub">{roles.length} active roles</span></div>
          <table className="rf2-jtable" aria-label="Production roles">
            <thead><tr><th scope="col">Role</th><th scope="col">Code</th><th scope="col">Seat</th><th scope="col">Permissions</th></tr></thead>
            <tbody>{roles.map((r) => (
              <tr key={r.id}><th scope="row">{r.name}</th><td><code className="rf2-admin__code">{r.code}</code></td>
                <td>{roleSeat(r) ? SEAT_LABEL[roleSeat(r)!] : <StatusChip tone="warning" label="Not mapped" />}</td><td className="rf2-num">{r.permissions.length}</td></tr>
            ))}</tbody>
          </table>
          <p className="rf2-jtable__sub">Seat comes from the server when it sends one; otherwise the provisional map (final map waits for the admin export, Roadmap §11).</p>
        </section>
      ) : null}
      <p className="rf2-inline-note"><ShieldCheck aria-hidden="true" /> Hidden means the page or action is absent from that role’s navigation. Interviewer is granted per interview, not as a fourth role.</p>
      {pending ? (
        <DrawerV2 open onClose={() => setPending(null)} kicker="Roles" title={capabilityChange(pending.count, pending.role.name)} subtitle={pending.label}
          primaryAction={<ButtonV2 onClick={() => void commit()}>Confirm</ButtonV2>}
          secondaryAction={<ButtonV2 kind="secondary" onClick={() => setPending(null)}>Cancel</ButtonV2>} />
      ) : null}
    </div>
  );
}
