import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Vacancy, VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { createVacancyRequestSchema } from '@recruitflow/validation';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

type RequestFormState = {
  requestedHeadcount: string;
  employmentType: string;
  reason: string;
  budgetStatus: string;
  criticality: string;
  targetStartDate: string;
  justification: string;
};

const emptyForm: RequestFormState = {
  requestedHeadcount: '1',
  employmentType: 'Full-time',
  reason: 'New position',
  budgetStatus: 'Pending review',
  criticality: 'Normal',
  targetStartDate: '',
  justification: '',
};

export function DashboardPage() {
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

  const updateForm = (key: keyof RequestFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageFrame
        className="dashboard-page"
        eyebrow="RecruitFlow Workspace"
        title="Recruitment Command Center"
        description="Live operational view of hiring demand, workload, candidate movement, offers, approvals and joining readiness."
        actions={<><Button variant="secondary" size="sm" onClick={() => void loadData()}>Export snapshot</Button><Button variant="primary" size="sm" onClick={() => setIsFormOpen(true)}>Create vacancy request</Button></>}
      >
        {error && <Alert tone="danger" title="Workspace data is unavailable">{error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void loadData()}>Retry</Button></Alert>}
        {isLoading && <PageState kind="loading" title="Loading workspace" description="Fetching vacancies, requests and approvals." />}

        <div className="ui-metric-grid">
          <MetricCard label="Open vacancies" value={openVacancies || 28} detail="+4 this month" tone="action" icon="□" />
          <MetricCard label="Required headcount" value={totalHeadcount || 74} detail="19 positions joined" tone="info" icon="◉" />
          <MetricCard label="Active applications" value="486" detail="+12.8% vs last month" tone="info" icon="◎" />
          <MetricCard label="Interviews this week" value="32" detail="6 feedback pending" tone="warning" icon="□" />
          <MetricCard label="Pending offers" value="11" detail="3 expire in 48h" tone="danger" icon="◇" />
          <MetricCard label="Final approvals" value={pendingRequests || 7} detail="Oldest: 2 days" tone="success" icon="✓" featured />
        </div>

        <div className="grid main-side ui-dashboard-grid">
          <div className="grid">
            <section className="card">
              <div className="card-h"><div><b>Recruitment Funnel &amp; Hiring Trend</b><small>Applications, interviews, offers and joined employees.</small></div></div>
              <div className="card-b">
                <div className="chart">
                  <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-label="Recruitment trend chart" role="img">
                    <g className="chart-grid-lines"><line x1="0" y1="40" x2="600" y2="40" /><line x1="0" y1="80" x2="600" y2="80" /><line x1="0" y1="120" x2="600" y2="120" /><line x1="0" y1="160" x2="600" y2="160" /></g>
                    <path className="chart-line" d="M0 150 C70 125,90 140,145 105 S230 72,300 90 S390 45,450 65 S540 30,600 40" />
                    <path className="chart-area" d="M0 150 C70 125,90 140,145 105 S230 72,300 90 S390 45,450 65 S540 30,600 40 L600 200 L0 200 Z" />
                  </svg>
                </div>
                <div className="legend ui-chart-legend">
                  <span><i className="legend-applications" />Applications</span><span><i className="legend-interviews" />Interviews</span><span><i className="legend-offers" />Offers</span><span><i className="legend-joined" />Joined</span>
                </div>
              </div>
            </section>

            <div className="grid c2">
              <section className="card">
                <div className="card-h"><div><b>Vacancy Aging</b><small>Open vacancies grouped by age.</small></div></div>
                <div className="card-b"><div className="bars">
                  <div className="barrow"><span>0-15 days</span><div className="bar"><span className="bar-fill bar-fill-88" /></div><b>11</b></div>
                  <div className="barrow"><span>16-30 days</span><div className="bar"><span className="bar-fill bar-fill-64" /></div><b>8</b></div>
                  <div className="barrow"><span>31-45 days</span><div className="bar"><span className="bar-fill bar-fill-42" /></div><b>5</b></div>
                  <div className="barrow"><span>46+ days</span><div className="bar"><span className="bar-fill bar-fill-25" /></div><b>4</b></div>
                </div></div>
              </section>
              <section className="card">
                <div className="card-h"><div><b>Candidate Sources</b><small>Applications by source.</small></div></div>
                <div className="card-b"><div className="ui-source-layout">
                  <div className="donut"><div className="center"><div><b>486</b><br /><small>Total</small></div></div></div>
                  <div className="legend ui-source-legend"><span><i className="legend-applications" />Career Portal 38%</span><span><i className="legend-interviews" />LinkedIn 20%</span><span><i className="legend-offers" />Referrals 15%</span><span><i className="legend-joined" />Agencies 15%</span></div>
                </div></div>
              </section>
            </div>
          </div>

          <aside className="grid">
            <section className="card">
              <div className="card-h"><div><b>Today's Priorities</b><small>Items requiring immediate action.</small></div></div>
              <div className="card-b"><div className="timeline">
                {criticalRequests > 0 && <div className="tl"><b>{criticalRequests} critical request(s)</b><small>Requires immediate priority</small></div>}
                <div className="tl"><b>3 offers expire today</b><small>Offer Management - Due 5:00 PM</small></div>
                <div className="tl"><b>Final approval pending</b><small>Mona Ibrahim - HR Specialist</small></div>
                <div className="tl"><b>Interview feedback overdue</b><small>Frontend Engineer - 2 interviewers</small></div>
                <div className="tl"><b>License expires in 10 days</b><small>Rana Adel - DHA License</small></div>
              </div></div>
            </section>
            <section className="card">
              <div className="card-h"><div><b>Upcoming Interviews</b><small>Next scheduled sessions.</small></div></div>
              <div className="card-b ui-interview-list">
                <div className="check dashboard-interview"><span className="badge purple">10:00</span><div><div className="cell">Ahmed Mohamed</div><div className="meta">Technical Interview</div></div><span aria-hidden="true">›</span></div>
                <div className="check dashboard-interview"><span className="badge purple">11:30</span><div><div className="cell">Salma Ali</div><div className="meta">HR Interview</div></div><span aria-hidden="true">›</span></div>
                <div className="check dashboard-interview"><span className="badge purple">14:00</span><div><div className="cell">Rana Adel</div><div className="meta">Final Interview</div></div><span aria-hidden="true">›</span></div>
              </div>
            </section>
          </aside>
        </div>
      </PageFrame>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Create vacancy request">
        <form onSubmit={(event) => void createRequest(event)}>
          <p className="modal-context">{context?.position.title} - {context?.branch.name}</p>
          {formError && <Alert tone="danger" title="Review the request">{formError}</Alert>}
          <div className="form-grid">
            <FormField id="request-headcount" label="Headcount" required><input className="ui-field-control" id="request-headcount" min="1" max="10000" required type="number" value={form.requestedHeadcount} onChange={(event) => updateForm('requestedHeadcount', event.target.value)} /></FormField>
            <FormField id="request-employment" label="Employment type"><select className="ui-field-control" id="request-employment" value={form.employmentType} onChange={(event) => updateForm('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option></select></FormField>
            <FormField id="request-criticality" label="Criticality"><select className="ui-field-control" id="request-criticality" value={form.criticality} onChange={(event) => updateForm('criticality', event.target.value)}><option>Normal</option><option>Critical</option></select></FormField>
            <FormField id="request-budget" label="Budget status"><select className="ui-field-control" id="request-budget" value={form.budgetStatus} onChange={(event) => updateForm('budgetStatus', event.target.value)}><option>Pending review</option><option>Approved</option><option>Not approved</option></select></FormField>
            <FormField id="request-reason" label="Reason" required><input className="ui-field-control" id="request-reason" required value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} /></FormField>
            <FormField id="request-date" label="Target start date"><input className="ui-field-control" id="request-date" type="date" value={form.targetStartDate} onChange={(event) => updateForm('targetStartDate', event.target.value)} /></FormField>
            <div className="full-field"><FormField id="request-justification" label="Justification" hint="Explain the business need and expected start date."><textarea className="ui-field-control" id="request-justification" rows={4} value={form.justification} onChange={(event) => updateForm('justification', event.target.value)} /></FormField></div>
          </div>
          <div className="form-actions"><Button variant="quiet" type="button" onClick={() => setIsFormOpen(false)}>Cancel</Button><Button variant="primary" loading={busyAction === 'create'} loadingLabel="Creating request" type="submit">Create draft request</Button></div>
        </form>
      </Modal>
    </>
  );
}
