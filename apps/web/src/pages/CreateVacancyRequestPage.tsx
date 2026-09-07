import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { FormSection } from '../components/ui/FormSection';
import { Input } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { PipelineStepper } from '../components/PipelineStepper';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

type FormState = {
  requestedHeadcount: string;
  employmentType: string;
  reason: string;
  budgetStatus: string;
  criticality: string;
  targetStartDate: string;
  justification: string;
  jobSummary: string;
  description: string;
  responsibilities: string;
  qualifications: string;
  benefits: string;
};

const initialForm: FormState = {
  requestedHeadcount: '1',
  employmentType: 'Full-time',
  reason: 'New position',
  budgetStatus: 'Budgeted',
  criticality: 'Normal',
  targetStartDate: '',
  justification: '',
  jobSummary: '',
  description: '',
  responsibilities: '',
  qualifications: '',
  benefits: '',
};

const WIZARD_STEPS = ['Requisition Basics', 'Specifications & Budget', 'Review & Submit'];

export function CreateVacancyRequestPage() {
  const navigate = useNavigate();
  const [context, setContext] = useState<VacancyCoreContext | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [showAllSteps, setShowAllSteps] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi<VacancyCoreContext>('/vacancy-requests/context')
      .then((ctx) => {
        setContext(ctx);
        if (ctx.branch?.id) setSelectedBranchId(ctx.branch.id);
        if (ctx.position?.id) setSelectedPositionId(ctx.position.id);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load request context'))
      .finally(() => setIsLoading(false));
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>, mode: 'draft' | 'submit') => {
    event.preventDefault();
    if (!context || !selectedBranchId || !selectedPositionId) {
      setError('Select an active branch and position before saving this vacancy request.');
      return;
    }
    setError('');
    setIsSubmitting(mode);
    try {
      const request = await fetchApi<VacancyRequest>('/vacancy-requests', {
        method: 'POST',
        body: JSON.stringify({
          branchId: selectedBranchId,
          positionId: selectedPositionId,
          requestedHeadcount: Number(form.requestedHeadcount),
          employmentType: form.employmentType,
          reason: form.reason,
          budgetStatus: form.budgetStatus,
          criticality: form.criticality,
          targetStartDate: form.targetStartDate || undefined,
          justification: form.justification || undefined,
          jobSummary: form.jobSummary.trim() || undefined,
          description: form.description.trim() || undefined,
          responsibilities: form.responsibilities.trim() || undefined,
          qualifications: form.qualifications.trim() || undefined,
          benefits: form.benefits.trim() || undefined,
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

  const selectedPositionTitle = useMemo(() => {
    return context?.positions?.find((p) => p.id === selectedPositionId)?.title ?? context?.position?.title ?? selectedPositionId;
  }, [context, selectedPositionId]);

  const selectedBranchName = useMemo(() => {
    return context?.branches?.find((b) => b.id === selectedBranchId)?.name ?? context?.branch?.name ?? selectedBranchId;
  }, [context, selectedBranchId]);

  if (isLoading) {
    return (
      <PageFrame
        eyebrow="Vacancy Management"
        title="Create Vacancy Request"
        description="Capture organization structure, headcount demand, budgeting and role requirements."
      >
        <PageState kind="loading" title="Loading requisition context" description="Fetching organizational master data." />
      </PageFrame>
    );
  }

  if (!context) {
    return (
      <PageFrame
        eyebrow="Vacancy Management"
        title="Create Vacancy Request"
        description="Capture organization structure, headcount demand, budgeting and role requirements."
        actions={
          <Button variant="ghost" size="sm" type="button" onClick={() => navigate('/vacancy-requests')}>
            <Icon name="arrow-left" size={13} />
            Back to requests
          </Button>
        }
      >
        <PageState
          kind="error"
          title="Requisition context unavailable"
          description={error || 'Organization, branch, and position context could not be loaded.'}
          actionLabel="Retry"
          onAction={() => window.location.reload()}
        />
      </PageFrame>
    );
  }

  if (!context.branch || !context.position || !context.branches?.length || !context.positions?.length) {
    return (
      <PageFrame eyebrow="Vacancy Management" title="Create Vacancy Request" description="Capture role demand only after organizational master data is configured.">
        <PageState
          kind="empty"
          title="Position or branch setup is required"
          description="Create at least one active position and branch in Master Data before creating a vacancy request. No incomplete request has been created."
          actionLabel="Open Master Data"
          actionHref="/master-data"
        />
      </PageFrame>
    );
  }

  const isHeadcountValid = Number(form.requestedHeadcount) > 0;
  const isJustificationValid = form.justification.trim().length > 0;
  const readinessCount = [context !== null, isHeadcountValid, isJustificationValid, Boolean(form.budgetStatus)].filter(Boolean).length;
  const readinessPct = Math.round((readinessCount / 4) * 100);

  return (
    <PageFrame
      className="rf-create-vacancy-page"
      eyebrow="Vacancy Management"
      title="Create Vacancy Request"
      description="Define role specifications, headcount demand, and budget authorization before routing to approvals."
      actions={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={() => navigate('/vacancy-requests')}>
            <Icon name="arrow-left" size={13} />
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="submit"
            form="vacancy-request-form"
            name="submissionMode"
            value="draft"
            disabled={isSubmitting !== null}
          >
            {isSubmitting === 'draft' ? 'Saving Draft...' : 'Save Draft'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="vacancy-request-form"
            name="submissionMode"
            value="submit"
            disabled={isSubmitting !== null}
          >
            <Icon name="check-circle" size={14} />
            {isSubmitting === 'submit' ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </>
      }
    >
      {/* Wizard Header & Stepper */}
      <section className="rf-request-wizard rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs mb-6" aria-labelledby="rf-request-wizard-title">
        <div className="rf-request-wizard__header flex items-center justify-between pb-3 border-b border-rf-border-subtle mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rf-action block">Requisition Workflow</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {showAllSteps ? 'All-in-One View' : `Step ${activeStep + 1} of 3`}
              </span>
            </div>
            <h2 id="rf-request-wizard-title" className="text-base font-bold text-rf-ink m-0 mt-0.5">
              Draft New Workforce Requisition
            </h2>
            <p className="text-xs text-rf-ink-muted font-medium m-0 mt-0.5">
              Fill in the operational demand parameters below. Save as draft at any time or submit directly for approval routing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAllSteps((prev) => !prev)}
              className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Icon name={showAllSteps ? 'layout' : 'menu'} size={12} />
              <span>{showAllSteps ? 'Switch to 3-Step Wizard' : 'Show All Sections'}</span>
            </button>
            <span className="text-xs font-black text-rf-ink px-3 py-1 rounded-full bg-rf-surface-subtle border border-rf-border-subtle">
              {readinessPct}% Complete
            </span>
          </div>
        </div>
        <div className="rf-request-wizard__progress pt-2">
          <PipelineStepper
            steps={WIZARD_STEPS}
            currentStep={showAllSteps ? 2 : activeStep}
          />
        </div>
      </section>

      {error && (
        <Alert tone="danger" title="Review Requisition" className="mb-6">
          {error}
        </Alert>
      )}

      <form
        id="vacancy-request-form"
        className="rf-create-vacancy-form"
        onSubmit={(event) => {
          const mode =
            event.nativeEvent instanceof SubmitEvent &&
            event.nativeEvent.submitter instanceof HTMLButtonElement &&
            event.nativeEvent.submitter.value === 'submit'
              ? 'submit'
              : 'draft';
          void create(event, mode);
        }}
      >
        <div className="rf-create-vacancy-layout grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Form Fields (8 cols) */}
          <div className="rf-create-vacancy-main lg:col-span-8 flex flex-col gap-6">
            {/* Step 1: Requisition Basics */}
            {(showAllSteps || activeStep === 0) && (
              <FormSection
                className="rf-request-form-section"
                eyebrow="Step 1 · Structure & Basics"
                title="Organization & Role Context"
                description="Select organizational branch, target position title, and initial headcount requirements."
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField id="ctx-org" label="Organization">
                    <Input id="ctx-org" disabled value={context.organization.name} />
                  </FormField>
                  <FormField id="ctx-branch" label="Branch / Location" required>
                    {context.branches && context.branches.length > 0 ? (
                      <Select
                        id="ctx-branch"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                      >
                        {context.branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input id="ctx-branch" disabled value={context.branch.name} />
                    )}
                  </FormField>
                  <FormField id="ctx-position" label="Target Position" required>
                    {context.positions && context.positions.length > 0 ? (
                      <Select
                        id="ctx-position"
                        value={selectedPositionId}
                        onChange={(e) => setSelectedPositionId(e.target.value)}
                      >
                        {context.positions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input id="ctx-position" disabled value={context.position.title} />
                    )}
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  <FormField id="req-headcount" label="Required Headcount" required>
                    <Input
                      id="req-headcount"
                      min="1"
                      max="10000"
                      required
                      type="number"
                      value={form.requestedHeadcount}
                      onChange={(event) => setForm({ ...form, requestedHeadcount: event.target.value })}
                    />
                  </FormField>
                  <FormField id="req-target-date" label="Target Start Date">
                    <Input
                      id="req-target-date"
                      type="date"
                      value={form.targetStartDate}
                      onChange={(event) => setForm({ ...form, targetStartDate: event.target.value })}
                    />
                  </FormField>
                  <FormField id="req-employment" label="Employment Type">
                    <Select
                      id="req-employment"
                      value={form.employmentType}
                      onChange={(event) => setForm({ ...form, employmentType: event.target.value })}
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </Select>
                  </FormField>
                </div>
              </FormSection>
            )}

            {/* Step 2: Specifications & Budget */}
            {(showAllSteps || activeStep === 1) && (
              <>
                <FormSection
                  className="rf-request-form-section"
                  eyebrow="Step 2 · Demand Specifications & Budget"
                  title="Operational & Financial Parameters"
                  description="Specify requisition reason, budget allocation status, and priority criticality."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField id="req-reason" label="Requisition Reason" required>
                      <Select
                        id="req-reason"
                        value={form.reason}
                        onChange={(event) => setForm({ ...form, reason: event.target.value })}
                      >
                        <option value="New position">New Position</option>
                        <option value="Replacement">Replacement</option>
                        <option value="Expansion">Expansion / Growth</option>
                      </Select>
                    </FormField>
                    <FormField id="req-criticality" label="Criticality">
                      <Select
                        id="req-criticality"
                        value={form.criticality}
                        onChange={(event) => setForm({ ...form, criticality: event.target.value })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </Select>
                    </FormField>
                    <FormField id="req-budget" label="Budget Status">
                      <Select
                        id="req-budget"
                        value={form.budgetStatus}
                        onChange={(event) => setForm({ ...form, budgetStatus: event.target.value })}
                      >
                        <option value="Budgeted">Budgeted</option>
                        <option value="Unbudgeted">Unbudgeted</option>
                      </Select>
                    </FormField>
                  </div>
                </FormSection>

                <FormSection
                  className="rf-request-form-section"
                  eyebrow="Posting Specifications"
                  title="Job Description & Responsibilities"
                  description="Public-facing content that will become the active vacancy posting on approval."
                >
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      id="req-job-summary"
                      label="Short Summary / Teaser"
                      hint="One or two lines shown on job listings. Required before vacancy publishing."
                    >
                      <Input
                        id="req-job-summary"
                        value={form.jobSummary}
                        onChange={(event) => setForm({ ...form, jobSummary: event.target.value })}
                        placeholder="e.g. Senior ICU nurse for a 24-bed critical care unit in Jeddah"
                      />
                    </FormField>
                    <FormField
                      id="req-description"
                      label="About the Role"
                      hint="Full role overview shown at the top of the careers posting."
                    >
                      <Textarea
                        id="req-description"
                        rows={3}
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        placeholder="Describe the unit, team, shift pattern, and what success looks like..."
                      />
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        id="req-responsibilities"
                        label="Key Responsibilities"
                        hint="One per line."
                      >
                        <Textarea
                          id="req-responsibilities"
                          rows={3}
                          value={form.responsibilities}
                          onChange={(event) => setForm({ ...form, responsibilities: event.target.value })}
                          placeholder="Deliver bedside critical care...&#10;Coordinate with physicians..."
                        />
                      </FormField>
                      <FormField
                        id="req-qualifications"
                        label="Required Qualifications"
                        hint="Licenses, certifications, experience."
                      >
                        <Textarea
                          id="req-qualifications"
                          rows={3}
                          value={form.qualifications}
                          onChange={(event) => setForm({ ...form, qualifications: event.target.value })}
                          placeholder="Valid SCFHS classification...&#10;Minimum 3 years ICU experience..."
                        />
                      </FormField>
                    </div>
                    <FormField
                      id="req-benefits"
                      label="Benefits & Highlights"
                      hint="What the organization offers for this role."
                    >
                      <Textarea
                        id="req-benefits"
                        rows={2}
                        value={form.benefits}
                        onChange={(event) => setForm({ ...form, benefits: event.target.value })}
                        placeholder="Competitive tax-free package, housing, annual flights, CME allowance..."
                      />
                    </FormField>
                  </div>
                </FormSection>
              </>
            )}

            {/* Step 3: Review & Submit */}
            {(showAllSteps || activeStep === 2) && (
              <FormSection
                className="rf-request-form-section"
                eyebrow="Step 3 · Business Justification & Review"
                title="Justification & Sign-Off"
                description="Provide business justification and verify requisition readiness before routing to approvals."
              >
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    id="req-justification"
                    label="Business Justification & Operational Impact"
                    required
                    hint="Explain why this role is needed and what operational impact it will deliver."
                  >
                    <Textarea
                      id="req-justification"
                      required
                      rows={4}
                      value={form.justification}
                      onChange={(event) => setForm({ ...form, justification: event.target.value })}
                      placeholder="Detail the operational demand, business necessity, and patient care impact for this requisition..."
                    />
                  </FormField>
                </div>
              </FormSection>
            )}

            {/* In-Wizard Step Navigation Bar */}
            {!showAllSteps && (
              <div className="flex items-center justify-between p-4 bg-rf-surface rounded-2xl border border-rf-border-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                >
                  <Icon name="arrow-left" size={13} />
                  <span>Previous Step</span>
                </Button>

                <span className="text-xs font-bold text-rf-ink-muted">
                  Step {activeStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[activeStep]}
                </span>

                {activeStep < 2 ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveStep((p) => Math.min(2, p + 1))}
                  >
                    <span>Next: {WIZARD_STEPS[activeStep + 1]}</span>
                    <Icon name="arrow-right" size={13} />
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      name="submissionMode"
                      value="draft"
                      disabled={isSubmitting !== null}
                    >
                      <span>Save Draft</span>
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      name="submissionMode"
                      value="submit"
                      disabled={isSubmitting !== null}
                    >
                      <Icon name="check-circle" size={13} />
                      <span>Submit Requisition</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar: Readiness & Live Summary Preview (4 cols) */}
          <aside className="rf-create-vacancy-aside lg:col-span-4 flex flex-col gap-6">
            {/* Live Requisition Summary Preview Card */}
            <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rf-action block">Live Requisition Summary</span>
                <h3 className="text-xs font-bold text-rf-ink m-0 mt-0.5">Preview Draft</h3>
              </div>

              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-rf-ink-muted uppercase tracking-wider">Position</span>
                  <span className="text-xs font-bold text-rf-ink">{selectedPositionTitle}</span>
                  <span className="text-[11px] text-rf-ink-muted inline-flex items-center gap-1 mt-0.5">
                    <Icon name="building" size={11} /> {selectedBranchName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="text-[10px] font-bold text-rf-ink-muted uppercase block">Headcount</span>
                    <span className="text-sm font-black text-rf-ink block mt-0.5">{form.requestedHeadcount} HC</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
                    <span className="text-[10px] font-bold text-rf-ink-muted uppercase block">Priority</span>
                    <span className="text-xs font-bold text-rf-ink block mt-0.5">{form.criticality}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle">
                  <span className="text-[10px] font-bold text-rf-ink-muted uppercase block">Timeline & Type</span>
                  <span className="text-xs font-bold text-rf-ink block mt-0.5">
                    {form.employmentType} · {form.targetStartDate ? new Date(form.targetStartDate).toLocaleDateString() : 'Flexible Start'}
                  </span>
                </div>
              </div>
            </section>

            {/* Submission Readiness Checklist */}
            <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted block">Pre-flight Verification</span>
                <h3 className="text-xs font-bold text-rf-ink m-0 mt-0.5">Submission Readiness</h3>
              </div>
              <div className="p-4 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle flex flex-col gap-3">
                <ProgressBar label="Readiness Score" value={readinessPct} tone="action" />
                <div className="flex flex-col gap-2 pt-2 border-t border-rf-border-subtle text-xs">
                  <div className="flex items-center gap-2 text-rf-ink font-medium">
                    <Icon
                      name={context ? 'check-circle' : 'circle'}
                      size={14}
                      className={context ? 'text-rf-success' : 'text-rf-ink-muted'}
                    />
                    Context Configured
                  </div>
                  <div className="flex items-center gap-2 text-rf-ink font-medium">
                    <Icon
                      name={isHeadcountValid ? 'check-circle' : 'circle'}
                      size={14}
                      className={isHeadcountValid ? 'text-rf-success' : 'text-rf-ink-muted'}
                    />
                    Valid Headcount ({form.requestedHeadcount})
                  </div>
                  <div className="flex items-center gap-2 text-rf-ink font-medium">
                    <Icon
                      name={isJustificationValid ? 'check-circle' : 'circle'}
                      size={14}
                      className={isJustificationValid ? 'text-rf-success' : 'text-rf-ink-muted'}
                    />
                    Business Justification Provided
                  </div>
                  <div className="flex items-center gap-2 text-rf-ink font-medium">
                    <Icon
                      name={form.budgetStatus ? 'check-circle' : 'circle'}
                      size={14}
                      className={form.budgetStatus ? 'text-rf-success' : 'text-rf-ink-muted'}
                    />
                    Budget Status Confirmed
                  </div>
                </div>
              </div>
            </section>

            <Alert tone="info" title="Workflow Routing Rule">
              Unbudgeted requests automatically route to Finance approval before active vacancy publishing.
            </Alert>
          </aside>
        </div>
      </form>
    </PageFrame>
  );
}

export default CreateVacancyRequestPage;
