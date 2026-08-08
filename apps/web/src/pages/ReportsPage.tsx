import { useEffect, useState } from 'react';
import { getApi } from '../api/client';
import { Spinner } from '../components/Spinner';
import { Icon } from '../components/Icon';
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
    ])
      .then(([kpiData, funnelData, departmentData, recruiterData]) => {
        setKpis(kpiData);
        setFunnel(funnelData);
        setDepartments(departmentData);
        setRecruiters(recruiterData);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="alert error" style={{ margin: '24px' }}>
        Failed to load report analytics: {error ?? 'No report data available.'}
      </div>
    );
  }

  const maxFunnel = Math.max(...funnel.map((stage) => stage.count), 1);

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Real-time performance metrics and conversion funnels derived from database records</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled
            title="PDF report export is scheduled for an upcoming release phase"
          >
            <Icon name="download" size={14} /> Export PDF (Coming Soon)
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled
            title="Excel spreadsheet export is scheduled for an upcoming release phase"
          >
            <Icon name="download" size={14} /> Export Excel (Coming Soon)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid" style={{ marginBottom: '24px' }}>
        <div className="card metric-card card-neon-purple">
          <span>Time to Fill</span>
          <strong>{kpis.timeToFill.value} <small style={{ fontSize: '14px', display: 'inline' }}>Days</small></strong>
          <small>Requisition to hire date</small>
        </div>
        <div className="card metric-card card-neon-amber">
          <span>Time to Offer</span>
          <strong>{kpis.timeToOffer.value} <small style={{ fontSize: '14px', display: 'inline' }}>Days</small></strong>
          <small>Application to offer date</small>
        </div>
        <div className="card metric-card card-neon-blue">
          <span>Offer Acceptance Rate</span>
          <strong>{kpis.offerAcceptanceRate.value}%</strong>
          <small>Accepted vs total sent</small>
        </div>
        <div className="card metric-card card-neon-emerald">
          <span>Interview No-Show Rate</span>
          <strong>{kpis.interviewNoShowRate.value}%</strong>
          <small>Cancelled or unattended</small>
        </div>
      </div>

      {/* Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Funnel Section */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Recruitment Funnel Conversion</h3>
          {funnel.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No application funnel data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {funnel.map((stage) => {
                const pct = Math.round((stage.count / maxFunnel) * 100);
                return (
                  <div key={stage.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <strong style={{ fontWeight: 600 }}>{stage.name}</strong>
                      <span style={{ color: 'var(--muted)' }}>
                        {stage.count} ({stage.percent}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: '10px',
                        background: 'var(--surface-soft)',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--primary), #a855f7)',
                          borderRadius: '6px',
                          transition: 'width 0.5s ease-out',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hiring by Position / Department */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Hiring Progress by Position</h3>
          {departments.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No position target data available.</p>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '11px' }}>
                  <th style={{ padding: '10px' }}>Position / Department</th>
                  <th style={{ padding: '10px' }}>Target Headcount</th>
                  <th style={{ padding: '10px' }}>Joined Count</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((item) => (
                  <tr key={item.department} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>{item.department}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>{item.target}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '11px' }}>
                        {item.joined}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recruiter Workload */}
        <div className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>Recruiter Workload & Active Pipeline</h3>
          {recruiters.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No recruiter data found.</p>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '11px' }}>
                  <th style={{ padding: '10px' }}>Recruiter</th>
                  <th style={{ padding: '10px' }}>Assigned Vacancies</th>
                  <th style={{ padding: '10px' }}>Active Applications</th>
                  <th style={{ padding: '10px' }}>Overdue Work Items</th>
                </tr>
              </thead>
              <tbody>
                {recruiters.map((item) => (
                  <tr key={item.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '12px 10px' }}>{item.vacancies}</td>
                    <td style={{ padding: '12px 10px' }}>{item.applications}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '10px', background: item.overdueTasks > 0 ? '#fef3c7' : 'var(--surface-soft)', color: item.overdueTasks > 0 ? '#b45309' : 'var(--muted)', fontWeight: 600, fontSize: '11px' }}>
                        {item.overdueTasks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
