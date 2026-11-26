import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, Building2, RotateCw } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { ACCEPTING_JOB_STATUSES, isRedactedJob, jobTitle, loadJobBoard, type JobDetail } from '../api/jobs';
import { CvUploadCore } from '../drawers/ImportCvsDrawer';
import { STATUS_LABEL, STATUS_TONE } from './OpenJobsV2';
import './jobs.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; job: JobDetail }
  | { kind: 'forbidden'; message?: string }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

/**
 * Ticket 10: Full-page CV Upload & ATS Extraction workflow (/vacancies/:id/upload-cv).
 * Replaces the cramped drawer with a full-width page showing ATS extraction →
 * duplicate check → skills match → review & add to Applied, including certifications.
 */
export function UploadCvPageV2() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    loadJobBoard(id)
      .then((board) => {
        if (!live) return;
        if (isRedactedJob(board.job)) {
          setState({ kind: 'forbidden', message: 'Only the job owner and their manager can upload CVs to this job.' });
          return;
        }
        setState({ kind: 'ready', job: board.job });
      })
      .catch((e: { statusCode?: number; message?: string }) => {
        if (!live) return;
        if (e?.statusCode === 403) setState({ kind: 'forbidden', message: e.message });
        else if (e?.statusCode === 404) setState({ kind: 'missing' });
        else setState({ kind: 'error', message: e?.message || 'Could not load this job.' });
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const backHref = `/vacancies/${encodeURIComponent(id)}`;

  if (state.kind === 'loading') {
    return <div className="rf2-jobs"><SkeletonV2 lines={6} label="Loading job for CV upload…" /></div>;
  }
  if (state.kind === 'forbidden') {
    return (
      <div className="rf2-jobs">
        <ForbiddenStateV2
          body={state.message || 'You do not have permission to upload CVs to this job.'}
          action={<Link className="rf2-link" to="/vacancies">Back to Open jobs</Link>}
        />
      </div>
    );
  }
  if (state.kind === 'missing') {
    return (
      <div className="rf2-jobs">
        <EmptyStateV2
          title="Job not found"
          body="This vacancy could not be found in your scope."
          action={<Link className="rf2-link" to="/vacancies">Back to Open jobs</Link>}
        />
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="rf2-jobs" role="alert">
        <EmptyStateV2
          title="Could not load job"
          body={state.message}
          action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>}
        />
      </div>
    );
  }

  const { job } = state;
  const title = jobTitle(job);
  const accepting = ACCEPTING_JOB_STATUSES.includes(job.status);

  return (
    <div className="rf2-jobs">
      <nav aria-label="Breadcrumb" className="rf2-crumbs">
        <Link to="/vacancies">Open jobs</Link>
        {' › '}
        <Link to={backHref}>{title}</Link>
        {' › '}
        <span aria-current="page">Upload CVs</span>
      </nav>

      <section className="rf2-panel rf2-jobhead" aria-label="Target job header">
        <div className="rf2-jobhead__top">
          <div className="rf2-jobhead__id">
            <span className="rf2-jobhead__mark" aria-hidden="true"><BriefcaseBusiness /></span>
            <div className="rf2-jobhead__copy">
              <h1 className="rf2-jobhead__title">
                Upload CVs — {title} <StatusChip tone={STATUS_TONE[job.status]} label={STATUS_LABEL[job.status]} />
              </h1>
              <p className="rf2-jobhead__meta">
                {job.vacancyCode ? <span>{job.vacancyCode}</span> : null}
                {job.department ? <span>{job.department}</span> : null}
                {job.branch?.name ? <span><Building2 aria-hidden="true" />{job.branch.name}</span> : null}
              </p>
            </div>
          </div>
          <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={backHref}>
            <ArrowLeft aria-hidden="true" /> Back to {title}
          </Link>
        </div>
      </section>

      {!accepting ? (
        <EmptyStateV2
          title="Job is not accepting new CVs"
          body={`This job is ${STATUS_LABEL[job.status].toLowerCase()}. Reopen it to add candidates.`}
          action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={backHref}>Back to {title}</Link>}
        />
      ) : (
        <section className="rf2-panel" aria-label="CV upload workspace">
          <CvUploadCore
            job={job}
            mode="page"
            onClose={() => navigate(backHref)}
            onDone={() => navigate(backHref)}
          />
        </section>
      )}
    </div>
  );
}
