import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../OpenJobsV2', () => ({ OpenJobsV2: () => <p>v2 open jobs</p> }));
vi.mock('../JobPipelineV2', () => ({ JobPipelineV2: () => <p>v2 pipeline</p> }));
vi.mock('../../../pages/VacantListPage', () => ({ VacantListPage: () => <p>v1 list</p> }));
vi.mock('../../../pages/VacancyOverviewPage', () => ({ VacancyOverviewPage: () => <p>v1 overview</p> }));
import { JobDetailRoute, JobsListRoute } from '../JobsRoute';

const r = (el: React.ReactElement) => render(<MemoryRouter><Suspense fallback="…">{el}</Suspense></MemoryRouter>);

describe('/vacancies routes', () => {
  it('v1 outside the v2 shell (flag-off parity)', async () => {
    shell.value = null;
    r(<JobsListRoute />); expect(await screen.findByText('v1 list')).toBeInTheDocument();
  });
  it('v1 for the Manager seat', async () => {
    shell.value = { seat: 'manager' };
    r(<JobDetailRoute />); expect(await screen.findByText('v1 overview')).toBeInTheDocument();
  });
  it('E08 / E09 for the Employee seat', () => {
    shell.value = { seat: 'employee' };
    r(<><JobsListRoute /><JobDetailRoute /></>);
    expect(screen.getByText('v2 open jobs')).toBeInTheDocument();
    expect(screen.getByText('v2 pipeline')).toBeInTheDocument();
  });
});
