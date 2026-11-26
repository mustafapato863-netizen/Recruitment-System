import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RotateCw } from 'lucide-react';
import { ApiError, downloadFileApi, getApi } from '../../api/client';
import { ButtonV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';

export interface VacancyTrackerRow {
  requestId: string;
  requestCode: string;
  vacancyId: string | null;
  vacancyCode: string | null;
  positionTitle: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  openingType: string;
  ownerName: string;
  status: string;
  isOpen: boolean;
  approvedAt: string | null;
  activatedAt: string | null;
  requestedSeats: number;
  filledSeats: number;
  remainingSeats: number;
  vacantDays: number | null;
}

export interface VacancyTrackerResponse {
  range: { from: string; to: string };
  summary: {
    totalRequestsCount: number;
    openRequestsCount: number;
    totalRequestedSeats: number;
    totalFilledSeats: number;
    totalRemainingSeats: number;
  };
  rows: VacancyTrackerRow[];
}

export interface CandidateActivityRow {
  applicationId: string;
  applicationCode: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  departmentName: string;
  source: string;
  ownerName: string;
  currentStage: string;
  appliedAt: string;
  applied: boolean;
  reachedScreening: boolean;
  reachedHrInterview: boolean;
  reachedTechnicalInterview: boolean;
  reachedAssessmentInterview: boolean;
  offerSent: boolean;
  offerDeclined: boolean;
  declineReason: string | null;
  joined: boolean;
  joinedAt: string | null;
}

export interface CandidateActivityResponse {
  range: { from: string; to: string };
  totals: {
    applications: number;
    applied: number;
    screening: number;
    hrInterview: number;
    technicalInterview: number;
    assessmentInterview: number;
    offerSent: number;
    offerDeclined: number;
    joined: number;
  };
  bySource: Array<{
    source: string;
    applied: number;
    screening: number;
    interviews: number;
    offerSent: number;
    joined: number;
  }>;
  declineReasons: Array<{ reason: string; count: number }>;
  rows: CandidateActivityRow[];
}

export interface OperationalReportsFilter {
  month?: string | null;
  from?: string | null;
  to?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
}

function buildQuery(filters: OperationalReportsFilter): string {
  const qs = new URLSearchParams();
  if (filters.month) qs.set('month', filters.month);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.branchId && filters.branchId !== 'all') qs.set('branchId', filters.branchId);
  if (filters.departmentId && filters.departmentId !== 'all') qs.set('departmentId', filters.departmentId);
  if (filters.ownerId && filters.ownerId !== 'all') qs.set('ownerId', filters.ownerId);
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export function OperationalReportsPanel({
  filters,
  defaultOpen = true,
}: {
  filters: OperationalReportsFilter;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<'vacancy' | 'activity'>('vacancy');
  const [vacancyData, setVacancyData] = useState<VacancyTrackerResponse | null>(null);
  const [activityData, setActivityData] = useState<CandidateActivityResponse | null>(null);
  const [loading, setLoading] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const queryStr = buildQuery(filters);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    const endpoint = tab === 'vacancy'
      ? `/reports/vacancy-tracker${queryStr}`
      : `/reports/candidate-activity${queryStr}`;

    getApi<VacancyTrackerResponse | CandidateActivityResponse>(endpoint)
      .then((res) => {
        if (!alive) return;
        if (tab === 'vacancy') {
          const vt = res as VacancyTrackerResponse;
          setVacancyData(vt && vt.summary && Array.isArray(vt.rows) ? vt : null);
        } else {
          const ca = res as CandidateActivityResponse;
          setActivityData(ca && ca.totals && Array.isArray(ca.rows) ? ca : null);
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof ApiError || e instanceof Error ? e.message : 'Could not load operational report.');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [open, tab, queryStr, attempt]);

  const handleExport = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const path = tab === 'vacancy'
        ? `/reports/vacancy-tracker/export.xlsx${queryStr}`
        : `/reports/candidate-activity/export.xlsx${queryStr}`;
      const fallbackName = tab === 'vacancy' ? 'vacancy-tracker.xlsx' : 'candidate-activity.xlsx';
      const { blob, filename } = await downloadFileApi(path, fallbackName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || fallbackName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not export Excel workbook.');
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <section className="rf2-panel" aria-labelledby="ops-reports-heading" style={{ marginTop: '1.5rem' }}>
      <div className="rf2-row-between" style={{ gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 id="ops-reports-heading" className="rf2-card__title">Operational Reports</h2>
          <p className="rf2-file__muted">
            Vacancy Tracker and Candidate Activity scoped to your role and active report filters.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {open ? (
            <>
              <div className="rf2-tabs" role="tablist" aria-label="Operational report views">
                <button
                  type="button"
                  role="tab"
                  className="rf2-tab"
                  aria-selected={tab === 'vacancy'}
                  onClick={() => setTab('vacancy')}
                >
                  Vacancy Tracker
                </button>
                <button
                  type="button"
                  role="tab"
                  className="rf2-tab"
                  aria-selected={tab === 'activity'}
                  onClick={() => setTab('activity')}
                >
                  Candidate Activity
                </button>
              </div>
              <ButtonV2 kind="secondary" size="sm" icon={<Download />} loading={exportBusy} onClick={() => void handleExport()}>
                Export Excel (.xlsx)
              </ButtonV2>
              {!defaultOpen ? (
                <ButtonV2 kind="tertiary" size="sm" onClick={() => setOpen(false)}>Hide</ButtonV2>
              ) : null}
            </>
          ) : (
            <>
              <ButtonV2 kind="secondary" size="sm" onClick={() => { setTab('vacancy'); setOpen(true); }}>
                Open Vacancy Tracker
              </ButtonV2>
              <ButtonV2 kind="secondary" size="sm" onClick={() => { setTab('activity'); setOpen(true); }}>
                Open Candidate Activity
              </ButtonV2>
            </>
          )}
        </div>
      </div>

      {!open ? null : (
        <>
          {exportError ? <p className="rf2-form-error" role="alert">{exportError}</p> : null}

          {loading ? <SkeletonV2 lines={5} label="Loading operational report…" /> : null}

      {!loading && error ? (
        <div role="alert">
          <EmptyStateV2
            headingLevel={3}
            title="Could not load report"
            body={error}
            action={<ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Retry</ButtonV2>}
          />
        </div>
      ) : null}

      {!loading && !error && tab === 'vacancy' && vacancyData ? (
        <>
          <ul className="rf2-team__summary-cards" aria-label="Vacancy Tracker summary" style={{ marginBottom: '1rem' }}>
            <li>
              <span className="rf2-team__sum-copy">
                <span className="rf2-team__sum-value" data-testid="vt-open-requests">{vacancyData.summary.openRequestsCount}</span>
                <span className="rf2-team__sum-label">Open requests</span>
              </span>
            </li>
            <li>
              <span className="rf2-team__sum-copy">
                <span className="rf2-team__sum-value" data-testid="vt-requested-seats">{vacancyData.summary.totalRequestedSeats}</span>
                <span className="rf2-team__sum-label">Requested seats</span>
              </span>
            </li>
            <li>
              <span className="rf2-team__sum-copy">
                <span className="rf2-team__sum-value" data-testid="vt-filled-seats">{vacancyData.summary.totalFilledSeats}</span>
                <span className="rf2-team__sum-label">Filled seats</span>
              </span>
            </li>
            <li>
              <span className="rf2-team__sum-copy">
                <span className="rf2-team__sum-value" data-testid="vt-remaining-seats">{vacancyData.summary.totalRemainingSeats}</span>
                <span className="rf2-team__sum-label">Remaining seats</span>
              </span>
            </li>
          </ul>

          {vacancyData.rows.length === 0 ? (
            <EmptyStateV2 headingLevel={3} title="No vacancy requests in this period" body="Adjust the date range or branch filter to view matching requisitions." />
          ) : (
            <div className="rf2-jscroll">
              <table className="rf2-jtable" aria-label="Vacancy Tracker table">
                <thead>
                  <tr>
                    <th scope="col">Request</th>
                    <th scope="col">Position</th>
                    <th scope="col">Branch & Dept</th>
                    <th scope="col">Opening Type</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Status</th>
                    <th scope="col">Seats (Filled / Req)</th>
                    <th scope="col">Remaining</th>
                    <th scope="col">Vacant Days</th>
                  </tr>
                </thead>
                <tbody>
                  {vacancyData.rows.map((row) => (
                    <tr key={row.requestId}>
                      <td>{row.requestCode}{row.vacancyCode ? ` · ${row.vacancyCode}` : ''}</td>
                      <td>{row.positionTitle}</td>
                      <td>{[row.branchName, row.departmentName].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{row.openingType}</td>
                      <td>{row.ownerName}</td>
                      <td><StatusChip tone={row.isOpen ? 'info' : 'neutral'} label={row.status} /></td>
                      <td>{row.filledSeats} / {row.requestedSeats}</td>
                      <td>{row.remainingSeats}</td>
                      <td>{row.vacantDays == null ? 'Not activated' : `${row.vacantDays} d`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {!loading && !error && tab === 'activity' && activityData ? (
        <>
          <ul className="rf2-team__summary-cards" aria-label="Candidate Activity summary" style={{ marginBottom: '1rem' }}>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-applied">{activityData.totals.applied}</span><span className="rf2-team__sum-label">Applied</span></span></li>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-screening">{activityData.totals.screening}</span><span className="rf2-team__sum-label">Screening</span></span></li>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-tech">{activityData.totals.technicalInterview}</span><span className="rf2-team__sum-label">Technical Interview</span></span></li>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-assess">{activityData.totals.assessmentInterview}</span><span className="rf2-team__sum-label">Pre-Hire Assessment</span></span></li>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-offer">{activityData.totals.offerSent}</span><span className="rf2-team__sum-label">Offer Sent</span></span></li>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-declined">{activityData.totals.offerDeclined}</span><span className="rf2-team__sum-label">Offer Declined</span></span></li>
            <li><span className="rf2-team__sum-copy"><span className="rf2-team__sum-value" data-testid="ca-joined">{activityData.totals.joined}</span><span className="rf2-team__sum-label">Joined</span></span></li>
          </ul>

          {activityData.declineReasons.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }} aria-label="Offer decline reasons">
              {activityData.declineReasons.map((item) => (
                <StatusChip key={item.reason} tone="warning" label={`${item.reason}: ${item.count}`} />
              ))}
            </div>
          ) : null}

          {activityData.rows.length === 0 ? (
            <EmptyStateV2 headingLevel={3} title="No candidate activity in this period" body="No applications reached a tracked stage during the selected date range and filters." />
          ) : (
            <div className="rf2-jscroll">
              <table className="rf2-jtable" aria-label="Candidate Activity drill-down">
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Position & Branch</th>
                    <th scope="col">Source</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Current Stage</th>
                    <th scope="col">Milestones in Period</th>
                    <th scope="col">Decline Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {activityData.rows.map((row) => {
                    const reached = [
                      row.applied ? 'Applied' : null,
                      row.reachedScreening ? 'Screening' : null,
                      row.reachedHrInterview ? 'HR Interview' : null,
                      row.reachedTechnicalInterview ? 'Technical' : null,
                      row.reachedAssessmentInterview ? 'Assessment' : null,
                      row.offerSent ? 'Offer Sent' : null,
                      row.offerDeclined ? 'Offer Declined' : null,
                      row.joined ? 'Joined' : null,
                    ].filter(Boolean);
                    return (
                      <tr key={row.applicationId}>
                        <td>
                          <Link className="rf2-kcard__name" to={`/applications/${encodeURIComponent(row.applicationId)}`}>
                            {row.candidateName}
                          </Link>
                        </td>
                        <td>{[row.positionTitle, row.branchName].filter(Boolean).join(' · ')}</td>
                        <td>{row.source}</td>
                        <td>{row.ownerName}</td>
                        <td><StatusChip tone={row.joined ? 'success' : row.offerDeclined ? 'danger' : 'info'} label={row.currentStage} /></td>
                        <td>{reached.join(' · ') || '—'}</td>
                        <td>{row.declineReason ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
        </>
      )}
    </section>
  );
}
