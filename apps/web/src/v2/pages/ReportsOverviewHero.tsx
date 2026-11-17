import './reports-v2.css';

export interface FunnelMetrics {
  applications: number;
  screened: number;
  interviewed: number;
  offered: number;
  hired: number;
}

export interface SourceBar {
  label: string;
  count: number;
}

export function ReportsOverviewHero({
  metrics,
  sources = [],
}: {
  metrics: FunnelMetrics;
  sources?: SourceBar[];
  showPercentBadges?: boolean;
  showBento?: boolean;
}) {
  const base = Math.max(1, metrics.applications);
  const stageRows = [
    { label: 'Applied', count: metrics.applications, pct: metrics.applications > 0 ? 100 : 0 },
    { label: 'Screening', count: metrics.screened, pct: metrics.applications > 0 ? Math.min(100, Math.round((metrics.screened / base) * 100)) : 0 },
    { label: 'Interview', count: metrics.interviewed, pct: metrics.applications > 0 ? Math.min(100, Math.round((metrics.interviewed / base) * 100)) : 0 },
    { label: 'Offer', count: metrics.offered, pct: metrics.applications > 0 ? Math.min(100, Math.round((metrics.offered / base) * 100)) : 0 },
    { label: 'Joined', count: metrics.hired, pct: metrics.applications > 0 ? Math.min(100, Math.round((metrics.hired / base) * 100)) : 0 },
  ];
  const maxSource = Math.max(1, ...sources.map((s) => s.count));

  return (
    <div className="rf2-rep-bento">
      <div className="rf2-rep-card">
        <h2 className="rf2-rep-card__title">Stage conversion</h2>
        <ul className="rf2-rep-bars" aria-label="Stage conversion">
          {stageRows.map((st) => (
            <li key={st.label} className="rf2-rep-bar-row">
              <span className="rf2-rep-bar-lbl">{st.label}</span>
              <span className="rf2-rep-bar-track" aria-hidden="true">
                <span className="rf2-rep-bar-fill" style={{ width: `${st.count === 0 ? 0 : st.pct}%` }} />
              </span>
              <span className="rf2-rep-bar-val">{`${st.pct}% (${st.count})`}</span>
            </li>
          ))}
        </ul>
      </div>
      {sources.length > 0 ? (
        <div className="rf2-rep-card">
          <h2 className="rf2-rep-card__title">Applications by source</h2>
          <ul className="rf2-rep-bars" aria-label="Applications by source">
            {sources.map((src) => {
              const pct = src.count === 0 ? 0 : Math.round((src.count / maxSource) * 100);
              return (
                <li key={src.label} className="rf2-rep-bar-row">
                  <span className="rf2-rep-bar-lbl">{src.label}</span>
                  <span className="rf2-rep-bar-track" aria-hidden="true">
                    <span className="rf2-rep-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="rf2-rep-bar-val">{src.count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
