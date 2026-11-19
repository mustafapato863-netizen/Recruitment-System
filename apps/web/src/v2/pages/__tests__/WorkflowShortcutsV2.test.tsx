import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: {
    permissions: [] as string[],
    roles: [{ code: 'RECRUITER' }],
  },
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => auth }));

import { WorkflowShortcutsV2 } from '../WorkflowShortcutsV2';

const show = (seat: 'employee' | 'manager') =>
  render(<MemoryRouter><WorkflowShortcutsV2 seat={seat} /></MemoryRouter>);

describe('permission-safe secondary V2 workflow navigation', () => {
  beforeEach(() => { auth.user.permissions = []; });

  it('shows CV bank, match skills and hiring workflows only when a recruiter is authorized', () => {
    auth.user.permissions = ['APPLICATION_VIEW', 'CANDIDATE_VIEW'];
    show('employee');
    const nav = screen.getByRole('navigation', { name: 'Recruitment workflow shortcuts' });
    expect(within(nav).getAllByRole('link').map((node) => node.textContent)).toEqual([
      'Offers', 'Hiring cases', 'Joinings', 'CV bank', 'Match skills',
    ]);
    expect(within(nav).getByRole('link', { name: /Hiring cases/ })).toHaveAttribute('href', '/hires');
    expect(within(nav).getByRole('link', { name: /CV bank/ })).toHaveAttribute('href', '/cv-bank');
  });

  it('shows manager hiring flows without linking to employee-only CV sources', () => {
    auth.user.permissions = ['APPLICATION_VIEW', 'CANDIDATE_VIEW'];
    show('manager');
    const nav = screen.getByRole('navigation', { name: 'Recruitment workflow shortcuts' });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
    expect(within(nav).queryByRole('link', { name: /CV bank/ })).not.toBeInTheDocument();
  });

  it('never advertises application records to restricted users', () => {
    auth.user.permissions = ['FINAL_HIRING_APPROVAL', 'LICENSE_CHECK'];
    show('employee');
    expect(screen.queryByRole('navigation', { name: 'Recruitment workflow shortcuts' })).not.toBeInTheDocument();
  });
});
