import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  QuickGuideProvider,
  QuickGuideModal,
  GameTourOverlay,
  useQuickGuide,
} from '../index';

describe('Gamified Autofocus Tour System', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function TestGameApp() {
    const { startGameTour, isGameTourActive } = useQuickGuide();
    return (
      <div>
        <div data-tour="candidate-card" id="test-target-1">Candidate Profile Card</div>
        <div data-tour="stage-sla-banner" id="test-target-2">Stage & SLA Status</div>
        <div data-tour="timeline-section" id="test-target-3">Audit Timeline</div>
        <button type="button" onClick={startGameTour}>
          Launch Test Game Quest
        </button>
        <span data-testid="game-active-status">{isGameTourActive ? 'ACTIVE' : 'INACTIVE'}</span>
        <QuickGuideModal />
        <GameTourOverlay />
      </div>
    );
  }

  it('starts game tour and displays quest HUD with XP and target autofocus', () => {
    render(
      <MemoryRouter initialEntries={['/applications/app-123']}>
        <QuickGuideProvider>
          <TestGameApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );

    // Initial state: inactive
    expect(screen.getByTestId('game-active-status')).toHaveTextContent('INACTIVE');
    expect(screen.queryByText(/Mission:/i)).not.toBeInTheDocument();

    // Start tour
    fireEvent.click(screen.getByText('Launch Test Game Quest'));

    // HUD should now be active
    expect(screen.getByTestId('game-active-status')).toHaveTextContent('ACTIVE');
    expect(screen.getByText(/Mission:/i)).toBeInTheDocument();
    expect(screen.getByText(/Quest Step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/\+25 XP/i)).toBeInTheDocument();
  });

  it('navigates through quest steps and completes quest with victory splash', () => {
    render(
      <MemoryRouter initialEntries={['/applications/app-123']}>
        <QuickGuideProvider>
          <TestGameApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Launch Test Game Quest'));

    // Step 1
    expect(screen.getByText(/Quest Step 1 of 4/i)).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /Next Step →/i });
    fireEvent.click(nextBtn);

    // Step 2
    expect(screen.getByText(/Quest Step 2 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next Step →/i }));

    // Step 3
    expect(screen.getByText(/Quest Step 3 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next Step →/i }));

    // Step 4 (Final step button says Complete Quest)
    expect(screen.getByText(/Quest Step 4 of 4/i)).toBeInTheDocument();
    const completeBtn = screen.getByRole('button', { name: /Complete Quest! 🏆/i });
    fireEvent.click(completeBtn);

    // Victory celebration screen
    expect(screen.getByText(/Quest Completed!/i)).toBeInTheDocument();
    expect(screen.getByText(/You have mastered the workflow/i)).toBeInTheDocument();

    // Confirm completion saved in localStorage
    expect(localStorage.getItem('rf_quest_completed_application-detail')).toBe('true');

    // Dismiss victory screen
    fireEvent.click(screen.getByRole('button', { name: /Enter Workspace & Recruit!/i }));
    expect(screen.getByTestId('game-active-status')).toHaveTextContent('INACTIVE');
  });

  it('toggles sound on and off within game tour HUD', () => {
    render(
      <MemoryRouter initialEntries={['/applications/app-123']}>
        <QuickGuideProvider>
          <TestGameApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Launch Test Game Quest'));

    const soundBtn = screen.getByRole('button', { name: /Mute Game Chimes|Unmute Game Chimes/i });
    expect(soundBtn).toBeInTheDocument();

    // Click to mute
    fireEvent.click(soundBtn);
    expect(localStorage.getItem('rf_game_sound_enabled')).toBe('false');

    // Click to unmute
    fireEvent.click(soundBtn);
    expect(localStorage.getItem('rf_game_sound_enabled')).toBe('true');
  });

  it('supports keyboard navigation (Escape to exit, Arrow keys to navigate)', () => {
    render(
      <MemoryRouter initialEntries={['/applications/app-123']}>
        <QuickGuideProvider>
          <TestGameApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Launch Test Game Quest'));
    expect(screen.getByText(/Quest Step 1 of 4/i)).toBeInTheDocument();

    // Press ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Quest Step 2 of 4/i)).toBeInTheDocument();

    // Press ArrowLeft
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Quest Step 1 of 4/i)).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('game-active-status')).toHaveTextContent('INACTIVE');
  });
});
