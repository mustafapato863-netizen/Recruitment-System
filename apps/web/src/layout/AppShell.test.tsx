import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavigationItem } from './AppShell';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'emp-1',
      displayName: 'Employee User',
      email: 'e@test.com',
      roles: [{ id: 'r-recruiter', name: 'RECRUITER', code: 'RECRUITER' }],
    },
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
          isCollapsed={true}
          allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Offers' })).toBeInTheDocument();
  });
});
