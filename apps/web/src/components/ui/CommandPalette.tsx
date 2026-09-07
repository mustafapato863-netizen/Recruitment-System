import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GlobalSearchItem, GlobalSearchResponse } from '@recruitflow/contracts';
import { fetchApi } from '../../api/client';
import { Icon, type IconName } from '../Icon';
import { Modal } from '../Modal';
import { Spinner } from '../Spinner';
import { Input } from './Input';
import { useTheme } from '../../theme/ThemeContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  keywords: string[];
  badge?: string;
  onSelect: (navigate: ReturnType<typeof useNavigate>, toggleTheme: () => void) => void;
}

const ENTITY_ICONS: Record<GlobalSearchItem['entityType'], IconName> = {
  candidate: 'user',
  vacancy: 'briefcase',
  application: 'pipeline',
  task: 'tasks',
  interview: 'calendar-clock',
  offer: 'document',
  approval: 'inbox',
  notification: 'mail',
  cv: 'upload',
  'talent-pool': 'folder-kanban',
  'master-data': 'database',
};

function itemRoute(item: GlobalSearchItem): string {
  switch (item.entityType) {
    case 'candidate': return `/candidates/${item.entityId}`;
    case 'vacancy': return `/vacancies/${item.entityId}`;
    case 'application': return `/applications/${item.entityId}`;
    case 'task': return `/tasks?focus=${encodeURIComponent(item.entityId)}`;
    case 'interview': return `/interviews/${item.entityId}`;
    case 'offer': return `/offers/${item.entityId}`;
    case 'approval': return `/approval-inbox`;
    case 'notification': return `/notifications/${item.entityId}`;
    case 'cv': return `/cv-intake/${item.entityId}`;
    case 'talent-pool': return `/sourcing-match`;
    case 'master-data': return `/master-data/${item.entityId}`;
    default: return '/';
  }
}

