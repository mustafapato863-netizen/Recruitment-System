import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  Vacancy,
  VacancyCoreContext,
  VacancyRequest,
} from '@recruitflow/contracts'
import { createVacancyRequestSchema } from '@recruitflow/validation'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

const navigation = [
  { label: 'Dashboard', icon: 'D', active: true },
  { label: 'My Tasks', icon: '✓' },
  { label: 'Notifications', icon: '!' },
  { label: 'Vacancy Requests', icon: 'R' },
  { label: 'Vacant List', icon: 'V' },
  { label: 'Candidates', icon: 'C' },
  { label: 'Interviews', icon: 'I' },
  { label: 'Offers', icon: 'O' },
  { label: 'Hire Management', icon: 'H' },
]

type RequestFormState = {
  requestedHeadcount: string
  employmentType: string
  reason: string
  budgetStatus: string
  criticality: string
  targetStartDate: string
  justification: string
}

const emptyForm: RequestFormState = {
  requestedHeadcount: '1',
  employmentType: 'Full-time',
  reason: 'New position',
  budgetStatus: 'Pending review',
  criticality: 'Normal',
  targetStartDate: '',
  justification: '',
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { message?: string | string[] } | null
    const message = Array.isArray(problem?.message) ? problem.message.join(', ') : problem?.message
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function statusClass(status: string): string {
  return `status-chip status-${status.toLowerCase().replaceAll(' ', '-')}`
}

function App() {
  const [context, setContext] = useState<VacancyCoreContext | null>(null)
  const [requests, setRequests] = useState<VacancyRequest[]>([])
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [form, setForm] = useState<RequestFormState>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [nextContext, nextRequests, nextVacancies] = await Promise.all([
        apiRequest<VacancyCoreContext>('/vacancy-requests/context'),
        apiRequest<VacancyRequest[]>('/vacancy-requests'),
        apiRequest<Vacancy[]>('/vacancies'),
      ])
      setContext(nextContext)
      setRequests(nextRequests)
      setVacancies(nextVacancies)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'API is unavailable')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totalHeadcount = useMemo(
    () => vacancies.reduce((total, vacancy) => total + vacancy.approvedHeadcount, 0),
    [vacancies],
  )
  const criticalRequests = requests.filter((request) => request.criticality === 'Critical').length
  const pendingRequests = requests.filter((request) => request.status === 'Pending Approval').length

  function updateForm(field: keyof RequestFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!context) return

    const candidate = {
      organizationId: context.organization.id,
      branchId: context.branch.id,
      positionId: context.position.id,
      requesterId: context.requester.id,
      requestedHeadcount: Number(form.requestedHeadcount),
      employmentType: form.employmentType || null,
      reason: form.reason || null,
      budgetStatus: form.budgetStatus || null,
      criticality: form.criticality || null,
      targetStartDate: form.targetStartDate || null,
      justification: form.justification || null,
    }
    const parsed = createVacancyRequestSchema.safeParse(candidate)
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please review the form fields.')
      return
    }

    setBusyAction('create')
    setFormError(null)
    try {
      await apiRequest<VacancyRequest>('/vacancy-requests', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      })
      setForm(emptyForm)
      setIsFormOpen(false)
      await loadData()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to create request')
    } finally {
      setBusyAction(null)
    }
  }

  async function runAction(request: VacancyRequest, action: 'submit' | 'approve' | 'request-changes' | 'reject' | 'convert') {
    setBusyAction(`${action}:${request.id}`)
    setError(null)
    try {
      await apiRequest(`/vacancy-requests/${request.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ comment: `Actioned from RecruitFlow workspace.` }),
      })
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update request')
    } finally {
      setBusyAction(null)
    }
  }

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
          <a className="nav-item" href="#"><span className="nav-icon" aria-hidden="true">S</span>Settings</a>
          <a className="nav-item" href="#"><span className="nav-icon" aria-hidden="true">A</span>Audit Log</a>
        </nav>
        <div className="user-card"><span className="avatar">AM</span><span><strong>Ahmed Mohamed</strong><small>HR Operations</small></span><span className="user-more" aria-hidden="true">•••</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="breadcrumb">Workspace / <strong>Dashboard</strong></span>
          <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search" placeholder="Search candidates, vacancies, tasks..." /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Notifications">◉</button><button className="scope-button" type="button">All branches <span>⌄</span></button></div>
        </header>

        <div className="page-content">
          <section className="page-heading"><div><span className="eyebrow">Recruitment command center</span><h1>Good morning, Ahmed</h1><p>Here is what needs your attention across the recruitment workflow.</p></div><button className="primary-button" type="button" onClick={() => { setFormError(null); setIsFormOpen(true) }}>+ Create vacancy request</button></section>

          {error && <div className="alert error-alert" role="alert"><strong>API connection</strong><span>{error}</span><button type="button" onClick={() => void loadData()}>Retry</button></div>}
          {!error && isLoading && <div className="alert loading-alert">Loading Vacancy Core workspace…</div>}

          <section className="metric-grid" aria-label="Recruitment metrics">
            {[
              { label: 'Open Vacancies', value: String(vacancies.filter((vacancy) => vacancy.status === 'Open').length), tone: 'purple', note: `${vacancies.length} total converted` },
              { label: 'Pending Approvals', value: String(pendingRequests), tone: 'orange', note: 'Waiting for decision' },
              { label: 'Required Headcount', value: String(totalHeadcount), tone: 'blue', note: 'From converted vacancies' },
              { label: 'Critical Requests', value: String(criticalRequests), tone: 'green', note: 'Needs prioritization' },
            ].map((metric) => <article className="metric-card" key={metric.label}><div className={`metric-icon ${metric.tone}`} aria-hidden="true">●</div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
          </section>

          <section className="dashboard-grid">
            <article className="panel funnel-panel"><div className="panel-heading"><div><strong>Recruitment funnel</strong><small>Applications by current stage</small></div><button className="quiet-button" type="button">Last 30 days⌄</button></div><div className="funnel-chart" aria-label="Recruitment funnel chart"><div className="chart-line"><span style={{ height: '78%' }} /><span style={{ height: '62%' }} /><span style={{ height: '70%' }} /><span style={{ height: '48%' }} /><span style={{ height: '58%' }} /><span style={{ height: '42%' }} /><span style={{ height: '52%' }} /><span style={{ height: '35%' }} /></div><div className="chart-axis"><span>1 Jun</span><span>8 Jun</span><span>15 Jun</span><span>22 Jun</span><span>30 Jun</span></div></div><div className="legend"><span><i className="dot purple-dot" />Active applications</span><span><i className="dot blue-dot" />Joined</span></div></article>
            <article className="panel priorities-panel"><div className="panel-heading"><div><strong>Today&apos;s priorities</strong><small>Items requiring action</small></div><span className="count-badge">{pendingRequests}</span></div><div className="task-list"><div className="task-row"><span className="task-marker purple" /><span><strong>{pendingRequests ? 'Review pending vacancy approvals' : 'No pending approvals'}</strong><small>Vacancy Core approval inbox</small></span><em>{pendingRequests ? 'Action needed' : 'All clear'}</em></div><div className="task-row"><span className="task-marker orange" /><span><strong>Keep request justification complete</strong><small>Required before approval</small></span><em>Best practice</em></div></div><button className="full-button" type="button" onClick={() => document.getElementById('vacancy-requests')?.scrollIntoView({ behavior: 'smooth' })}>View vacancy requests</button></article>
          </section>

          <section className="panel request-panel" id="vacancy-requests"><div className="panel-heading"><div><strong>Vacancy requests</strong><small>Create, submit, approve, and convert requests from one workflow.</small></div><button className="quiet-button" type="button" onClick={() => void loadData()}>Refresh</button></div>{requests.length === 0 ? <div className="empty-state"><strong>No vacancy requests yet</strong><span>Create the first request to start the approval flow.</span><button className="primary-button" type="button" onClick={() => setIsFormOpen(true)}>Create request</button></div> : <div className="request-table" role="table" aria-label="Vacancy requests"><div className="request-row request-header" role="row"><span>Request</span><span>Status</span><span>Headcount</span><span>Updated</span><span>Action</span></div>{requests.map((request) => <div className="request-row" role="row" key={request.id}><span><strong>{request.requestCode}</strong><small>{request.reason ?? 'No reason provided'}</small></span><span><em className={statusClass(request.status)}>{request.status}</em></span><span>{request.requestedHeadcount}</span><span>{formatDate(request.updatedAt)}</span><span className="inline-actions">{request.status === 'Draft' || request.status === 'Changes Requested' ? <button className="small-button" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'submit')}>{busyAction === `submit:${request.id}` ? 'Submitting…' : 'Submit'}</button> : request.status === 'Pending Approval' ? <><button className="small-button" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'approve')}>{busyAction === `approve:${request.id}` ? 'Approving…' : 'Approve'}</button><button className="small-button danger" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'request-changes')}>Changes</button></> : request.status === 'Approved' ? <button className="small-button" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'convert')}>{busyAction === `convert:${request.id}` ? 'Converting…' : 'Convert'}</button> : <span className="muted-action">—</span>}</span></div>)}</div>}</section>

          <section className="dashboard-grid lower-grid">
            <article className="panel status-panel"><div className="panel-heading"><div><strong>Vacancy status</strong><small>Open recruitment needs</small></div><button className="quiet-button" type="button">View report →</button></div><div className="status-rows"><div><span>Open</span><strong>{vacancies.filter((vacancy) => vacancy.status === 'Open').length}</strong><div className="bar"><i className="bar-purple" style={{ width: `${Math.min(vacancies.length * 10, 100)}%` }} /></div></div><div><span>Pending activation</span><strong>{vacancies.filter((vacancy) => vacancy.status === 'Pending Activation').length}</strong><div className="bar"><i className="bar-orange" style={{ width: `${Math.min(vacancies.length * 10, 100)}%` }} /></div></div><div><span>Partially filled</span><strong>{vacancies.filter((vacancy) => vacancy.status === 'Partially Filled').length}</strong><div className="bar"><i className="bar-blue" style={{ width: '20%' }} /></div></div></div></article>
            <article className="panel activity-panel"><div className="panel-heading"><div><strong>Workflow guardrails</strong><small>Rules enforced by the API</small></div><span className="count-badge">{requests.length + vacancies.length}</span></div><div className="activity-list"><p><span className="activity-avatar green">1</span><span><strong>Draft → Pending Approval</strong><small>Only the requester can submit in production auth.</small></span></p><p><span className="activity-avatar purple">2</span><span><strong>Pending Approval → Approved</strong><small>Approval decisions are recorded with revision.</small></span></p><p><span className="activity-avatar orange">3</span><span><strong>Approved → Vacancy</strong><small>Conversion is idempotent and preserves headcount.</small></span></p></div></article>
          </section>
          <footer className="foundation-note"><span className="status-pulse" />Vacancy Core connected <span>•</span> In-memory adapter active until Prisma engine setup is complete.</footer>
        </div>
      </main>

      {isFormOpen && <div className="form-backdrop" role="presentation"><form className="form-card" onSubmit={(event) => void createRequest(event)}><div className="form-heading"><div><span className="eyebrow">Vacancy Core</span><h2>Create vacancy request</h2><p>{context?.position.title} · {context?.branch.name}</p></div><button className="close-button" type="button" aria-label="Close" onClick={() => setIsFormOpen(false)}>×</button></div>{formError && <div className="alert error-alert" role="alert">{formError}</div>}<div className="form-grid"><label>Headcount<input min="1" max="10000" required type="number" value={form.requestedHeadcount} onChange={(event) => updateForm('requestedHeadcount', event.target.value)} /></label><label>Employment type<select value={form.employmentType} onChange={(event) => updateForm('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option></select></label><label>Criticality<select value={form.criticality} onChange={(event) => updateForm('criticality', event.target.value)}><option>Normal</option><option>Critical</option></select></label><label>Budget status<select value={form.budgetStatus} onChange={(event) => updateForm('budgetStatus', event.target.value)}><option>Pending review</option><option>Approved</option><option>Not approved</option></select></label><label>Reason<input required value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} /></label><label>Target start date<input type="date" value={form.targetStartDate} onChange={(event) => updateForm('targetStartDate', event.target.value)} /></label><label className="full-field">Justification<textarea rows={4} value={form.justification} onChange={(event) => updateForm('justification', event.target.value)} placeholder="Explain the business need and expected start date." /></label></div><div className="form-actions"><button className="quiet-button" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="primary-button" disabled={busyAction === 'create'} type="submit">{busyAction === 'create' ? 'Creating…' : 'Create draft request'}</button></div></form></div>}
    </div>
  )
}

export default App
