import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { BorderGlow } from '../../components/ui/BorderGlow';
import { ThemeProvider } from '../../theme/ThemeContext';
import { LoginPage } from '../LoginPage';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../../layout/V2Shell', () => ({ V2Shell: () => null }));
vi.mock('../../v2/pages/MyWorkRoute', () => ({ MyWorkRoute: () => null }));

function renderLogin(from?: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : undefined }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Workspace home</h1>} />
          <Route path="/my-work" element={<h1>My work</h1>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function fillCredentials(email = 'sarah.ahmed@recruitflow.local', password = 'Password123!') {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
}

async function submitAndAdvance(ms = 50) {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to RecruitFlow' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('LoginPage speed', () => {
  beforeEach(() => {
    login.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates as soon as valid credentials resolve', async () => {
    login.mockResolvedValue(undefined);
    renderLogin();
    fillCredentials('  sarah.ahmed@recruitflow.local  ');
    vi.useFakeTimers();

    await submitAndAdvance(50);

    expect(screen.getByRole('heading', { name: 'Workspace home' })).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({
      email: 'sarah.ahmed@recruitflow.local',
      password: 'Password123!',
    });
  });

  it('follows a saved redirect without an artificial delay', async () => {
    login.mockResolvedValue(undefined);
    renderLogin('/my-work');
    fillCredentials();
    vi.useFakeTimers();

    await submitAndAdvance(50);

    expect(screen.getByRole('heading', { name: 'My work' })).toBeInTheDocument();
  });

  it('renders without canvas, atmosphere, backdrop blur, or pulse', () => {
    const { container } = renderLogin();

    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(container.querySelector('.rf-atmosphere')).toBeNull();
    expect(container.querySelector('.blur-3xl')).toBeNull();
    expect(container.querySelector('.sweep-active')).toBeNull();
    expect(container.innerHTML).not.toContain('backdrop-blur-xl');
    expect(container.innerHTML).not.toContain('animate-pulse');
    expect(container.innerHTML).not.toContain('hover:-translate-y-px');
  });

  it('never runs requestAnimationFrame or mounts glow pseudo-layers on BorderGlow', () => {
    const { container } = renderLogin();
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const card = container.querySelector('.border-glow-card');

    expect(card).not.toBeNull();
    expect(container.querySelector('.edge-light')).toBeNull();
    expect(container.querySelector('.sweep-active')).toBeNull();
    fireEvent.pointerMove(card as Element, { clientX: 24, clientY: 24 });
    expect(frame).not.toHaveBeenCalled();
    frame.mockRestore();
  });

  it('keeps BorderGlow static without sweep or pointer tracking even if animated prop is passed', () => {
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const { container } = render(
      <ThemeProvider>
        <BorderGlow animated>Static card</BorderGlow>
      </ThemeProvider>,
    );
    const callsAfterRender = frame.mock.calls.length;
    const card = container.querySelector('.border-glow-card');

    expect(card).not.toBeNull();
    expect(card).not.toHaveClass('sweep-active');
    expect(container.querySelector('.edge-light')).toBeNull();
    fireEvent.pointerMove(card as Element, { clientX: 12, clientY: 18 });
    expect(frame.mock.calls.length).toBe(callsAfterRender);
    frame.mockRestore();
  });

  it('focuses the first invalid field and announces the validation error', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to RecruitFlow' }));

    expect(screen.getByLabelText(/email address/i)).toHaveFocus();
    const alerts = screen.getAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('Enter your email address.');
    expect(alerts.some((alert) => alert.textContent?.includes('Enter your password.'))).toBe(true);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'sarah.ahmed@recruitflow.local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to RecruitFlow' }));

    expect(screen.getByLabelText(/^password/i)).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password.');
  });

  it('announces invalid credentials through an alert live region', async () => {
    login.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to RecruitFlow' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The email or password is incorrect.');
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('The email or password is incorrect.');
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('focuses the first field returned by the server', async () => {
    login.mockRejectedValueOnce(new ApiError(422, 'Check the form.', undefined, {
      fields: { email: ['Use your work email address.'] },
    }));
    renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to RecruitFlow' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Use your work email address.');
    expect(screen.getByLabelText(/email address/i)).toHaveFocus();
  });
});
