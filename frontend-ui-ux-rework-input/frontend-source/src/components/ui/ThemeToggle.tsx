import { Icon } from '../Icon';
import { useTheme } from '../../theme/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className={['theme-toggle', showLabel ? 'theme-toggle--labelled' : '', className].filter(Boolean).join(' ')}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} mode`}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
      </span>
      {showLabel && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  );
}
