import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, MessageSquare, RotateCw, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2 } from '../../components/v2/Button';
import { DiscardChangesDialog } from '../../components/v2/DiscardChangesDialog';
import { InputV2, SelectV2, TextareaV2 } from '../../components/v2/Field';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { StatusChip } from '../../components/v2/StatusChip';
import { StageFormSection } from '../drawers/StageFormSection';
import { errorText } from '../drawers/FileDrawers';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import {
  loadInterviewDetail,
  loadInterviewScorecards,
  RECOMMENDATIONS,
  reviseScorecard,
  submitScorecard,
  type InterviewItem,
  type Recommendation,
  type ScorecardCriterionRating,
  type ScorecardItem,
} from '../api/applicationFile';
import '../../components/v2/v2-primitives.css';
import './application-file.css';

interface SghCriterionDef {
  key: string;
  name: string;
  section: 'HR' | 'TECHNICAL';
  category: 'COMPETENCY' | 'SKILL';
}

export const SGH_EVALUATION_CRITERIA: readonly SghCriterionDef[] = [
  { key: 'sgh_communication', name: 'Communication & clarity', section: 'HR', category: 'COMPETENCY' },
  { key: 'sgh_values_fit', name: 'SGH values & cultural fit', section: 'HR', category: 'COMPETENCY' },
  { key: 'sgh_teamwork', name: 'Accountability & teamwork', section: 'HR', category: 'COMPETENCY' },
  { key: 'sgh_patient_focus', name: 'Patient & service orientation', section: 'HR', category: 'COMPETENCY' },
  { key: 'sgh_technical_core', name: 'Core technical / clinical competence', section: 'TECHNICAL', category: 'SKILL' },
  { key: 'sgh_problem_solving', name: 'Problem solving & judgment', section: 'TECHNICAL', category: 'SKILL' },
  { key: 'sgh_role_readiness', name: 'Role readiness & experience depth', section: 'TECHNICAL', category: 'SKILL' },
];

type CriterionState = { rating: number | null; notObserved: boolean; comment: string };

function buildInitialCriteria(existing?: ScorecardItem): Record<string, CriterionState> {
  const byKey = new Map((existing?.ratings ?? []).map((r) => [r.criterionKey, r]));
  const map: Record<string, CriterionState> = {};
  for (const def of SGH_EVALUATION_CRITERIA) {
    const saved = byKey.get(def.key);
    map[def.key] = {
      rating: saved && !saved.notObserved && typeof saved.rating === 'number' ? saved.rating : null,
      notObserved: Boolean(saved?.notObserved),
      comment: saved?.comment ?? '',
    };
  }
  return map;
}

export function averageObservedRating(criteria: Record<string, CriterionState>): { avg: number | null; observedCount: number; notObservedCount: number } {
  const values = Object.values(criteria);
  const rated = values.filter((c) => !c.notObserved && typeof c.rating === 'number' && c.rating >= 1 && c.rating <= 5);
  const notObservedCount = values.filter((c) => c.notObserved).length;
  if (rated.length === 0) return { avg: null, observedCount: 0, notObservedCount };
  const total = rated.reduce((sum, item) => sum + (item.rating ?? 0), 0);
  return { avg: Math.round((total / rated.length) * 10) / 10, observedCount: rated.length, notObservedCount };
}

