import { useEffect, useState } from 'react';
import { AlertTriangle, Briefcase, CheckCircle2, ChevronDown, ChevronUp, FileSearch, Sparkles, XCircle } from 'lucide-react';
import { fetchApplicationAts } from '../api/ats';
import type { AtsEvaluationResult } from '@recruitflow/contracts';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import './ats-card.css';

interface AtsMatchCardProps {
  applicationId: string;
  onSuggestJobs?: () => void;
}

export function AtsMatchCard({ applicationId, onSuggestJobs }: AtsMatchCardProps) {
  const [data, setData] = useState<AtsEvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchApplicationAts(applicationId)
      .then((res) => {
        if (alive) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Unable to evaluate ATS score.');
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [applicationId]);

  if (loading) {
    return (
      <section className="rf2-card rf2-ats-card" aria-label="ATS candidate evaluation">
        <div className="rf2-ats-card__loading">
          <Sparkles className="rf2-ats-card__pulse-icon" aria-hidden="true" />
          <span>Evaluating candidate qualifications against JD criteria…</span>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rf2-card rf2-ats-card" aria-label="ATS candidate evaluation">
        <header className="rf2-ats-card__header">
          <h3 className="rf2-card__title">ATS Evaluation</h3>
        </header>
        <p className="rf2-ats-card__error">{error || 'No ATS criteria configured for this vacancy.'}</p>
      </section>
    );
  }

  const { atsScore, atsKnockoutPass, breakdown } = data;
  const manualReview = breakdown.manualReviewRequired ?? [];
  const scoreTone = !atsKnockoutPass ? 'danger' : atsScore >= 70 ? 'success' : atsScore >= 50 ? 'warning' : 'danger';
  const scoreLabel = !atsKnockoutPass
    ? `${atsScore}% (Knockout Flagged)`
    : atsScore >= 70
      ? `${atsScore}% — Strong Fit`
      : atsScore >= 50
        ? `${atsScore}% — Moderate Fit`
        : `${atsScore}% — Low Fit`;

  const skillsWithEvidence = breakdown.skillBreakdown.filter((s) => s.matched && s.evidenceSnippet);

  return (
    <section className="rf2-card rf2-ats-card" aria-labelledby="ats-fit-heading">
      <header className="rf2-ats-card__header">
        <div className="rf2-ats-card__title-group">
          <Sparkles className="rf2-ats-card__icon" aria-hidden="true" />
          <h3 id="ats-fit-heading" className="rf2-card__title">ATS Fit & Requirement Analysis</h3>
        </div>
        <StatusChip tone={scoreTone} label={scoreLabel} />
      </header>

      {!atsKnockoutPass ? (
        <div className="rf2-ats-card__alert rf2-ats-card__alert--warning" role="alert">
          <AlertTriangle className="rf2-ats-card__alert-icon" aria-hidden="true" />
          <div>
            <strong>Knockout criteria flagged for human review</strong>
            <p className="rf2-ats-card__alert-sub">
              {breakdown.knockoutFailures.length > 0
                ? breakdown.knockoutFailures.join('. ')
                : 'Candidate does not satisfy minimum mandatory criteria.'}
            </p>
            <p className="rf2-ats-card__notice">
              Per October governance, automated knockouts do not auto-reject files. Recruiter confirmation required.
            </p>
          </div>
        </div>
      ) : manualReview.length > 0 ? (
        <div className="rf2-ats-card__alert rf2-ats-card__alert--warning" role="status">
          <AlertTriangle className="rf2-ats-card__alert-icon" aria-hidden="true" />
          <div>
            <strong>Human verification required</strong>
            <p className="rf2-ats-card__alert-sub">{manualReview.join(' ')}</p>
            <p className="rf2-ats-card__notice">No verified knockout failed, but unverified requirements are not marked as passed. This score is advisory only.</p>
          </div>
        </div>
      ) : (
        <div className="rf2-ats-card__alert rf2-ats-card__alert--success" role="status">
          <CheckCircle2 className="rf2-ats-card__alert-icon" aria-hidden="true" />
          <div>
            <strong>No evaluated knockout failures</strong>
            <p className="rf2-ats-card__alert-sub">This does not replace a recruiter's hiring review.</p>
          </div>
        </div>
      )}
      <p className="rf2-ats-card__notice">Evidence-based indicator: scores use evaluated skills and experience only. Unverified education and languages do not earn points.</p>

      <div className="rf2-ats-card__stats-grid">
        <div className="rf2-ats-card__stat-box">
          <span className="rf2-ats-card__stat-label">Must-Have Skills</span>
          <span className="rf2-ats-card__stat-val">
            {breakdown.mustHaveMatchedCount} / {breakdown.mustHaveTotalCount}
          </span>
          <span className="rf2-ats-card__stat-hint">
            {breakdown.mustHaveSkillsPassed ? '100% matched' : `${breakdown.mustHaveTotalCount - breakdown.mustHaveMatchedCount} missing`}
          </span>
        </div>

        <div className="rf2-ats-card__stat-box">
          <span className="rf2-ats-card__stat-label">Nice-To-Have Skills</span>
          <span className="rf2-ats-card__stat-val">
            {breakdown.niceToHaveMatchedCount} / {breakdown.niceToHaveTotalCount}
          </span>
          <span className="rf2-ats-card__stat-hint">Preferred additions</span>
        </div>

        <div className="rf2-ats-card__stat-box">
          <span className="rf2-ats-card__stat-label">Experience Weight</span>
          <span className="rf2-ats-card__stat-val">
            {breakdown.experienceMatch?.actualYears != null && breakdown.experienceMatch.requiredYears > 0
              ? `${Math.min(100, Math.round((breakdown.experienceMatch.actualYears / breakdown.experienceMatch.requiredYears) * 100))}%`
              : 'Not evaluated'}
          </span>
          <span className="rf2-ats-card__stat-hint">Evidence-based tenure</span>
        </div>
      </div>

      {breakdown.missingKeywords.length > 0 ? (
        <div className="rf2-ats-card__keywords-section">
          <span className="rf2-ats-card__subheading">Missing Keywords & Skills:</span>
          <div className="rf2-ats-card__chips">
            {breakdown.missingKeywords.map((kw) => (
              <span key={kw} className="rf2-ats-card__missing-chip">
                <XCircle aria-hidden="true" size={13} /> {kw}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {skillsWithEvidence.length > 0 ? (
        <div className="rf2-ats-card__evidence-section">
          <button
            type="button"
            className="rf2-ats-card__evidence-toggle"
            aria-expanded={showEvidence}
            onClick={() => setShowEvidence((prev) => !prev)}
          >
            <FileSearch aria-hidden="true" size={15} />
            <span>Verbatim CV Evidence ({skillsWithEvidence.length} matches)</span>
            {showEvidence ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showEvidence ? (
            <ul className="rf2-ats-card__evidence-list">
              {skillsWithEvidence.map((s) => (
                <li key={s.skillName} className="rf2-ats-card__evidence-item">
                  <div className="rf2-ats-card__evidence-title">
                    <CheckCircle2 size={13} className="rf2-ats-card__check" aria-hidden="true" />
                    <strong>{s.skillName}</strong>
                    {s.isMustHave ? <span className="rf2-ats-card__tag-req">Must-have</span> : null}
                  </div>
                  {s.evidenceSnippet ? (
                    <blockquote className="rf2-ats-card__snippet">
                      "{s.evidenceSnippet}"
                    </blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {onSuggestJobs ? (
        <div className="rf2-ats-card__footer">
          <ButtonV2
            kind="secondary"
            size="md"
            icon={<Briefcase />}
            onClick={onSuggestJobs}
          >
            Suggest Other Open Roles
          </ButtonV2>
        </div>
      ) : null}
    </section>
  );
}
