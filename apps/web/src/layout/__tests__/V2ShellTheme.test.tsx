import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
import { V2Shell } from '../V2Shell';

describe('V2Shell is light-only', () => {
  it('forces color-scheme: light on <html> while mounted, even with a stored dark theme, and restores it after', () => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
    const { unmount } = render(<MemoryRouter><V2Shell /></MemoryRouter>);
    expect(document.documentElement.style.colorScheme).toBe('light');
    unmount();
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
