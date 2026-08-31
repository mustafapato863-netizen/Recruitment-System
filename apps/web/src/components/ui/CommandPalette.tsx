import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GlobalSearchItem, GlobalSearchResponse } from '@recruitflow/contracts';
import { fetchApi } from '../../api/client';
import { Icon, type IconName } from '../Icon';
import { Modal } from '../Modal';
import { Spinner } from '../Spinner';
import { Input } from './Input';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const ENTITY_ICONS: Record<GlobalSearchItem['entityType'], IconName> = {
  candidate: 'user',
  vacancy: 'briefcase',
  application: 'pipeline',
  task: 'tasks',
};

function itemRoute(item: GlobalSearchItem): string {
  switch (item.entityType) {
    case 'candidate': return `/candidates/${item.entityId}`;
    case 'vacancy': return `/vacancies/${item.entityId}`;
    case 'application': return `/applications/${item.entityId}`;
    case 'task': return `/tasks?focus=${encodeURIComponent(item.entityId)}`;
  }
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
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
        `/search?q=${encodeURIComponent(normalized)}&limit=5`,
        { method: 'GET', signal: controller.signal },
      )
        .then((response) => {
          setResult(response);
          setActiveIndex(0);
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

  const flatItems = useMemo(() => result?.groups.flatMap((group) => group.items) ?? [], [result]);

  const openItem = (item: GlobalSearchItem) => {
    onClose();
    navigate(itemRoute(item));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search RecruitFlow" maxWidthClass="max-w-2xl">
      <div className="command-palette">
        <div className="command-palette__input-wrap">
          <Icon name="search" size={18} />
          <Input
            className="command-palette__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && flatItems.length > 0) {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % flatItems.length);
              } else if (event.key === 'ArrowUp' && flatItems.length > 0) {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + flatItems.length) % flatItems.length);
              } else if (event.key === 'Enter' && flatItems[activeIndex]) {
                event.preventDefault();
                openItem(flatItems[activeIndex]);
              }
            }}
            aria-label="Search candidates, openings, applications, and tasks"
            aria-controls="command-search-results"
            aria-activedescendant={flatItems[activeIndex] ? `command-result-${flatItems[activeIndex].entityType}-${flatItems[activeIndex].entityId}` : undefined}
            autoComplete="off"
            placeholder="Search candidates, openings, applications, and tasks..."
          />
          {loading && <Spinner size={17} aria-label="Searching workspace" />}
        </div>

        <div id="command-search-results" className="command-palette__results" role="listbox" aria-label="Workspace search results">
          {query.trim().length < 2 && (
            <div className="command-palette__state">
              <Icon name="search" size={20} />
              <span>Enter at least two characters to search your permitted workspace.</span>
            </div>
          )}
          {error && <div className="command-palette__state is-error" role="alert">{error}</div>}
          {!loading && !error && query.trim().length >= 2 && result?.total === 0 && (
            <div className="command-palette__state">No matching records were found.</div>
          )}
          {!error && result?.groups.map((group) => (
            <section key={group.entityType} className="command-palette__group" aria-labelledby={`command-group-${group.entityType}`}>
              <h3 id={`command-group-${group.entityType}`}>{group.label}</h3>
              {group.items.map((item) => {
                const index = flatItems.findIndex((candidate) => candidate.entityType === item.entityType && candidate.entityId === item.entityId);
                return (
                  <button
                    key={`${item.entityType}-${item.entityId}`}
                    id={`command-result-${item.entityType}-${item.entityId}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? 'is-active' : ''}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openItem(item)}
                  >
                    <span className="command-palette__item-icon"><Icon name={ENTITY_ICONS[item.entityType]} size={16} /></span>
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
        </div>

        <footer className="command-palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </div>
    </Modal>
  );
}
