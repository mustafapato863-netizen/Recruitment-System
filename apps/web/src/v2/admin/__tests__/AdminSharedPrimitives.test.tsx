import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import {
  AdminSectionBoundary,
  AdminToolbarV2,
  AdminWorkspaceHeader,
  useAdminUnsavedChanges,
} from '../AdminWorkspaceHeader';

function DirtyFormFixture({ dirty }: { dirty: boolean }) {
  const { confirmDiscard } = useAdminUnsavedChanges(dirty);
  return (
    <button
      type="button"
      onClick={() => {
        confirmDiscard('Discard form edits?');
      }}
    >
      Close form
    </button>
  );
}

describe('ADM-04: AdminWorkspaceHeader & AdminToolbarV2 composition', () => {
  it('renders header kicker, title, subtitle, sub-navigation, toolbar chips, and passes axe', async () => {
    const u = userEvent.setup();
    const onRemoveRole = vi.fn();
    const onClearAll = vi.fn();
    const onRefresh = vi.fn();

    document.documentElement.setAttribute('data-ui', 'v2');
    const { container } = render(
      <MemoryRouter initialEntries={['/audit-log']}>
        <div className="rf2-jobs rf2-admin">
          <AdminWorkspaceHeader
            group="Settings"
            title="Audit"
            subtitle="Inspect immutable configuration, workflow and override activity."
          />
          <AdminToolbarV2
            resultSummary="14 entries · page 1 of 1"
            chips={[
              {
                key: 'area',
                label: 'Area',
                value: 'Override',
                onRemove: onRemoveRole,
              },
            ]}
            onClearAll={onClearAll}
            onRefresh={onRefresh}
          >
            <input aria-label="Filter actor" defaultValue="Omar" />
          </AdminToolbarV2>
        </div>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Audit' })).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    const subnav = screen.getByRole('navigation', { name: 'Settings pages' });
    const links = subnav.querySelectorAll('a');
    expect(Array.from(links).map((a) => a.textContent)).toEqual(['Audit', 'Integrations']);
    expect(links[0]).toHaveAttribute('aria-current', 'page');

    expect(screen.getByText('14 entries · page 1 of 1')).toHaveAttribute('aria-live', 'polite');
    await u.click(screen.getByRole('button', { name: 'Remove filter Area: Override' }));
    expect(onRemoveRole).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ADM-04: AdminSectionBoundary state contract', () => {
  it('renders loading, ready, empty, filter-empty, forbidden (403), not-found (404), unavailable, and error + retry states cleanly', async () => {
    const u = userEvent.setup();
    const onRetry = vi.fn();
    const onClearFilters = vi.fn();
    document.documentElement.setAttribute('data-ui', 'v2');

    const { rerender, container } = render(
      <AdminSectionBoundary
        state={{ kind: 'loading' }}
        loadingLabel="Loading directory…"
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByRole('status', { name: 'Loading directory…' })).toHaveAttribute('aria-busy', 'true');

    rerender(
      <AdminSectionBoundary
        state={{ kind: 'empty' }}
        emptyTitle="No records yet"
        emptyBody="Create the first entry to begin."
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'No records yet' })).toBeInTheDocument();

    rerender(
      <AdminSectionBoundary
        state={{ kind: 'filter-empty' }}
        onClearFilters={onClearFilters}
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    await u.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    rerender(
      <AdminSectionBoundary
        state={{
          kind: 'forbidden',
          title: 'Role permissions required',
          message: 'You need ROLES_VIEW to read role grants.',
        }}
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByRole('alert', { name: 'Role permissions required' })).toHaveTextContent(
      'You need ROLES_VIEW to read role grants.',
    );

    rerender(
      <AdminSectionBoundary
        state={{
          kind: 'not-found',
          title: 'User not found',
          message: 'This user record does not exist in your organization.',
        }}
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'User not found' })).toBeInTheDocument();

    rerender(
      <AdminSectionBoundary
        state={{
          kind: 'unavailable',
          message: 'Session revocation is not on this server yet.',
        }}
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Session revocation is not on this server yet.');

    rerender(
      <AdminSectionBoundary
        state={{ kind: 'error', message: 'Database connection timed out.' }}
        errorTitle="Could not load roles"
        onRetry={onRetry}
      >
        {() => <p>Loaded content</p>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Database connection timed out.');
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <AdminSectionBoundary state={{ kind: 'ready', data: ['Admin', 'Recruiter'] }}>
        {(items) => <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}
      </AdminSectionBoundary>,
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ADM-04: useAdminUnsavedChanges guard', () => {
  it('prompts on confirmDiscard and registers beforeunload only when dirty is true', async () => {
    const u = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { rerender } = render(<DirtyFormFixture dirty={false} />);
    await u.click(screen.getByRole('button', { name: 'Close form' }));
    expect(confirmSpy).not.toHaveBeenCalled();

    rerender(<DirtyFormFixture dirty={true} />);
    await u.click(screen.getByRole('button', { name: 'Close form' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard form edits?');

    const unloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);

    confirmSpy.mockRestore();
  });
});

