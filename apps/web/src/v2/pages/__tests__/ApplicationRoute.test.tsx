import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../ApplicationFileV2', () => ({ ApplicationFileV2: () => <p>v2 file</p> }));
import { ApplicationRoute } from '../ApplicationRoute';

const r = () => render(<MemoryRouter><Suspense fallback="…"><ApplicationRoute /></Suspense></MemoryRouter>);

describe('/applications/:id route', () => {
  it('v2 default: the v2 file without a shell context too (no v1 detail any more)', () => { shell.value = null; r(); expect(screen.getByText('v2 file')).toBeInTheDocument(); });
  it('v2 file (manager mode) for the Manager seat (B2-18/B2-23)', () => { shell.value = { seat: 'manager' }; r(); expect(screen.getByText('v2 file')).toBeInTheDocument(); });
  it('v2 file (E13) for the Employee seat', () => { shell.value = { seat: 'employee' }; r(); expect(screen.getByText('v2 file')).toBeInTheDocument(); });
});
