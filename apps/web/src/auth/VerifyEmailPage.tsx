import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postApi } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { BorderGlow } from '../components/ui/BorderGlow';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { SghLogo } from '../design-system/brand/sgh-logo';
import { Spinner } from '../components/Spinner';

export function VerifyEmailPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'invalid-token' | 'no-token'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setStatus('no-token');
        setErrorMsg('No verification token provided in the URL.');
        return;
      }

      try {
        await postApi('/auth/email-verification/complete', { token });
        setStatus('success');
      } catch (err: unknown) {
        setStatus('invalid-token');
        const message = err instanceof Error ? err.message : 'Failed to verify email. The link may have expired or is invalid.';
        setErrorMsg(message);
      }
    };

    verifyToken();
  }, []);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-rf-canvas">
      <AtmosphericBackground className="z-0" variant="auth" />
      <ThemeToggle className="fixed right-4 top-4 z-30" showLabel />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-8">
        <BorderGlow animated borderRadius={24} className="w-full shadow-[var(--shadow-float)] backdrop-blur-xl bg-rf-surface/90" backgroundColor="var(--color-surface)">
          <div className="p-8 sm:p-10 text-center">
            <div className="mb-8 flex items-center justify-center">
              <SghLogo size="sm" variant="horizontal" showSubtitle={false} />
            </div>

            <header className="mb-8">
              <h1 className="font-rf-heading text-[28px] font-extrabold tracking-[-0.04em] text-rf-ink">
                Email Verification
              </h1>
            </header>

            {status === 'verifying' && (
              <div className="flex flex-col items-center justify-center py-8">
                <Spinner size={32} className="text-rf-action mb-4" />
                <p className="text-[13px] text-rf-ink-muted">Verifying your email address...</p>
              </div>
            )}

            {status === 'success' && (
              <div>
                <Alert tone="success" title="Verified!" className="mb-6 text-left">
                  Your email has been verified.
                </Alert>
                <Link to="/login">
                  <Button className="w-full sgh-btn-gradient h-[52px] rounded-[14px]">
                    Continue to sign in
                  </Button>
                </Link>
              </div>
            )}

            {(status === 'invalid-token' || status === 'no-token') && (
              <div>
                <Alert tone="danger" title="Verification Failed" className="mb-6 text-left">
                  {errorMsg}
                </Alert>
                <Link to="/login" className="text-[13px] font-semibold text-rf-action hover:underline">
                  Back to sign in
                </Link>
              </div>
            )}
          </div>
        </BorderGlow>
      </div>
    </main>
  );
}
