import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ user: null as null | Record<string, unknown>, logout: vi.fn() }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../AppShell', () => ({ AppShell: () => <div data-testid="v1-shell">old shell</div> }));
vi.mock('../../components/v2/shell/AppShellV2', () => ({
  AppShellV2: ({ seat }: { seat: string }) => <div data-testid="v2-shell" data-seat={seat}>new shell</div>,
}));

import { SeatShellSwitch } from '../SeatShellSwitch';
import { shouldUseV2Shell } from '../../v2/seatSwitch';
import type { Seat } from '../../v2/seat';

const asUser = (code: string) => ({ id: 'u', displayName: 'U', email: 'u@x', roles: [{ id: 'r', code, name: code }], permissions: [] });
const decideWith = (flag: boolean, seats: string) => (seat: Seat) => shouldUseV2Shell(seat, { envFlag: flag, envSeats: seats });

afterEach(() => { document.documentElement.removeAttribute('data-ui'); auth.user = null; });

describe('SeatShellSwitch', () => {
  it.each([
    ['flag off → old shell', 'RECRUITER', false, 'employee', 'v1-shell', null],
    ['flag on, seat enabled → v2 shell', 'RECRUITER', true, 'employee', 'v2-shell', 'v2'],
    ['flag on, manager not enabled → old shell', 'HIRING_MANAGER', true, 'employee', 'v1-shell', null],
    ['flag on, manager enabled → v2 shell', 'HIRING_MANAGER', true, 'employee,manager', 'v2-shell', 'v2'],
    ['flag on, admin enabled → v2 shell', 'ADMINISTRATOR', true, 'all', 'v2-shell', 'v2'],
  ])('%s', (_label, code, flag, seats, testId, attr) => {
    document.documentElement.setAttribute('data-ui', 'v2'); // as set at boot by initUiVersion when the flag is on
    auth.user = asUser(code);
    render(<MemoryRouter><SeatShellSwitch decide={decideWith(flag, seats)} /></MemoryRouter>);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-ui')).toBe(attr);
  });

  it('passes the resolved seat to the v2 shell', () => {
    auth.user = asUser('HR_MANAGER');
    render(<MemoryRouter><SeatShellSwitch decide={() => true} /></MemoryRouter>);
    expect(screen.getByTestId('v2-shell')).toHaveAttribute('data-seat', 'manager');
  });

  it('flag-off parity: the v1 shell renders and no v2 attribute is left on <html>', () => {
    auth.user = asUser('RECRUITER');
    render(<MemoryRouter><SeatShellSwitch decide={() => false} /></MemoryRouter>);
    expect(screen.getByTestId('v1-shell')).toHaveTextContent('old shell');
    expect(screen.queryByTestId('v2-shell')).not.toBeInTheDocument();
    expect(document.documentElement.hasAttribute('data-ui')).toBe(false);
  });
});
