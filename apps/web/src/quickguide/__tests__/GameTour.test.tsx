import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  QuickGuideProvider,
  QuickGuideModal,
  GameTourOverlay,
  GuidedTourOverlay,
  useQuickGuide,
} from '../index';

describe('Clean Autofocus Spotlight Tour (famous-apps style)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function TestTourApp() {
    const { startTour, startGameTour, isTourActive, isGameTourActive } = useQuickGuide();
    const begin = startTour ?? startGameTour;
    const active = isTourActive || isGameTourActive;
    return (
      <div>
        <div data-tour="candidate-card" id="test-target-1">Candidate Profile Card</div>
        <div data-tour="stage-sla-banner" id="test-target-2">Stage & SLA Status</div>
        <div data-tour="timeline-section" id="test-target-3">Audit Timeline</div>
        <button type="button" onClick={begin}>
          Launch Guided Tour
        </button>
        <span data-testid="tour-active-status">{active ? 'ACTIVE' : 'INACTIVE'}</span>
        <QuickGuideModal />
        <GuidedTourOverlay />
      </div>
    );
  }

  function renderTour() {
    render(
      <MemoryRouter initialEntries={['/applications/app-123']}>
        <QuickGuideProvider>
          <TestTourApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );
  }

  it('starts tour and displays clean tooltip with step counter and autofocus', () => {
    renderTour();

    expect(screen.getByTestId('tour-active-status')).toHaveTextContent('INACTIVE');
    expect(screen.queryByText(/Review Candidate Vitals/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Launch Guided Tour'));

    expect(screen.getByTestId('tour-active-status')).toHaveTextContent('ACTIVE');
    // Clean step counter, no game language
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Review Candidate Vitals/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip tour/i })).toBeInTheDocument();
    // No gamification leftovers
    expect(screen.queryByText(/\+\d+ XP|Total XP Earned/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mission:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quest Step|Play Quest|Complete Quest/i)).not.toBeInTheDocument();
  });

  it('navigates through steps and finishes cleanly with Done (no victory splash)', () => {
    renderTour();
    fireEvent.click(screen.getByText('Launch Guided Tour'));

    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Tour closed, completion persisted, no victory modal
    expect(screen.getByTestId('tour-active-status')).toHaveTextContent('INACTIVE');
    expect(screen.queryByText(/Quest Completed/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('rf_tour_completed_application-detail')).toBe('true');
  });

  it('supports Back navigation and Skip', () => {
    renderTour();
    fireEvent.click(screen.getByText('Launch Guided Tour'));
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Skip tour/i }));
    expect(screen.getByTestId('tour-active-status')).toHaveTextContent('INACTIVE');
  });

  it('supports keyboard navigation (Escape to exit, Arrow keys to navigate)', () => {
    renderTour();
    fireEvent.click(screen.getByText('Launch Guided Tour'));
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('tour-active-status')).toHaveTextContent('INACTIVE');
  });

  it('legacy game aliases still start/end the same clean tour', () => {
    function LegacyApp() {
      const { startGameTour, isGameTourActive } = useQuickGuide();
      return (
        <div>
          <button type="button" onClick={startGameTour}>
            Legacy Start
          </button>
          <span data-testid="legacy-status">{isGameTourActive ? 'ACTIVE' : 'INACTIVE'}</span>
          <GameTourOverlay />
        </div>
      );
    }
    render(
      <MemoryRouter initialEntries={['/applications/app-123']}>
        <QuickGuideProvider>
          <LegacyApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Legacy Start'));
    expect(screen.getByTestId('legacy-status')).toHaveTextContent('ACTIVE');
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
  });
});
