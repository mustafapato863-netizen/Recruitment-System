import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { BorderGlow } from '../components/ui/BorderGlow';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { SghLogo } from '../design-system/brand/sgh-logo';

export function AcceptInvitationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'invalid-token' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (!tokenParam) {
      setStatus('invalid-token');
      setErrorMsg('No invitation token provided. Please check your invitation email.');
    } else {
      setToken(tokenParam);
    }
  }, []);

  const validate = () => {
    const errors: { password?: string; confirm?: string } = {};
    if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !token) return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      await postApi('/auth/invitations/accept', { token, password, displayName: displayName || undefined });
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to accept invitation. The link may have expired.';
      setErrorMsg(message);
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
                Welcome to RecruitFlow
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-rf-ink-muted">
                Complete your account setup to join your team's workspace.
              </p>
            </header>

            {status === 'invalid-token' ? (
              <div className="text-center">
                <Alert tone="danger" title="Invalid Link" className="mb-6 text-left">
                  {errorMsg}
                </Alert>
                <Link to="/login" className="text-[13px] font-semibold text-rf-action hover:underline">
                  Go to sign in
                </Link>
              </div>
            ) : status === 'success' ? (
              <div className="text-center">
                <Alert tone="success" title="Account Active" className="mb-6 text-left">
                  Your account is now active.
                </Alert>
                <Link to="/login">
                  <Button className="w-full sgh-btn-gradient h-[52px] rounded-[14px]">
                    Sign in to your workspace
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="grid gap-5">
                {status === 'error' && (
                  <Alert tone="danger" title="Setup Failed">
                    {errorMsg}
                  </Alert>
                )}

                <FormField id="display-name" label="Full Name (Optional)">
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="user" size={17} />
                    <Input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-4 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                    />
                  </div>
                </FormField>

                <FormField error={fieldErrors.password} id="password" label="Password" required>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="lock" size={17} aria-hidden="true" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      placeholder="At least 8 characters"
                      className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-12 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'password-message' : undefined}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-rf-ink-muted hover:bg-rf-action-soft hover:text-rf-action focus:outline-none focus-visible:ring-2 focus-visible:ring-rf-action"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} aria-hidden="true" />
                    </button>
                  </div>
                </FormField>

                <FormField error={fieldErrors.confirm} id="confirm-password" label="Confirm Password" required>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="lock" size={17} aria-hidden="true" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                      }}
                      placeholder="Confirm your password"
                      className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-4 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                      aria-invalid={!!fieldErrors.confirm}
                      aria-describedby={fieldErrors.confirm ? 'confirm-password-message' : undefined}
                    />
                  </div>
                </FormField>

                <Button
                  className="sgh-btn-gradient mt-2 h-[52px] w-full rounded-[14px] text-[13.5px] font-bold"
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={status === 'submitting'}
                  loadingLabel="Setting up account"
                >
                  Complete Setup
                </Button>
              </form>
            )}
          </div>
        </BorderGlow>
      </div>
    </main>
  );
}
