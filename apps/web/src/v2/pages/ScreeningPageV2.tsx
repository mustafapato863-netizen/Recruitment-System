import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, DollarSign, MessageSquare, RotateCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { DiscardChangesDialog } from '../../components/v2/DiscardChangesDialog';
import { InputV2, SelectV2, TextareaV2 } from '../../components/v2/Field';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { StatusChip } from '../../components/v2/StatusChip';
import { StageFormSection } from '../drawers/StageFormSection';
import { errorText } from '../drawers/FileDrawers';
import {
  loadApplicationFile,
  loadScreeningContext,
  loadScreeningDraft,
  logScreening,
  moveStage,
  needsReasonNote,
  OTHER_NOTE_MIN,
  rejectionReasons,
  saveScreeningDraft,
  type ApplicationFile,
  type FileStage,
  type ScreeningContext,
} from '../api/applicationFile';
import { SYSTEM_REJECTION_REASONS } from '../api/gates';
import '../../components/v2/v2-primitives.css';
import './application-file.css';

const SCREEN_METHODS = ['Phone', 'Video', 'In person'] as const;
const SCREEN_NEXT_STEPS = ['Move to interview', 'Keep in screening', 'Do not proceed'] as const;
const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD'] as const;
const PERIODS = ['Monthly', 'Annual'] as const;

type SalaryFitStatus = 'below' | 'within' | 'above' | 'not_comparable' | 'range_missing' | 'not_recorded';

export function computeSalaryFit(
  expectedRaw: string,
  expectedCurrency: string,
  expectedPeriod: string,
  range: ScreeningContext['vacancySalaryRange'] | null | undefined,
): SalaryFitStatus {
  const trimmed = expectedRaw.trim();
  if (!trimmed) return 'not_recorded';
  const expected = Number(trimmed);
  if (!Number.isFinite(expected) || expected < 0) return 'not_recorded';
  if (!range || (range.min == null && range.max == null)) return 'range_missing';
  const rCurrency = (range.currency ?? '').trim().toUpperCase();
  const eCurrency = expectedCurrency.trim().toUpperCase();
  const rPeriod = (range.period ?? 'Monthly').trim().toLowerCase();
  const ePeriod = expectedPeriod.trim().toLowerCase();
  if ((rCurrency && eCurrency && rCurrency !== eCurrency) || rPeriod !== ePeriod) {
    return 'not_comparable';
  }
  if (range.min != null && expected < range.min) return 'below';
  if (range.max != null && expected > range.max) return 'above';
  return 'within';
}

const FIT_BADGE: Record<SalaryFitStatus, { tone: 'success' | 'warning' | 'neutral' | 'info'; label: string }> = {
  within: { tone: 'success', label: 'Within vacancy salary range' },
  below: { tone: 'info', label: 'Below vacancy salary range' },
  above: { tone: 'warning', label: 'Above vacancy salary range' },
  not_comparable: { tone: 'warning', label: 'Currency or period differs — manual comparison needed' },
  range_missing: { tone: 'neutral', label: 'Salary range not set on this requisition' },
  not_recorded: { tone: 'neutral', label: 'Enter expected salary to compare' },
};

function formatRange(range: ScreeningContext['vacancySalaryRange'] | null | undefined): string {
  if (!range || (range.min == null && range.max == null)) return 'Not set on this requisition';
  const minText = range.min != null ? range.min.toLocaleString('en-US') : '—';
  const maxText = range.max != null ? range.max.toLocaleString('en-US') : '—';
  const cur = range.currency ? ` ${range.currency}` : '';
  const period = range.period ? ` / ${range.period}` : '';
  return `${minText} – ${maxText}${cur}${period}`;
}

