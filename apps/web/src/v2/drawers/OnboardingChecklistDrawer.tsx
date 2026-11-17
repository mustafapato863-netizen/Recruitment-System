import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ButtonV2, DrawerV2, StatusChip } from '../../components/v2';
import { InputV2, SelectV2 } from '../../components/v2/Field';
import { patchApi, postApi, ApiError } from '../../api/client';
import {
  joiningBlockerSentences,
  requirementCleared,
  isExpiredRequiredLicence,
  type LicenceFact,
} from '../../components/candidate/JoiningChecklist';
import './stage-form.css';

export interface OnboardingCase {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  plannedJoiningDate: string | null;
  status: string;
  complianceRequirements?: LicenceFact[];
  approvedHeadcount?: number | null;
  joinedHeadcount?: number | null;
}

interface Props {
  hiringCase: OnboardingCase;
  onClose: () => void;
  onUpdated: () => void;
}

export function OnboardingChecklistDrawer({ hiringCase, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState<'Joined' | 'Postponed' | 'No-show'>('Joined');
  const [actualJoiningDate, setActualJoiningDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<LicenceFact[]>(hiringCase.complianceRequirements ?? []);
  const [toggling, setToggling] = useState<string | null>(null);

  const blockers = joiningBlockerSentences({
    approvedHeadcount: hiringCase.approvedHeadcount,
    joinedHeadcount: hiringCase.joinedHeadcount,
    requirements,
  });

  const handleToggleRequirement = async (req: LicenceFact, index: number) => {
    const reqId = (req as { id?: string }).id ?? String(index);
    const nextStatus = req.status === 'Verified' ? 'Pending' : 'Verified';
    setToggling(reqId);
    setError(null);
    try {
      await patchApi(`/hiring/${encodeURIComponent(hiringCase.id)}/compliance/${encodeURIComponent(reqId)}`, {
        status: nextStatus,
      });
      setRequirements((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, status: nextStatus } : item)),
      );
      onUpdated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update checklist requirement.');
    } finally {
      setToggling(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'Joined' && blockers.length > 0) {
      setError('Cannot confirm joining while requirements are blocked.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postApi(`/hiring/${encodeURIComponent(hiringCase.id)}/joining`, {
        status,
        ...(status === 'Joined' && actualJoiningDate ? { actualJoiningDate } : {}),
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record joining status.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearedCount = requirements.filter((r) => requirementCleared(r)).length;
  const totalCount = requirements.length;

  return (
    <DrawerV2
      open
      title={`Onboarding & Joining: ${hiringCase.candidateName}`}
      subtitle={`${hiringCase.positionTitle} · ${hiringCase.branchName}`}
      onClose={onClose}
      >
      <form onSubmit={handleSubmit} className="rf2-stage-form">
        {error ? (
          <div className="rf2-stage-form__error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {blockers.length > 0 ? (
          <div className="rf2-stage-form__blockers" role="alert">
            <h4 className="rf2-stage-form__blocker-title">
              <AlertTriangle aria-hidden="true" /> Joining Blockers
            </h4>
            <ul>
              {blockers.map((b, idx) => (
                <li key={idx}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="rf2-stage-form__section">
          <h3 className="rf2-stage-form__section-title">
            Pre-boarding & Licensure Checklist ({clearedCount}/{totalCount})
          </h3>
          <p className="rf2-stage-form__hint">
            Review compliance and professional practice credentials before confirming day-one show.
          </p>
          {requirements.length === 0 ? (
            <p className="rf2-stage-form__empty">No compliance requirements recorded for this position.</p>
          ) : (
            <ul className="rf2-stage-form__checklist">
              {requirements.map((req, idx) => {
                const cleared = requirementCleared(req);
                const expired = isExpiredRequiredLicence(req);
                return (
                  <li key={idx} className="rf2-stage-form__check-row">
                    <div className="rf2-stage-form__check-label">
                      <span className="rf2-stage-form__check-name">{req.name || req.label || req.type || 'Requirement'}</span>
                      {req.expiryDate ? (
                        <span className="rf2-stage-form__check-expiry">
                          Expires: {new Date(req.expiryDate).toLocaleDateString('en-GB')}
                        </span>
                      ) : null}
                    </div>
                    <div className="rf2-stage-form__check-actions">
                      <StatusChip
                        tone={cleared ? 'success' : expired ? 'danger' : 'warning'}
                        label={expired ? 'Expired' : req.status ?? 'Pending'}
                      />
                      <ButtonV2
                        kind="tertiary"
                        size="sm"
                        disabled={toggling !== null}
                        onClick={() => handleToggleRequirement(req, idx)}
                      >
                        {cleared ? 'Mark Pending' : 'Verify'}
                      </ButtonV2>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rf2-stage-form__section">
          <h3 className="rf2-stage-form__section-title">Record Day-One Show Status</h3>
          <div className="rf2-stage-form__row">
            <SelectV2
              label="Joining Outcome"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Joined' | 'Postponed' | 'No-show')}
            >
              <option value="Joined">Joined (Showed on Day One)</option>
              <option value="Postponed">Postponed (Start date delayed)</option>
              <option value="No-show">No-show (Failed to report)</option>
            </SelectV2>

            {status === 'Joined' ? (
              <InputV2
                label="Actual Joining Date (Africa/Cairo)"
                type="date"
                value={actualJoiningDate}
                onChange={(e) => setActualJoiningDate(e.target.value)}
                required
              />
            ) : null}
          </div>
        </section>

        <div className="rf2-stage-form__footer">
          <ButtonV2 kind="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </ButtonV2>
          <ButtonV2
            type="submit"
            kind="primary"
            disabled={submitting || (status === 'Joined' && blockers.length > 0)}
          >
            {submitting ? 'Recording…' : 'Record Joining Status'}
          </ButtonV2>
        </div>
      </form>
    </DrawerV2>
  );
}
