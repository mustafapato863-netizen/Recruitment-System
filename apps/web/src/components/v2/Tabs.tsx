import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabV2Item {
  key: string;
  label: string;
  disabled?: boolean;
  controls?: string;
}

interface TabsV2Props {
  items: TabV2Item[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel: string;
}

export function TabsV2({ items, activeKey, onChange, ariaLabel }: TabsV2Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, key: string) => {
    const enabled = items.map((item, index) => ({ item, index })).filter((row) => !row.item.disabled);
    if (!enabled.length) return;
    let next = enabled[0]!.index;
    if (key === 'End') next = enabled[enabled.length - 1]!.index;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      const current = enabled.findIndex((row) => row.index === from);
      const step = key === 'ArrowRight' ? 1 : -1;
      const wrapped = (current + step + enabled.length) % enabled.length;
      next = enabled[wrapped]!.index;
    }
    tabRefs.current[next]?.focus();
    onChange(items[next]!.key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    move(index, event.key);
  };

  return (
    <div className="rf2-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const selected = item.key === activeKey;
        return (
          <button
            key={item.key}
            ref={(element) => { tabRefs.current[index] = element; }}
            type="button"
            role="tab"
            id={`rf2-tab-${item.key}`}
            className="rf2-tab"
            aria-selected={selected}
            aria-controls={item.controls}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => { if (!item.disabled) onChange(item.key); }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanelV2({ id, labelledBy, children, hidden }: { id: string; labelledBy: string; children: ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return <div role="tabpanel" id={id} aria-labelledby={labelledBy} className="rf2-tabpanel">{children}</div>;
}
