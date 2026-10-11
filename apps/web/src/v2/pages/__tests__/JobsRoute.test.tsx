import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../OpenJobsV2', () => ({ OpenJobsV2: () => <p>v2 open jobs</p> }));
vi.mock('../JobPipelineV2', () => ({ JobPipelineV2: () => <p>v2 pipeline</p> }));
import { JobDetailRoute, JobsListRoute } from '../JobsRoute';

const r = (el: React.ReactElement) => render(<MemoryRouter><Suspense fallback="…">{el}</Suspense></MemoryRouter>);

describe('/vacancies routes', () => {
  it('v2 default: E08 / E09 without a shell context too (no v1 list or overview any more)', () => {
    shell.value = null;
    r(<><JobsListRoute /><JobDetailRoute /></>);
    expect(screen.getByText('v2 open jobs')).toBeInTheDocument();
    expect(screen.getByText('v2 pipeline')).toBeInTheDocument();
  });
  it('E08 / E09 for the Employee seat', () => {
    shell.value = { seat: 'employee' };
    r(<><JobsListRoute /><JobDetailRoute /></>);
    expect(screen.getByText('v2 open jobs')).toBeInTheDocument();
    expect(screen.getByText('v2 pipeline')).toBeInTheDocument();
  });
});
