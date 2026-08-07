import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Application } from '@recruitflow/contracts';

type OfferComponentDraft = {
  type: 'Salary' | 'Allowance' | 'Benefit';
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  isTaxable: boolean;
};

type OfferComponentField = keyof OfferComponentDraft;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function CreateOfferPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const applicationId = query.get('applicationId');
  const isRevision = query.get('revision') === 'true';
  const offerId = query.get('offerId');

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contractType: 'Permanent',
    probationPeriod: '6 Months',
    offerExpiry: '',
    proposedJoiningDate: '',
    workLocation: '',
    workingSchedule: 'Standard Mon-Fri',
  });

  const [components, setComponents] = useState<OfferComponentDraft[]>([
    { type: 'Salary' as const, name: 'Basic Salary', amount: 0, currency: 'AED', frequency: 'Monthly', isTaxable: true },
    { type: 'Allowance' as const, name: 'Housing Allowance', amount: 0, currency: 'AED', frequency: 'Monthly', isTaxable: true },
    { type: 'Allowance' as const, name: 'Transportation', amount: 0, currency: 'AED', frequency: 'Monthly', isTaxable: true },
  ]);

  useEffect(() => {
    if (applicationId) {
      fetchApplication(applicationId);
    }
  }, [applicationId]);

  async function fetchApplication(id: string) {
    try {
      const data = await getApi<Application>(`/applications/${id}`);
      setApplication(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }

  const handleComponentChange = (
    index: number,
    field: OfferComponentField,
    value: string | number | boolean,
  ) => {
    const newComps = [...components];
    newComps[index] = { ...newComps[index], [field]: value } as OfferComponentDraft;
    setComponents(newComps);
  };

  const calculateTotal = () => {
    return components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return;

    setLoading(true);
    try {
      const payload = {
        applicationId,
        ...formData,
        offerExpiry: formData.offerExpiry ? new Date(formData.offerExpiry).toISOString() : undefined,
        proposedJoiningDate: formData.proposedJoiningDate ? new Date(formData.proposedJoiningDate).toISOString() : undefined,
        components,
      };

      if (isRevision && offerId) {
        await postApi(`/offers/${offerId}/revisions`, payload);
        navigate(`/offers/${offerId}`);
      } else {
        const id = await postApi('/offers', payload);
        navigate(`/offers/${id}`);
      }
    } catch (err: unknown) {
      alert(`Failed to save offer: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!applicationId) return <div className="page">Application ID is required.</div>;
  if (error) return <div className="page"><div className="alert error">Failed to load context: {error}</div></div>;

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow">RecruitFlow Workspace</div>
          <h1>{isRevision ? 'Revise Offer' : 'Create Offer Package'}</h1>
          <div className="sub">
            Prepare compensation components and terms for {application?.candidate ? `${application.candidate.firstName} ${application.candidate.lastName}` : 'Candidate'}.
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Submit for Approval'}
          </button>
        </div>
      </div>

      <div className="grid main-side">
        <section className="card">
          <div className="card-h">
            <div><b>Terms & Logistics</b><small>Standard conditions of employment.</small></div>
          </div>
          <div className="card-b">
            <div className="grid c2" style={{ gap: '1rem' }}>
              <div className="field">
                <label>Contract Type</label>
                <select value={formData.contractType} onChange={e => setFormData({ ...formData, contractType: e.target.value })}>
                  <option value="Permanent">Permanent</option>
                  <option value="Fixed Term">Fixed Term</option>
                  <option value="Consultancy">Consultancy</option>
                </select>
              </div>
              <div className="field">
                <label>Probation Period</label>
                <select value={formData.probationPeriod} onChange={e => setFormData({ ...formData, probationPeriod: e.target.value })}>
                  <option value="None">None</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                </select>
              </div>
              <div className="field">
                <label>Proposed Joining Date</label>
                <input type="date" value={formData.proposedJoiningDate} onChange={e => setFormData({ ...formData, proposedJoiningDate: e.target.value })} />
              </div>
              <div className="field">
                <label>Offer Expiry Date</label>
                <input type="date" value={formData.offerExpiry} onChange={e => setFormData({ ...formData, offerExpiry: e.target.value })} />
              </div>
              <div className="field">
                <label>Work Location</label>
                <input type="text" value={formData.workLocation} onChange={e => setFormData({ ...formData, workLocation: e.target.value })} placeholder="e.g. Dubai HQ" />
              </div>
              <div className="field">
                <label>Working Schedule</label>
                <input type="text" value={formData.workingSchedule} onChange={e => setFormData({ ...formData, workingSchedule: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card-h" style={{ borderTop: '1px solid var(--border)' }}>
            <div><b>Compensation Components</b><small>Financial breakdown of the package.</small></div>
          </div>
          <div className="card-b">
            {components.map((comp, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', alignItems: 'end' }}>
                <div className="field">
                  <label>Type</label>
                  <select value={comp.type} onChange={e => handleComponentChange(idx, 'type', e.target.value)}>
                    <option value="Salary">Salary</option>
                    <option value="Allowance">Allowance</option>
                    <option value="Benefit">Benefit</option>
                  </select>
                </div>
                <div className="field">
                  <label>Name</label>
                  <input type="text" value={comp.name} onChange={e => handleComponentChange(idx, 'name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Amount (AED)</label>
                  <input type="number" value={comp.amount} onChange={e => handleComponentChange(idx, 'amount', Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Frequency</label>
                  <select value={comp.frequency} onChange={e => handleComponentChange(idx, 'frequency', e.target.value)}>
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>
            ))}
            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <b>Total Monthly Package</b>
              <b style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>AED {calculateTotal().toLocaleString()}</b>
            </div>
          </div>
        </section>

        <aside>
          <div className="card">
            <div className="card-h">
              <div><b>Context</b></div>
            </div>
            <div className="card-b">
              <div className="field">
                <label>Candidate</label>
                <div>{application?.candidate ? `${application.candidate.firstName} ${application.candidate.lastName}` : '...'}</div>
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label>Vacancy / Position</label>
                <div>{application?.positionTitle || '...'}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 15 }}>
            <div className="card-h">
              <div><b>Approval Chain</b><small>Generated upon submission</small></div>
            </div>
            <div className="card-b">
              <div className="process">
                <div className="prow"><span className="pcheck pending">•</span>HR Manager</div>
                <div className="prow"><span className="pcheck pending">•</span>Finance (if applicable)</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
