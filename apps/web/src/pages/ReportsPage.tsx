import { useEffect, useState } from 'react';
import { getApi } from '../api/client';
import type { DepartmentHiring, FunnelStage, RecruiterWorkload, ReportKpis } from '@recruitflow/contracts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function ReportsPage() {
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [departments, setDepartments] = useState<DepartmentHiring[]>([]);
  const [recruiters, setRecruiters] = useState<RecruiterWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getApi<ReportKpis>('/reports/kpis'),
      getApi<FunnelStage[]>('/reports/funnel'),
      getApi<DepartmentHiring[]>('/reports/hiring-by-department'),
      getApi<RecruiterWorkload[]>('/reports/recruiter-workload'),
    ]).then(([kpiData, funnelData, departmentData, recruiterData]) => {
      setKpis(kpiData);
      setFunnel(funnelData);
      setDepartments(departmentData);
      setRecruiters(recruiterData);
    }).catch((reason: unknown) => setError(getErrorMessage(reason))).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-container"><div className="card" style={{ padding: '2rem' }}>Loading reports...</div></div>;
  if (error || !kpis) return <div className="page-container"><div className="alert error">Failed to load reports: {error ?? 'No report data available.'}</div></div>;

  const maxFunnel = Math.max(...funnel.map((stage) => stage.count), 1);

  return (
    <div className="page-container">
      <header className="page-header">
        <div><h1 className="page-title">Reports & Analytics</h1><p className="page-subtitle">Metrics calculated from organization-scoped recruitment data.</p></div>
        <div className="page-actions"><button className="button button-outline" disabled title="Export endpoint is not implemented yet">Export PDF</button><button className="button button-primary" disabled title="Export endpoint is not implemented yet">Export Excel</button></div>
      </header>

      <div className="grid c6 metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="card metric-card"><h4>Time to Fill</h4><span className="metric-value">{kpis.timeToFill.value} Days</span></div>
        <div className="card metric-card"><h4>Time to Offer</h4><span className="metric-value">{kpis.timeToOffer.value} Days</span></div>
        <div className="card metric-card"><h4>Offer Acceptance Rate</h4><span className="metric-value">{kpis.offerAcceptanceRate.value}%</span></div>
        <div className="card metric-card"><h4>Interview No-Show Rate</h4><span className="metric-value">{kpis.interviewNoShowRate.value}%</span></div>
        <div className="card metric-card"><h4>Top Source</h4><span className="metric-value">{kpis.topSource.name}</span></div>
        <div className="card metric-card"><h4>Total Joined</h4><span className="metric-value">{kpis.totalJoined.count}</span></div>
      </div>

      <div className="grid c2 analytics-grid">
        <section className="card"><div className="card-header"><h3 className="card-title">Funnel Conversion</h3></div><div className="card-content">
          {funnel.length === 0 ? <p className="text-muted">No application data yet.</p> : funnel.map((stage) => <div className="progress-group" key={stage.name} style={{ marginBottom: '12px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{stage.name}</span><span>{stage.count} ({stage.percent}%)</span></div><div className="progress-track" style={{ height: '8px', background: 'var(--surface-muted)', borderRadius: '4px' }}><div className="progress-fill" style={{ width: `${Math.round((stage.count / maxFunnel) * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }} /></div></div>)}
        </div></section>

        <section className="card"><div className="card-header"><h3 className="card-title">Hiring by Position</h3></div><div className="card-content"><table className="request-table"><thead><tr><th>Position</th><th>Target</th><th>Joined</th></tr></thead><tbody>{departments.length === 0 ? <tr><td colSpan={3}>No hiring data yet.</td></tr> : departments.map((item) => <tr key={item.department}><td>{item.department}</td><td>{item.target}</td><td>{item.joined}</td></tr>)}</tbody></table></div></section>

        <section className="card"><div className="card-header"><h3 className="card-title">Recruiter Workload</h3></div><div className="card-content"><table className="request-table"><thead><tr><th>Recruiter</th><th>Vacancies</th><th>Applications</th><th>Overdue</th></tr></thead><tbody>{recruiters.length === 0 ? <tr><td colSpan={4}>No active recruiters found.</td></tr> : recruiters.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.vacancies}</td><td>{item.applications}</td><td>{item.overdueTasks}</td></tr>)}</tbody></table></div></section>
      </div>
    </div>
  );
}
