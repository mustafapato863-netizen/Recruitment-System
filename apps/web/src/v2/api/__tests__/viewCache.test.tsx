import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import {
  clearViewCache,
  invalidateViewCache,
  loadCachedView,
  readViewCache,
  setViewCacheEnabled,
  setViewCacheUser,
} from '../viewCache';
import { useCachedResource } from '../useCachedResource';

function TestView({ cacheKey, loader }: { cacheKey: string; loader: () => Promise<string> }) {
  const res = useCachedResource({ key: cacheKey, fetcher: loader });
  if (res.kind === 'loading') return <div role="status">Loading…</div>;
  if (res.kind === 'error') return <div role="alert">Error</div>;
  return (
    <div>
      <span data-testid="value">{res.data}</span>
      {res.isRefreshing ? <span data-testid="refreshing">Updating…</span> : null}
    </div>
  );
}

describe('viewCache & useCachedResource', () => {
  beforeEach(() => {
    setViewCacheEnabled(true);
    setViewCacheUser('u-1');
  });

  it('deduplicates concurrent in-flight loads and returns fresh cache hits immediately', async () => {
    let resolveLoad!: (value: string) => void;
    const loader = vi.fn(
      () => new Promise<string>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const p1 = loadCachedView('team-work', loader);
    const p2 = loadCachedView('team-work', loader);
    expect(loader).toHaveBeenCalledTimes(1);

    resolveLoad('team-work-v1');
    await expect(Promise.all([p1, p2])).resolves.toEqual(['team-work-v1', 'team-work-v1']);

    const cached = await loadCachedView('team-work', loader);
    expect(cached).toBe('team-work-v1');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('renders cached route immediately on switch-back without loading flash, and revalidates silently after invalidation', async () => {
    const u = userEvent.setup();
    let resolveSecond!: (value: string) => void;
    const loaderA = vi.fn()
      .mockResolvedValueOnce('Team Work v1')
      .mockImplementationOnce(() => new Promise<string>((resolve) => {
        resolveSecond = resolve;
      }));
    const loaderB = vi.fn().mockResolvedValue('Open Jobs v1');

    render(
      <MemoryRouter initialEntries={['/a']}>
        <nav>
          <Link to="/a">Go A</Link>
          <Link to="/b">Go B</Link>
        </nav>
        <Routes>
          <Route path="/a" element={<TestView cacheKey="view-a" loader={loaderA} />} />
          <Route path="/b" element={<TestView cacheKey="view-b" loader={loaderB} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('value')).toHaveTextContent('Team Work v1');
    expect(loaderA).toHaveBeenCalledTimes(1);

    // Switch to B and back while fresh: 0 extra fetches and zero loading skeleton
    await u.click(screen.getByRole('link', { name: 'Go B' }));
    expect(await screen.findByTestId('value')).toHaveTextContent('Open Jobs v1');

    await u.click(screen.getByRole('link', { name: 'Go A' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('Team Work v1');
    expect(loaderA).toHaveBeenCalledTimes(1);

    // Switch to B, invalidate (simulating mutation), then return to A:
    // A still renders cached immediately (no skeleton flash) and updates cleanly in background.
    await u.click(screen.getByRole('link', { name: 'Go B' }));
    invalidateViewCache();
    await u.click(screen.getByRole('link', { name: 'Go A' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('Team Work v1');
    await waitFor(() => expect(loaderA).toHaveBeenCalledTimes(2));

    resolveSecond('Team Work v2');
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Team Work v2'));
  });

  it('purges all cached data when user changes or session clears, ignoring stale in-flight writes', async () => {
    let resolveOld!: (value: string) => void;
    const oldLoader = vi.fn(
      () => new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
    );

    const pending = loadCachedView('team-work', oldLoader);
    setViewCacheUser('u-2');

    resolveOld('u-1-secret');
    await pending;

    expect(readViewCache('team-work')).toBeNull();

    await loadCachedView('team-work', async () => 'u-2-data');
    expect(readViewCache('team-work')?.data).toBe('u-2-data');

    clearViewCache();
    expect(readViewCache('team-work')).toBeNull();
  });

  it('drops out-of-order responses when switching keys rapidly', async () => {
    let resolveToday!: (value: string) => void;
    let resolveTomorrow!: (value: string) => void;

    const loader = vi.fn((day: 'today' | 'tomorrow') => new Promise<string>((resolve) => {
      if (day === 'today') resolveToday = resolve;
      else resolveTomorrow = resolve;
    }));

    const { rerender } = render(<TestView cacheKey="my-work:today" loader={() => loader('today')} />);
    rerender(<TestView cacheKey="my-work:tomorrow" loader={() => loader('tomorrow')} />);

    resolveTomorrow('Tomorrow tasks');
    expect(await screen.findByTestId('value')).toHaveTextContent('Tomorrow tasks');

    // Older in-flight response for 'today' settles later -> must NOT overwrite visible 'tomorrow' UI.
    resolveToday('Today tasks');
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Tomorrow tasks'));
    expect(readViewCache('my-work:today')?.data).toBe('Today tasks');
  });
});
