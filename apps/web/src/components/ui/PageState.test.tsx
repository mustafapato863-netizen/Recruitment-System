import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PageState } from './PageState';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('PageState operational variants', () => {
  it('renders loading state with accessible spinner', () => {
    render(<PageState kind="loading" title="Loading candidates..." description="Fetching latest applications" />);
    expect(screen.getByText('Loading candidates...')).toBeVisible();
    expect(screen.getByText('Fetching latest applications')).toBeVisible();
  });

  it('renders empty state with action button', async () => {
    const onAction = vi.fn();
    render(<PageState kind="empty" title="No candidates found" description="Try adjusting your filters" actionLabel="Create candidate" onAction={onAction} />);
    expect(screen.getByText('No candidates found')).toBeVisible();
    expect(screen.getByText('Try adjusting your filters')).toBeVisible();
    const btn = screen.getByRole('button', { name: 'Create candidate' });
    expect(btn).toBeVisible();
    await userEvent.click(btn);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders unauthorized state with sign-in link', () => {
    renderWithRouter(<PageState kind="unauthorized" title="Session expired" actionHref="/login" actionLabel="Sign in" />);
    expect(screen.getByText('Session expired')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('renders forbidden state with access explanation', () => {
    renderWithRouter(<PageState kind="forbidden" title="Access Restricted" description="Requires USERS_MANAGE permission." actionHref="/" actionLabel="Back to Home" />);
    expect(screen.getByText('Access Restricted')).toBeVisible();
    expect(screen.getByText('Requires USERS_MANAGE permission.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toBeVisible();
  });

  it('renders not-found state with return action', () => {
    renderWithRouter(<PageState kind="not-found" title="Vacancy not found" description="The requested vacancy may have been archived." actionHref="/vacancies" actionLabel="View all vacancies" />);
    expect(screen.getByText('Vacancy not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View all vacancies' })).toBeVisible();
  });

  it('renders unavailable state with retry action', async () => {
    const onRetry = vi.fn();
    render(<PageState kind="unavailable" title="Reports service offline" actionLabel="Retry connection" onAction={onRetry} />);
    expect(screen.getByText('Reports service offline')).toBeVisible();
    const retryBtn = screen.getByRole('button', { name: 'Retry connection' });
    expect(retryBtn).toBeVisible();
    await userEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders stale state with a safe refresh action', () => {
    render(<PageState kind="stale" title="Data may be out of date" onAction={vi.fn()} />);
    expect(screen.getByText('Data may be out of date')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  it('renders partial-success banner without presenting it as a clean result', () => {
    render(<PageState kind="partial-success" title="Import partially complete" description="2 rows need attention." />);
    expect(screen.getByRole('status')).toHaveTextContent('Import partially complete');
    expect(screen.getByRole('status')).toHaveTextContent('2 rows need attention.');
  });

  it('renders error state with actionable message', async () => {
    const onAction = vi.fn();
    render(<PageState kind="error" title="Failed to save changes" description="Network timeout occurred." actionLabel="Try again" onAction={onAction} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save changes');
    expect(screen.getByRole('alert')).toHaveTextContent('Network timeout occurred.');
    const actionBtn = screen.getByRole('button', { name: 'Try again' });
    await userEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledOnce();
  });
});
