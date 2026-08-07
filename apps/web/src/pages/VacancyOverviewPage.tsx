import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import type { VacancyDetailView, VacancyStatus } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export function VacancyOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [vacancy, setVacancy] = useState<VacancyDetailView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      setVacancy(await fetchApi<VacancyDetailView>(`/vacancies/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this vacancy');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const updateStatus = async (status: VacancyStatus) => {
    if (!id || !vacancy || !globalThis.confirm(`Change vacancy status to ${status}?`)) return;
    setBusyAction(true);
    try {
      await fetchApi(`/vacancies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update vacancy status');
    } finally {
      setBusyAction(false);
    }
  };

  if (isLoading) return <div className="alert loading-alert" role="status">Loading vacancy...</div>;
  if (error && !vacancy) return <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>;
  if (!vacancy) return null;

  const funnel = [
    ['Applied', vacancy.funnelCounts.applied],
    ['Screening', vacancy.funnelCounts.screening],
    ['Interviews', vacancy.funnelCounts.interviews],
    ['Offers', vacancy.funnelCounts.offer],
    ['Pre-hire', vacancy.funnelCounts.preHire],
    ['Joined', vacancy.funnelCounts.joined],
  ] as const;

  return (
    <div className="vacancy-overview-page">
      <div className="page-heading"><div><span className="eyebrow">Vacancies / {vacancy.vacancyCode}</span><h1>{vacancy.positionTitle || vacancy.vacancyCode}</h1><p>{vacancy.branchName || vacancy.branchId} · Created {new Date(vacancy.createdAt).toLocaleDateString()}</p></div><div className="inline-actions"><StatusBadge status={vacancy.status} />{vacancy.status === 'Pending Activation' && <button className="primary-button" disabled={busyAction} type="button" onClick={() => void updateStatus('Open')}>{busyAction ? 'Updating...' : 'Open vacancy'}</button>}{vacancy.status === 'Open' && <button className="quiet-button" disabled={busyAction} type="button" onClick={() => void updateStatus('On Hold')}>Put on hold</button>}<Link className="quiet-button" to={`/applications?vacancyId=${vacancy.id}`}>View applications</Link></div></div>
      {error && <div className="alert error-alert" role="alert">{error}</div>}

      <div className="detail-tabs" role="tablist" aria-label="Vacancy sections"><button aria-selected="true" className="detail-tab active" role="tab" type="button">Overview</button>{['Candidates', 'Pipeline', 'Interviews', 'Offers', 'Hire Management', 'Analytics', 'Activity'].map((tab) => <button className="detail-tab" disabled key={tab} role="tab" title="Available in a future phase" type="button">{tab}</button>)}</div>

      <div className="dashboard-grid vacancy-detail-grid">
        <div>
          <div className="panel detail-panel"><div className="panel-heading"><div><strong>Progress Summary</strong><small>Counts will populate as later recruitment modules are delivered.</small></div><StatusBadge status={vacancy.status} /></div><div className="funnel-summary">{funnel.map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div></div>
          <div className="panel detail-panel"><h2>Position Metadata</h2><dl className="detail-grid"><div><dt>Vacancy code</dt><dd>{vacancy.vacancyCode}</dd></div><div><dt>Approved headcount</dt><dd>{vacancy.approvedHeadcount}</dd></div><div><dt>Joined headcount</dt><dd>{vacancy.joinedHeadcount}</dd></div><div><dt>Target date</dt><dd>{vacancy.targetStartDate || 'Not set'}</dd></div><div><dt>Legal entity</dt><dd>{vacancy.legalEntityName || 'Not selected'}</dd></div><div><dt>Position</dt><dd>{vacancy.positionTitle || vacancy.positionId}</dd></div></dl></div>
        </div>
        <div className="panel detail-panel"><h2>Ownership</h2>{vacancy.assignments.length === 0 ? <p className="muted-copy">No active team assignments yet.</p> : <div className="assignment-list">{vacancy.assignments.filter((assignment) => assignment.isActive).map((assignment) => <div className="assignment-row" key={assignment.id}><span className="avatar">{assignment.roleCode.slice(0, 2)}</span><div><strong>{assignment.roleCode}</strong><small>{assignment.userId}</small></div></div>)}</div>}<h2 className="section-divider">Recent activity</h2><p className="muted-copy">Activity history will be connected to the audit stream in the administration phase.</p></div>
      </div>
    </div>
  );
}
