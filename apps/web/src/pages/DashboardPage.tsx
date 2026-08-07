import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Vacancy, VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { createVacancyRequestSchema } from '@recruitflow/validation';
import { fetchApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';

type RequestFormState = { requestedHeadcount: string; employmentType: string; reason: string; budgetStatus: string; criticality: string; targetStartDate: string; justification: string };
const emptyForm: RequestFormState = { requestedHeadcount: '1', employmentType: 'Full-time', reason: 'New position', budgetStatus: 'Pending review', criticality: 'Normal', targetStartDate: '', justification: '' };

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function DashboardPage() {
  const { user } = useAuth();
  const [context, setContext] = useState<VacancyCoreContext | null>(null);
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextContext, nextRequests, nextVacancies] = await Promise.all([
        fetchApi<VacancyCoreContext>('/vacancy-requests/context'),
        fetchApi<VacancyRequest[]>('/vacancy-requests'),
        fetchApi<Vacancy[]>('/vacancies'),
      ]);
      setContext(nextContext);
      setRequests(nextRequests);
      setVacancies(nextVacancies);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API is unavailable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totalHeadcount = useMemo(() => vacancies.reduce((total, vacancy) => total + vacancy.approvedHeadcount, 0), [vacancies]);
  const pendingRequests = requests.filter((request) => request.status === 'Pending Approval').length;
  const criticalRequests = requests.filter((request) => request.criticality === 'Critical').length;
  const openVacancies = vacancies.filter((vacancy) => vacancy.status === 'Open').length;

  const createRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!context) return;
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
    };
    const parsed = createVacancyRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please review the form fields.');
      return;
    }
    setBusyAction('create');
    setFormError('');
    try {
      await fetchApi('/vacancy-requests', { method: 'POST', body: JSON.stringify(parsed.data) });
      setForm(emptyForm);
      setIsFormOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create request');
    } finally {
      setBusyAction(null);
    }
  };

  const runAction = async (request: VacancyRequest, action: 'submit' | 'approve' | 'request-changes' | 'convert') => {
    setBusyAction(`${action}:${request.id}`);
    setError('');
    try {
      await fetchApi(`/vacancy-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify({ comment: 'Actioned from RecruitFlow workspace.' }) });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update request');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Recruitment command center</span><h1>Good morning, {user?.displayName.split(' ')[0] || 'User'}</h1><p>Here is what needs your attention across the recruitment workflow.</p></div><button className="primary-button" type="button" onClick={() => { setFormError(''); setIsFormOpen(true); }}>Create vacancy request</button></section>
      {error && <div className="alert error-alert" role="alert"><strong>API connection</strong><span>{error}</span><button type="button" onClick={() => void loadData()}>Retry</button></div>}
      {!error && isLoading && <div className="alert loading-alert" role="status">Loading Vacancy Core workspace...</div>}

      <section className="metric-grid" aria-label="Recruitment metrics">{[{ label: 'Open Vacancies', value: openVacancies, note: `${vacancies.length} total converted`, icon: 'vacancy' as const }, { label: 'Pending Approvals', value: pendingRequests, note: 'Waiting for decision', icon: 'inbox' as const }, { label: 'Required Headcount', value: totalHeadcount, note: 'From converted vacancies', icon: 'users' as const }, { label: 'Critical Requests', value: criticalRequests, note: 'Needs prioritization', icon: 'report' as const }].map((metric) => <article className="metric-card" key={metric.label}><div className="metric-icon purple"><Icon name={metric.icon} size={16} /></div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</section>

      <section className="dashboard-grid"><article className="panel"><div className="panel-heading"><div><strong>Recruitment funnel</strong><small>Candidate and application data is available in the pipeline workspace.</small></div><Link className="quiet-button" to="/applications">View pipeline</Link></div><div className="empty-state"><strong>Open the live candidate pipeline</strong><span>Review applications, stages, interviews, offers, and joining workflows from the Applications workspace.</span><Link className="primary-button" to="/applications">View applications</Link></div></article><article className="panel priorities-panel"><div className="panel-heading"><div><strong>Today's priorities</strong><small>Items requiring action</small></div><span className="count-badge">{pendingRequests}</span></div><div className="task-list"><div className="task-row"><span className="task-marker purple" /><span><strong>{pendingRequests ? 'Review pending vacancy approvals' : 'No pending approvals'}</strong><small>Vacancy Core approval inbox</small></span><em>{pendingRequests ? 'Action needed' : 'All clear'}</em></div><div className="task-row"><span className="task-marker orange" /><span><strong>Keep request justification complete</strong><small>Required before approval</small></span><em>Best practice</em></div></div><button className="full-button" type="button" onClick={() => document.getElementById('vacancy-requests')?.scrollIntoView({ behavior: 'smooth' })}>View vacancy requests</button></article></section>

      <section className="panel request-panel" id="vacancy-requests"><div className="panel-heading"><div><strong>Vacancy requests</strong><small>Create, submit, approve, and convert requests from one workflow.</small></div><button className="quiet-button" type="button" onClick={() => void loadData()}>Refresh</button></div>{requests.length === 0 ? <div className="empty-state"><strong>No vacancy requests yet</strong><span>Create the first request to start the approval flow.</span><button className="primary-button" type="button" onClick={() => setIsFormOpen(true)}>Create request</button></div> : <div className="request-table" role="region" aria-label="Vacancy requests" tabIndex={0}><div className="request-row request-header" role="row"><span>Request</span><span>Status</span><span>Headcount</span><span>Updated</span><span>Action</span></div>{requests.map((request) => <div className="request-row" role="row" key={request.id}><span><strong>{request.requestCode}</strong><small>{request.reason || 'No reason provided'}</small></span><span><StatusBadge status={request.status} /></span><span>{request.requestedHeadcount}</span><span>{formatDate(request.updatedAt)}</span><span className="inline-actions">{request.status === 'Draft' || request.status === 'Changes Requested' ? <button className="small-button" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'submit')}>{busyAction === `submit:${request.id}` ? 'Submitting...' : 'Submit'}</button> : request.status === 'Pending Approval' ? <><button className="small-button success-button" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'approve')}>{busyAction === `approve:${request.id}` ? 'Approving...' : 'Approve'}</button><button className="small-button danger" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'request-changes')}>Changes</button></> : request.status === 'Approved' ? <button className="small-button" disabled={busyAction !== null} type="button" onClick={() => void runAction(request, 'convert')}>{busyAction === `convert:${request.id}` ? 'Converting...' : 'Convert'}</button> : <span className="muted-action">No action</span>}</span></div>)}</div>}</section>

      <section className="dashboard-grid lower-grid"><article className="panel status-panel"><div className="panel-heading"><div><strong>Vacancy status</strong><small>Open recruitment needs</small></div><Link className="quiet-button" to="/reports">View reports</Link></div><div className="status-rows"><div><span>Open</span><strong>{openVacancies}</strong><div className="bar"><i className="bar-purple" style={{ width: `${vacancies.length ? Math.min(openVacancies / vacancies.length * 100, 100) : 0}%` }} /></div></div><div><span>Pending activation</span><strong>{vacancies.filter((vacancy) => vacancy.status === 'Pending Activation').length}</strong><div className="bar"><i className="bar-orange" style={{ width: `${vacancies.length ? Math.min(vacancies.filter((vacancy) => vacancy.status === 'Pending Activation').length / vacancies.length * 100, 100) : 0}%` }} /></div></div><div><span>Partially filled</span><strong>{vacancies.filter((vacancy) => vacancy.status === 'Partially Filled').length}</strong><div className="bar"><i className="bar-blue" style={{ width: `${vacancies.length ? Math.min(vacancies.filter((vacancy) => vacancy.status === 'Partially Filled').length / vacancies.length * 100, 100) : 0}%` }} /></div></div></div></article><article className="panel activity-panel"><div className="panel-heading"><div><strong>Workflow guardrails</strong><small>Rules enforced by the API</small></div><span className="count-badge">{requests.length + vacancies.length}</span></div><div className="activity-list"><p><span className="activity-avatar green">1</span><span><strong>Draft to Pending Approval</strong><small>Only the requester can submit in production auth.</small></span></p><p><span className="activity-avatar purple">2</span><span><strong>Pending Approval to Approved</strong><small>Approval decisions are recorded with revision.</small></span></p><p><span className="activity-avatar orange">3</span><span><strong>Approved to Vacancy</strong><small>Conversion is idempotent and preserves headcount.</small></span></p></div></article></section>
      <footer className="foundation-note"><span className="status-pulse" />Vacancy Core connected <span aria-hidden="true">·</span> Production auth integrated.</footer>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Create vacancy request"><form onSubmit={(event) => void createRequest(event)}><p className="modal-context">{context?.position.title} · {context?.branch.name}</p>{formError && <div className="alert error-alert" role="alert">{formError}</div>}<div className="form-grid"><label>Headcount<input min="1" max="10000" required type="number" value={form.requestedHeadcount} onChange={(event) => setForm({ ...form, requestedHeadcount: event.target.value })} /></label><label>Employment type<select value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })}><option>Full-time</option><option>Part-time</option><option>Contract</option></select></label><label>Criticality<select value={form.criticality} onChange={(event) => setForm({ ...form, criticality: event.target.value })}><option>Normal</option><option>Critical</option></select></label><label>Budget status<select value={form.budgetStatus} onChange={(event) => setForm({ ...form, budgetStatus: event.target.value })}><option>Pending review</option><option>Approved</option><option>Not approved</option></select></label><label>Reason<input required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><label>Target start date<input type="date" value={form.targetStartDate} onChange={(event) => setForm({ ...form, targetStartDate: event.target.value })} /></label><label className="full-field">Justification<textarea rows={4} value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} placeholder="Explain the business need and expected start date." /></label></div><div className="form-actions"><button className="quiet-button" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="primary-button" disabled={busyAction === 'create'} type="submit">{busyAction === 'create' ? 'Creating...' : 'Create draft request'}</button></div></form></Modal>
    </>
  );
}
