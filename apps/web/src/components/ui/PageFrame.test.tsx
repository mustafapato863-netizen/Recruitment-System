import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageFrame } from './PageFrame';

function stubCompact(matches: boolean) {
  const impl = (query: string) => ({
    matches: matches && query.includes('639'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
  vi.stubGlobal('matchMedia', impl);
  window.matchMedia = impl;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageFrame component', () => {
  it('renders title, eyebrow, and description', () => {
    render(
      <PageFrame
        eyebrow="Recruitment Operations"
        title="Openings & Job Cards"
        description="Manage active requisitions and vacancies across all branches."
      >
        <div>Content Body</div>
      </PageFrame>
    );

    expect(screen.getByText('Recruitment Operations')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Openings & Job Cards' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Openings & Job Cards' })).toHaveClass('rf-page-title');
    expect(screen.getByText('Manage active requisitions and vacancies across all branches.')).toBeVisible();
    expect(screen.getByText('Content Body')).toBeVisible();
  });

  it('renders actions and back button when configured', () => {
    render(
      <BrowserRouter>
        <PageFrame
          title="Vacancy Detail"
          showBack={true}
          backTo="/vacancies"
          actions={<button type="button">Edit Vacancy</button>}
        >
          <div>Vacancy Details Content</div>
        </PageFrame>
      </BrowserRouter>
    );

    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/vacancies');
    expect(screen.getByRole('button', { name: 'Edit Vacancy' })).toBeVisible();
  });

  it('keeps every action inline at the sm breakpoint and above', () => {
    render(
      <PageFrame
        title="Vacancies"
        actions={(
          <>
            <button type="button">Edit</button>
            <button type="button">Archive</button>
          </>
        )}
      >
        <div>Body</div>
      </PageFrame>,
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('moves actions after the first into a More menu below sm', async () => {
    stubCompact(true);
    const user = userEvent.setup();
    render(
      <PageFrame
        title="Vacancies"
        actions={(
          <>
            <button type="button">Edit</button>
            <button type="button">Archive</button>
          </>
        )}
      >
        <div>Body</div>
      </PageFrame>,
    );

    const more = await screen.findByRole('button', { name: 'More' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls');
    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeVisible();
  });

  it('honors an explicit primary action below sm', async () => {
    stubCompact(true);
    render(
      <PageFrame
        title="Vacancies"
        primaryAction={<button type="button">Create</button>}
        overflowActions={<button type="button">Export</button>}
      >
        <div>Body</div>
      </PageFrame>,
    );

    expect(await screen.findByRole('button', { name: 'More' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });
});
