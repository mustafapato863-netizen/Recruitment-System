import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { UserRecord } from '@recruitflow/contracts';
import { fetchApi, patchApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { PageState } from '../components/ui/PageState';

interface TreeNode {
  user: UserRecord;
  children: TreeNode[];
}

function buildForest(users: UserRecord[]): TreeNode[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const childrenOf = new Map<string, UserRecord[]>();
  const roots: UserRecord[] = [];
  for (const user of users) {
    const manager = user.managerId ? byId.get(user.managerId) : undefined;
    if (manager) {
      const list = childrenOf.get(manager.id) ?? [];
      list.push(user);
      childrenOf.set(manager.id, list);
    } else {
      roots.push(user);
    }
  }
  const sortByName = (a: UserRecord, b: UserRecord) => a.displayName.localeCompare(b.displayName);
  const toNode = (user: UserRecord, trail: Set<string>): TreeNode => ({
    user,
    children: (childrenOf.get(user.id) ?? []).slice().sort(sortByName)
      .filter((child) => !trail.has(child.id))
      .map((child) => toNode(child, new Set(trail).add(child.id))),
  });
  return roots.slice().sort(sortByName).map((root) => toNode(root, new Set([root.id])));
}

function collectDescendantIds(node: TreeNode): Set<string> {
  const ids = new Set<string>();
  const walk = (current: TreeNode) => {
    for (const child of current.children) {
      ids.add(child.user.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').substring(0, 2).toUpperCase() || '—';
}

function UserCard({
  node,
  managerName,
  allUsers,
  canManage,
  savingId,
  onAssignManager,
}: {
  node: TreeNode;
  managerName?: string;
  allUsers: UserRecord[];
  canManage: boolean;
  savingId: string | null;
  onAssignManager: (userId: string, managerId: string | null) => void;
}) {
  const { user } = node;
  const roleLabel = user.roles?.[0]?.name ?? 'Team Member';
  const descendantIds = useMemo(() => collectDescendantIds(node), [node]);
  const managerOptions = useMemo(
    () => allUsers.filter((candidate) => candidate.id !== user.id && !descendantIds.has(candidate.id)),
    [allUsers, descendantIds, user.id],
  );

  return (
    <div className="rf-reporting-card rounded-2xl border border-rf-border-subtle bg-rf-surface p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rf-action/20 bg-rf-action-soft text-sm font-bold text-rf-action">
          {getInitials(user.displayName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-rf-ink">{user.displayName}</div>
          <div className="truncate text-xs text-rf-ink-muted">{user.jobTitle || roleLabel}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-rf-border-subtle bg-rf-surface-subtle px-2 py-0.5 text-[10.5px] font-bold text-rf-ink">
          <Icon name="users" size={11} />
          {node.children.length} reporting
        </span>
        {user.roles?.slice(0, 2).map((role) => (
          <span key={role.id} className="rounded-full border border-rf-border-subtle bg-rf-surface-subtle px-2 py-0.5 text-[10.5px] font-semibold text-rf-ink-muted">
            {role.name}
          </span>
        ))}
      </div>
      {canManage ? (
        <label className="mt-3 block text-[11px] font-semibold text-rf-ink-muted">
          Reports to
          <select
            className="mt-1 w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5 text-xs text-rf-ink"
            value={user.managerId ?? ''}
            disabled={savingId === user.id}
            onChange={(event) => onAssignManager(user.id, event.target.value || null)}
            aria-label={`Select manager for ${user.displayName}`}
          >
            <option value="">No manager (top level)</option>
            {managerOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName}{candidate.jobTitle ? ` — ${candidate.jobTitle}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="mt-3 text-[11px] font-medium text-rf-ink-muted">
          Reports to: <span className="font-bold text-rf-ink">{managerName ?? 'Top level'}</span>
        </div>
      )}
    </div>
  );
}

interface ChartEdge {
  id: string;
  d: string;
}

/**
 * Flatten the forest into breadth-first levels for the chart. Nodes already
 * visited (e.g. reachable through a second path) stay at their first level
 * so every user renders exactly once.
 */
function flattenLevels(forest: TreeNode[]): TreeNode[][] {
  const levels: TreeNode[][] = [];
  const seen = new Set<string>();
  let current = forest.filter((node) => {
    if (seen.has(node.user.id)) return false;
    seen.add(node.user.id);
    return true;
  });
  while (current.length > 0) {
    levels.push(current);
    const next: TreeNode[] = [];
    for (const node of current) {
      for (const child of node.children) {
        if (!seen.has(child.user.id)) {
          seen.add(child.user.id);
          next.push(child);
        }
      }
    }
    current = next;
  }
  return levels;
}

/**
 * Auto-drawn org chart: one centered row per hierarchy level with SVG
 * connectors measured from the rendered cards, so the drawing always fills
 * the available page area and stays correct as links change.
 */
function ReportingChart({
  levels,
  usersById,
  allUsers,
  canManage,
  savingId,
  onAssignManager,
}: {
  levels: TreeNode[][];
  usersById: Map<string, UserRecord>;
  allUsers: UserRecord[];
  canManage: boolean;
  savingId: string | null;
  onAssignManager: (userId: string, managerId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [edges, setEdges] = useState<ChartEdge[]>([]);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [measureKey, setMeasureKey] = useState(0);

  useEffect(() => {
    const onResize = () => setMeasureKey((key) => key + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const next: ChartEdge[] = [];
    for (const row of levels) {
      for (const node of row) {
        const managerId = node.user.managerId;
        if (!managerId || !usersById.has(managerId)) continue;
        const parentEl = cardRefs.current.get(managerId);
        const childEl = cardRefs.current.get(node.user.id);
        if (!parentEl || !childEl) continue;
        const parent = parentEl.getBoundingClientRect();
        const child = childEl.getBoundingClientRect();
        const x1 = parent.left + parent.width / 2 - bounds.left;
        const y1 = parent.bottom - bounds.top;
        const x2 = child.left + child.width / 2 - bounds.left;
        const y2 = child.top - bounds.top;
        const midY = (y1 + y2) / 2;
        next.push({ id: node.user.id, d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}` });
      }
    }
    setEdges(next);
    setCanvas({ width: container.scrollWidth, height: container.scrollHeight });
  }, [levels, usersById, canManage, measureKey]);

  return (
    <div ref={containerRef} className="relative mx-auto w-fit min-w-full px-2 py-2">
      <svg
        className="pointer-events-none absolute inset-0"
        width={canvas.width}
        height={canvas.height}
        data-testid="reporting-tree-edges"
        aria-hidden="true"
      >
        {edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.d}
            fill="none"
            strokeWidth={2}
            opacity={0.55}
            style={{ stroke: 'var(--color-rf-action, #2563eb)' }}
          />
        ))}
      </svg>
      <div className="relative flex flex-col gap-16">
        {levels.map((row, index) => (
          <div key={row.map((node) => node.user.id).join('|')}>
            <div className="mb-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-rf-ink-muted">
              Level {index + 1} · {row.length} {row.length === 1 ? 'member' : 'members'}
            </div>
            <div className="flex justify-center gap-8">
              {row.map((node) => (
                <div
                  key={node.user.id}
                  className="w-[248px] shrink-0"
                  ref={(element) => {
                    if (element) cardRefs.current.set(node.user.id, element);
                    else cardRefs.current.delete(node.user.id);
                  }}
                >
                  <UserCard
                    node={node}
                    managerName={node.user.managerId ? usersById.get(node.user.managerId)?.displayName ?? 'Assigned' : undefined}
                    allUsers={allUsers}
                    canManage={canManage}
                    savingId={savingId}
                    onAssignManager={onAssignManager}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportingTreePage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = Boolean(user?.permissions?.includes('USERS_MANAGE'));

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchApi<UserRecord[] | { data?: UserRecord[] }>('/users');
      setUsers(Array.isArray(res) ? res : res.data ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load reporting tree.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAssignManager = useCallback(async (userId: string, managerId: string | null) => {
    setSavingId(userId);
    setNotice(null);
    try {
      await patchApi(`/users/${userId}`, { managerId });
      setNotice('Reporting line updated.');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to update reporting line.');
    } finally {
      setSavingId(null);
    }
  }, [load]);

  const forest = useMemo(() => buildForest(users), [users]);
  const usersById = useMemo(() => new Map(users.map((candidate) => [candidate.id, candidate])), [users]);
  const levels = useMemo(() => flattenLevels(forest), [forest]);
  const flatMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    return users.filter((candidate) =>
      candidate.displayName.toLowerCase().includes(query)
      || candidate.email.toLowerCase().includes(query)
      || (candidate.jobTitle ?? '').toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  if (isLoading) {
    return <PageState kind="loading" title="Loading reporting tree..." description="Fetching users and reporting lines" />;
  }

  if (loadError) {
    return <PageState kind="error" title="Unable to load reporting tree" description={loadError} actionLabel="Retry" onAction={() => void load()} />;
  }

  return (
    <div className="page mx-auto flex min-h-screen w-full flex-col px-4 py-5 sm:px-6 lg:px-[26px] lg:py-7">
      <header className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-rf-ink-muted">Governance</div>
            <h1 className="mt-1 text-xl font-extrabold text-rf-ink">Reporting Tree</h1>
            <p className="mt-1 text-xs text-rf-ink-muted">
              {canManage
                ? 'Link who reports to whom. Team leaders can then assign tasks only to their own team.'
                : 'View only — contact an administrator to change reporting lines.'}
            </p>
          </div>
          <label className="flex min-w-[220px] items-center gap-2 rounded-xl border border-rf-border bg-rf-surface-subtle px-3 py-2 text-xs text-rf-ink-muted">
            <Icon name="search" size={14} />
            <input
              className="w-full bg-transparent text-xs text-rf-ink outline-none"
              placeholder="Search name, email, title..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search users"
            />
          </label>
        </div>
        {notice && (
          <div className="mt-3 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle px-3 py-2 text-xs font-semibold text-rf-ink" role="status">
            {notice}
          </div>
        )}
      </header>

      <section className="mt-4 overflow-x-auto pb-6" aria-label="Reporting hierarchy">
        {flatMatches ? (
          flatMatches.length === 0 ? (
            <PageState kind="empty" title="No users match your search" description="Try a different name, email, or job title." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {flatMatches.map((match) => (
                <UserCard
                  key={match.id}
                  node={{ user: match, children: [] }}
                  managerName={match.managerId ? usersById.get(match.managerId)?.displayName ?? 'Assigned' : undefined}
                  allUsers={users}
                  canManage={canManage}
                  savingId={savingId}
                  onAssignManager={handleAssignManager}
                />
              ))}
            </div>
          )
        ) : forest.length === 0 ? (
          <PageState kind="empty" title="No users yet" description="Users appear here once they are added to the organization." />
        ) : (
          <ReportingChart
            levels={levels}
            usersById={usersById}
            allUsers={users}
            canManage={canManage}
            savingId={savingId}
            onAssignManager={handleAssignManager}
          />
        )}
      </section>
    </div>
  );
}
