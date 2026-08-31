import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeProbe() {
  const { theme, effectiveTheme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme}>{theme}:{effectiveTheme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  });

  it('defaults to Light and persists a Dark selection', async () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light:light');
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('recruitflow.theme')).toBe('dark');
  });

  it('synchronizes a valid theme change from another tab', async () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    window.dispatchEvent(new StorageEvent('storage', { key: 'recruitflow.theme', newValue: 'dark' }));
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('dark:dark'));
  });

  it('migrates the static v2 theme preference when the canonical key is absent', () => {
    localStorage.setItem('rf-theme', 'dark');
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark:dark');
  });
});
