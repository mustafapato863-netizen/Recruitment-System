import { OpenJobsV2 } from './OpenJobsV2';
import { JobPipelineV2 } from './JobPipelineV2';

/** /vacancies: E08. */
export function JobsListRoute() { return <OpenJobsV2 />; }
/** /vacancies/:id: E09. */
export function JobDetailRoute() { return <JobPipelineV2 />; }
