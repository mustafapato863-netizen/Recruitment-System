import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase, Calendar, CircleCheck, ClipboardList, Clock, Code2, EllipsisVertical, Eye, FileText, FlaskConical, HeartPulse, Info, Pencil, Pill, Plus, RotateCw, ScanLine, Search, Target, Users,
  type LucideIcon,
} from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, initials, InputV2, SelectV2, StatusChip } from '../../components/v2';
import { useMediaQuery } from '../../components/ui/useMediaQuery';
import { useAuth } from '../../auth/AuthContext';
import {
  deptOf, dueOf, fetchContext, ownerIdOf, ownerOf, siteOf, TARGET_UPDATE_LIVE, titleOf, fetchGrades, fetchPeople, fetchRequisitions, formatDue, isEditable, mineOrTeam, STATUS_LABEL,
  type Grade, type Person, type ReqContext, type ReqStatus, type Requisition,
} from '../api/requisitions';
import { RequisitionDrawer, TargetDrawer } from '../drawers/RequisitionDrawers';
import { EditRequisitionView, RequisitionDetailView } from './RequisitionViews';
import './jobs.css';
import './requisitions.css';

export { EditRequisitionView, RequisitionDetailView } from './RequisitionViews';

type Data = { rows: Requisition[]; ctx: ReqContext | null; people: Person[] | null; grades: Grade[] | null };
type StatusFilter = 'all' | 'Filled' | ReqStatus;
type SortKey = 'due' | 'due-desc' | 'created' | 'title';
type DrawerMode = 'target' | 'detail' | 'edit';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Pending Approval', label: 'Pending approval' },
  { value: 'Changes Requested', label: 'Changes requested' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Converted to Vacancy', label: 'Job active' },
  { value: 'Filled', label: 'Filled' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Closed / cancelled' },
];
const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'due', label: 'Sort: Due date (earliest)' },
  { value: 'due-desc', label: 'Sort: Due date (latest)' },
  { value: 'created', label: 'Sort: Newest' },
  { value: 'title', label: 'Sort: Title' },
];
const ROW_TONE: Record<ReqStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  Draft: 'neutral',
  'Pending Approval': 'warning',
  'Changes Requested': 'danger',
  Approved: 'info',
  Rejected: 'danger',
  Cancelled: 'neutral',
  'Converted to Vacancy': 'success',
};

const isStatus = (value: string | null): value is StatusFilter => STATUS_FILTERS.some((item) => item.value === value);
const sortKeyOf = (value: string | null): SortKey => (value === 'due-desc' || value === 'created' || value === 'title' ? value : 'due');

/** A hiring target is the due date the manager set. The chip's seats are the request size until then. */
function hasTarget(r: Requisition): boolean {
  return dueOf(r) != null;
}

/** Filled is not an API status. It means a job-active requisition whose returned target is met. */
function isFilledReq(r: Requisition): boolean {
  const chip = r.targetChip;
  return r.status === 'Converted to Vacancy' && !!chip && chip.target > 0 && chip.filled >= chip.target && hasTarget(r);
}

function progressOf(r: Requisition): { text: string; pct: number | null } {
  if (!hasTarget(r)) return { text: '—', pct: null };
  const target = r.targetChip?.target ?? r.requestedHeadcount;
  if (!target || target <= 0) return { text: '—', pct: null };
  const filled = Math.max(0, r.targetChip?.filled ?? 0);
  const pct = Math.round((filled / target) * 100);
  return { text: `${filled} of ${target} (${pct}%)`, pct };
}

function statusLabel(r: Requisition): string {
  if (isFilledReq(r)) return 'Filled';
  return r.status === 'Converted to Vacancy' ? 'Job active' : STATUS_LABEL[r.status];
}

