import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getFieldError, getErrorFields } from '../api/errors';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { AtmosphericBackground } from '../components/ui/AtmosphericBackground';
import { BorderGlow } from '../components/ui/BorderGlow';
import { ClickSpark } from '../components/ui/ClickSpark';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { SghAnimatedLogo } from '../design-system/brand/sgh-animated-logo';
import { SghLogo } from '../design-system/brand/sgh-logo';
import { SghAnimatedLoader } from '../design-system/brand/sgh-animated-loader';
import { ThinkingDots } from '../design-system/backgrounds/thinking-dots';

type LoginField = 'email' | 'password';
type LoginFieldErrors = Partial<Record<LoginField, string>>;

// Local QA helpers exist only in development builds; production bundles carry no seeded credentials.
const TEST_PASSWORD: string | null = import.meta.env.DEV ? 'Password123!' : null;

const TEST_PERSONAS: Array<{
  name: string;
  initials: string;
  role: string;
  email: string;
}> = import.meta.env.DEV
  ? [
      {
        name: 'Ahmed Mahmoud',
        initials: 'AM',
        role: 'Administrator (Full Governance)',
        email: 'ahmed.mahmoud@recruitflow.local',
      },
      {
        name: 'Tarek Nabil',
        initials: 'TN',
        role: 'Performance Admin (Auditor & Reports)',
        email: 'tarek.audit@recruitflow.local',
      },
      {
        name: 'Mona El-Sayed',
        initials: 'ME',
        role: 'Talent Manager (Hiring Lead & Targets)',
        email: 'mona.manager@recruitflow.local',
      },
      {
        name: 'Sarah Ahmed',
        initials: 'SA',
        role: 'Recruiter (Jobs & Fast Review)',
        email: 'sarah.ahmed@recruitflow.local',
      },
    ]
  : [];

const PRODUCT_POINTS = [
  'Manage candidates and hiring activity in one workspace',
  'Keep interviews, decisions, and ownership clearly aligned',
  'Give every hiring role the right level of visibility',
];

function getLoginErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Login failed';

  if (/Cannot POST|Failed to fetch|NetworkError|Network request failed/i.test(message)) {
    return 'The sign-in service is unavailable. Check that the API is running, then try again.';
  }

  if (/Invalid credentials/i.test(message)) {
    return 'The email or password is incorrect.';
  }

  if (/inactive/i.test(message)) {
    return 'This account is inactive. Contact your administrator for access.';
  }

  return message;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedPersonaEmail, setSelectedPersonaEmail] = useState('');

  const { login } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = (location.state as { from?: string } | null)?.from;

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const focusFirstInvalidField = (errors: LoginFieldErrors) => {
    if (errors.email) {
      emailInputRef.current?.focus();
    } else if (errors.password) {
      passwordInputRef.current?.focus();
    }
  };

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  };

  const selectTestPersona = (personaEmail: string) => {
    if (!TEST_PASSWORD) return;
    setEmail(personaEmail);
    setPassword(TEST_PASSWORD);
    setSelectedPersonaEmail(personaEmail);
    setFieldErrors({});
    setError('');
  };

  const validateForm = (): boolean => {
    const nextErrors: LoginFieldErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setFieldErrors(nextErrors);

    focusFirstInvalidField(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsSubmitting(true);
    setIsAuthenticating(true);

    try {
      // Parallelize login with minimum 2-second SGH brand animation
      await Promise.all([
        login({
          email: email.trim(),
          password,
        }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      navigate(redirectPath || '/', { replace: true });
    } catch (err) {
      setIsAuthenticating(false);

      const serverFields = getErrorFields(err);
      if (serverFields && Object.keys(serverFields).length > 0) {
        const serverFieldErrors: LoginFieldErrors = {};
        for (const field of ['email', 'password'] as const) {
          const serverMessage = getFieldError(err, field);
          if (serverMessage) serverFieldErrors[field] = serverMessage;
        }
        setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
        focusFirstInvalidField(serverFieldErrors);
        if (Object.keys(serverFieldErrors).length > 0) {
          setError('');
        } else {
          setError(getLoginErrorMessage(err));
        }
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isAuthenticating && (
        <SghAnimatedLoader
          fullScreen={true}
          durationMs={2000}
          textSequence="Saudi German Health"
          subtitle="Authenticating & Loading Recruitment Workspace..."
          isDark={isDark}
        />
      )}
      <ClickSpark
        className="rf-login-click-spark"
        sparkColor="var(--color-action)"
        sparkRadius={24}
        sparkCount={10}
        duration={450}
      >
        <main className="relative isolate min-h-screen overflow-hidden bg-rf-canvas">
        <AtmosphericBackground className="z-0" variant="auth" />
        <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
          <ThinkingDots dotSize={1.4} spacing={32} speed={0.0015} isDark={isDark} />
        </div>

      <ThemeToggle
        className="fixed right-4 top-4 z-30 sm:right-6 sm:top-6"
        showLabel
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-4 py-5 sm:px-6 lg:px-8">
        <BorderGlow 
          animated 
          borderRadius={16}
          className="mx-auto w-full max-w-[1180px] rounded-2xl border border-rf-border-subtle shadow-[var(--shadow-float)] backdrop-blur-xl lg:min-h-[640px]"
          backgroundColor="var(--color-surface)"
        >
          <section className="flex-1 grid h-full w-full overflow-hidden rounded-2xl lg:grid-cols-[1.05fr_0.95fr]">
            {/* Brand / product story */}
            <div className="relative hidden overflow-hidden border-r border-rf-border-subtle bg-rf-action-soft/45 p-8 lg:flex lg:flex-col lg:justify-between xl:p-10 h-full">
              <div
                className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-rf-info/10 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-rf-action/10 blur-3xl"
                aria-hidden="true"
              />

              <div className="relative">
                <div className="flex items-center gap-3.5">
                  <SghAnimatedLogo size={52} showText={false} />
                  <div className="h-9 w-px bg-rf-border-subtle" aria-hidden="true" />
                  <div>
                    <p className="m-0 font-rf-heading text-[16px] font-extrabold tracking-[-0.02em] text-rf-ink">
                      RecruitFlow
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rf-action">
                      Saudi German Health
                    </p>
                  </div>
                </div>

                <div className="mt-12 max-w-[500px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-rf-action/15 bg-rf-surface/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-rf-action shadow-sm">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-rf-success"
                      aria-hidden="true"
                    />
                    Built for focused hiring teams
                  </div>

                  <h2 className="mt-4 max-w-[500px] font-rf-heading text-[36px] font-extrabold leading-[1.08] tracking-[-0.04em] text-rf-ink xl:text-[40px]">
                    Move hiring forward with less operational noise.
                  </h2>

                  <p className="mt-4 max-w-[500px] text-[14px] leading-6 text-rf-ink-muted">
                    One secure workspace for recruiters, hiring managers,
                    interviewers, and leadership to stay aligned from candidate
                    review through final decision.
                  </p>

                  <div className="mt-7 grid gap-3">
                    {PRODUCT_POINTS.map((point, index) => (
                      <div key={point} className="flex items-start gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-rf-action/15 bg-rf-surface text-[10px] font-extrabold text-rf-action shadow-sm">
                          {index + 1}
                        </span>

                        <p className="m-0 pt-0.5 text-[13px] font-semibold leading-6 text-rf-ink">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-between border-t border-rf-action/10 pt-6">
                <p className="m-0 text-[11px] font-medium text-rf-ink-muted">
                  Secure access · Role-based workspace
                </p>

                <div className="flex -space-x-2" aria-hidden="true">
                  {['HR', 'RC', 'HM', 'QA'].map((label) => (
                    <span
                      key={label}
                      className="grid h-8 w-8 place-items-center rounded-full border-2 border-rf-surface bg-rf-surface-elevated text-[8px] font-extrabold text-rf-action shadow-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Login */}
            <div className="flex items-center justify-center p-5 sm:p-7 lg:p-9 xl:p-10 h-full bg-rf-surface/90">
              <div className="w-full max-w-[420px]">
                {/* Mobile brand */}
                <div className="mb-6 flex items-center gap-3 lg:hidden">
                  <SghLogo size="sm" variant="horizontal" showSubtitle={false} />
                  <div className="h-5 w-px bg-rf-border-subtle mx-1" aria-hidden="true" />
                  <div>
                    <p className="m-0 font-rf-heading text-[14px] font-extrabold text-rf-ink">
                      RecruitFlow
                    </p>
                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-rf-ink-muted">
                      Talent Operations
                    </p>
                  </div>
                </div>

                <header className="mb-6">
                  <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-rf-action/20 bg-rf-action-soft px-3 py-1 text-[10.5px] font-bold text-rf-action shadow-2xs">
                    <span
                      className="h-2 w-2 rounded-full bg-rf-success shadow-[0_0_0_3px_rgba(0,168,89,0.2)] animate-pulse"
                      aria-hidden="true"
                    />
                    <span>Saudi German Health • Secure Workspace</span>
                  </div>

                  <h1 className="font-rf-heading text-[28px] font-extrabold tracking-[-0.04em] text-rf-ink sm:text-[32px]">
                    Welcome back
                  </h1>

                  <p className="mt-2 max-w-[390px] text-[13px] leading-6 text-rf-ink-muted">
                    Enter your work credentials to continue to your recruiting
                    workspace.
                  </p>
                </header>

                {error && (
                  <div aria-live="polite">
                    <Alert
                      className="mb-6"
                      tone="danger"
                      title="Unable to sign in"
                    >
                      {error}
                    </Alert>
                  </div>
                )}

                <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
                  <FormField
                    error={fieldErrors.email}
                    id="login-email"
                    label="Email address"
                    required
                  >
                    <div className="relative">
                      <Icon
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted"
                        name="mail"
                        size={17}
                      />

                      <Input
                        ref={emailInputRef}
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setSelectedPersonaEmail('');
                          clearFieldError('email');
                        }}
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoFocus
                        aria-describedby={
                          fieldErrors.email ? 'login-email-message' : undefined
                        }
                        aria-invalid={Boolean(fieldErrors.email)}
                        placeholder="name@company.com"
                        className="h-12 rounded-xl bg-rf-canvas/55 pl-11 pr-4 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                      />
                    </div>
                  </FormField>

                  <FormField
                    error={fieldErrors.password}
                    id="login-password"
                    label="Password"
                    required
                  >
                    <div className="relative">
                      <Icon
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rf-ink-muted"
                        name="lock"
                        size={17}
                      />

                      <Input
                        ref={passwordInputRef}
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          clearFieldError('password');
                        }}
                        autoComplete="current-password"
                        aria-describedby={
                          fieldErrors.password
                            ? 'login-password-message'
                            : undefined
                        }
                        aria-invalid={Boolean(fieldErrors.password)}
                        placeholder="Enter your password"
                        className="h-12 rounded-xl bg-rf-canvas/55 pl-11 pr-12 text-[13px] shadow-[var(--shadow-2xs)] transition focus:bg-rf-surface"
                      />

                      <button
                        type="button"
                        className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] border border-transparent text-rf-ink-muted transition hover:border-rf-border hover:bg-rf-action-soft hover:text-rf-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action"
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        aria-pressed={showPassword}
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                      >
                        <Icon
                          name={showPassword ? 'eye-off' : 'eye'}
                          size={16}
                        />
                      </button>
                    </div>
                  </FormField>

                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-[11.5px] font-semibold text-rf-action hover:text-rf-action-strong hover:underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/30 rounded"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    className="sgh-btn-gradient mt-1 h-12 w-full rounded-xl text-[13px] font-bold shadow-[0_4px_16px_rgba(0,163,224,0.28)] transition hover:shadow-[0_8px_24px_rgba(0,163,224,0.38)] hover:-translate-y-px"
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}
                    loadingLabel="Signing in"
                    disabled={isSubmitting}
                  >
                    Sign in to RecruitFlow
                  </Button>
                </form>

                {/* Local development helpers are excluded from production builds. */}
                {import.meta.env.DEV && <details className="group mt-6 overflow-hidden rounded-xl border border-rf-border-subtle bg-rf-canvas/35">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-rf-action-soft/35 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-rf-ink">
                        Development accounts
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-rf-ink-muted">
                        Auto-fill credentials for local QA
                      </span>
                    </span>

                    <span className="shrink-0 rounded-full border border-rf-info/15 bg-rf-info-soft px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-rf-info transition group-open:border-rf-action/15 group-open:bg-rf-action-soft group-open:text-rf-action">
                      Demo
                    </span>
                  </summary>

                  <div className="border-t border-rf-border-subtle p-2">
                    <div className="grid gap-1.5">
                      {TEST_PERSONAS.map((persona) => {
                        const selected =
                          persona.email === selectedPersonaEmail;

                        return (
                          <button
                            key={persona.email}
                            type="button"
                            onClick={() => selectTestPersona(persona.email)}
                            className={[
                              'group/persona flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                              selected
                                ? 'border-rf-action/25 bg-rf-action-soft/70 shadow-sm'
                                : 'border-transparent hover:border-rf-border-subtle hover:bg-rf-surface',
                            ].join(' ')}
                            aria-pressed={selected}
                          >
                            <span
                              className={[
                                'grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-[9px] font-extrabold transition',
                                selected
                                  ? 'bg-rf-action text-rf-on-action'
                                  : 'bg-rf-surface text-rf-action shadow-sm',
                              ].join(' ')}
                            >
                              {persona.initials}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11.5px] font-bold text-rf-ink">
                                {persona.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-rf-ink-muted">
                                {persona.role}
                              </span>
                            </span>

                            <span
                              className={[
                                'shrink-0 text-[10px] font-bold transition',
                                selected
                                  ? 'text-rf-action'
                                  : 'text-rf-ink-muted group-hover/persona:text-rf-action',
                              ].join(' ')}
                            >
                              {selected ? 'Selected' : 'Use'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </details>}

                <footer className="mt-7 flex items-center justify-center gap-2 text-center text-[10.5px] text-rf-ink-muted">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-rf-success"
                    aria-hidden="true"
                  />
                  Protected by your organization&apos;s access policy
                </footer>
              </div>
            </div>
          </section>
        </BorderGlow>
      </div>
      </main>
      </ClickSpark>
    </>
  );
}
