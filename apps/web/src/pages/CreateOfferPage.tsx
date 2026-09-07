import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Application } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { FormSection } from '../components/ui/FormSection';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { MetricCard } from '../components/ui/MetricCard';
import { PipelineStepper } from '../components/PipelineStepper';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

type OfferComponentDraft = {
  type: 'Salary' | 'Allowance' | 'Benefit';
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  isTaxable: boolean;
};

type OfferComponentField = keyof OfferComponentDraft;

const OFFER_STEPS = ['Candidate & Role', 'Compensation Package', 'Terms & Sign-Off'];

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

  const [availableApplications, setAvailableApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState(applicationId || '');
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contractType: 'Permanent',
    probationPeriod: '6 Months',
    offerExpiry: '',
    proposedJoiningDate: '',
    workLocation: '',
    workingSchedule: 'Full-time (Standard)',
  });

  const [components, setComponents] = useState<OfferComponentDraft[]>([
    { type: 'Salary', name: 'Basic Salary', amount: 0, currency: 'SAR', frequency: 'Monthly', isTaxable: true },
  ]);

  const [targetGrossSalary, setTargetGrossSalary] = useState<number>(0);

  useEffect(() => {
    if (selectedAppId) {
      void fetchApplication(selectedAppId);
    } else {
      void loadApplications();
    }
  }, [selectedAppId]);

  async function loadApplications() {
    try {
      const res = await getApi<{ data: Application[] }>('/applications');
      if (res.data && res.data.length > 0) {
        setAvailableApplications(res.data);
      }
    } catch {
      // Ignored
    }
  }

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

  const addComponent = () => {
    setComponents([
      ...components,
      { type: 'Allowance', name: 'Other Allowance', amount: 1000, currency: 'SAR', frequency: 'Monthly', isTaxable: true },
    ]);
  };

  const applySaudiStandardPackage = (gross: number) => {
    if (!gross || gross <= 0) return;
    const basic = Math.round(gross * 0.60);
    const housing = Math.round(gross * 0.25);
    const transport = Math.round(gross * 0.10);
    const other = gross - (basic + housing + transport);

    const newComps: OfferComponentDraft[] = [
      { type: 'Salary', name: 'Basic Salary (60%)', amount: basic, currency: 'SAR', frequency: 'Monthly', isTaxable: true },
      { type: 'Allowance', name: 'Housing Allowance (25%)', amount: housing, currency: 'SAR', frequency: 'Monthly', isTaxable: true },
      { type: 'Allowance', name: 'Transportation Allowance (10%)', amount: transport, currency: 'SAR', frequency: 'Monthly', isTaxable: true },
    ];

    if (other > 0) {
      newComps.push({
        type: 'Allowance',
        name: 'Special / Medical Allowance (5%)',
        amount: other,
        currency: 'SAR',
        frequency: 'Monthly',
        isTaxable: true,
      });
    }

    setComponents(newComps);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const calculateMonthlyTotal = () => {
    return components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  };

  const calculateAnnualTotal = () => {
    return calculateMonthlyTotal() * 12;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAppId && !isRevision) {
      setError('Please select a valid candidate application.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        applicationId: selectedAppId,
        ...formData,
        offerExpiry: formData.offerExpiry ? new Date(formData.offerExpiry).toISOString() : undefined,
        proposedJoiningDate: formData.proposedJoiningDate ? new Date(formData.proposedJoiningDate).toISOString() : undefined,
        components,
      };

      if (isRevision && offerId) {
        await postApi(`/offers/${offerId}/revisions`, payload);
        navigate(`/offers/${offerId}`);
      } else {
        const res = await postApi<{ id?: string; offerId?: string }>('/offers', payload);
        const resultId = typeof res === 'string' ? res : (res as { id?: string })?.id || (res as { offerId?: string })?.offerId || 'active';
        navigate(`/offers/${resultId}`);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const candidateName = application?.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : 'Candidate (Selected)';

  return (
    <PageFrame
      eyebrow="Offer Management / Create"
      title={isRevision ? 'Revise Offer Package' : 'Create Offer Package'}
      description="Configure compensation elements, contract terms, salary bands, and multi-tier approval routing."
      actions={
        <>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/offers">
              <Icon name="arrow-left" size={13} />
              Cancel
            </Link>
          </Button>
          <Button variant="primary" size="sm" loading={loading} loadingLabel="Saving offer" onClick={(e) => void handleSubmit(e)}>
            <Icon name="check-circle" size={14} />
            Generate & Submit Offer
          </Button>
        </>
      }
    >
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <PipelineStepper steps={OFFER_STEPS} currentStep={1} />
      </div>

      {error && (
        <Alert tone="danger" title="Offer configuration error">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Monthly Total" value={`AED ${calculateMonthlyTotal().toLocaleString()}`} detail="Gross compensation" tone="action" icon={<Icon name="offer" size={14} />} />
        <MetricCard label="Annual Value" value={`AED ${calculateAnnualTotal().toLocaleString()}`} detail="Base + Allowances" tone="info" icon={<Icon name="grid-squares" size={14} />} />
        <MetricCard label="Contract Type" value={formData.contractType} detail={formData.probationPeriod} tone="neutral" icon={<Icon name="briefcase" size={14} />} />
        <MetricCard label="Salary Band" value="Within Range" detail="Grade 7 approved" tone="success" icon={<Icon name="check-circle" size={14} />} />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {!isRevision && (
              <FormSection
                title="Candidate Application"
                description="Select candidate application for this compensation package."
              >
                <FormField id="offer-app-select" label="Target Application" required>
                  <Select
                    id="offer-app-select"
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                  >
                    <option value="">Choose an application</option>
                    {availableApplications.length === 0 && (
                      <option value={selectedAppId || ''}>
                        {candidateName} {application?.positionTitle ? `— ${application.positionTitle}` : ''}
                      </option>
                    )}
                    {availableApplications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : 'Candidate'} — {app.positionTitle || 'Position'} ({app.stage})
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormSection>
            )}

            <FormSection
              title="Compensation Breakdown"
              description="Define salary, housing, transport and variable allowances in Saudi Riyals (SAR)."
              actions={
                <Button variant="secondary" size="sm" type="button" onClick={addComponent}>
                  <Icon name="plus" size={13} />
                  Add Component
                </Button>
              }
            >
              {/* Saudi Standard 1-Click Calculator Helper */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/80 via-emerald-50/60 to-white dark:from-slate-800/80 dark:via-slate-800/40 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/50 mb-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold">⚡</span>
                    <strong className="text-xs font-bold text-slate-900 dark:text-white">
                      Saudi Labor Law Standard Package Calculator
                    </strong>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      SAR Currency
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Auto-split: 60% Basic • 25% Housing • 10% Transport • 5% Other
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-48">
                    <Input
                      type="number"
                      placeholder="Target Gross (e.g. 35000)"
                      value={targetGrossSalary || ''}
                      onChange={(e) => setTargetGrossSalary(Number(e.target.value))}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    disabled={!targetGrossSalary || targetGrossSalary <= 0}
                    onClick={() => applySaudiStandardPackage(targetGrossSalary)}
                  >
                    Apply 1-Click Saudi Breakdown
                  </Button>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 ml-auto">
                    <span>Presets:</span>
                    {[15000, 25000, 45000, 60000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setTargetGrossSalary(amt);
                          applySaudiStandardPackage(amt);
                        }}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 transition text-[10px] font-bold cursor-pointer"
                      >
                        {amt.toLocaleString()} SAR
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {components.map((comp, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                  >
                    <div className="sm:col-span-3">
                      <Select
                        value={comp.type}
                        onChange={(e) => handleComponentChange(idx, 'type', e.target.value as OfferComponentDraft['type'])}
                      >
                        <option value="Salary">Basic Salary</option>
                        <option value="Allowance">Allowance</option>
                        <option value="Benefit">Benefit</option>
                      </Select>
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        placeholder="Component name"
                        value={comp.name}
                        onChange={(e) => handleComponentChange(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        type="number"
                        placeholder="Amount (SAR)"
                        value={comp.amount}
                        onChange={(e) => handleComponentChange(idx, 'amount', Number(e.target.value))}
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-center">
                      <Button
                        variant="danger"
                        size="sm"
                        type="button"
                        className="w-8 h-8 p-0 flex items-center justify-center rounded-lg"
                        onClick={() => removeComponent(idx)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection
              title="Contract Terms & Joining Logistics"
              description="Probation, schedule, location and offer validity."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="offer-contract" label="Contract Type">
                  <Select
                    id="offer-contract"
                    value={formData.contractType}
                    onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                  >
                    <option value="Permanent">Permanent Contract</option>
                    <option value="Fixed-Term">Fixed-Term Contract</option>
                    <option value="Consultancy">Consultancy Agreement</option>
                  </Select>
                </FormField>

                <FormField id="offer-probation" label="Probation Period">
                  <Select
                    id="offer-probation"
                    value={formData.probationPeriod}
                    onChange={(e) => setFormData({ ...formData, probationPeriod: e.target.value })}
                  >
                    <option value="3 Months">3 Months</option>
                    <option value="6 Months">6 Months</option>
                    <option value="None">None</option>
                  </Select>
                </FormField>

                <FormField id="offer-join" label="Proposed Joining Date">
                  <Input
                    id="offer-join"
                    type="date"
                    value={formData.proposedJoiningDate}
                    onChange={(e) => setFormData({ ...formData, proposedJoiningDate: e.target.value })}
                  />
                </FormField>

                <FormField id="offer-expiry" label="Offer Acceptance Expiry">
                  <Input
                    id="offer-expiry"
                    type="date"
                    value={formData.offerExpiry}
                    onChange={(e) => setFormData({ ...formData, offerExpiry: e.target.value })}
                  />
                </FormField>

                <FormField id="offer-loc" label="Work Location">
                  <Input
                    id="offer-loc"
                    value={formData.workLocation}
                    onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                  />
                </FormField>

                <FormField id="offer-sched" label="Working Schedule">
                  <Input
                    id="offer-sched"
                    value={formData.workingSchedule}
                    onChange={(e) => setFormData({ ...formData, workingSchedule: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rf-panel rounded-2xl border border-rf-border bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-xs font-bold text-rf-ink m-0">Target Candidate</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Offer recipient.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center font-bold text-sm border border-rf-action/20">
                  {candidateName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong className="text-xs font-bold text-rf-ink block">{candidateName}</strong>
                  <span className="text-[11px] text-rf-ink-muted font-medium">{application?.positionTitle || 'Position not reported'}</span>
                </div>
              </div>
            </section>

            <Alert tone="info" title="Approval requirement">
              Compensation packages above AED 20,000/mo require secondary approval by the HR Director.
            </Alert>
          </aside>
        </div>
      </form>
    </PageFrame>
  );
}
