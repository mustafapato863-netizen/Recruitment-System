import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';
import { changeOwnPassword } from './passwordApi';
import { evaluateStrongPassword } from './passwordPolicy';
import { mustChangePassword } from './userProfile';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { BorderGlow } from '../components/ui/BorderGlow';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { PasswordStrengthMeter } from '../components/auth/PasswordStrengthMeter';
import { SghLogo } from '../design-system/brand/sgh-logo';

/**
 * Forced password change (pre-workspace, public surface like /login).
 * Reached when the signed-in account has mustChangePassword: the user picks
 * a new strong password before entering any workspace. On success the flag
 * is refreshed and the user continues to their workspace (the `from`
 * location, else '/').
 */
export function ChangePasswordRequiredPage() {
  const { user, isLoading, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-rf-canvas">
        <p role="status" className="relative z-10 mx-auto flex min-h-screen items-center justify-center text-sm text-rf-ink-muted">
          Checking your account…
        </p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/change-password' }} />;
  }

  // Already satisfied the requirement: do not trap the user here.
  if (!mustChangePassword(user)) {
    return <Navigate to="/" replace />;
  }

  const evaluation = evaluateStrongPassword(newPassword, user.email);
  const redirectTo = (location.state as { from?: string } | null)?.from || '/';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation must match.');
      return;
    }
    if (!evaluation.valid) {
      setError(`Your new password must meet every requirement: ${evaluation.unmetLabels.join('; ')}.`);
      return;
    }
    setSubmitting(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      await refreshUser();
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'WEAK_PASSWORD') {
        setError('Your new password does not meet the strength requirements. Check every item in the list and try again.');
      } else if (err instanceof ApiError && err.statusCode === 401) {
        setError('Your current password is incorrect. Try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not update your password. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-rf-canvas">
      <AtmosphericBackground className="z-0" variant="auth" />
      <ThemeToggle className="fixed right-4 top-4 z-30" showLabel />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-8">
        <BorderGlow animated borderRadius={24} className="w-full shadow-[var(--shadow-float)] backdrop-blur-xl bg-rf-surface/90" backgroundColor="var(--color-surface)">
          <div className="p-8 sm:p-10">
            <div className="mb-8 flex items-center justify-center">
              <SghLogo size="sm" variant="horizontal" showSubtitle={false} />
            </div>

            <header className="mb-8 text-center">
              <h1 className="font-rf-heading text-[28px] font-extrabold tracking-[-0.04em] text-rf-ink">
                Change your password
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-rf-ink-muted">
                Your account needs a new password before you can use RecruitFlow.
                Choose a strong password you have not used before.
              </p>
            </header>

            <form onSubmit={(event) => void handleSubmit(event)} noValidate className="grid gap-5">
              {error ? (
                <Alert tone="danger" title="Could not change your password">
                  {error}
                </Alert>
              ) : null}

              <FormField id="current-password" label="Current password" required>
                <div className="relative">
                  <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="lock" size={17} aria-hidden="true" />
                  <Input
                    id="current-password"
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    placeholder="Your current password"
                    className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-12 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                    className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-rf-ink-muted hover:bg-rf-action-soft hover:text-rf-action focus:outline-none focus-visible:ring-2 focus-visible:ring-rf-action"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} aria-hidden="true" />
                  </button>
                </div>
              </FormField>

              <FormField id="new-password" label="New password" required>
                <div className="relative">
                  <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="lock" size={17} aria-hidden="true" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 10 characters"
                    className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-12 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                    required
                  />
                </div>
                <div className="mt-3">
                  <PasswordStrengthMeter password={newPassword} email={user.email} />
                </div>
              </FormField>

              <FormField id="confirm-password" label="Confirm new password" required>
                <div className="relative">
                  <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="lock" size={17} aria-hidden="true" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-12 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                    required
                  />
                </div>
              </FormField>

              <Button
                className="sgh-btn-gradient mt-2 h-[52px] w-full rounded-[14px] text-[13.5px] font-bold"
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                loadingLabel="Updating password"
                disabled={submitting}
              >
                Change password and continue
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="w-full"
                loading={signingOut}
                loadingLabel="Signing out"
                disabled={signingOut || submitting}
                onClick={() => void handleSignOut()}
              >
                Sign out
              </Button>
            </form>
          </div>
        </BorderGlow>
      </div>
    </main>
  );
}
