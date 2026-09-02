import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: ReactNode;
  disabled?: boolean;
  controls?: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel: string;
  className?: string;
}

export function Tabs({ items, activeKey, onChange, ariaLabel, className = '' }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const nextIndex = items.findIndex((item, itemIndex) => itemIndex === index && !item.disabled);
    if (nextIndex < 0) return;
    tabRefs.current[nextIndex]?.focus();
    onChange(items[nextIndex].key);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();

    if (event.key === 'Home') {
      focusTab(0);
      return;
    }
    if (event.key === 'End') {
      focusTab(items.length - 1);
      return;
    }

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    let nextIndex = index + direction;
    while (nextIndex >= 0 && nextIndex < items.length && items[nextIndex].disabled) nextIndex += direction;
    if (nextIndex < 0) nextIndex = items.length - 1;
    if (nextIndex >= items.length) nextIndex = 0;
    focusTab(nextIndex);
  };

  return (
    <div className={['rf-source-tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            id={`tab-${item.key}`}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            className={['rf-source-tab', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={item.controls}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{item.label}</span>
            {item.count !== undefined && <span className="rf-source-tab-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, activeKey, children }: { id: string; activeKey: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} hidden={activeKey !== id}>
      {children}
    </div>
  );
}
