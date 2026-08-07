import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import '../styles/auth.css';

type LoginField = 'email' | 'password';
type LoginFieldErrors = Partial<Record<LoginField, string>>;

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
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
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
    if (nextErrors.email) {
      emailInputRef.current?.focus();
    } else if (nextErrors.password) {
      passwordInputRef.current?.focus();
    }

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/');
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">R</span>
          <div>
            <strong>RecruitFlow</strong>
            <span>Recruitment operations</span>
          </div>
        </div>

        {error && <div className="alert error-alert auth-error" role="alert">{error}</div>}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">Email address</label>
            <input
              ref={emailInputRef}
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }}
              autoComplete="email"
              autoFocus
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              placeholder="name@company.com"
            />
            {fieldErrors.email && <p className="field-error" id="login-email-error" role="alert">{fieldErrors.email}</p>}
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <input
              ref={passwordInputRef}
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }}
              autoComplete="current-password"
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password && <p className="field-error" id="login-password-error" role="alert">{fieldErrors.password}</p>}
          </div>

          <button type="submit" className="auth-button" aria-busy={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
