import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../MyWorkV2', () => ({ MyWorkV2: () => <p>v2 my work</p> }));
vi.mock('../TeamWorkV2', () => ({ TeamWorkV2: () => <p>v2 team work</p> }));
import { MyWorkRoute } from '../MyWorkRoute';

const r = () => render(<MemoryRouter><Suspense fallback="…"><MyWorkRoute /></Suspense></MemoryRouter>);

describe('MyWorkRoute', () => {
  it('v2 default: My Work even without a shell context (no v1 page any more)', () => {
    shell.value = null; r();
    expect(screen.getByText('v2 my work')).toBeInTheDocument();
  });
  it('v2 Team work for the Manager seat (M2)', () => {
    shell.value = { seat: 'manager' }; r();
    expect(screen.getByText('v2 team work')).toBeInTheDocument();
  });
  it('never a v1 page (Admin is redirected to /users by the shell before this renders)', () => {
    shell.value = { seat: 'admin' }; r();
    expect(screen.queryByText(/v1/)).toBeNull();
  });
  it('v2 page for the Employee seat', () => {
    shell.value = { seat: 'employee' }; r();
    expect(screen.getByText('v2 my work')).toBeInTheDocument();
  });
});