export function ScreeningPageV2() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [context, setContext] = useState<ScreeningContext | null>(null);
  const [file, setFile] = useState<ApplicationFile | null>(null);

  const [outcome, setOutcome] = useState<'Passed' | 'Failed' | 'On Hold'>('Passed');
  const [method, setMethod] = useState<string>('Phone');
  const [evidenceSource, setEvidenceSource] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState<string>('SAR');
  const [salaryPeriod, setSalaryPeriod] = useState<'Monthly' | 'Annual'>('Monthly');
  const [nextStep, setNextStep] = useState<string>('Move to interview');
  const [reasons, setReasons] = useState<string[]>(SYSTEM_REJECTION_REASONS);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);

  const cursorRef = useRef<{ id: string; stage: FileStage; version: number } | null>(null);

  useEffect(() => {
    rejectionReasons()
      .then((list) => setReasons(Array.from(new Set([...list, ...SYSTEM_REJECTION_REASONS]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      loadScreeningContext(id),
      loadApplicationFile(id),
      loadScreeningDraft(id),
    ])
      .then(([ctx, appFile, draftRes]) => {
        if (!alive) return;
        setContext(ctx);
        setFile(appFile);
        const app = appFile.workspace.application;
        cursorRef.current = { id: app.id, stage: app.stage as FileStage, version: app.version };

        const defaultCurrency = ctx.latestExpectedSalary?.currency
          ?? ctx.vacancySalaryRange?.currency
          ?? 'SAR';
        const defaultPeriod = (ctx.latestExpectedSalary?.period
          ?? ctx.vacancySalaryRange?.period
          ?? 'Monthly') as 'Monthly' | 'Annual';

        setSalaryCurrency(defaultCurrency);
        setSalaryPeriod(defaultPeriod === 'Annual' ? 'Annual' : 'Monthly');
        if (ctx.latestExpectedSalary?.amount != null) {
          setExpectedSalary(String(ctx.latestExpectedSalary.amount));
        } else {
          setExpectedSalary('');
        }

        if (draftRes.status === 'ready') {
          const d = draftRes.draft;
          setOutcome(d.outcome);
          setNotes(d.notes ?? '');
          setNotice(d.noticePeriodDays == null ? '' : String(d.noticePeriodDays));
          setMethod(d.method?.trim() ? d.method.trim() : 'Phone');
          setEvidenceSource(d.evidenceSource ?? '');
          setNextStep(d.nextStep?.trim() || 'Move to interview');
        }
        setDirty(false);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const status = e instanceof ApiError ? e.statusCode : undefined;
        setLoadError({ status, message: e instanceof Error ? e.message : 'Could not load screening.' });
        setLoading(false);
      });
    return () => { alive = false; };
  }, [id, attempt]);

  const liveFit = useMemo(
    () => computeSalaryFit(expectedSalary, salaryCurrency, salaryPeriod, context?.vacancySalaryRange),
    [expectedSalary, salaryCurrency, salaryPeriod, context?.vacancySalaryRange],
  );
  const fitBadge = FIT_BADGE[liveFit];

  const app = file?.workspace.application;
  const canMove = Boolean(app && ['Applied', 'Screening'].includes(app.stage));
  const willMoveToInterview = canMove && outcome === 'Passed' && nextStep === 'Move to interview';
  const willReject = canMove && nextStep === 'Do not proceed';
  const otherReject = needsReasonNote(rejectReason);

  const handleBack = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    navigate(`/applications/${encodeURIComponent(id)}`);
  };

  const handleSaveDraft = async () => {
    if (draftBusy || busy) return;
    setDraftBusy(true);
    setDraftNotice(null);
    setFormError(null);
    try {
      await saveScreeningDraft(id, {
        outcome,
        notes: notes.trim() || null,
        noticePeriodDays: notice.trim() === '' ? null : Number(notice),
        method: method.trim() || null,
        evidenceSource: evidenceSource.trim() || null,
        nextStep: nextStep.trim() || null,
        moveToInterview: outcome === 'Passed' && nextStep === 'Move to interview',
      });
      setDraftNotice('Draft saved. Expected salary is not stored in private drafts and is saved when you submit screening.');
      setDirty(false);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setDraftBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || draftBusy || !app || !cursorRef.current) return;
    const next: Record<string, string> = {};
    if (!method.trim()) next.method = 'Choose how you screened.';
    if (!evidenceSource.trim()) next.evidenceSource = 'Write the evidence source.';
    if (!notes.trim()) next.notes = 'Write the screen note. Interview needs a saved screen note.';
    if (!nextStep.trim()) next.nextStep = 'Choose the next step.';
    else if (nextStep === 'Move to interview' && outcome !== 'Passed') {
      next.nextStep = 'Only a Passed screen can move to Interview.';
    }

    const parsedSalary = expectedSalary.trim() === '' ? null : Number(expectedSalary);
    if (parsedSalary !== null && (!Number.isFinite(parsedSalary) || parsedSalary < 0)) {
      next.expectedSalary = 'Expected salary must be a valid non-negative number.';
    }
    if (willMoveToInterview && parsedSalary === null) {
      next.expectedSalary = 'Expected salary is required before moving to Interview.';
    }
    if (willReject) {
      if (!rejectReason) next.rejectReason = 'Pick a rejection reason.';
      if (otherReject && rejectNote.trim().length < OTHER_NOTE_MIN) {
        next.rejectNote = 'Write a short note (at least 3 characters) when selecting Other.';
      }
    }

    setErrs(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setFormError(null);
    try {
      await logScreening({
        applicationId: app.id,
        outcome,
        notes: notes.trim(),
        method: method.trim(),
        evidenceSource: evidenceSource.trim(),
        nextStep: nextStep.trim(),
        ...(notice.trim() ? { noticePeriodDays: Number(notice) } : {}),
        ...(parsedSalary !== null ? { expectedSalary: parsedSalary, salaryCurrency, salaryPeriod } : {}),
      });

      if (willMoveToInterview) {
        const order: FileStage[] = ['Applied', 'Screening', 'Interview'];
        while (order.indexOf(cursorRef.current.stage) >= 0 && order.indexOf(cursorRef.current.stage) < order.indexOf('Interview')) {
          const nextStage: FileStage = order[order.indexOf(cursorRef.current.stage) + 1]!;
          const res = await moveStage(cursorRef.current, nextStage);
          cursorRef.current = {
            id: cursorRef.current.id,
            stage: nextStage,
            version: typeof res?.version === 'number' ? res.version : cursorRef.current.version + 1,
          };
        }
      } else if (willReject) {
        await moveStage(cursorRef.current, 'Rejected', rejectReason, otherReject ? rejectNote.trim() : undefined);
      }

      setDirty(false);
      navigate(`/applications/${encodeURIComponent(app.id)}`);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rf2-file">
        <SkeletonV2 lines={8} label="Loading screening workspace…" />
      </div>
    );
  }
  if (loadError?.status === 403) {
    return (
      <div className="rf2-file">
        <ForbiddenStateV2
          title="Screening is not available for this file"
          body={loadError.message}
          action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/my-work">Back to My Work</Link>}
        />
      </div>
    );
  }
  if (loadError || !context || !file) {
    return (
      <div className="rf2-file" role="alert">
        <EmptyStateV2
          title="Could not load screening"
          body={loadError?.message ?? 'Application screening details could not be loaded.'}
          action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>}
        />
      </div>
    );
  }

  return (
    <div className="rf2-file">
      <section className="rf2-file__head rf2-file__header" aria-labelledby="screening-page-title">
        <div className="rf2-file__navline">
          <button type="button" className="rf2-file__back rf2-link-btn" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" /> Back to application file
          </button>
        </div>
        <div className="rf2-file__identity-row">
          <div className="rf2-file__intro">
            <h1 id="screening-page-title" className="rf2-file__name">Screening — {context.candidateName}</h1>
            <p className="rf2-file__meta rf2-file__sub">
              {context.positionTitle} · Stage: {context.stage}
            </p>
          </div>
          <div className="rf2-file__identity-meta">
            <StatusChip tone={fitBadge.tone} label={fitBadge.label} />
          </div>
        </div>
      </section>

      <form className="rf2-file__stack" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <section className="rf2-card" aria-labelledby="screen-details-h">
          <h2 id="screen-details-h" className="rf2-card__title">Screening evidence</h2>
          <StageFormSection title="Call & evidence" icon={ClipboardCheck}>
            <div className="rf2-drawer-form__row">
              <SelectV2
                label="Outcome"
                value={outcome}
                onChange={(e) => { setOutcome(e.target.value as typeof outcome); setDirty(true); }}
              >
                <option value="Passed">Pass</option>
                <option value="On Hold">On hold</option>
                <option value="Failed">Fail</option>
              </SelectV2>
              <SelectV2
                label="Method"
                required
                value={method}
                onChange={(e) => { setMethod(e.target.value); setDirty(true); }}
                error={errs.method}
              >
                {SCREEN_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectV2>
            </div>
            <div className="rf2-drawer-form__row">
              <InputV2
                label="Evidence source"
                required
                placeholder="Screening call"
                maxLength={500}
                value={evidenceSource}
                onChange={(e) => { setEvidenceSource(e.target.value); setDirty(true); }}
                error={errs.evidenceSource}
              />
              <InputV2
                label="Notice period (days)"
                type="number"
                min={0}
                max={3650}
                inputMode="numeric"
                value={notice}
                onChange={(e) => { setNotice(e.target.value); setDirty(true); }}
              />
            </div>
            <TextareaV2
              label="Screen note"
              required
              rows={5}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              error={errs.notes}
              hint="Summarize qualifications, availability, and screening evidence."
            />
          </StageFormSection>
        </section>

        <section className="rf2-card" aria-labelledby="salary-fit-h">
          <h2 id="salary-fit-h" className="rf2-card__title">Salary fit</h2>
          <StageFormSection title="Vacancy salary range vs candidate expectation" icon={DollarSign} tone="success">
            <dl className="rf2-terms">
              <dt>Approved vacancy salary range</dt>
              <dd data-testid="vacancy-salary-range">{formatRange(context.vacancySalaryRange)}</dd>
              <dt>Comparison</dt>
              <dd data-testid="salary-fit-status">
                <StatusChip tone={fitBadge.tone} label={fitBadge.label} />
              </dd>
            </dl>
            <div className="rf2-drawer-form__row">
              <InputV2
                label="Expected salary"
                type="number"
                min={0}
                step="any"
                required={willMoveToInterview}
                placeholder="e.g. 12000"
                value={expectedSalary}
                onChange={(e) => { setExpectedSalary(e.target.value); setDirty(true); }}
                error={errs.expectedSalary}
                hint="Required before moving to Interview. Out-of-range expectations are advisory — you still choose the next step."
              />
              <SelectV2
                label="Currency"
                value={salaryCurrency}
                onChange={(e) => { setSalaryCurrency(e.target.value); setDirty(true); }}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectV2>
              <SelectV2
                label="Salary period"
                value={salaryPeriod}
                onChange={(e) => { setSalaryPeriod(e.target.value as 'Monthly' | 'Annual'); setDirty(true); }}
              >
                {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </SelectV2>
            </div>
          </StageFormSection>
        </section>

        <section className="rf2-card" aria-labelledby="next-step-h">
          <h2 id="next-step-h" className="rf2-card__title">Next step</h2>
          <StageFormSection title="Decision" icon={MessageSquare}>
            <SelectV2
              label="Next step"
              required
              value={nextStep}
              onChange={(e) => { setNextStep(e.target.value); setDirty(true); }}
              error={errs.nextStep}
            >
              {SCREEN_NEXT_STEPS.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectV2>
            {willReject ? (
              <>
                <SelectV2
                  label="Rejection reason"
                  required
                  placeholder="Choose a reason"
                  value={rejectReason}
                  onChange={(e) => { setRejectReason(e.target.value); setDirty(true); }}
                  error={errs.rejectReason}
                >
                  {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </SelectV2>
                {otherReject ? (
                  <TextareaV2
                    label="Rejection note"
                    required
                    rows={2}
                    value={rejectNote}
                    onChange={(e) => { setRejectNote(e.target.value); setDirty(true); }}
                    error={errs.rejectNote}
                    hint='Required for "Other". Saved as "Other: <note>".'
                  />
                ) : null}
              </>
            ) : null}
          </StageFormSection>

          {draftNotice ? <p className="rf2-inline-note" role="status">{draftNotice}</p> : null}
          {formError ? <p className="rf2-drawer-form__error" role="alert">{formError}</p> : null}

          <div className="rf2-drawer-form__actions">
            <ButtonV2 type="submit" kind={willReject ? 'danger' : 'primary'} loading={busy} disabled={draftBusy}>
              {willReject ? 'Save and reject' : willMoveToInterview ? 'Save and move to Interview' : 'Save screening'}
            </ButtonV2>
            <ButtonV2 type="button" kind="secondary" loading={draftBusy} disabled={busy} onClick={() => void handleSaveDraft()}>
              Save draft
            </ButtonV2>
            <ButtonV2 type="button" kind="tertiary" onClick={handleBack}>
              Cancel
            </ButtonV2>
          </div>
        </section>
      </form>

      <DiscardChangesDialog
        open={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          setDirty(false);
          navigate(`/applications/${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
}
