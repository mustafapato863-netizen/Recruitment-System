import { useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';

type LicenseRecord = {
  id: string;
  candidate: string;
  type: string;
  number: string;
  expiry: string;
  status: string;
  statusColor: string;
  owner: string;
};

export function LicenseManagementPage() {
  const [licenses] = useState<LicenseRecord[]>([]);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>License Management</h1>
          <p className="subtitle">Track position requirements, verification, validity and renewal risk.</p>
        </div>
        <div className="page-actions">
          <button className="btn" disabled title="License records are not modeled yet">Export</button>
          <button className="btn primary" disabled title="License records are not modeled yet">Add License</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card" style={{ '--mc': 'var(--primary)', '--ms': '#f3ecff' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Active Licenses</span><span className="m-ico"><Icon name="document" size={16} /></span></div>
          <div className="m-value">47</div>
          <div className="m-foot">Across hiring cases</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#d97706', '--ms': '#fffbeb' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Under Verification</span><span className="m-ico"><Icon name="clock" size={16} /></span></div>
          <div className="m-value">5</div>
          <div className="m-foot">Median 1.2 days</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#dc2626', '--ms': '#fff1f2' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Expiring ≤ 30d</span><span className="m-ico"><Icon name="bell" size={16} /></span></div>
          <div className="m-value">6</div>
          <div className="m-foot">2 before joining</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#db2777', '--ms': '#fdf2f8' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Rejected</span><span className="m-ico"><Icon name="close" size={16} /></span></div>
          <div className="m-value">1</div>
          <div className="m-foot">Candidate action required</div>
        </div>
        <div className="metric-card" style={{ '--mc': '#16a34a', '--ms': '#ecfdf3' } as CSSProperties}>
          <div className="m-top"><span className="m-label">Not Required</span><span className="m-ico"><Icon name="check" size={16} /></span></div>
          <div className="m-value">12</div>
          <div className="m-foot">Based on position</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input type="text" placeholder="Search records..." />
          </div>
          <button className="filter-btn active">All License Status <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">Authority <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">Expiry <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">Branch <Icon name="chevron-down" size={14} /></button>
          <button className="filter-btn">More Filters</button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>License ID</th>
                <th>Candidate</th>
                <th>Type</th>
                <th>Number</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Verifier / Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>License tracking is not available because no license domain/API exists yet.</td>
                </tr>
              ) : (
                licenses.map((lic) => (
                  <tr key={lic.id}>
                    <td className="fw-500">{lic.id}</td>
                    <td>{lic.candidate}</td>
                    <td>{lic.type}</td>
                    <td>{lic.number}</td>
                    <td>{lic.expiry}</td>
                    <td><span className={`badge badge-${lic.statusColor}`}>{lic.status}</span></td>
                    <td>{lic.owner}</td>
                    <td><button className="btn btn-sm">Open</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
