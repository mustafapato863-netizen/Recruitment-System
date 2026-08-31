import { useState, type FormEvent } from 'react';
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

interface AuthActionResponse {
  accepted: true;
  delivery?: 'development' | 'not_configured';
  expiresAt?: string;
  devToken?: string;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [devToken, setDevToken] = useState<string | undefined>();
  const [fieldError, setFieldError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('Enter a valid email address.');
      return;
    }
    
    setFieldError('');
    setStatus('submitting');
    setErrorMsg('');
    setDevToken(undefined);

    try {
      const data = await postApi<AuthActionResponse>('/auth/password-reset/request', { email });
      setStatus('success');
      if (import.meta.env.DEV && data.devToken) {
        setDevToken(data.devToken);
      }
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
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
                Reset your password
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-rf-ink-muted">
                Enter your work email address and we'll send you a link to reset your password.
              </p>
            </header>

            {status === 'success' ? (
              <div className="text-center">
                <Alert tone="success" className="mb-6 text-left">
                  If an account exists with that email, we've sent instructions to reset your password.
                </Alert>
                
                {import.meta.env.DEV && devToken && (
                  <details className="mb-6 rounded-lg border border-rf-border-subtle bg-rf-canvas/50 text-left text-sm">
                    <summary className="cursor-pointer p-3 font-semibold text-rf-ink">Development Token</summary>
                    <div className="border-t border-rf-border-subtle p-3 break-all font-mono text-xs text-rf-ink-muted">
                      <a href={`/reset-password?token=${devToken}`} className="text-rf-action hover:underline">
                        /reset-password?token={devToken}
                      </a>
                    </div>
                  </details>
                )}

                <Link to="/login" className="text-[13px] font-semibold text-rf-action hover:underline">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="grid gap-5">
                {status === 'error' && (
                  <Alert tone="danger" title="Failed to request reset">
                    {errorMsg}
                  </Alert>
                )}

                <FormField error={fieldError} id="email" label="Email address" required>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted" name="mail" size={17} aria-hidden="true" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError('');
                      }}
                      autoComplete="email"
                      autoFocus
                      placeholder="name@company.com"
                      className="h-[52px] rounded-[14px] bg-rf-canvas/55 pl-11 pr-4 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                      aria-invalid={!!fieldError}
                      aria-describedby={fieldError ? 'email-message' : undefined}
                    />
                  </div>
                </FormField>

                <Button
                  className="sgh-btn-gradient mt-2 h-[52px] w-full rounded-[14px] text-[13.5px] font-bold"
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={status === 'submitting'}
                  loadingLabel="Sending request"
                >
                  Send reset link
                </Button>

                <div className="mt-4 text-center">
                  <Link to="/login" className="text-[13px] font-medium text-rf-ink-muted hover:text-rf-ink transition-colors">
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
            
            <footer className="mt-10 flex items-center justify-center gap-2 text-center text-[10.5px] text-rf-ink-muted border-t border-rf-border-subtle pt-6">
              Protected by Saudi German Health access policy
            </footer>
          </div>
        </BorderGlow>
      </div>
    </main>
  );
}
