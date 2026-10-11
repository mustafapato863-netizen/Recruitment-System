import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsersRolesPage } from '../UsersRolesPage';

vi.mock('../../components/ui/PageFrame', () => ({ PageFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../../components/access/AccessPolicyManager', () => ({ AccessPolicyManager: () => null }));
vi.mock('../../components/UserResponsibilityModal', () => ({ UserResponsibilityModal: () => null }));
vi.mock('../../api/client', () => ({ fetchApi: async () => [] }));

const selectedTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

afterEach(() => { window.history.replaceState(null, '', '/'); });

describe('UsersRolesPage #roles deep link', () => {
  it('v1 default is still the Users tab', () => {
    render(<MemoryRouter initialEntries={['/users']}><UsersRolesPage /></MemoryRouter>);
    expect(selectedTab()).toMatch(/^Users/);
  });

  it('/users#roles selects Roles, and the user can still switch tabs', async () => {
    const u = userEvent.setup();
    render(<MemoryRouter initialEntries={['/users#roles']}><UsersRolesPage /></MemoryRouter>);
    expect(selectedTab()).toMatch(/^Roles/);
    await u.click(screen.getAllByRole('tab').find((t) => /^Users/.test(t.textContent ?? ''))!);
    expect(selectedTab()).toMatch(/^Users/);
  });

  it('works outside a router via window.location.hash', () => {
    window.history.replaceState(null, '', '/users#roles');
    render(<UsersRolesPage />);
    expect(selectedTab()).toMatch(/^Roles/);
  });
});
