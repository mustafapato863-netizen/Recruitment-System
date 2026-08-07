import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';

type FormState = { requestedHeadcount: string; employmentType: string; reason: string; budgetStatus: string; criticality: string; targetStartDate: string; justification: string };
const initialForm: FormState = { requestedHeadcount: '1', employmentType: 'Full-time', reason: 'New Position', budgetStatus: 'Budgeted', criticality: 'Normal', targetStartDate: '', justification: '' };

export function CreateVacancyRequestPage() {
  const navigate = useNavigate();
  const [context, setContext] = useState<VacancyCoreContext | null>(null);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi<VacancyCoreContext>('/vacancy-requests/context')
      .then(setContext)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load request context'))
      .finally(() => setIsLoading(false));
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>, mode: 'draft' | 'submit') => {
    event.preventDefault();
    if (!context) return;
    setError('');
    setIsSubmitting(mode);
    try {
      const request = await fetchApi<VacancyRequest>('/vacancy-requests', {
        method: 'POST',
        body: JSON.stringify({
          branchId: context.branch.id,
          positionId: context.position.id,
          requestedHeadcount: Number(form.requestedHeadcount),
          employmentType: form.employmentType,
          reason: form.reason,
          budgetStatus: form.budgetStatus,
          criticality: form.criticality,
          targetStartDate: form.targetStartDate || undefined,
          justification: form.justification || undefined,
        }),
      });
      if (mode === 'submit') {
        await fetchApi(`/vacancy-requests/${request.id}/submit`, { method: 'POST', body: JSON.stringify({}) });
      }
      navigate(`/vacancy-requests/${request.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create vacancy request');
    } finally {
      setIsSubmitting(null);
    }
  };

  if (isLoading) return <div className="alert loading-alert" role="status">Loading request context...</div>;

  return (
    <div className="create-request-page">
      <div className="page-heading"><div><span className="eyebrow">Vacancy Requests / Create</span><h1>New Vacancy Request</h1><p>Create a draft or submit a headcount request for approval.</p></div><button className="quiet-button" type="button" onClick={() => navigate('/vacancy-requests')}>Cancel</button></div>
      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      <form onSubmit={(event) => void create(event, 'draft')}>
        <div className="dashboard-grid create-request-grid">
          <div className="panel detail-panel">
            <ol className="workflow-steps" aria-label="Request steps"><li className="active">Organization</li><li>Details</li><li>Requirements</li><li>Budget</li><li>Review</li></ol>
            <div className="form-grid"><div className="form-summary full-field"><strong>Organization context</strong><span>{context?.organization.name}</span><small>Branch: {context?.branch.name} · Position: {context?.position.title}</small></div><h2 className="full-field form-section-title">Vacancy details</h2><label>Headcount <input required min="1" max="10000" type="number" value={form.requestedHeadcount} onChange={(event) => setForm({ ...form, requestedHeadcount: event.target.value })} /></label><label>Target date <input type="date" value={form.targetStartDate} onChange={(event) => setForm({ ...form, targetStartDate: event.target.value })} /></label><label>Reason <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}><option>New Position</option><option>Replacement</option></select></label><label>Employment type <select value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })}><option>Full-time</option><option>Part-time</option><option>Contract</option></select></label><label>Criticality <select value={form.criticality} onChange={(event) => setForm({ ...form, criticality: event.target.value })}><option>Normal</option><option>High</option><option>Critical</option></select></label><label>Budget status <select value={form.budgetStatus} onChange={(event) => setForm({ ...form, budgetStatus: event.target.value })}><option>Budgeted</option><option>Unbudgeted</option></select></label><label className="full-field">Justification <textarea required rows={5} value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} placeholder="Explain the business need and expected start date." /></label></div>
            <div className="form-actions"><button className="quiet-button" disabled={isSubmitting !== null} type="button" onClick={() => navigate('/vacancy-requests')}>Cancel</button><button className="quiet-button" disabled={isSubmitting !== null} type="submit">{isSubmitting === 'draft' ? 'Saving...' : 'Save Draft'}</button><button className="primary-button" disabled={isSubmitting !== null} type="button" onClick={(event) => { event.preventDefault(); void create(event as unknown as FormEvent<HTMLFormElement>, 'submit'); }}>{isSubmitting === 'submit' ? 'Submitting...' : 'Submit for Approval'}</button></div>
          </div>
          <aside className="panel detail-panel"><h2>Request readiness</h2><ul className="readiness-list"><li className="ready">Organization context loaded</li><li className={form.requestedHeadcount ? 'ready' : ''}>Headcount provided</li><li className={form.justification ? 'ready' : ''}>Justification provided</li><li className={form.budgetStatus ? 'ready' : ''}>Budget status selected</li></ul><p className="muted-copy">Submitting creates the draft and starts the server-side approval route.</p></aside>
        </div>
      </form>
    </div>
  );
}
