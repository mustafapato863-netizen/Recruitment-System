import type { ReactNode } from 'react';
import { Icon } from '../Icon';

interface FilterChipProps {
  label: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  isActive?: boolean;
}

export function FilterChip({ label, onRemove, onClick, isActive }: FilterChipProps) {
  return (
    <span className={['rf-filter-chip', 'filter-chip', isActive ? 'active' : ''].filter(Boolean).join(' ')}>
      {onClick ? (
        <button
          className="rf-filter-chip__label"
          type="button"
          aria-pressed={Boolean(isActive)}
          onClick={onClick}
        >
          {label}
        </button>
      ) : (
        <span className="rf-filter-chip__label">{label}</span>
      )}
      {onRemove && (
        <button
          className="rf-filter-chip__remove filter-chip-remove"
          type="button"
          aria-label="Remove filter"
          onClick={onRemove}
        >
          <Icon name="close" size={11} />
        </button>
      )}
    </span>
  );
}

interface SavedViewProps {
  label: string;
  count?: number;
  isActive?: boolean;
  onClick: () => void;
}

export function SavedViewTab({ label, count, isActive, onClick }: SavedViewProps) {
  return (
    <button
      className={['rf-saved-view', 'saved-view', isActive ? 'active' : ''].filter(Boolean).join(' ')}
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
    >
      {label}
      {count !== undefined && <span className="tab-count">{count}</span>}
    </button>
  );
}
