import { useId } from 'react';
import { Check, X } from 'lucide-react';
import { evaluateStrongPassword, type PasswordStrength } from '../../auth/passwordPolicy';

/** Filled segments of the 4-segment bar for each strength (empty password: 0). */
const FILLED_SEGMENTS: Record<PasswordStrength, number> = { weak: 1, fair: 2, good: 3, strong: 4 };

/** Bar colour comes from the semantic token for the strength — never colour alone: the label text always names it. */
const STRENGTH_TOKEN: Record<PasswordStrength, string> = {
  weak: 'var(--color-danger)',
  fair: 'var(--color-warning)',
  good: 'var(--color-warning)',
  strong: 'var(--color-success)',
};

export interface PasswordStrengthMeterProps {
  password: string;
  /** Sign-in email: enables the "does not contain your email name" rule. */
  email?: string | null;
  /** Show the live per-rule checklist under the bar (default true). */
  showChecklist?: boolean;
}

/**
 * Live password-strength meter: 4-segment bar + rule checklist.
 * Strength is text + icon, never colour alone; the summary is announced
 * via role="status" (aria-live polite).
 */
export function PasswordStrengthMeter({ password, email, showChecklist = true }: PasswordStrengthMeterProps) {
  const summaryId = useId();
  const evaluation = evaluateStrongPassword(password, email);
  const hasInput = password.length > 0;
  const filled = hasInput ? FILLED_SEGMENTS[evaluation.strength] : 0;
  const barColor = hasInput ? STRENGTH_TOKEN[evaluation.strength] : 'var(--color-border)';

  return (
    <div className="grid gap-2">
      <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-rf-ink">
          Password strength:{' '}
          <span id={summaryId}>{hasInput ? evaluation.strengthLabel : 'Enter a password'}</span>
        </span>
        <span className="text-rf-ink-muted">
          {hasInput ? `${evaluation.passedCount} of ${evaluation.totalCount} requirements met` : `${evaluation.totalCount} requirements`}
        </span>
      </div>
      <div
        className="flex gap-1"
        role="meter"
        aria-labelledby={summaryId}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={filled}
        aria-valuetext={hasInput ? evaluation.strengthLabel : 'No password entered'}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: index < filled ? barColor : 'var(--color-border)' }}
          />
        ))}
      </div>
      {showChecklist ? (
        <ul className="m-0 grid gap-1 p-0 text-xs" aria-label="Password requirements">
          {evaluation.rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-1.5 text-rf-ink-muted"
              aria-label={`${rule.label}: ${rule.passed ? 'met' : 'not met'}`}
            >
              {rule.passed ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-rf-success" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-rf-danger" aria-hidden="true" />
              )}
              <span className={rule.passed ? 'text-rf-ink' : undefined}>{rule.label}</span>
              <span className="sr-only">{rule.passed ? 'Met' : 'Not met'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