const FAMILY_RULES: Array<{ test: RegExp; Icon: LucideIcon; tone: 'info' | 'success' | 'warning' | 'neutral' }> = [
  { test: /\bnurs(?:e|ing|es)?\b/i, Icon: HeartPulse, tone: 'success' },
  { test: /\bradiolog|\bimaging\b|\bx-?rays?\b/i, Icon: ScanLine, tone: 'info' },
  { test: /\bpharmac/i, Icon: Pill, tone: 'info' },
  { test: /\bcoders?\b|\bcoding\b|\brevenue\b/i, Icon: Code2, tone: 'info' },
  { test: /\bcounsel|\bmental\b/i, Icon: Users, tone: 'success' },
  { test: /\blaborator(?:y|ies)\b|\blabs?\b/i, Icon: FlaskConical, tone: 'info' },
];

/** Icon for a requisition row. Keywords are matched on department, position, and specialty — not on a bare "tech" substring. */
export function requisitionFamily(department: string | null, title: string, specialty?: string | null): { Icon: LucideIcon; tone: 'info' | 'success' | 'warning' | 'neutral' } {
  const hay = `${department ?? ''} ${specialty ?? ''} ${title}`;
  return FAMILY_RULES.find((rule) => rule.test.test(hay)) ?? { Icon: Briefcase, tone: 'neutral' };
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function specialtyOf(r: Requisition): string | null {
  const fromPosition = r.position && typeof r.position === 'object' && 'specialty' in r.position ? r.position.specialty : null;
  return cleanText(r.specialty) ?? cleanText(r.specialtyName) ?? cleanText(fromPosition);
}

/** "Department · Position" from the payload. A part that only repeats the row title is omitted. */
export function requisitionSubline(r: Requisition, ctx: ReqContext | null): string | null {
  const department = cleanText(deptOf(r, ctx));
  const position = cleanText(r.positionTitle ?? r.position?.title ?? null);
  const specialty = specialtyOf(r);
  const title = cleanText(titleOf(r, ctx));
  const parts: string[] = [];
  if (department) parts.push(department);
  if (position && position !== department && (department || position !== title)) parts.push(position);
  if (specialty && !parts.includes(specialty) && specialty !== title) parts.push(specialty);
  return parts.length ? parts.join(' · ') : null;
}

function contextualAction(r: Requisition): { mode: DrawerMode; label: string; icon: ReactNode } {
  if (r.status === 'Draft' || r.status === 'Changes Requested') return { mode: 'edit', label: 'Continue draft', icon: <Pencil /> };
  if (r.status === 'Pending Approval') return { mode: 'detail', label: 'View request', icon: <FileText /> };
  if (r.status === 'Converted to Vacancy' && !isFilledReq(r)) {
    return hasTarget(r)
      ? { mode: 'target', label: 'Update target', icon: <Target /> }
      : { mode: 'target', label: 'Add target', icon: <Target /> };
  }
  return { mode: 'detail', label: 'View details', icon: <Eye /> };
}

type MenuItem = { label: string; aria: string; mode: DrawerMode | 'drawer' };

function overflowActions(r: Requisition, title: string, canActivate: boolean): MenuItem[] {
  const primary = contextualAction(r);
  const items: MenuItem[] = [];
  if (primary.mode !== 'detail') items.push({ label: 'Details', aria: `View details: ${title}`, mode: 'detail' });
  if ((isEditable(r.status) || canActivate) && primary.mode !== 'edit') items.push({ label: 'Edit', aria: `Edit requisition: ${title}`, mode: 'edit' });
  const canTarget = isEditable(r.status) || (r.status === 'Approved' && canActivate) || (r.status === 'Converted to Vacancy' && TARGET_UPDATE_LIVE);
  if (canTarget && primary.mode !== 'target') {
    const label = hasTarget(r) ? 'Update target' : 'Add target';
    items.push({ label, aria: `${label}: ${title}`, mode: 'target' });
  }
  if (r.status !== 'Cancelled' && r.status !== 'Rejected') items.push({ label: 'Close', aria: `Close requisition: ${title}`, mode: 'drawer' });
  return items;
}

function compareReq(a: Requisition, b: Requisition, sort: SortKey, title: (r: Requisition) => string): number {
  if (sort === 'title') return title(a).localeCompare(title(b), undefined, { sensitivity: 'base' });
  if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
  const ad = dueOf(a);
  const bd = dueOf(b);
  if (ad && bd && ad !== bd) return sort === 'due-desc' ? bd.localeCompare(ad) : ad.localeCompare(bd);
  if (ad && !bd) return -1;
  if (!ad && bd) return 1;
  return 0;
}

type ReqView = {
  id: string;
  name: string;
  sub: string | null;
  family: { Icon: LucideIcon; tone: 'info' | 'success' | 'warning' | 'neutral' };
  action: ReturnType<typeof contextualAction>;
  items: MenuItem[];
  progress: { text: string; pct: number | null };
  who: string;
  detail: string | null;
  siteName: string;
  due: string | null;
  dueLabel: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  status: string;
  cancelReason: string | null;
};

function ReqIdentity({ view, onOpen }: { view: ReqView; onOpen: () => void }) {
  const Icon = view.family.Icon;
  return (
    <div className="rf2-reqs__who">
      <span className="rf2-reqs__tile" data-tone={view.family.tone} aria-hidden="true"><Icon /></span>
      <div className="rf2-reqs__who-copy">
        <button type="button" className="rf2-link rf2-jtable__name" onClick={onOpen}>{view.name}</button>
        {view.sub ? <p className="rf2-jtable__sub rf2-reqs__sub" title={view.sub}>{view.sub}</p> : null}
      </div>
    </div>
  );
}

function ReqOwner({ view }: { view: ReqView }) {
  if (!view.who || view.who === '—') return '—';
  return (
    <span className="rf2-reqs__owner">
      <span className="rf2-avatar rf2-avatar--sm" aria-hidden="true">{initials(view.who)}</span>
      <span>
        <span className="rf2-reqs__owner-name">{view.who}</span>
        {view.detail ? <span className="rf2-jtable__sub">{view.detail}</span> : null}
      </span>
    </span>
  );
}

function ReqProgress({ view }: { view: ReqView }) {
  return (
    <div className="rf2-reqs__progress">
      <span className="rf2-num">{view.progress.text}</span>
      {view.progress.pct != null ? (
        <div className="rf2-req__meter rf2-reqs__meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.progress.pct} aria-valuetext={view.progress.text} aria-label={`Hiring progress for ${view.name}`}>
          <span style={{ width: `${view.progress.pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function ReqActions({ view, open, onOpen, onMenu }: {
  view: ReqView;
  open: boolean;
  onOpen: (mode: DrawerMode) => void;
  onMenu: (id: string, button: HTMLButtonElement) => void;
}) {
  return (
    <div className="rf2-reqs__acts">
      <ButtonV2 kind="secondary" size="sm" icon={view.action.icon} aria-label={`${view.action.label}: ${view.name}`} onClick={() => onOpen(view.action.mode)}>{view.action.label}</ButtonV2>
      {view.items.length > 0 ? (
        <ButtonV2
          kind="tertiary"
          size="sm"
          icon={<EllipsisVertical />}
          aria-label={`More actions: ${view.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `req-menu-${view.id}` : undefined}
          data-req-menu={view.id}
          onClick={(event) => onMenu(view.id, event.currentTarget)}
        >
          <span className="rf2-sr-only">More</span>
        </ButtonV2>
      ) : null}
    </div>
  );
}

/** M1 Requisitions (Manager, v2): list, create, activate, add target, cancel. */
export function RequisitionsV2() {
  const { user } = useAuth();
  const perms = new Set(user?.permissions ?? []);
  const isAdmin = (user?.roles ?? []).some((r) => r.code === 'ADMINISTRATOR');
  const can = (p: string) => isAdmin || perms.has(p);
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: Data } | { kind: 'forbidden' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const compactRows = useMediaQuery('(max-width: 767px)');
  const status: StatusFilter = isStatus(params.get('status')) ? params.get('status') as StatusFilter : 'all';
  const q = params.get('q') ?? '';
  const siteQ = params.get('site') ?? '';
  const ownerQ = params.get('owner') ?? '';
  const sort = sortKeyOf(params.get('sort'));
  const setList = useCallback((patch: { q?: string; status?: string; site?: string; owner?: string; due?: string; sort?: string; desk?: string }) => {
    const n = new URLSearchParams(params);
    const put = (key: string, value: string | undefined, blank: string) => {
      if (value === undefined) return;
      if (!value || value === blank) n.delete(key);
      else n.set(key, value);
    };
    put('q', patch.q, '');
    put('status', patch.status, 'all');
    put('site', patch.site, '');
    put('owner', patch.owner, '');
    put('due', patch.due, '');
    put('sort', patch.sort, 'due');
    put('desk', patch.desk, '');
    setMenu(null);
    setParams(n);
  }, [params, setParams]);

  useEffect(() => {
    let live = true;
    Promise.all([fetchRequisitions(), fetchContext(), fetchPeople(), fetchGrades()])
      .then(([rows, ctx, people, grades]) => live && setState({ kind: 'ready', data: { rows, ctx, people, grades } }))
      .catch((e: { statusCode?: number; message?: string }) => live && setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' }));
    return () => { live = false; };
  }, [attempt]);

  useEffect(() => {
    if (!menu) return undefined;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (menuRef.current?.contains(event.target as Node)) return;
      if (target?.closest('[data-req-menu]')) return;
      setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const open = params.get('req');
  const drawer = params.get('drawer');
  const go = useCallback((req: string | null, d?: string) => {
    const n = new URLSearchParams(params);
    if (req) n.set('req', req); else n.delete('req');
    if (d) n.set('drawer', d); else n.delete('drawer');
    n.delete('view');
    n.delete('mode');
    setMenu(null);
    setParams(n);
  }, [params, setParams]);
  const done = (m: string) => { setToast(m); go(null); setAttempt((n) => n + 1); };

  const data = state.kind === 'ready' ? state.data : null;
  const scoped = data ? mineOrTeam(data.rows, user?.id, data.people) : [];
  const title = (r: Requisition) => titleOf(r, data?.ctx ?? null);
  const site = (r: Requisition) => siteOf(r, data?.ctx ?? null);
  const owner = (r: Requisition) => ownerOf(r, data?.people ?? null);
  const sites = [...new Set(scoped.map((r) => site(r)).filter((name) => name && name !== '—'))].sort((a, b) => a.localeCompare(b));
  const owners = [...new Set(scoped.map((r) => owner(r)).filter((name) => name && name !== '—' && name !== 'Assigned'))].sort((a, b) => a.localeCompare(b));
  const rows = scoped.filter((r) => {
    if (status === 'Filled') { if (!isFilledReq(r)) return false; }
    else if (status !== 'all' && r.status !== status) return false;
    if (siteQ && site(r) !== siteQ) return false;
    if (ownerQ && owner(r) !== ownerQ) return false;
    const hay = `${title(r)} ${r.requestCode} ${site(r)} ${owner(r)} ${deptOf(r, data?.ctx ?? null) ?? ''}`;
    return !q.trim() || hay.toLowerCase().includes(q.trim().toLowerCase());
  }).sort((a, b) => compareReq(a, b, sort, title));
  const counts = {
    total: scoped.length,
    active: scoped.filter((r) => r.status === 'Converted to Vacancy').length,
    pending: scoped.filter((r) => r.status === 'Pending Approval').length,
    filled: scoped.filter((r) => isFilledReq(r)).length,
  };
  const current = open && open !== 'new' ? scoped.find((r) => r.id === open) ?? null : null;
  const viewParam = params.get('view');
  const modeParam = params.get('mode');
  const showTarget = Boolean(current && drawer === 'target');
  const showEdit = Boolean(current && !showTarget && (drawer === 'edit' || (modeParam === 'edit' && drawer !== 'detail')));
  const showDetail = Boolean(current && !showTarget && !showEdit && (drawer === 'detail' || viewParam === 'detail'));
  const filtersActive = Boolean(q || status !== 'all' || siteQ || ownerQ || sort !== 'due' || params.get('due') || params.get('desk'));
  const outsideScope = Boolean(open && open !== 'new' && data && !current);
  const canCreate = can('VACANCY_REQUEST_CREATE') && !!data?.ctx;
  const canActivate = can('VACANCY_MANAGE');
  const present = (r: Requisition): ReqView => {
    const name = title(r);
    const who = owner(r);
    const ownerId = ownerIdOf(r);
    const person = ownerId ? data?.people?.find((p) => p.id === ownerId) : data?.people?.find((p) => p.name === who);
    const due = dueOf(r);
    return {
      id: r.id,
      name,
      sub: requisitionSubline(r, data?.ctx ?? null),
      family: requisitionFamily(deptOf(r, data?.ctx ?? null), name, specialtyOf(r)),
      action: contextualAction(r),
      items: overflowActions(r, name, canActivate),
      progress: progressOf(r),
      who,
      detail: person?.detail ?? null,
      siteName: site(r),
      due,
      dueLabel: due ? formatDue(due) : '—',
      tone: isFilledReq(r) ? 'success' : ROW_TONE[r.status],
      status: statusLabel(r),
      cancelReason: r.cancelReason ?? null,
    };
  };
  const toggleMenu = (id: string, button: HTMLButtonElement) => {
    if (menu?.id === id) { setMenu(null); return; }
    const rect = button.getBoundingClientRect();
    setMenu({ id, top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
  };
  const canDecide = can('VACANCY_REQUEST_APPROVE');
  const clearFilters = () => setList({ q: '', status: 'all', site: '', owner: '', due: '', sort: 'due', desk: '' });
  const menuRow = menu ? rows.find((r) => r.id === menu.id) ?? scoped.find((r) => r.id === menu.id) ?? null : null;

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    if (event.key === 'End') { event.preventDefault(); items[items.length - 1]?.focus(); }
  };

  return (
    <div className="rf2-jobs rf2-reqs">
      <div className="rf2-row-between">
        <div>
          <h1 className="rf2-jobs__title">Requisitions</h1>
          <p className="rf2-jobs__sub">Create, track, and manage your team&apos;s hiring requisitions from request to fill.</p>
        </div>
        {canCreate && !showDetail && !showEdit ? <ButtonV2 icon={<Plus />} onClick={() => go('new')}>New requisition</ButtonV2> : null}
      </div>
      {toast ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {toast}</p> : null}
      {state.kind === 'loading' ? (
        <div role="status" aria-busy="true" aria-label="Loading requisitions">
          <div className="rf2-reqs__cards" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="rf2-reqs__card rf2-reqs__card--skel"><span className="rf2-skeleton__line" /></div>)}
          </div>
          <div className="rf2-reqs__skel" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="rf2-reqs__skel-row"><span className="rf2-skeleton__line" /></div>)}
          </div>
        </div>
      ) : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include requisitions." /> : null}
      {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load requisitions" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data && showDetail && current ? (
        <RequisitionDetailView key={current.id} current={current} ctx={data.ctx} people={data.people} me={user ? { id: user.id, name: user.displayName } : null} go={go} />
      ) : null}
      {data && showEdit && current ? (
        <EditRequisitionView key={current.id} current={current} ctx={data.ctx} people={data.people} go={go} onDone={done} />
      ) : null}
      {data && !showDetail && !showEdit ? (
        <>
          <div className="rf2-reqs__cards" role="group" aria-label="Requisition summary">
            <SummaryCard icon={<ClipboardList />} tone="info" label="Total requisitions" count={counts.total} pressed={status === 'all'} onClick={() => setList({ status: 'all' })} />
            <SummaryCard icon={<CircleCheck />} tone="success" label="Active" name="Active (job active)" count={counts.active} pressed={status === 'Converted to Vacancy'} onClick={() => setList({ status: 'Converted to Vacancy' })} />
            <SummaryCard icon={<Clock />} tone="warning" label="Pending approval" count={counts.pending} pressed={status === 'Pending Approval'} alert={counts.pending > 0} onClick={() => setList({ status: 'Pending Approval' })} />
            <SummaryCard icon={<Briefcase />} tone="success" label="Filled" count={counts.filled} pressed={status === 'Filled'} onClick={() => setList({ status: 'Filled' })} />
          </div>
          <div className="rf2-reqs__toolbar" role="search">
            <div className="rf2-reqs__filters">
              <InputV2 label="Search requisitions" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search requisitions" leadingIcon={<Search />} value={q} onChange={(e) => setList({ q: e.target.value })} />
              <SelectV2 label="Site" fieldClassName="rf2-sr-label" value={siteQ} onChange={(e) => setList({ site: e.target.value })}>
                <option value="">All sites</option>
                {sites.map((name) => <option key={name} value={name}>{name}</option>)}
              </SelectV2>
              <SelectV2 label="Status" fieldClassName="rf2-sr-label" value={status} onChange={(e) => setList({ status: e.target.value })}>
                {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </SelectV2>
              <SelectV2 label="Owner" fieldClassName="rf2-sr-label" value={ownerQ} onChange={(e) => setList({ owner: e.target.value })}>
                <option value="">All owners</option>
                {owners.map((name) => <option key={name} value={name}>{name}</option>)}
                {ownerQ && !owners.includes(ownerQ) ? <option value={ownerQ}>{ownerQ}</option> : null}
              </SelectV2>
            </div>
            <div className="rf2-reqs__sort">
              <SelectV2 label="Sort" fieldClassName="rf2-sr-label" value={sort} onChange={(e) => setList({ sort: e.target.value })}>
                {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </SelectV2>
              {filtersActive && rows.length > 0 ? <ButtonV2 kind="secondary" size="sm" onClick={clearFilters}>Clear filters</ButtonV2> : null}
              <p className="rf2-jobs__count" aria-live="polite">{rows.length} {rows.length === 1 ? 'requisition' : 'requisitions'}</p>
            </div>
          </div>
          <section className="rf2-panel" aria-labelledby="req-h">
            <h2 id="req-h" className="rf2-sr-only">Requisition list</h2>
            {rows.length === 0 ? (
              <EmptyStateV2 headingLevel={3} title={scoped.length ? 'No requisitions match these filters' : 'No requisitions yet'} body={scoped.length ? 'Change the status, site, owner, or search.' : canCreate ? 'Start one with New requisition.' : 'Requisitions you raise or assign to your team show here.'} action={scoped.length && filtersActive ? <ButtonV2 kind="secondary" onClick={clearFilters}>Clear filters</ButtonV2> : null} />
            ) : compactRows ? (
              <ul className="rf2-reqs__list">
                {rows.map((r) => {
                  const view = present(r);
                  return (
                    <li key={r.id} className="rf2-reqs__rowcard">
                      <div className="rf2-reqs__rowcard-top">
                        <ReqIdentity view={view} onOpen={() => go(r.id)} />
                        <StatusChip tone={view.tone} label={view.status} />
                      </div>
                      <p className="rf2-reqs__meta">{r.requestCode} · {view.siteName}</p>
                      <p className="rf2-reqs__meta">{r.requestedHeadcount} {r.requestedHeadcount === 1 ? 'seat' : 'seats'} · {view.dueLabel}</p>
                      <ReqOwner view={view} />
                      <ReqProgress view={view} />
                      {view.cancelReason ? <p className="rf2-jtable__sub">Cancelled · {view.cancelReason}</p> : null}
                      <ReqActions view={view} open={menu?.id === r.id} onOpen={(mode) => go(r.id, mode)} onMenu={toggleMenu} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rf2-jscroll">
                <table className="rf2-jtable">
                  <thead>
                    <tr>
                      <th scope="col">Requisition</th>
                      <th scope="col">ID</th>
                      <th scope="col">Site</th>
                      <th scope="col">Seats</th>
                      <th scope="col">Due date</th>
                      <th scope="col">Primary recruiter</th>
                      <th scope="col">Status</th>
                      <th scope="col">Progress</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const view = present(r);
                      return (
                        <tr key={r.id}>
                          <td><ReqIdentity view={view} onOpen={() => go(r.id)} /></td>
                          <td className="rf2-num">{r.requestCode}</td>
                          <td>{view.siteName}</td>
                          <td className="rf2-num">{r.requestedHeadcount}</td>
                          <td className="rf2-num">{view.due ? <span className="rf2-reqs__due"><Calendar aria-hidden="true" />{view.dueLabel}</span> : '—'}</td>
                          <td><ReqOwner view={view} /></td>
                          <td>
                            <StatusChip tone={view.tone} label={view.status} />
                            {view.cancelReason ? <p className="rf2-jtable__sub">Cancelled · {view.cancelReason}</p> : null}
                          </td>
                          <td><ReqProgress view={view} /></td>
                          <td className="rf2-jtable__act"><ReqActions view={view} open={menu?.id === r.id} onOpen={(mode) => go(r.id, mode)} onMenu={toggleMenu} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {menu && menuRow ? (
            <div
              ref={menuRef}
              id={`req-menu-${menuRow.id}`}
              role="menu"
              aria-label={`More actions: ${title(menuRow)}`}
              className="rf2-menu rf2-reqs__menu"
              style={{ top: menu.top, right: menu.right }}
              onKeyDown={onMenuKey}
            >
              {overflowActions(menuRow, title(menuRow), canActivate).map((item) => (
                <button
                  key={item.aria}
                  type="button"
                  role="menuitem"
                  className="rf2-menu__item"
                  aria-label={item.aria}
                  onClick={() => go(menuRow.id, item.mode === 'drawer' ? undefined : item.mode)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="rf2-reqs__banner" role="note">
            <Info aria-hidden="true" />
            <div>
              <p>Requisitions follow an approval flow: Draft → Pending approval → Job active. Once approved, you can set targets, track progress, and manage the requisition until it is filled.</p>
              <details className="rf2-reqs__rules">
                <summary>Learn activation and approval rules</summary>
                <ul>
                  <li>Drafts with a due date and an eligible owner activate directly under policy.</li>
                  <li>Submitted requisitions stay Pending approval until approved, returned for changes, or declined.</li>
                  <li>{'"0 of X" operational fill progress is distinct from "No target" until a hiring target is set.'}</li>
                </ul>
              </details>
            </div>
          </div>
          {outsideScope ? <p className="rf2-inline-note" role="status">That requisition is not in your team or organization.</p> : null}
          {open === 'new' && canCreate ? <RequisitionDrawer req={null} ctx={data.ctx} people={data.people} grades={data.grades} canActivate={canActivate} canDecide={canDecide} meId={user?.id} onClose={() => go(null)} onDone={done} /> : null}
          {showTarget && current ? <TargetDrawer req={current} people={data.people} canActivate={canActivate} meId={user?.id} onClose={() => go(null)} onDone={done} /> : null}
          {current && !showTarget && !showDetail && !showEdit ? <RequisitionDrawer key={current.id} req={current} ctx={data.ctx} people={data.people} grades={data.grades} canActivate={canActivate} canDecide={canDecide} meId={user?.id} onClose={() => go(null)} onDone={done} /> : null}
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ icon, tone, label, name, count, pressed, alert, onClick }: {
  icon: ReactNode;
  tone: 'info' | 'success' | 'warning' | 'neutral';
  label: string;
  name?: string;
  count: number;
  pressed: boolean;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="rf2-reqs__card" aria-pressed={pressed} aria-label={`${name ?? label}, ${count}`} onClick={onClick}>
      <span className="rf2-reqs__tile" data-tone={tone} aria-hidden="true">{icon}</span>
      <span className="rf2-reqs__card-copy">
        <span className="rf2-reqs__card-n" data-tone={alert ? 'danger' : undefined}>{count}</span>
        <span className="rf2-reqs__card-k">{label}</span>
      </span>
    </button>
  );
}
