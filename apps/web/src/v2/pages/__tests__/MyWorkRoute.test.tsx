import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../MyWorkV2', () => ({ MyWorkV2: () => <p>v2 my work</p> }));
vi.mock('../../../pages/MyWorkPage', () => ({ MyWorkPage: () => <p>v1 my work</p> }));
import { MyWorkRoute } from '../MyWorkRoute';

const r = () => render(<MemoryRouter><Suspense fallback="…"><MyWorkRoute /></Suspense></MemoryRouter>);

describe('MyWorkRoute', () => {
  it('v1 page outside the v2 shell (flag off parity)', async () => {
    shell.value = null; r();
    expect(await screen.findByText('v1 my work')).toBeInTheDocument();
  });
  it('v1 page for Manager Team work in the v2 shell', async () => {
    shell.value = { seat: 'manager' }; r();
    expect(await screen.findByText('v1 my work')).toBeInTheDocument();
  });
  it('v2 page for the Employee seat', () => {
    shell.value = { seat: 'employee' }; r();
    expect(screen.getByText('v2 my work')).toBeInTheDocument();
  });
});
