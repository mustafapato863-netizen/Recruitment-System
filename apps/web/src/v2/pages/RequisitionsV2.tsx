import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, Info, Plus, RotateCw, Search, Target } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip } from '../../components/v2';
import { useAuth } from '../../auth/AuthContext';
import {
  dueOf, fetchContext, fetchGrades, fetchPeople, fetchRequisitions, formatDue, isClosed, isEditable, mineOrTeam, STATUS_LABEL, STATUS_TONE,
  type Grade, type Person, type ReqContext, type Requisition,
} from '../api/requisitions';
import { RequisitionDrawer, TargetDrawer } from '../drawers/RequisitionDrawers';
import './jobs.css';
import './requisitions.css';

type Data = { rows: Requisition[]; ctx: ReqContext | null; people: Person[] | null; grades: Grade[] | null };
type Filter = 'open' | 'active' | 'closed' | 'all';
const FILTERS: Record<Filter, { label: string; test: (r: Requisition) => boolean }> = {
  open: { label: 'In progress', test: (r) => !isClosed(r.status) },
  active: { label: 'Job active', test: (r) => r.status === 'Converted to Vacancy' },
  closed: { label: 'Cancelled or rejected', test: (r) => r.status === 'Cancelled' || r.status === 'Rejected' },
  all: { label: 'All', test: () => true },
};

function targetText(r: Requisition): string {
  if (r.status === 'Cancelled') return r.cancelReason ? `cancelled · ${r.cancelReason}` : 'cancelled';
  if (!dueOf(r)) return 'no target yet';
  return `target ${r.targetChip?.label ?? `0 of ${r.requestedHeadcount}`}`;
}

/** M1 Requisitions (Manager, v2): list, create, submit, activate, add target, cancel. */
export function RequisitionsV2() {
  const { user } = useAuth();
  const perms = useMemo(() => new Set(user?.permissions ?? []), [user]);
  const isAdmin = (user?.roles ?? []).some((r) => r.code === 'ADMINISTRATOR');
  const can = (p: string) => isAdmin || perms.has(p);
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: Data } | { kind: 'forbidden' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([fetchRequisitions(), fetchContext(), fetchPeople(), fetchGrades()])
      .then(([rows, ctx, people, grades]) => live && setState({ kind: 'ready', data: { rows, ctx, people, grades } }))
      .catch((e: { statusCode?: number; message?: string }) => live && setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' }));
    return () => { live = false; };
  }, [attempt]);

  const open = params.get('req');
  const drawer = params.get('drawer');
  const go = useCallback((req: string | null, d?: string) => {
    const n = new URLSearchParams(params);
    if (req) n.set('req', req); else n.delete('req');
    if (d) n.set('drawer', d); else n.delete('drawer');
    setParams(n);
  }, [params, setParams]);
  const done = (m: string) => { setToast(m); go(null); setAttempt((n) => n + 1); };

  const data = state.kind === 'ready' ? state.data : null;
  const scoped = data ? mineOrTeam(data.rows, user?.id, data.people) : [];
  const title = (r: Requisition) => r.position?.title ?? data?.ctx?.positions.find((p) => p.id === r.positionId)?.title ?? r.requestCode;
  const site = (r: Requisition) => data?.ctx?.branches.find((b) => b.id === r.branchId)?.name ?? '—';
  const owner = (r: Requisition) => (r.assignedEmployeeId ? data?.people?.find((p) => p.id === r.assignedEmployeeId)?.name ?? 'Assigned' : '—');
  const rows = scoped.filter((r) => FILTERS[filter].test(r) && (!q.trim() || `${title(r)} ${r.requestCode} ${site(r)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const current = open && open !== 'new' ? scoped.find((r) => r.id === open) ?? data?.rows.find((r) => r.id === open) ?? null : null;
  const canCreate = can('VACANCY_REQUEST_CREATE') && !!data?.ctx;
  const canActivate = can('VACANCY_MANAGE');

  return (
    <div className="rf2-jobs">
      <div className="rf2-row-between">
        <div>
          <h1 className="rf2-jobs__title">Requisitions</h1>
          <p className="rf2-jobs__sub">Requisitions for your team. Activate job turns an approved requisition into an open job in one step. Cancelled lives on the requisition.</p>
        </div>
        {canCreate ? <ButtonV2 icon={<Plus />} onClick={() => go('new')}>New requisition</ButtonV2> : null}
      </div>
      {toast ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {toast}</p> : null}
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading requisitions…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include requisitions." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load requisitions" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <>
          <div className="rf2-jobs__filters" role="search">
            <InputV2 label="Search requisitions" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search requisitions" leadingIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
            <SelectV2 label="Status" fieldClassName="rf2-sr-label" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              {(Object.keys(FILTERS) as Filter[]).map((k) => <option key={k} value={k}>{FILTERS[k].label}</option>)}
            </SelectV2>
            <p className="rf2-jobs__count" aria-live="polite">{rows.length} {rows.length === 1 ? 'requisition' : 'requisitions'}</p>
          </div>
          <section className="rf2-panel" aria-labelledby="req-h">
            <h2 id="req-h" className="rf2-sr-only">Requisitions</h2>
            {rows.length === 0 ? (
              <EmptyStateV2 headingLevel={3} title={scoped.length ? 'No requisitions match these filters' : 'No requisitions yet'} body={scoped.length ? 'Change the status filter or search.' : canCreate ? 'Start one with New requisition.' : 'Requisitions you raise or assign to your team show here.'} />
            ) : (
              <table className="rf2-jtable">
                <thead><tr><th scope="col">Requisition</th><th scope="col">Site</th><th scope="col">Seats</th><th scope="col">Due</th><th scope="col">Primary recruiter</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><button type="button" className="rf2-link rf2-jtable__name" onClick={() => go(r.id)}>{title(r)}</button><p className="rf2-jtable__sub">{r.requestCode} · {targetText(r)}</p></td>
                      <td>{site(r)}</td>
                      <td className="rf2-num">{r.requestedHeadcount}</td>
                      <td className="rf2-num">{formatDue(dueOf(r))}</td>
                      <td>{owner(r)}</td>
                      <td><StatusChip tone={STATUS_TONE[r.status]} label={r.status === 'Converted to Vacancy' ? 'Job active' : STATUS_LABEL[r.status]} /></td>
                      <td className="rf2-jtable__act">
                        {isEditable(r.status) || (r.status === 'Approved' && canActivate)
                          ? <ButtonV2 kind="secondary" size="sm" icon={<Target />} onClick={() => go(r.id, 'target')} aria-label={`${dueOf(r) ? 'Edit' : 'Add'} target: ${title(r)}`}>{dueOf(r) ? 'Edit target' : 'Add target'}</ButtonV2>
                          : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="rf2-inline-note"><Info aria-hidden="true" /> Statuses: Draft → Pending approval → Approved → Job active (via Activate job), or Cancelled with a reason. There is no pending-activation step.</p>
          {open === 'new' && canCreate ? <RequisitionDrawer req={null} ctx={data.ctx} people={data.people} grades={data.grades} canActivate={canActivate} onClose={() => go(null)} onDone={done} /> : null}
          {current && drawer === 'target' ? <TargetDrawer req={current} people={data.people} canActivate={canActivate} onClose={() => go(null)} onDone={done} /> : null}
          {current && drawer !== 'target' ? <RequisitionDrawer key={current.id} req={current} ctx={data.ctx} people={data.people} grades={data.grades} canActivate={canActivate} onClose={() => go(null)} onDone={done} /> : null}
        </>
      ) : null}
    </div>
  );
}
