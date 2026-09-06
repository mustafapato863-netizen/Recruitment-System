import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BreadcrumbsBar } from './BreadcrumbsBar';
import { BreadcrumbProvider, useSetBreadcrumbTitle } from '../../context/BreadcrumbContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BreadcrumbsBar Component', () => {
  it('returns null when on root path "/"', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <BreadcrumbsBar />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders breadcrumb trail and back button on nested route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/vacancies']}>
        <BreadcrumbsBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Job Positions')).toBeInTheDocument();
    expect(screen.getByText('Job Positions')).toHaveAttribute('aria-current', 'page');

    const backBtn = screen.getByRole('button', { name: /back/i });
    await user.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('handles deep paths such as /offers/new with friendly names', () => {
    render(
      <MemoryRouter initialEntries={['/offers/new']}>
        <BreadcrumbsBar />
      </MemoryRouter>
    );

    expect(screen.getByText('Offers & Packages')).toBeInTheDocument();
    expect(screen.getByText('Create New')).toBeInTheDocument();
    expect(screen.getByText('Create New')).toHaveAttribute('aria-current', 'page');
  });

  it('renders contextual label for UUID or numeric ID routes instead of generic Item #xxx', () => {
    render(
      <MemoryRouter initialEntries={['/interviews/20000000-0000-0000-0000-000000000001']}>
        <BreadcrumbsBar />
      </MemoryRouter>
    );

    expect(screen.getByText('Interviews & Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Interview Details')).toBeInTheDocument();
    expect(screen.queryByText(/Item #/i)).not.toBeInTheDocument();
  });

  it('renders human-readable contextual fallback for applications ID route', () => {
    render(
      <MemoryRouter initialEntries={['/applications/200000']}>
        <BreadcrumbsBar />
      </MemoryRouter>
    );

    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByText('Application Details')).toBeInTheDocument();
  });

  it('renders dynamic title set via useSetBreadcrumbTitle', () => {
    function PageWithTitle() {
      useSetBreadcrumbTitle('Senior React Engineer');
      return <div>Page Content</div>;
    }

    render(
      <MemoryRouter initialEntries={['/vacancies/vac-123']}>
        <BreadcrumbProvider>
          <BreadcrumbsBar />
          <PageWithTitle />
        </BreadcrumbProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Senior React Engineer')).toBeInTheDocument();
  });
});