export function ScorecardPageV2() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [interview, setInterview] = useState<(InterviewItem & { candidateName?: string; positionTitle?: string; applicationCode?: string }) | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardItem[]>([]);

  const [criteria, setCriteria] = useState<Record<string, CriterionState>>(() => buildInitialCriteria());
  const [overallRating, setOverallRating] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<Recommendation>('Hire');
  const [decisionSummary, setDecisionSummary] = useState('');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [revising, setRevising] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([loadInterviewDetail(id), loadInterviewScorecards(id)])
      .then(([iv, cards]) => {
        if (!alive) return;
        setInterview(iv);
        setScorecards(cards);
        const mine = cards
          .filter((c) => c.interviewerId === user?.id)
          .sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))[0];
        setCriteria(buildInitialCriteria(mine));
        setOverallRating(mine?.overallRating ?? 0);
        setRecommendation((mine?.recommendation ?? 'Hire') as Recommendation);
        setDecisionSummary(mine?.decisionSummary ?? '');
        setStrengths(mine?.strengths ?? '');
        setConcerns(mine?.concerns ?? '');
        setNotes(mine?.notes ?? '');
        setNextStep(mine?.nextStep ?? '');
        setFollowUpAt(mine?.followUpAt ? mine.followUpAt.slice(0, 10) : '');
        setDirty(false);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const status = e instanceof ApiError ? e.statusCode : undefined;
        setLoadError({ status, message: e instanceof Error ? e.message : 'Could not load interview scorecard.' });
        setLoading(false);
      });
    return () => { alive = false; };
  }, [id, attempt, user?.id]);

  const mine = useMemo(
    () => scorecards.filter((c) => c.interviewerId === user?.id).sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))[0],
    [scorecards, user?.id],
  );
  const mySubmitted = isScorecardSubmitted(mine);
  const attendees = interview?.attendees ?? [];
  const submittedByUser = useMemo(() => new Set(scorecards.filter(isScorecardSubmitted).map((c) => c.interviewerId)), [scorecards]);
  const draftByUser = useMemo(() => new Set(scorecards.filter((c) => !isScorecardSubmitted(c)).map((c) => c.interviewerId)), [scorecards]);
  const isPanelMember = Boolean(mine) || attendees.some((a) => a.userId && a.userId === user?.id);
  const started = interview ? interview.status === 'Completed' || new Date(interview.scheduledStart).getTime() <= Date.now() : false;
  const editable = isPanelMember && (!mySubmitted || revising);

  const summary = useMemo(() => averageObservedRating(criteria), [criteria]);

  const backHref = interview?.applicationId
    ? `/applications/${encodeURIComponent(interview.applicationId)}`
    : '/my-interviews';

  const handleBack = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    navigate(backHref);
  };

  const updateCriterion = (key: string, patch: Partial<CriterionState>) => {
    setCriteria((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
  };

  const buildPayload = (status: 'Draft' | 'Submitted') => {
    const criteriaRatings: ScorecardCriterionRating[] = SGH_EVALUATION_CRITERIA.flatMap((def) => {
      const state = criteria[def.key];
      if (!state) return [];
      if (!state.notObserved && state.rating === null && !state.comment.trim()) return [];
      return [{
        criterionKey: def.key,
        criterionName: def.name,
        category: def.category,
        rating: state.notObserved ? null : state.rating,
        notObserved: state.notObserved,
        comment: state.comment.trim() || null,
      }];
    });
    return {
      overallRating: overallRating || (summary.avg ? Math.round(summary.avg) : 1),
      recommendation,
      notes: notes.trim(),
      evaluationTemplate: 'SGH_V1',
      ...(decisionSummary.trim() ? { decisionSummary: decisionSummary.trim() } : {}),
      ...(strengths.trim() ? { strengths: strengths.trim() } : {}),
      ...(concerns.trim() ? { concerns: concerns.trim() } : {}),
      ...(nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
      ...(followUpAt ? { followUpAt: `${followUpAt}T00:00:00.000Z` } : {}),
      ...(criteriaRatings.length > 0 ? { criteriaRatings } : {}),
      status,
    };
  };

  const handleSave = async (status: 'Draft' | 'Submitted', e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !isPanelMember) return;
    const next: Record<string, string> = {};
    if (status === 'Submitted' && (overallRating < 1 || overallRating > 5)) {
      next.overallRating = 'Choose an overall rating from 1 to 5.';
    }
    if (!notes.trim()) {
      next.notes = 'Write interview evidence notes before saving.';
    }
    if (revising && revisionReason.trim().length < 3) {
      next.revisionReason = 'Explain why you are revising this scorecard (at least 3 characters).';
    }
    setErrs(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setFormError(null);
    setStatusNotice(null);
    try {
      const body = buildPayload(status);
      if (revising) {
        const { status: _s, ...revBody } = body;
        await reviseScorecard(id, { ...revBody, reason: revisionReason.trim() });
        setRevising(false);
        setRevisionReason('');
        setStatusNotice('Scorecard revision submitted.');
      } else {
        await submitScorecard(id, body);
        setStatusNotice(status === 'Submitted' ? 'Scorecard submitted.' : 'Draft saved.');
      }
      setDirty(false);
      setAttempt((n) => n + 1);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rf2-file">
        <SkeletonV2 lines={8} label="Loading SGH interview evaluation…" />
      </div>
    );
  }
  if (loadError?.status === 403) {
    return (
      <div className="rf2-file">
        <ForbiddenStateV2
          title="Scorecard is not available"
          body={loadError.message}
          action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/my-interviews">Back to My interviews</Link>}
        />
      </div>
    );
  }
  if (loadError || !interview) {
    return (
      <div className="rf2-file" role="alert">
        <EmptyStateV2
          title="Could not load interview scorecard"
          body={loadError?.message ?? 'Interview details could not be loaded.'}
          action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>}
        />
      </div>
    );
  }

  const isPreHireAssessment = interview.stageContext === 'Pre-Hire' || interview.interviewType === 'Assessment';
  const renderCriterionRow = (def: SghCriterionDef) => {
    const row = criteria[def.key] ?? { rating: null, notObserved: false, comment: '' };
    return (
      <div key={def.key} className="rf2-card" style={{ padding: '0.85rem', marginBottom: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <strong>{def.name}</strong>
          <label className="rf2-checklist__item" style={{ margin: 0 }}>
            <span>
              <input
                type="checkbox"
                checked={row.notObserved}
                disabled={!editable}
                onChange={(e) => updateCriterion(def.key, { notObserved: e.target.checked, rating: e.target.checked ? null : row.rating })}
              />
              Not observed
            </span>
          </label>
        </div>
        <div className="rf2-rating__options" role="radiogroup" aria-label={def.name} style={{ marginTop: '0.5rem' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="rf2-rating__option">
              <input
                type="radio"
                name={`crit-${def.key}`}
                value={n}
                disabled={!editable || row.notObserved}
                checked={!row.notObserved && row.rating === n}
                onChange={() => updateCriterion(def.key, { rating: n, notObserved: false })}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <InputV2
          label={`Notes for ${def.name} (optional)`}
          value={row.comment}
          disabled={!editable}
          onChange={(e) => updateCriterion(def.key, { comment: e.target.value })}
        />
      </div>
    );
  };

  return (
    <div className="rf2-file">
      <section className="rf2-file__head rf2-file__header" aria-labelledby="scorecard-page-title">
        <div className="rf2-file__navline">
          <button type="button" className="rf2-file__back rf2-link-btn" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" /> Back
          </button>
        </div>
        <div className="rf2-file__identity-row">
          <div className="rf2-file__intro">
            <h1 id="scorecard-page-title" className="rf2-file__name">
              SGH Evaluation — {interview.title}
            </h1>
            <p className="rf2-file__meta rf2-file__sub">
              {[interview.interviewType, interview.status, interview.locationUrl ? 'Online room link' : 'In-person / no link'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="rf2-file__identity-meta">
            <StatusChip
              tone={isPreHireAssessment ? 'info' : 'neutral'}
              label={isPreHireAssessment ? 'Pre-hire assessment' : 'Interview evaluation'}
            />
          </div>
        </div>
      </section>

      <div className="rf2-file__stack">
        <section className="rf2-card" aria-labelledby="panel-progress-h">
          <h2 id="panel-progress-h" className="rf2-card__title">Assigned panel progress</h2>
          <p className="rf2-file__muted">
            Every assigned interviewer must submit a scorecard before the application can advance.
          </p>
          <ul className="rf2-approvals" aria-label="Panel scorecards">
            {attendees.length === 0 ? (
              <li>No assigned interviewers recorded on this interview.</li>
            ) : (
              attendees.map((att, idx) => {
                const name = att.displayName ?? att.name ?? 'Interviewer';
                const uid = att.userId ?? '';
                const statusLabel = uid && submittedByUser.has(uid)
                  ? 'Submitted'
                  : uid && draftByUser.has(uid)
                    ? 'Draft saved'
                    : 'Pending';
                const tone = statusLabel === 'Submitted' ? 'success' : statusLabel === 'Draft saved' ? 'info' : 'warning';
                return (
                  <li key={uid || idx}>
                    <strong>{name}</strong> <StatusChip tone={tone} label={statusLabel} />
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {!isPanelMember ? (
          <section className="rf2-card" role="status">
            <p className="rf2-file__muted">
              Only assigned interviewers on this panel can submit or revise a scorecard. Submitted evaluations appear below for review.
            </p>
          </section>
        ) : (
          <form className="rf2-file__stack" onSubmit={(e) => void handleSave('Submitted', e)} noValidate>
            <section className="rf2-card" aria-labelledby="hr-eval-h">
              <h2 id="hr-eval-h" className="rf2-card__title">1. HR & Behavioral Evaluation (SGH)</h2>
              <StageFormSection title="Core competencies" icon={Users}>
                {SGH_EVALUATION_CRITERIA.filter((c) => c.section === 'HR').map(renderCriterionRow)}
              </StageFormSection>
            </section>

            <section className="rf2-card" aria-labelledby="tech-eval-h">
              <h2 id="tech-eval-h" className="rf2-card__title">2. Technical & Role Competency Evaluation</h2>
              <StageFormSection title="Role competencies" icon={ClipboardCheck} tone="success">
                {SGH_EVALUATION_CRITERIA.filter((c) => c.section === 'TECHNICAL').map(renderCriterionRow)}
                <p className="rf2-file__muted" data-testid="observed-average">
                  Observed ratings: {summary.observedCount} of {SGH_EVALUATION_CRITERIA.length}
                  {summary.notObservedCount > 0 ? ` (${summary.notObservedCount} marked Not observed, excluded from average)` : ''}
                  {summary.avg !== null ? ` · Average ${summary.avg} / 5` : ''}
                </p>
              </StageFormSection>
            </section>

            <section className="rf2-card" aria-labelledby="final-decision-h">
              <h2 id="final-decision-h" className="rf2-card__title">3. Final Decision & Next Steps</h2>
              <StageFormSection title="Overall recommendation" icon={MessageSquare} tone="warning">
                <fieldset className="rf2-rating" aria-describedby={errs.overallRating ? 'sgh-rating-err' : undefined}>
                  <legend className="rf2-field__label">Overall rating<span className="rf2-field__req" aria-hidden="true">*</span></legend>
                  <div className="rf2-rating__options">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="rf2-rating__option">
                        <input
                          type="radio"
                          name="overall-rating"
                          value={n}
                          disabled={!editable}
                          checked={overallRating === n}
                          onChange={() => { setOverallRating(n); setDirty(true); }}
                        />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                  {errs.overallRating ? <p id="sgh-rating-err" className="rf2-field__msg rf2-field__msg--error" role="alert">{errs.overallRating}</p> : null}
                </fieldset>

                <div className="rf2-drawer-form__row">
                  <SelectV2
                    label="Recommendation"
                    value={recommendation}
                    disabled={!editable}
                    onChange={(e) => { setRecommendation(e.target.value as Recommendation); setDirty(true); }}
                  >
                    {RECOMMENDATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </SelectV2>
                  <InputV2
                    label="Next step (optional)"
                    placeholder="e.g. Proceed to offer or second assessment"
                    value={nextStep}
                    disabled={!editable}
                    onChange={(e) => { setNextStep(e.target.value); setDirty(true); }}
                  />
                  <InputV2
                    label="Follow-up date (optional)"
                    type="date"
                    value={followUpAt}
                    disabled={!editable}
                    onChange={(e) => { setFollowUpAt(e.target.value); setDirty(true); }}
                  />
                </div>

                <TextareaV2
                  label="Decision summary"
                  rows={2}
                  value={decisionSummary}
                  disabled={!editable}
                  onChange={(e) => { setDecisionSummary(e.target.value); setDirty(true); }}
                />
                <div className="rf2-drawer-form__row">
                  <TextareaV2
                    label="Strengths"
                    rows={2}
                    value={strengths}
                    disabled={!editable}
                    onChange={(e) => { setStrengths(e.target.value); setDirty(true); }}
                  />
                  <TextareaV2
                    label="Concerns"
                    rows={2}
                    value={concerns}
                    disabled={!editable}
                    onChange={(e) => { setConcerns(e.target.value); setDirty(true); }}
                  />
                </div>
                <TextareaV2
                  label="Evidence notes"
                  required
                  rows={4}
                  value={notes}
                  disabled={!editable}
                  onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                  error={errs.notes}
                />
                {revising ? (
                  <TextareaV2
                    label="Reason for revising"
                    required
                    rows={2}
                    value={revisionReason}
                    onChange={(e) => { setRevisionReason(e.target.value); setDirty(true); }}
                    error={errs.revisionReason}
                  />
                ) : null}
              </StageFormSection>

              {!started && !mySubmitted ? (
                <p className="rf2-file__muted">The interview has not started yet. You can save a draft now and submit once it starts.</p>
              ) : null}
              {statusNotice ? <p className="rf2-inline-note" role="status">{statusNotice}</p> : null}
              {formError ? <p className="rf2-drawer-form__error" role="alert">{formError}</p> : null}

              <div className="rf2-drawer-form__actions">
                {editable ? (
                  <>
                    <ButtonV2 type="submit" loading={busy} disabled={!started && !revising}>
                      {revising ? 'Submit revision' : 'Submit scorecard'}
                    </ButtonV2>
                    {!revising ? (
                      <ButtonV2 type="button" kind="secondary" disabled={busy} onClick={() => void handleSave('Draft')}>
                        Save draft
                      </ButtonV2>
                    ) : null}
                  </>
                ) : mySubmitted ? (
                  <ButtonV2 type="button" kind="secondary" onClick={() => setRevising(true)}>
                    Revise with a reason
                  </ButtonV2>
                ) : null}
                <ButtonV2 type="button" kind="tertiary" onClick={handleBack}>
                  Back
                </ButtonV2>
              </div>
            </section>
          </form>
        )}

        {scorecards.filter((c) => c.id !== mine?.id).length > 0 ? (
          <section className="rf2-card" aria-labelledby="other-cards-h">
            <h2 id="other-cards-h" className="rf2-card__title">Panel evaluations</h2>
            {scorecards.filter((c) => c.id !== mine?.id).map((card) => (
              <div key={card.id} className="rf2-scard">
                <header>
                  <strong>{card.interviewerName ?? 'Interviewer'}</strong>{' '}
                  <StatusChip
                    tone={isScorecardSubmitted(card) ? 'success' : 'neutral'}
                    label={isScorecardSubmitted(card) ? 'Submitted' : 'Draft'}
                  />
                </header>
                <p>{card.overallRating} of 5 · {card.recommendation}</p>
                {card.decisionSummary ? <p>{card.decisionSummary}</p> : null}
                {card.notes ? <p className="rf2-scard__notes">{card.notes}</p> : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>

      <DiscardChangesDialog
        open={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          setDirty(false);
          navigate(backHref);
        }}
      />
    </div>
  );
}
