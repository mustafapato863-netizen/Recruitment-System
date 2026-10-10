import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { OpenJobsV2 } from './OpenJobsV2';
import { JobPipelineV2 } from './JobPipelineV2';

const VacantListPage = lazy(() => import('../../pages/VacantListPage').then((m) => ({ default: m.VacantListPage })));
const VacancyOverviewPage = lazy(() => import('../../pages/VacancyOverviewPage').then((m) => ({ default: m.VacancyOverviewPage })));

/** /vacancies: E08 for the v2 Employee seat; v1 list otherwise. */
export function JobsListRoute() {
  return useV2Shell()?.seat === 'employee' ? <OpenJobsV2 /> : <VacantListPage />;
}
/** /vacancies/:id: E09 for the v2 Employee seat; v1 overview otherwise. */
export function JobDetailRoute() {
  return useV2Shell()?.seat === 'employee' ? <JobPipelineV2 /> : <VacancyOverviewPage />;
}
