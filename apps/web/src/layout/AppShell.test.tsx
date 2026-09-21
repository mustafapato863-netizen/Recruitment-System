import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavigationItem } from './AppShell';

const authState = vi.hoisted(() => ({
  user: {
    id: 'emp-1',
    displayName: 'Employee User',
    email: 'e@test.com',
    roles: [{ id: 'r-recruiter', name: 'RECRUITER', code: 'RECRUITER' }],
    permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW'] as string[],
  },
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
  }),
}));

describe('NavigationItem Component', () => {
  it('renders navigation item with icon and label when expanded', () => {
    render(
      <MemoryRouter>
        <NavigationItem
          icon="briefcase"
          label="Job Positions"
          to="/vacancies"
          navigationKey="vacancies"
          isCollapsed={false}
          allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']}
        />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Job Positions' });
    expect(link).toBeInTheDocument();
    expect(link.querySelector('.ico')).toBeInTheDocument();
    expect(screen.getByText('Job Positions')).toBeInTheDocument();
  });

  it('renders navigation item with icon and tooltip when collapsed', () => {
    render(
      <MemoryRouter>
        <NavigationItem
          icon="users"
          label="Applications"
          to="/applications"
          navigationKey="applications"
          isCollapsed={true}
          allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']}
        />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Applications' });
    expect(link).toBeInTheDocument();
    expect(link.querySelector('.ico')).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Applications');
  });

  it('allows recruiter employee persona to access recruitment navigation items', () => {
    render(
      <MemoryRouter>
        <NavigationItem
          icon="offer"
          label="Offers"
          to="/offers"
          navigationKey="offers"
          isCollapsed={true}
          allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Offers' })).toBeInTheDocument();
  });

  it('disables items the user cannot access and explains the required permission', () => {
    render(
      <MemoryRouter>
        <NavigationItem
          icon="upload"
          label="CV Intake"
          to="/cv-intake"
          navigationKey="cv-intake"
          isCollapsed={false}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'CV Intake' })).not.toBeInTheDocument();
    const locked = screen.getByText('CV Intake').closest('[aria-disabled="true"]');
    expect(locked).toBeTruthy();
    expect(locked).toHaveAttribute('title', expect.stringContaining('CANDIDATE_CREATE'));
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});
