import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Focus,
  Hand,
  Layers,
  ListTree,
  Maximize2,
  Minimize2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { fetchApi, patchApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import {
  ButtonV2,
  EmptyStateV2,
  ErrorStateV2,
  InputV2,
  SelectV2,
  SkeletonV2,
} from '../../components/v2';
import { AdminWorkspaceHeader } from './AdminWorkspaceHeader';
import {
  type AdminUser,
  buildTree,
  flatten,
  flattenLevels,
  isActive,
  seatLabel,
  seatOf,
  subLine,
  type TreeNode,
} from './usersApi';
import './admin.css';

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '—'
  );
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

interface ChartEdge {
  id: string;
  parentId: string;
  d: string;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Executive & Top Leadership',
  2: 'Department Heads & Branch Leads',
  3: 'Team Leads & Supervisors',
  4: 'Specialists & Senior Staff',
  5: 'Team Members & Associates',
};

function OrgCard({
  node,
  managerName,
  allUsers,
  canManage,
  savingId,
  isHighlighted,
  onAssignManager,
  onFocusSubtree,
  isSubtreeFocused,
  onHover,
}: {
  node: TreeNode;
  managerName?: string;
  allUsers: AdminUser[];
  canManage: boolean;
  savingId: string | null;
  isHighlighted?: boolean;
  onAssignManager: (userId: string, managerId: string | null) => void;
  onFocusSubtree?: (userId: string) => void;
  isSubtreeFocused?: boolean;
  onHover?: (userId: string | null) => void;
}) {
  const { user } = node;
  const descendantIds = useMemo(() => collectDescendantIds(node), [node]);
  const managerOptions = useMemo(
    () =>
      allUsers.filter(
        (candidate) =>
          candidate.id !== user.id && !descendantIds.has(candidate.id),
      ),
    [allUsers, descendantIds, user.id],
  );

  const seat = seatOf(user);
  const directsCount = node.children.length;
  const hasReports = directsCount > 0;
  const isRoot = !user.managerId;
  const isUnassigned = isRoot && seat === 'employee';

  return (
    <div
      className={`rf2-org-card ${isRoot ? 'rf2-org-card--root' : ''} ${hasReports ? 'rf2-org-card--manager' : ''} ${isUnassigned ? 'rf2-org-card--unassigned' : ''} ${isHighlighted ? 'rf2-org-card--highlighted' : ''}`}
      data-user-id={user.id}
      onMouseEnter={() => onHover?.(user.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="rf2-org-card__header">
        <div
          className={`rf2-org-card__avatar rf2-org-card__avatar--${seat}`}
          aria-hidden="true"
        >
          {getInitials(user.displayName)}
        </div>
        <div className="rf2-org-card__identity">
          <div className="rf2-org-card__name-row">
            <span className="rf2-org-card__name" title={user.displayName}>
              {user.displayName}
            </span>
          </div>
          <span className="rf2-org-card__title" title={user.jobTitle || subLine(user)}>
            {user.jobTitle || subLine(user)}
          </span>
        </div>
      </div>

      <div className="rf2-org-card__chips">
        <span
          className={`rf2-org-card__pill rf2-org-card__pill--${seat}`}
          title={`Seat: ${seatLabel(user)}`}
        >
          {seatLabel(user)}
        </span>
        {user.branchName ? (
          <span className="rf2-org-card__pill rf2-org-card__pill--branch" title={user.branchName}>
            {user.branchName}
          </span>
        ) : null}
        {hasReports ? (
          <span className="rf2-org-card__pill rf2-org-card__pill--reports">
            <Users size={12} aria-hidden="true" /> {directsCount} reporting
          </span>
        ) : null}
      </div>

      <div className="rf2-org-card__line">
        {canManage ? (
          <label className="rf2-org-card__label">
            <span className="rf2-org-card__label-text">Reports to</span>
            <select
              className="rf2-org-card__select"
              value={user.managerId ?? ''}
              disabled={savingId === user.id}
              onChange={(e) => onAssignManager(user.id, e.target.value || null)}
              aria-label={`Select manager for ${user.displayName}`}
            >
              <option value="">No manager (top level)</option>
              {managerOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.displayName}
                  {candidate.jobTitle ? ` — ${candidate.jobTitle}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="rf2-org-card__viewonly-line">
            <span className="rf2-org-card__label-text">Reports to:</span>
            <span className="rf2-org-card__manager-name">
              {managerName ?? 'Top level'}
            </span>
          </div>
        )}
      </div>

      {hasReports && onFocusSubtree ? (
        <div className="rf2-org-card__footer">
          <button
            type="button"
            className="rf2-org-card__subtree-btn"
            onClick={() => onFocusSubtree(user.id)}
            title={isSubtreeFocused ? 'Reset to full organization' : `Focus on ${user.displayName}'s team`}
          >
            {isSubtreeFocused ? (
              <>
                <Minimize2 size={12} aria-hidden="true" />
                <span>Show full org</span>
              </>
            ) : (
              <>
                <Maximize2 size={12} aria-hidden="true" />
                <span>Focus team ({directsCount})</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function measureOffsetRelativeTo(
  el: HTMLElement,
  ancestor: HTMLElement,
): { left: number; top: number; width: number; height: number } | null {
  let left = 0;
  let top = 0;
  let curr: HTMLElement | null = el;
  while (curr && curr !== ancestor) {
    left += curr.offsetLeft;
    top += curr.offsetTop;
    curr = curr.offsetParent as HTMLElement | null;
  }
  if (curr !== ancestor) return null;
  return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

function ReportingChart({
  levels,
  usersById,
  allUsers,
  canManage,
  savingId,
  hoveredUserId,
  onHover,
  onAssignManager,
  onFocusSubtree,
  focusedSubtreeId,
  zoom = 0.6,
}: {
  levels: TreeNode[][];
  usersById: Map<string, AdminUser>;
  allUsers: AdminUser[];
  canManage: boolean;
  savingId: string | null;
  hoveredUserId: string | null;
  onHover: (id: string | null) => void;
  onAssignManager: (userId: string, managerId: string | null) => void;
  onFocusSubtree: (id: string) => void;
  focusedSubtreeId?: string | null;
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [edges, setEdges] = useState<ChartEdge[]>([]);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [measureKey, setMeasureKey] = useState(0);

  useEffect(() => {
    const onResize = () => setMeasureKey((key) => key + 1);
    window.addEventListener('resize', onResize);
    const container = containerRef.current;
    const ro =
      typeof ResizeObserver !== 'undefined' && container
        ? new ResizeObserver(() => setMeasureKey((key) => key + 1))
        : null;
    if (ro && container) ro.observe(container);
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Measure inside .rf2-org-canvas layout space (invariant to parent CSS scale/transform transitions).
    const bounds = container.getBoundingClientRect();
    const scale = zoom || 1;
    const next: ChartEdge[] = [];
    for (const row of levels) {
      for (const node of row) {
        const managerId = node.user.managerId;
        if (!managerId || !usersById.has(managerId)) continue;
        const parentEl = cardRefs.current.get(managerId);
        const childEl = cardRefs.current.get(node.user.id);
        if (!parentEl || !childEl) continue;

        const parentOffset = measureOffsetRelativeTo(parentEl, container);
        const childOffset = measureOffsetRelativeTo(childEl, container);
        let x1: number;
        let y1: number;
        let x2: number;
        let y2: number;

        if (parentOffset && childOffset && (parentOffset.width > 0 || childOffset.width > 0)) {
          x1 = parentOffset.left + parentOffset.width / 2;
          y1 = parentOffset.top + parentOffset.height;
          x2 = childOffset.left + childOffset.width / 2;
          y2 = childOffset.top;
        } else {
          const parent = parentEl.getBoundingClientRect();
          const child = childEl.getBoundingClientRect();
          x1 = (parent.left + parent.width / 2 - bounds.left) / scale;
          y1 = (parent.bottom - bounds.top) / scale;
          x2 = (child.left + child.width / 2 - bounds.left) / scale;
          y2 = (child.top - bounds.top) / scale;
        }
        const midY = (y1 + y2) / 2;
        next.push({
          id: node.user.id,
          parentId: managerId,
          d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
        });
      }
    }
    setEdges(next);
    setCanvas({ width: container.scrollWidth, height: container.scrollHeight });
  }, [levels, usersById, canManage, measureKey, zoom]);

  return (
    <div ref={containerRef} className="rf2-org-canvas" data-testid="reporting-org-canvas">
      <svg
        className="rf2-org-canvas__svg"
        width={canvas.width || '100%'}
        height={canvas.height || '100%'}
        viewBox={canvas.width > 0 && canvas.height > 0 ? `0 0 ${canvas.width} ${canvas.height}` : undefined}
        data-testid="reporting-tree-edges"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rf2-edge-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--rf2-action, #0284c7)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--rf2-action, #0284c7)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {edges.map((edge) => {
          const isHighlighted =
            hoveredUserId &&
            (edge.id === hoveredUserId || edge.parentId === hoveredUserId);
          return (
            <path
              key={edge.id}
              d={edge.d}
              fill="none"
              stroke={
                isHighlighted
                  ? 'var(--rf2-action, #0284c7)'
                  : 'url(#rf2-edge-grad)'
              }
              strokeWidth={isHighlighted ? 3 : 2}
              opacity={hoveredUserId ? (isHighlighted ? 1 : 0.25) : 0.65}
              className="rf2-org-edge"
            />
          );
        })}
      </svg>

      <div className="rf2-org-canvas__levels">
        {levels.map((row, index) => {
          const levelNum = index + 1;
          const levelTitle = LEVEL_LABELS[levelNum] ?? `Level ${levelNum}`;
          return (
            <div
              key={row.map((n) => n.user.id).join('|')}
              className="rf2-org-level"
              aria-label={`Hierarchy level ${levelNum}`}
            >
              <div className="rf2-org-level__tag">
                <span className="rf2-org-level__num">Level {levelNum}</span>
                <span className="rf2-org-level__title">{levelTitle}</span>
                <span className="rf2-org-level__count">
                  {row.length} {row.length === 1 ? 'member' : 'members'}
                </span>
              </div>
              <div className="rf2-org-level__cards">
                {row.map((node) => {
                  const manager = node.user.managerId
                    ? usersById.get(node.user.managerId)
                    : undefined;
                  const isHighlighted =
                    hoveredUserId === node.user.id ||
                    (hoveredUserId !== null &&
                      (node.user.managerId === hoveredUserId ||
                        node.children.some((c) => c.user.id === hoveredUserId)));
                  return (
                    <div
                      key={node.user.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(node.user.id, el);
                        else cardRefs.current.delete(node.user.id);
                      }}
                      className="rf2-org-card-wrapper"
                    >
                      <OrgCard
                        node={node}
                        managerName={manager?.displayName}
                        allUsers={allUsers}
                        canManage={canManage}
                        savingId={savingId}
                        isHighlighted={Boolean(isHighlighted)}
                        onAssignManager={onAssignManager}
                        onFocusSubtree={onFocusSubtree}
                        isSubtreeFocused={focusedSubtreeId === node.user.id}
                        onHover={onHover}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReportingTreeV2({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const auth = useAuth();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [focusedSubtreeId, setFocusedSubtreeId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'chart' | 'outline' | 'unassigned'>('chart');
  const [zoom, setZoom] = useState(0.6);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Figma-like infinite canvas pan state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleResetView = useCallback(() => {
    setZoom(0.6);
    setPan({ x: 0, y: 0 });
  }, []);

  // Listen for Spacebar key to enable pan hand cursor anywhere on canvas
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Figma-style wheel navigation: Ctrl+scroll to zoom, regular scroll / trackpad to pan
  useEffect(() => {
    if (viewMode !== 'chart') return;
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.08 : 0.92;
        setZoom((z) => {
          const next = Math.round(z * factor * 100) / 100;
          return Math.min(1.4, Math.max(0.4, next));
        });
      } else {
        setPan((prev) => ({
          x: Math.round(prev.x - e.deltaX),
          y: Math.round(prev.y - e.deltaY),
        }));
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [viewMode]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('button, select, input, textarea, a, [role="button"]');
      if (isInteractive && !spacePressed && e.button !== 1) {
        return;
      }
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture unsupported in synthetic test events
      }
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan.x, pan.y, spacePressed],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    setPan({
      x: Math.round(panStartRef.current.panX + dx),
      y: Math.round(panStartRef.current.panY + dy),
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture already released or unsupported
      }
      panStartRef.current = null;
      setIsPanning(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 40;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x + step }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x - step }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y + step }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y - step }));
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleResetView();
      }
    },
    [handleResetView],
  );

  const canManage = Boolean(auth.user?.permissions?.includes('USERS_MANAGE'));

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchApi<AdminUser[] | { data?: AdminUser[] }>('/users');
      const list = Array.isArray(res) ? res : res.data ?? [];
      setUsers(
        list.map((u) => ({
          ...u,
          roles: u.roles ?? [],
          managerId: u.managerId ?? null,
          branchName: u.branchName || u.branch?.name || null,
        })),
      );
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load reporting tree users.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAssignManager = useCallback(
    async (userId: string, managerId: string | null) => {
      setSavingId(userId);
      setNotice(null);
      try {
        await patchApi(`/users/${encodeURIComponent(userId)}`, { managerId });
        setNotice('Reporting line updated successfully.');
        await load();
      } catch (err) {
        setNotice(
          err instanceof Error
            ? err.message
            : 'Unable to update reporting line.',
        );
      } finally {
        setSavingId(null);
      }
    },
    [load],
  );

  const activeUsers = useMemo(
    () => (users ?? []).filter((u) => isActive(u)),
    [users],
  );

  const usersById = useMemo(
    () => new Map(activeUsers.map((u) => [u.id, u])),
    [activeUsers],
  );

  const fullForest = useMemo(() => buildTree(activeUsers), [activeUsers]);

  const displayForest = useMemo(() => {
    if (!focusedSubtreeId) return fullForest;
    const findSubtree = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.user.id === focusedSubtreeId) return node;
        const inChild = findSubtree(node.children);
        if (inChild) return inChild;
      }
      return null;
    };
    const target = findSubtree(fullForest);
    return target ? [target] : fullForest;
  }, [fullForest, focusedSubtreeId]);

  const levels = useMemo(
    () => flattenLevels(displayForest),
    [displayForest],
  );

  const unassignedEmployees = useMemo(
    () => activeUsers.filter((u) => !u.managerId && seatOf(u) === 'employee'),
    [activeUsers],
  );

  const managersWithDirects = useMemo(() => {
    const directsMap = new Map<string, number>();
    for (const u of activeUsers) {
      if (u.managerId) {
        directsMap.set(u.managerId, (directsMap.get(u.managerId) ?? 0) + 1);
      }
    }
    return activeUsers.filter((u) => (directsMap.get(u.id) ?? 0) > 0);
  }, [activeUsers]);

  const flatMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return activeUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.jobTitle ?? '').toLowerCase().includes(q) ||
        (u.branchName ?? '').toLowerCase().includes(q) ||
        u.roles.some((r) => r.name.toLowerCase().includes(q)),
    );
  }, [activeUsers, searchQuery]);

  const stats = useMemo(
    () => ({
      total: activeUsers.length,
      managers: managersWithDirects.length,
      depth: levels.length,
      unassigned: unassignedEmployees.length,
    }),
    [activeUsers.length, managersWithDirects.length, levels.length, unassignedEmployees.length],
  );

  if (isLoading) {
    return (
      <div className="rf2-admin rf2-org-page">
        <AdminWorkspaceHeader
          group="Users & Access"
          title="Reporting Tree"
          subtitle="Loading organization hierarchy..."
        />
        <div className="rf2-admin__card rf2-admin__pad">
          <SkeletonV2 lines={8} label="Loading reporting tree" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rf2-admin rf2-org-page">
        <AdminWorkspaceHeader
          group="Users & Access"
          title="Reporting Tree"
          subtitle="Unable to load reporting tree"
        />
        <ErrorStateV2
          title="Unable to load reporting tree"
          body={loadError}
          action={<ButtonV2 kind="secondary" onClick={() => void load()}>Retry</ButtonV2>}
        />
      </div>
    );
  }

  const viewFormatSwitcher = (
    <div className="rf2-segmented" role="tablist" aria-label="Tree view format">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'chart'}
        className="rf2-segmented__btn"
        onClick={() => setViewMode('chart')}
      >
        <Network size={14} aria-hidden="true" />
        <span>Org Chart</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'outline'}
        className="rf2-segmented__btn"
        onClick={() => setViewMode('outline')}
      >
        <ListTree size={14} aria-hidden="true" />
        <span>Hierarchy Outline</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'unassigned'}
        className={`rf2-segmented__btn${stats.unassigned > 0 ? ' rf2-segmented__btn--warning' : ''}`}
        onClick={() => setViewMode('unassigned')}
      >
        <AlertTriangle size={14} aria-hidden="true" />
        <span>Needs Manager ({stats.unassigned})</span>
      </button>
    </div>
  );

  const zoomControls = viewMode === 'chart' ? (
    <div className="rf2-org-canvas-controls" aria-label="Org chart zoom controls">
      <button
        type="button"
        className="rf2-org-ctrl-btn"
        onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
        disabled={zoom <= 0.4}
        title="Zoom out (down to 40%)"
        aria-label="Zoom out"
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="rf2-org-zoom-label" data-testid="reporting-zoom-label">{Math.round(zoom * 100)}%</span>
      <button
        type="button"
        className="rf2-org-ctrl-btn"
        onClick={() => setZoom((z) => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
        disabled={zoom >= 1.4}
        title="Zoom in (up to 140%)"
        aria-label="Zoom in"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <span className="rf2-org-zoom-divider" aria-hidden="true" />
      <div className="rf2-org-zoom-presets" role="group" aria-label="Quick zoom presets">
        <button
          type="button"
          className={`rf2-org-preset-btn${Math.round(zoom * 100) === 40 ? ' is-active' : ''}`}
          onClick={() => setZoom(0.4)}
          title="Zoom out to 40%"
        >
          40%
        </button>
        <button
          type="button"
          className={`rf2-org-preset-btn${Math.round(zoom * 100) === 60 ? ' is-active' : ''}`}
          onClick={() => setZoom(0.6)}
          title="Default 60% zoom"
        >
          60%
        </button>
        <button
          type="button"
          className={`rf2-org-preset-btn${Math.round(zoom * 100) === 100 ? ' is-active' : ''}`}
          onClick={() => setZoom(1.0)}
          title="100% full scale"
        >
          100%
        </button>
      </div>
      {Math.round(zoom * 100) !== 60 || pan.x !== 0 || pan.y !== 0 ? (
        <>
          <span className="rf2-org-zoom-divider" aria-hidden="true" />
          <button
            type="button"
            className="rf2-org-preset-btn rf2-org-preset-btn--reset"
            onClick={handleResetView}
            title="Reset canvas view (60% zoom, centered)"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Reset (60%)</span>
          </button>
        </>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="rf2-admin rf2-org-page">
      {!hideHeader ? (
        <AdminWorkspaceHeader
          group="Users & Access"
          title="Reporting Tree"
          subtitle={
            canManage
              ? 'Organizational hierarchy, reporting lines, and manager oversight structure. Changes immediately update team-scoped views.'
              : 'View only — contact an administrator to change reporting lines.'
          }
        />
      ) : null}

      <ul className="rf2-admin-kpis rf2-admin-kpis--compact" aria-label="Reporting hierarchy metrics">
        <li className="rf2-admin-kpi">
          <span className="rf2-admin-kpi__icon" data-tone="neutral">
            <Users aria-hidden="true" />
          </span>
          <div className="rf2-admin-kpi__copy">
            <span className="rf2-admin-kpi__value">{stats.total}</span>
            <span className="rf2-admin-kpi__label">Total active staff</span>
            <span className="rf2-admin-kpi__sub">In organization</span>
          </div>
        </li>
        <li className="rf2-admin-kpi">
          <span className="rf2-admin-kpi__icon" data-tone="success">
            <UserCheck aria-hidden="true" />
          </span>
          <div className="rf2-admin-kpi__copy">
            <span className="rf2-admin-kpi__value">{stats.managers}</span>
            <span className="rf2-admin-kpi__label">Team leaders</span>
            <span className="rf2-admin-kpi__sub">With direct reports</span>
          </div>
        </li>
        <li className="rf2-admin-kpi">
          <span className="rf2-admin-kpi__icon">
            <Layers aria-hidden="true" />
          </span>
          <div className="rf2-admin-kpi__copy">
            <span className="rf2-admin-kpi__value">{stats.depth}</span>
            <span className="rf2-admin-kpi__label">Hierarchy depth</span>
            <span className="rf2-admin-kpi__sub">Levels from root</span>
          </div>
        </li>
        <li className="rf2-admin-kpi rf2-admin-kpi--action">
          <button
            type="button"
            className="rf2-admin-kpi__btn"
            onClick={() => setViewMode('unassigned')}
            aria-label={`View ${stats.unassigned} unassigned employees needing manager`}
          >
            <span
              className="rf2-admin-kpi__icon"
              data-tone={stats.unassigned > 0 ? 'warning' : 'success'}
            >
              <AlertTriangle aria-hidden="true" />
            </span>
            <div className="rf2-admin-kpi__copy">
              <span
                className="rf2-admin-kpi__value"
                data-tone={stats.unassigned > 0 ? 'warning' : undefined}
              >
                {stats.unassigned}
              </span>
              <span className="rf2-admin-kpi__label">Needs manager</span>
              <span className="rf2-admin-kpi__sub">
                {stats.unassigned > 0 ? (
                  <>
                    <span>Review unassigned</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </>
                ) : (
                  'All staff assigned'
                )}
              </span>
            </div>
          </button>
        </li>
      </ul>

      {notice ? (
        <div className="rf2-inline-note" data-tone="info" role="status">
          <Check aria-hidden="true" />
          <span>{notice}</span>
          <button
            type="button"
            className="rf2-btn rf2-btn--tertiary rf2-btn--sm"
            style={{ marginInlineStart: 'auto' }}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="rf2-admin-filterbar rf2-org-filterbar">
        <div className="rf2-org-filterbar__row rf2-org-filterbar__row--filters">
          <div className="rf2-admin__filterset">
            <InputV2
              label="Search organization"
              fieldClassName="rf2-sr-label rf2-org-search"
              placeholder="Search name, job title, department, branch…"
              leadingIcon={<Search size={15} aria-hidden="true" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {managersWithDirects.length > 0 ? (
              <SelectV2
                label="Focus manager subtree"
                fieldClassName="rf2-sr-label rf2-org-subtree-select"
                value={focusedSubtreeId}
                onChange={(e) => setFocusedSubtreeId(e.target.value)}
              >
                <option value="">Entire organization</option>
                {managersWithDirects.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                    {m.jobTitle ? ` (${m.jobTitle})` : ''}
                  </option>
                ))}
              </SelectV2>
            ) : null}
          </div>

          <div className="rf2-org-filterbar__actions">
            <ButtonV2
              kind="secondary"
              size="sm"
              icon={<RotateCw size={13} aria-hidden="true" />}
              onClick={() => void load()}
              title="Refresh tree data"
            >
              Refresh
            </ButtonV2>
          </div>
        </div>

        <div className="rf2-org-filterbar__row rf2-org-filterbar__row--controls">
          <div className="rf2-org-filterbar__views">
            {viewFormatSwitcher}
          </div>
          {zoomControls ? (
            <div className="rf2-org-filterbar__zoom">
              {zoomControls}
            </div>
          ) : null}
        </div>
      </div>

      {focusedSubtreeId ? (
        <div className="rf2-inline-note" data-tone="info">
          <Filter aria-hidden="true" />
          <span>
            Filtering subtree for{' '}
            <strong>{usersById.get(focusedSubtreeId)?.displayName}</strong>.
          </span>
          <ButtonV2
            kind="tertiary"
            size="sm"
            onClick={() => setFocusedSubtreeId('')}
            style={{ marginInlineStart: 'auto' }}
          >
            Show full organization
          </ButtonV2>
        </div>
      ) : null}

      {flatMatches ? (
        flatMatches.length === 0 ? (
          <EmptyStateV2
            title="No matching staff in reporting tree"
            body="Try a different name, job title, or branch location."
            action={
              <ButtonV2 kind="secondary" size="sm" onClick={() => setSearchQuery('')}>
                Clear search
              </ButtonV2>
            }
          />
        ) : (
          <div className="rf2-admin__card rf2-admin__pad">
            <h2 className="rf2-jtable__name" style={{ marginBottom: '12px' }}>
              Search Results ({flatMatches.length})
            </h2>
            <div className="rf2-org-grid">
              {flatMatches.map((user) => {
                const manager = user.managerId ? usersById.get(user.managerId) : undefined;
                return (
                  <OrgCard
                    key={user.id}
                    node={{ user, children: [], depth: 0 }}
                    managerName={manager?.displayName}
                    allUsers={activeUsers}
                    canManage={canManage}
                    savingId={savingId}
                    onAssignManager={handleAssignManager}
                  />
                );
              })}
            </div>
          </div>
        )
      ) : viewMode === 'unassigned' ? (
        unassignedEmployees.length === 0 ? (
          <div className="rf2-admin__card rf2-admin__pad">
            <EmptyStateV2
              title="All staff members have assigned reporting lines"
              body="There are no orphaned or unassigned employee seats in the organization."
              action={
                <ButtonV2 kind="secondary" size="sm" onClick={() => setViewMode('chart')}>
                  Return to Org Chart
                </ButtonV2>
              }
            />
          </div>
        ) : (
          <div className="rf2-admin__card rf2-admin__pad">
            <div className="rf2-org-unassigned-header">
              <div>
                <h2 className="rf2-jtable__name">
                  Staff Needing Manager Assignment ({unassignedEmployees.length})
                </h2>
                <p className="rf2-jtable__sub">
                  Assign a manager to ensure these team members appear in the appropriate manager&apos;s Team Work and Team Result dashboards.
                </p>
              </div>
            </div>
            <div className="rf2-org-grid" style={{ marginTop: '16px' }}>
              {unassignedEmployees.map((user) => (
                <OrgCard
                  key={user.id}
                  node={{ user, children: [], depth: 0 }}
                  managerName="Unassigned"
                  allUsers={activeUsers}
                  canManage={canManage}
                  savingId={savingId}
                  onAssignManager={handleAssignManager}
                />
              ))}
            </div>
          </div>
        )
      ) : viewMode === 'outline' ? (
        <div className="rf2-admin__card rf2-admin__pad">
          <div className="rf2-org-outline-controls">
            <h2 className="rf2-jtable__name">Organization Hierarchy Outline</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <ButtonV2
                kind="tertiary"
                size="sm"
                onClick={() => setCollapsed(new Set())}
              >
                Expand all
              </ButtonV2>
              <ButtonV2
                kind="tertiary"
                size="sm"
                onClick={() =>
                  setCollapsed(new Set(activeUsers.map((u) => u.id)))
                }
              >
                Collapse all
              </ButtonV2>
            </div>
          </div>
          <ul className="rf2-admin__tree rf2-org-tree-list" aria-label="Reporting hierarchy tree">
            {flatten(displayForest).map((n) => {
              const reportCount = n.children.length;
              const isCollapsible = reportCount > 0;
              const isNodeCollapsed = collapsed.has(n.user.id);
              const unassigned = !n.user.managerId && seatOf(n.user) === 'employee';
              return (
                <li
                  key={n.user.id}
                  data-depth={n.depth}
                  data-unassigned={unassigned || undefined}
                  style={{ paddingInlineStart: `${n.depth * 28}px` }}
                >
                  <div
                    className={`rf2-admin__node ${unassigned ? 'rf2-admin__node--unassigned' : ''}`}
                  >
                    {isCollapsible ? (
                      <button
                        type="button"
                        className="rf2-org-tree-toggle"
                        onClick={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(n.user.id)) next.delete(n.user.id);
                            else next.add(n.user.id);
                            return next;
                          })
                        }
                        aria-label={isNodeCollapsed ? 'Expand team' : 'Collapse team'}
                      >
                        {isNodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                    ) : (
                      <span className="rf2-org-tree-spacer" aria-hidden="true" />
                    )}
                    <span
                      className={`rf2-org-card__avatar rf2-org-card__avatar--${seatOf(n.user)} rf2-org-card__avatar--sm`}
                      aria-hidden="true"
                    >
                      {getInitials(n.user.displayName)}
                    </span>
                    <span className="rf2-org-node-text">
                      <span className="rf2-jtable__name">{n.user.displayName}</span>
                      <span className="rf2-jtable__sub">
                        {[
                          seatLabel(n.user),
                          n.user.jobTitle,
                          n.user.branchName,
                          reportCount ? `${reportCount} direct reports` : '',
                          unassigned ? 'Needs manager' : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {canManage ? (
                      <div className="rf2-org-node-action">
                        <select
                          className="rf2-org-card__select rf2-org-card__select--sm"
                          value={n.user.managerId ?? ''}
                          disabled={savingId === n.user.id}
                          onChange={(e) => handleAssignManager(n.user.id, e.target.value || null)}
                          aria-label={`Select manager for ${n.user.displayName}`}
                        >
                          <option value="">No manager (top level)</option>
                          {activeUsers
                            .filter(
                              (candidate) =>
                                candidate.id !== n.user.id &&
                                !collectDescendantIds(n).has(candidate.id),
                            )
                            .map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                {cand.displayName}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : displayForest.length === 0 ? (
        <EmptyStateV2
          title="No users in reporting tree"
          body="Active users will appear in the organizational hierarchy automatically."
        />
      ) : (
        <div
          ref={viewportRef}
          className={`rf2-org-canvas-viewport ${isPanning ? 'is-panning' : ''} ${spacePressed ? 'is-space-pressed' : ''}`}
          style={{
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="region"
          aria-label="Interactive organization chart canvas. Catch and drag or use arrow keys to pan, zoom controls to scale."
        >
          <div
            className={`rf2-org-canvas-scaler ${isPanning ? '' : 'is-animated'}`}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <ReportingChart
              levels={levels}
              usersById={usersById}
              allUsers={activeUsers}
              canManage={canManage}
              savingId={savingId}
              hoveredUserId={hoveredUserId}
              onHover={setHoveredUserId}
              onAssignManager={handleAssignManager}
              onFocusSubtree={(id) => {
                setFocusedSubtreeId((curr) => (curr === id ? '' : id));
                setPan({ x: 0, y: 0 });
              }}
              focusedSubtreeId={focusedSubtreeId}
              zoom={zoom}
            />
          </div>

          <div className="rf2-org-canvas-hud" role="status" aria-label="Canvas navigation help">
            <span className="rf2-org-canvas-hud__hint">
              <Hand size={13} aria-hidden="true" />
              <span>Catch &amp; drag canvas · Ctrl + scroll to zoom</span>
            </span>
            {pan.x !== 0 || pan.y !== 0 ? (
              <button
                type="button"
                className="rf2-org-hud-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setPan({ x: 0, y: 0 });
                }}
                title="Recenter canvas position"
                aria-label="Center canvas position"
              >
                <Focus size={12} aria-hidden="true" />
                <span>Center</span>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
