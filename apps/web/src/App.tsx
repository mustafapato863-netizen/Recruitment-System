import './App.css'

const navigation = [
  { label: 'Dashboard', icon: '⌂', active: true },
  { label: 'My Tasks', icon: '✓' },
  { label: 'Notifications', icon: '!' },
  { label: 'Vacancy Requests', icon: '▣' },
  { label: 'Vacant List', icon: '▤' },
  { label: 'Candidates', icon: '◉' },
  { label: 'Interviews', icon: '◷' },
  { label: 'Offers', icon: '◇' },
  { label: 'Hire Management', icon: '→' },
]

const metrics = [
  { label: 'Open Vacancies', value: '28', tone: 'purple', note: '+4 this month' },
  { label: 'Critical Vacancies', value: '7', tone: 'orange', note: '2 over SLA' },
  { label: 'Required Headcount', value: '74', tone: 'blue', note: 'Across 18 positions' },
  { label: 'Joined', value: '32', tone: 'green', note: '+8 this month' },
]

const tasks = [
  { title: 'Approve hiring case · HC-1014', owner: 'Final approval', due: 'Due today', tone: 'purple' },
  { title: 'Review missing interview feedback', owner: 'Interview evaluation', due: '1 day overdue', tone: 'orange' },
  { title: 'Follow up on offer expiry', owner: 'Offer management', due: 'Due tomorrow', tone: 'blue' },
]

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <span><strong>RecruitFlow</strong><small>Recruitment operations</small></span>
        </div>
        <nav className="navigation" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map((item) => <a className={item.active ? 'nav-item active' : 'nav-item'} href="#" key={item.label}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</a>)}
          <p className="nav-label">Administration</p>
          <a className="nav-item" href="#"><span className="nav-icon" aria-hidden="true">⚙</span>Settings</a>
          <a className="nav-item" href="#"><span className="nav-icon" aria-hidden="true">◌</span>Audit Log</a>
        </nav>
        <div className="user-card"><span className="avatar">AM</span><span><strong>Ahmed Mohamed</strong><small>HR Operations</small></span><span className="user-more" aria-hidden="true">•••</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="breadcrumb">Workspace / <strong>Dashboard</strong></span>
          <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search" placeholder="Search candidates, vacancies, tasks..." /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Notifications">◔</button><button className="scope-button" type="button">All branches <span>⌄</span></button></div>
        </header>

        <div className="page-content">
          <section className="page-heading"><div><span className="eyebrow">Recruitment command center</span><h1>Good morning, Ahmed</h1><p>Here is what needs your attention across the recruitment workflow.</p></div><button className="primary-button" type="button">+ Create vacancy request</button></section>

          <section className="metric-grid" aria-label="Recruitment metrics">
            {metrics.map((metric) => <article className="metric-card" key={metric.label}><div className={`metric-icon ${metric.tone}`} aria-hidden="true">●</div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
          </section>

          <section className="dashboard-grid">
            <article className="panel funnel-panel"><div className="panel-heading"><div><strong>Recruitment funnel</strong><small>Applications by current stage</small></div><button className="quiet-button" type="button">Last 30 days⌄</button></div><div className="funnel-chart" aria-label="Recruitment funnel chart"><div className="chart-line"><span style={{ height: '78%' }} /><span style={{ height: '62%' }} /><span style={{ height: '70%' }} /><span style={{ height: '48%' }} /><span style={{ height: '58%' }} /><span style={{ height: '42%' }} /><span style={{ height: '52%' }} /><span style={{ height: '35%' }} /></div><div className="chart-axis"><span>1 Jun</span><span>8 Jun</span><span>15 Jun</span><span>22 Jun</span><span>30 Jun</span></div></div><div className="legend"><span><i className="dot purple-dot" />Active applications</span><span><i className="dot blue-dot" />Joined</span></div></article>
            <article className="panel priorities-panel"><div className="panel-heading"><div><strong>Today&apos;s priorities</strong><small>Items requiring action</small></div><span className="count-badge">7</span></div><div className="task-list">{tasks.map((task) => <div className="task-row" key={task.title}><span className={`task-marker ${task.tone}`} /><span><strong>{task.title}</strong><small>{task.owner}</small></span><em>{task.due}</em></div>)}</div><button className="full-button" type="button">View all tasks</button></article>
          </section>

          <section className="dashboard-grid lower-grid">
            <article className="panel status-panel"><div className="panel-heading"><div><strong>Vacancy status</strong><small>Open recruitment needs</small></div><button className="quiet-button" type="button">View report →</button></div><div className="status-rows"><div><span>Open</span><strong>18</strong><div className="bar"><i className="bar-purple" style={{ width: '76%' }} /></div></div><div><span>On hold</span><strong>4</strong><div className="bar"><i className="bar-orange" style={{ width: '32%' }} /></div></div><div><span>Partially filled</span><strong>6</strong><div className="bar"><i className="bar-blue" style={{ width: '46%' }} /></div></div></div></article>
            <article className="panel activity-panel"><div className="panel-heading"><div><strong>Recent activity</strong><small>Permission-scoped workflow events</small></div><button className="quiet-button" type="button">Open log →</button></div><div className="activity-list"><p><span className="activity-avatar green">SM</span><span><strong>Sarah Mahmoud</strong> approved vacancy request <b>VR-2026-101</b><small>12 minutes ago</small></span></p><p><span className="activity-avatar purple">HK</span><span><strong>Hassan Khalil</strong> submitted interview feedback<small>42 minutes ago</small></span></p><p><span className="activity-avatar orange">AM</span><span><strong>Ahmed Mohamed</strong> assigned a new task<small>1 hour ago</small></span></p></div></article>
          </section>
          <footer className="foundation-note"><span className="status-pulse" />Foundation shell ready <span>•</span> Vacancy Core is the next implementation slice.</footer>
        </div>
      </main>
    </div>
  )
}

export default App
