import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../ApplicationFileV2', () => ({ ApplicationFileV2: () => <p>v2 file</p> }));
vi.mock('../../../pages/ApplicationDetailPage', () => ({ ApplicationDetailPage: () => <p>v1 detail</p> }));
import { ApplicationRoute } from '../ApplicationRoute';

const r = () => render(<MemoryRouter><Suspense fallback="…"><ApplicationRoute /></Suspense></MemoryRouter>);

describe('/applications/:id route', () => {
  it('v1 detail outside the v2 shell (flag off parity)', async () => { shell.value = null; r(); expect(await screen.findByText('v1 detail')).toBeInTheDocument(); });
  it('v1 detail for the Manager seat', async () => { shell.value = { seat: 'manager' }; r(); expect(await screen.findByText('v1 detail')).toBeInTheDocument(); });
  it('v2 file (E13) for the Employee seat', () => { shell.value = { seat: 'employee' }; r(); expect(screen.getByText('v2 file')).toBeInTheDocument(); });
});