const STATIC_QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'act-create-req',
    title: 'Create Job Requisition',
    subtitle: 'Initiate a new clinical or corporate vacancy request with approval workflow',
    icon: 'briefcase',
    keywords: ['create', 'job', 'requisition', 'vacancy', 'position', 'hire', 'new'],
    badge: 'Requisition',
    onSelect: (nav) => nav('/vacancy-requests/create'),
  },
  {
    id: 'act-sourcing-match',
    title: 'Smart Sourcing & Match Bench',
    subtitle: 'Evaluate 22 SGH positions with real-time candidate benchmark scoring',
    icon: 'sparkles',
    keywords: ['sourcing', 'match', 'bench', 'score', 'benchmark', 'pool', 'talent'],
    badge: 'SGH AI',
    onSelect: (nav) => nav('/sourcing-match'),
  },
  {
    id: 'act-pipeline',
    title: 'Applications Pipeline & Kanban',
    subtitle: 'Manage candidate stages from Applied through Screening, Interview, to Pre-Hire',
    icon: 'pipeline',
    keywords: ['pipeline', 'kanban', 'applications', 'stages', 'screening', 'board'],
    badge: 'Pipeline',
    onSelect: (nav) => nav('/applications'),
  },
  {
    id: 'act-compare',
    title: 'Candidate Comparison Matrix',
    subtitle: 'Side-by-side criteria, skills, and qualifications comparison for candidates',
    icon: 'filter',
    keywords: ['compare', 'matrix', 'side by side', 'evaluation', 'criteria', 'candidates'],
    badge: 'Tools',
    onSelect: (nav) => nav('/candidates/compare'),
  },
  {
    id: 'act-cv-intake',
    title: 'Smart CV Intake & Parser',
    subtitle: 'Upload and parse medical & engineering résumés into candidate records',
    icon: 'upload',
    keywords: ['cv', 'resume', 'intake', 'upload', 'parse', 'import', 'files'],
    badge: 'Intake',
    onSelect: (nav) => nav('/cv-intake'),
  },
  {
    id: 'act-candidates',
    title: 'Candidates Database',
    subtitle: 'Search, filter, and inspect all active candidate profiles and credentials',
    icon: 'user',
    keywords: ['candidates', 'database', 'directory', 'people', 'profiles', 'talent'],
    badge: 'Talent',
    onSelect: (nav) => nav('/candidates'),
  },
  {
    id: 'act-calendar',
    title: 'Interview Calendar',
    subtitle: 'View upcoming clinical panel interviews, scheduling slots, and room bookings',
    icon: 'calendar-clock',
    keywords: ['interview', 'calendar', 'schedule', 'meetings', 'panels', 'interviews'],
    badge: 'Calendar',
    onSelect: (nav) => nav('/interviews/calendar'),
  },
  {
    id: 'act-approvals',
    title: 'Approvals Inbox',
    subtitle: 'Review pending requisition, offer, and final hiring sign-offs',
    icon: 'inbox',
    keywords: ['approvals', 'inbox', 'sign off', 'pending', 'requisitions', 'offers'],
    badge: 'Approvals',
    onSelect: (nav) => nav('/approval-inbox'),
  },
  {
    id: 'act-targets',
    title: 'Position Targets & SLA Hub',
    subtitle: 'Configure time-to-hire, diversity, and SLA benchmarks by position level',
    icon: 'settings',
    keywords: ['targets', 'sla', 'settings', 'benchmarks', 'time to hire', 'kpi'],
    badge: 'Settings',
    onSelect: (nav) => nav('/settings/targets'),
  },
  {
    id: 'act-reports',
    title: 'Executive Reports & Analytics',
    subtitle: 'Recruitment velocity, funnel conversion rates, and sourcing channel metrics',
    icon: 'report',
    keywords: ['reports', 'analytics', 'metrics', 'velocity', 'conversion', 'dashboard'],
    badge: 'Analytics',
    onSelect: (nav) => nav('/reports'),
  },
  {
    id: 'act-theme',
    title: 'Toggle Dark / Light Theme',
    subtitle: 'Switch between Saudi German Health luminous day and deep slate night mode',
    icon: 'moon',
    keywords: ['theme', 'dark', 'light', 'mode', 'color', 'night', 'day', 'toggle'],
    badge: 'Display',
    onSelect: (_, toggle) => toggle(),
  },
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResult(null);
      setError('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Filter quick actions based on query
  const matchingActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATIC_QUICK_ACTIONS;
    return STATIC_QUICK_ACTIONS.filter(
      (act) =>
        act.title.toLowerCase().includes(q) ||
        act.subtitle.toLowerCase().includes(q) ||
        act.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  }, [query]);

  // Backend search debounced
  useEffect(() => {
    const normalized = query.trim();
    if (!isOpen || normalized.length < 2) {
      setResult(null);
      setLoading(false);
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void fetchApi<GlobalSearchResponse>(
        `/search?q=${encodeURIComponent(normalized)}&limit=8`,
        { method: 'GET', signal: controller.signal },
      )
        .then((response) => {
          setResult(response);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(reason instanceof Error ? reason.message : 'Workspace search failed.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  // Combined flat items for keyboard navigation (Actions first, then Search items)
  type UnifiedItem =
    | { type: 'action'; data: QuickActionItem }
    | { type: 'record'; data: GlobalSearchItem };

  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];
    matchingActions.forEach((act) => items.push({ type: 'action', data: act }));
    result?.groups.forEach((group) => {
      group.items.forEach((item) => items.push({ type: 'record', data: item }));
    });
    return items;
  }, [matchingActions, result]);

  // Reset activeIndex when item count changes
  useEffect(() => {
    setActiveIndex(0);
  }, [unifiedItems.length]);

  const executeItem = (item: UnifiedItem) => {
    onClose();
    if (item.type === 'action') {
      item.data.onSelect(navigate, toggleTheme);
    } else {
      navigate(itemRoute(item.data));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search & Quick Actions" maxWidthClass="max-w-2xl">
      <div className="command-palette">
        <div className="command-palette__input-wrap">
          <Icon name="search" size={18} />
          <Input
            className="command-palette__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && unifiedItems.length > 0) {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % unifiedItems.length);
              } else if (event.key === 'ArrowUp' && unifiedItems.length > 0) {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + unifiedItems.length) % unifiedItems.length);
              } else if (event.key === 'Enter' && unifiedItems[activeIndex]) {
                event.preventDefault();
                executeItem(unifiedItems[activeIndex]);
              }
            }}
            aria-label="Search candidates, positions, applications, or run quick actions"
            autoComplete="off"
            placeholder="Type a command or search candidates, positions, applications..."
            autoFocus
          />
          {loading && <Spinner size={17} aria-label="Searching workspace" />}
        </div>

        <div id="command-search-results" className="command-palette__results" role="listbox" aria-label="Command search results">
          {error && <div className="command-palette__state is-error" role="alert">{error}</div>}

          {/* Quick Actions Group */}
          {matchingActions.length > 0 && (
            <section className="command-palette__group" aria-label="Quick Actions">
              <h3>Quick Actions & Navigation</h3>
              {matchingActions.map((act) => {
                const itemIndex = unifiedItems.findIndex(
                  (u) => u.type === 'action' && u.data.id === act.id
                );
                const isSelected = itemIndex === activeIndex;
                return (
                  <button
                    key={act.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={isSelected ? 'is-active' : ''}
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                    onClick={() => executeItem({ type: 'action', data: act })}
                  >
                    <span className="command-palette__item-icon">
                      <Icon name={act.icon} size={16} />
                    </span>
                    <span className="command-palette__item-copy">
                      <strong>{act.title}</strong>
                      <small>{act.subtitle}</small>
                    </span>
                    {act.badge && (
                      <span className="command-palette__status text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0084ce] dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60">
                        {act.badge}
                      </span>
                    )}
                    <Icon name="chevron-right" size={14} className="opacity-40" />
                  </button>
                );
              })}
            </section>
          )}

          {/* Backend Search Result Groups */}
          {!error &&
            result?.groups.map((group) => (
              <section key={group.entityType} className="command-palette__group" aria-labelledby={`command-group-${group.entityType}`}>
                <h3 id={`command-group-${group.entityType}`}>{group.label}</h3>
                {group.items.map((item) => {
                  const itemIndex = unifiedItems.findIndex(
                    (u) => u.type === 'record' && u.data.entityType === item.entityType && u.data.entityId === item.entityId
                  );
                  const isSelected = itemIndex === activeIndex;
                  return (
                    <button
                      key={`${item.entityType}-${item.entityId}`}
                      id={`command-result-${item.entityType}-${item.entityId}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={isSelected ? 'is-active' : ''}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      onClick={() => executeItem({ type: 'record', data: item })}
                    >
                      <span className="command-palette__item-icon">
                        <Icon name={ENTITY_ICONS[item.entityType]} size={16} />
                      </span>
                      <span className="command-palette__item-copy">
                        <strong>{item.title}</strong>
                        {item.subtitle && <small>{item.subtitle}</small>}
                      </span>
                      {item.status && <span className="command-palette__status">{item.status}</span>}
                      <Icon name="chevron-right" size={15} />
                    </button>
                  );
                })}
              </section>
            ))}

          {!loading && !error && query.trim().length >= 2 && unifiedItems.length === 0 && (
            <div className="command-palette__state">No matching records or actions found.</div>
          )}
        </div>

        <footer className="command-palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open / Run</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </div>
    </Modal>
  );
}