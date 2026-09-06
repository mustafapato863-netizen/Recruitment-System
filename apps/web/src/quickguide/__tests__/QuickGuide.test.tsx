import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getPageGuideForPath,
  DEFAULT_PAGE_GUIDE,
  QuickGuideProvider,
  QuickGuideTrigger,
  QuickGuideModal,
  useQuickGuide,
} from '../index';

describe('Quick Guide Page Resolution', () => {
  it('resolves root dashboard path', () => {
    const guide = getPageGuideForPath('/');
    expect(guide.id).toBe('dashboard');
    expect(guide.title).toContain('Recruitment Ops Hub');
  });

  it('resolves vacancies list and detail paths', () => {
    const listGuide = getPageGuideForPath('/vacancies');
    expect(listGuide.id).toBe('vacancies');

    const detailGuide = getPageGuideForPath('/vacancies/vac-cardiology-01');
    expect(detailGuide.id).toBe('vacancy-detail');
  });

  it('resolves CV intake studio path', () => {
    const guide = getPageGuideForPath('/cv-intake');
    expect(guide.id).toBe('cv-intake');
    expect(guide.hardPartCaution.title).toContain('Prevent Blind Profile Merging');
  });

  it('resolves applications and application 360 detail paths', () => {
    const appList = getPageGuideForPath('/applications');
    expect(appList.id).toBe('applications');

    const appDetail = getPageGuideForPath('/applications/app-789');
    expect(appDetail.id).toBe('application-detail');
    expect(appDetail.hardPartCaution.title).toContain('AI Match vs. Regulatory Reality');
  });

  it('resolves Saudi offer creation path', () => {
    const guide = getPageGuideForPath('/offers/create');
    expect(guide.id).toBe('create-offer');
    expect(guide.hardPartCaution.title).toContain('Saudi Salary Breakdown Math');
  });

  it('resolves candidate comparison matrix path', () => {
    const guide = getPageGuideForPath('/candidates/compare');
    expect(guide.id).toBe('candidate-comparison');
    expect(guide.hardPartCaution.title).toContain('Scorecard Trumps Algorithm');
  });

  it('resolves clinical hiring and credentialing path', () => {
    const guide = getPageGuideForPath('/hires/case-999');
    expect(guide.id).toBe('hiring-case');
    expect(guide.hardPartCaution.title).toContain('Never Confirm Joining Prematurely');
  });

  it('falls back gracefully on unknown routes', () => {
    const fallback = getPageGuideForPath('/some/unknown/legacy/path');
    expect(fallback.id).toBe(DEFAULT_PAGE_GUIDE.id);
  });
});

describe('QuickGuideTrigger Component', () => {
  it('renders safely outside provider using safe fallback', () => {
    render(<QuickGuideTrigger />);
    const btn = screen.getByRole('button', { name: /open page guide/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText('Page guide')).toBeInTheDocument();
  });

  it('renders with "New" badge when page is unseen', () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={['/cv-intake']}>
        <QuickGuideProvider>
          <QuickGuideTrigger />
        </QuickGuideProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Page guide')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

describe('QuickGuideModal Component & User Interaction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens on button click and allows navigating tabs', () => {
    function TestApp() {
      const { openGuide } = useQuickGuide();
      return (
        <div>
          <button type="button" onClick={openGuide}>
            Launch Manual Guide
          </button>
          <QuickGuideModal />
        </div>
      );
    }

    render(
      <MemoryRouter initialEntries={['/offers/create']}>
        <QuickGuideProvider>
          <TestApp />
        </QuickGuideProvider>
      </MemoryRouter>
    );

    // Click launch button
    fireEvent.click(screen.getByText('Launch Manual Guide'));

    // Modal should be visible with offer title
    expect(screen.getByText('Saudi Compensation & Offer Builder')).toBeInTheDocument();
    expect(screen.getByText('Offer & Compensation')).toBeInTheDocument();

    // Check Overview tab content
    expect(screen.getByText(/why this page exists/i)).toBeInTheDocument();

    // Click on 3-Step Workflow tab
    fireEvent.click(screen.getByRole('tab', { name: /3-step workflow/i }));
    expect(screen.getByText('Structure the Saudi Package (SAR)')).toBeInTheDocument();

    // Click on Golden Rules tab
    fireEvent.click(screen.getByRole('tab', { name: /golden rules/i }));
    expect(screen.getByText(/saudi salary breakdown math/i)).toBeInTheDocument();

    // Click "Got It, Let’s Start!"
    const dismissBtn = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(dismissBtn);

    // Modal should be closed and saved in localStorage
    expect(screen.queryByText('Saudi Compensation & Offer Builder')).not.toBeInTheDocument();
    expect(localStorage.getItem('rf_seen_guide_create-offer')).toBe('true');
  });
});
